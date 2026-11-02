import axios from 'axios'
import yts from 'yt-search'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import { getBuffer } from '#serialize'

const execAsync = promisify(exec)
const tmpDir = './tmp'
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
const TIMEOUT_MS = 10 * 60 * 1000
const MAX_DURATION_MIN = 35
const MAX_DURATION_SEC = MAX_DURATION_MIN * 60

// --- APIS Y SCRAPER DE YOUTUBE (Basado en ytdl.js y ytsearch.js) ---
const YT = 'https://www.youtube.com'
const CNV = 'https://cnv.cx/v2'
const FRAME = 'https://frame.y2meta-uk.com'
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'
const FALLBACK = { key: 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8', version: '2.20261002.10.00' }

const yt = axios.create({
  timeout: 30000,
  headers: { 'User-Agent': UA, 'Content-Type': 'application/json', Origin: YT, Referer: YT + '/' }
})

const cnv = axios.create({
  timeout: 30000,
  headers: { 'User-Agent': UA, Referer: FRAME + '/', Origin: FRAME }
})

async function getConfig() {
  try {
    const res = await axios.get(YT + '/?hl=en', {
      timeout: 10000,
      headers: { 'User-Agent': UA, Cookie: 'CONSENT=YES+1; SOCS=CAI' }
    })
    const html = String(res.data)
    const key = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)
    const version = html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)
    return { key: key ? key[1] : FALLBACK.key, version: version ? version[1] : FALLBACK.version }
  } catch {
    return FALLBACK
  }
}

const txt = (o) => (o ? o.simpleText || (o.runs ? o.runs.map((r) => r.text).join('') : null) : null) || null

function collect(node, out) {
  if (Array.isArray(node)) {
    for (const n of node) collect(n, out)
    return
  }
  if (!node || typeof node !== 'object') return
  if (node.videoRenderer) out.push(node.videoRenderer)
  for (const k in node) {
    if (k !== 'videoRenderer') collect(node[k], out)
  }
}

async function scraperSearch(query) {
  const cfg = await getConfig()
  const res = await yt.post(
    `${YT}/youtubei/v1/search?key=${cfg.key}&prettyPrint=false`,
    {
      context: { client: { clientName: 'WEB', clientVersion: cfg.version, hl: 'es', gl: 'CO' } },
      query,
      params: 'EgIQAQ=='
    },
    { headers: { 'X-Youtube-Client-Name': '1', 'X-Youtube-Client-Version': cfg.version } }
  )
  const found = []
  collect(res.data, found)
  const v = found.find((x) => x.videoId)
  if (!v) return null
  return {
    videoId: v.videoId,
    title: txt(v.title) || 'Sin título',
    channel: txt(v.ownerText) || 'Desconocido',
    duration: txt(v.lengthText) || '0:00',
    seconds: parseDurationToSec(txt(v.lengthText)),
    views: txt(v.viewCountText) || '0',
    thumbnail: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${v.videoId}`
  }
}

async function getYtLink(text) {
  try {
    const id = extractVideoId(text)
    if (id) {
      const res = await axios.get(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`).catch(() => null)
      const r2 = await yts({ videoId: id }).catch(() => null)
      return {
        videoId: id,
        title: res?.data?.title || r2?.title || 'Sin título',
        channel: res?.data?.author_name || r2?.author?.name || 'Desconocido',
        duration: r2?.timestamp || '0:00',
        seconds: r2?.seconds || 0,
        views: r2?.views || 0,
        thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${id}`
      }
    }
    const scraped = await scraperSearch(text)
    if (scraped) return scraped
    const r = await yts(text)
    const v = r?.videos?.[0]
    if (!v) return null
    return {
      videoId: v.videoId,
      title: v.title,
      channel: v.author?.name || 'Desconocido',
      duration: v.timestamp,
      seconds: v.seconds,
      views: v.views,
      thumbnail: v.image,
      url: v.url
    }
  } catch {
    return null
  }
}

function extractVideoId(input) {
  const s = String(input).trim()
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s
  const m = s.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

async function getKey(videoId) {
  const res = await cnv.get(`${CNV}/sanity/key?id=${videoId}`)
  return res.data.key
}

async function convert(key, videoId, format, videoQuality, audioBitrate) {
  const res = await cnv.post(
    `${CNV}/converter`,
    new URLSearchParams({
      link: `https://youtu.be/${videoId}`,
      format,
      audioBitrate: String(audioBitrate),
      videoQuality: String(videoQuality),
      filenameStyle: 'pretty',
      vCodec: 'h264'
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded', accept: '*/*', key } }
  )
  return (res.data && res.data.url) || null
}

async function getYTMP3(videoId) {
  try {
    const key = await getKey(videoId)
    const url = await convert(key, videoId, 'mp3', 720, 128)
    return url ? { dl: url } : null
  } catch {
    return null
  }
}

async function getYTMP4(videoId) {
  try {
    const key = await getKey(videoId)
    const url = await convert(key, videoId, 'mp4', 360, 128)
    return url ? { dl: url } : null
  } catch {
    return null
  }
}

async function downloadFile(url, dest) {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`Download ${res.status}`)
  const fileStream = fs.createWriteStream(dest)
  if (typeof res.body.pipe === 'function') await pipeline(res.body, fileStream)
  else await pipeline(Readable.fromWeb(res.body), fileStream)
}

const isYtUrl = (t) => /(youtube\.com|youtu\.be|music\.youtube\.com)/i.test(t)

function parseDurationToSec(d) {
  if (!d) return 0
  if (typeof d === 'number') return d
  if (!isNaN(d)) return Number(d)
  const parts = String(d).split(':').map(Number)
  if (parts.length === 3) return parts[0]*3600 + parts[1]*60 + parts[2]
  if (parts.length === 2) return parts[0]*60 + parts[1]
  return 0
}

function formatViews(n) { if (!n) return 'Desconocido'; return Number(n).toLocaleString('es-ES') }
function formatBytes(b = 0) { if (!b) return 'Desconocido'; const u = ['B','KB','MB','GB']; let i = 0; let s = Number(b); while (s >= 1024 && i < u.length - 1) { s /= 1024; i++ } return `${s.toFixed(i === 0? 0 : 2)} ${u[i]}` }

export default {
  command: ['play','mp3','playaudio','ytaudio','ytmp3','mp4','ytmp4'],
  category: 'downloader',
  run: async ({ sock, msg, text, usedPrefix, command }) => {
    try {
      const isChannel = msg.chat.endsWith('@newsletter')
      const options = isChannel ? undefined : { quoted: msg }
      const chatId = msg.chat
      const q = text?.trim()

      if (!q) {
        return sock.sendMessage(chatId, { 
          text: '*(E-etto...)* \n> Disculpa... ¿p-podrías decirme el nombre o enlace de lo que deseas buscar? (｡>﹏<｡)' 
        }, options)
      }

      await sock.sendMessage(chatId, { react: { text: '🌸', key: msg.key } })
      
      const timeoutMessage = `*(Oh...)* \n> El tiempo se agotó y no seleccionaste nada...\n> Si necesitas algo más, vuelve a usar *${usedPrefix}${command}* con cuidadito, ¿sí? (._.)`

      const videoInfo = await getYtLink(q)
      if (!videoInfo) {
        return sock.sendMessage(chatId, { 
          text: '*(Lo siento mucho...)* \n> No pude encontrar nada con ese nombre... ¿Podrías intentarlo de nuevo? 🥺' 
        }, options)
      }

      const durationSec = videoInfo.seconds || parseDurationToSec(videoInfo.duration)
      if (durationSec > MAX_DURATION_SEC) {
        return sock.sendMessage(chatId, { 
          text: `*(U-um...)* \n> El video dura *${videoInfo.timestamp || videoInfo.duration}* y es muy largo para mí... El límite es de *${MAX_DURATION_MIN} minutos*. Gomenasai! 💦` 
        }, options)
      }

      const finalUrl = videoInfo.url
      const canal = videoInfo.channel || 'Desconocido'
      const vistas = formatViews(videoInfo.views)

      const infoMessage = `🌸 *¡Lo encontré!* (Ayudo con mucho gusto)\n\n` +
        `> 🎧 *Título* › *${videoInfo.title}*\n` +
        `> ❖ *Canal* › ${canal}\n` +
        `> ⴵ *Duración* › ${videoInfo.duration || 'Desconocido'}\n` +
        `> ✿ *Vistas* › ${vistas}\n` +
        `> ❒ *Enlace* › ${finalUrl}\n\n` +
        `*(Por favor, presiona un botoncito o respóndeme con "mp3" o "mp4" aquí abajito)* ✨`

      const buttons = [
        { buttonId: `ytaudio|${videoInfo.videoId}`, buttonText: { displayText: '🎧 MP3 (Audio)' }, type: 1 },
        { buttonId: `ytvideo|${videoInfo.videoId}`, buttonText: { displayText: '🎥 MP4 (Video)' }, type: 1 }
      ]

      let sent
      try { 
        const buf = await getBuffer(videoInfo.thumbnail)
        sent = await sock.sendMessage(chatId, { image: buf, caption: infoMessage, buttons, footer: `Sumi Sakurasawa • Assistant` }, options) 
      } catch { 
        sent = await sock.sendMessage(chatId, { text: infoMessage, buttons, footer: `Sumi Sakurasawa • Assistant` }, options) 
      }

      let uses = 0
      const maxUses = 2
      const sentId = sent.key.id
      const usedTypes = new Set()
      const processingTypes = new Set()
      const processedIds = new Set()

      const collector = async (upsert) => {
        const m = upsert.messages?.[0]
        if (!m || m.key.remoteJid !== chatId) return
        if (processedIds.has(m.key.id)) return

        const btnId = m.message?.buttonsResponseMessage?.selectedButtonId || m.message?.templateButtonReplyMessage?.selectedId || ''
        const raw = (m.message?.conversation || m.message?.extendedTextMessage?.text || '').toLowerCase().trim()
        
        let type, vId
        if (btnId) { 
          const p = btnId.split('|')
          type = p[0]
          vId = p[1]
        } else { 
          const ctx = m.message?.extendedTextMessage?.contextInfo
          if (ctx?.stanzaId !== sentId) return
          if (['mp3','audio','ytaudio'].includes(raw)) type = 'ytaudio'
          else if (['mp4','video','ytvideo'].includes(raw)) type = 'ytvideo'
          else return
          vId = videoInfo.videoId
        }

        if (usedTypes.has(type) || processingTypes.has(type)) return
        if (uses >= maxUses) return

        processedIds.add(m.key.id)
        processingTypes.add(type)

        try {
          uses++
          if (uses >= maxUses) { 
            clearTimeout(timer)
            sock.ev.off('messages.upsert', collector) 
          }

          await sock.sendMessage(chatId, { react: { text: '⏳', key: m.key } })

          if (type === 'ytvideo') {
            const data = await getYTMP4(vId)
            if (!data?.dl) { 
              processingTypes.delete(type)
              return sock.sendMessage(chatId, { text: '*(E-etto...) No pude preparar el video MP4... Perónteme.* 💧' }, { quoted: m }) 
            }

            let input = path.join(tmpDir, `in_${Date.now()}.mp4`)
            let output = path.join(tmpDir, `out_${Date.now()}.mp4`)

            try {
              await downloadFile(data.dl, input)
              try { 
                await execAsync(`ffmpeg -y -i "${input}" -c:v libx264 -preset veryfast -crf 28 -c:a aac -b:a 96k -movflags +faststart "${output}"`) 
              } catch { 
                fs.copyFileSync(input, output) 
              }

              const finalSize = fs.existsSync(output) ? fs.statSync(output).size : 0
              const caption = `🌸 *¡Aquí tienes tu video, con mucho cariño!* (๑>◡<๑)\n\n> ❒ *Tamaño* › *${formatBytes(finalSize)}*`
              
              await sock.sendMessage(chatId, { video: { url: output }, mimetype: 'video/mp4', fileName: `${videoInfo.title}.mp4`, caption }, { quoted: m })
              usedTypes.add(type)
            } catch (e) { 
              await sock.sendMessage(chatId, { text: `> Ups... Ocurrió un error con el video: ${e.message}` }, { quoted: m }) 
            } finally { 
              try { if (fs.existsSync(input)) fs.unlinkSync(input) } catch {}
              try { if (fs.existsSync(output)) fs.unlinkSync(output) } catch {}
              processingTypes.delete(type)
            }
          } else {
            const data = await getYTMP3(vId)
            if (!data?.dl) { 
              processingTypes.delete(type)
              return sock.sendMessage(chatId, { text: '*(Lo siento...) No pude descargar el audio MP3...* 🥺' }, { quoted: m }) 
            }

            await sock.sendMessage(chatId, { audio: { url: data.dl }, mimetype: 'audio/mpeg', fileName: `${videoInfo.title}.mp3` }, { quoted: m })
            usedTypes.add(type)
            processingTypes.delete(type)
          }

          await sock.sendMessage(chatId, { react: { text: '🌸', key: m.key } })
        } catch { 
          processingTypes.delete(type) 
        }
      }

      sock.ev.on('messages.upsert', collector)
      const timer = setTimeout(async () => { 
        try { sock.ev.off('messages.upsert', collector) } catch {}
        if (uses === 0) await sock.sendMessage(chatId, { text: timeoutMessage }, options) 
      }, TIMEOUT_MS)

      await sock.sendMessage(chatId, { react: { text: '🌸', key: msg.key } })

    } catch (e) { 
      await sock.sendMessage(msg.chat, { text: `*(A-ayuda...)* Ocurrió un error inesperado: ${e.message} (T_T)` }, { quoted: msg }) 
    }
  }
}
