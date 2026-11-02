import yts from 'yt-search'
import fs from 'fs'
import path from 'path'
import { getBuffer } from '#serialize'
import fetch from 'node-fetch'

const tmpDir = './tmp'
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
const TIMEOUT_MS = 10 * 60 * 1000
const MAX_DURATION_MIN = 35
const MAX_DURATION_SEC = MAX_DURATION_MIN * 60

function extractVideoId(input) {
  const s = String(input).trim()
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s
  const m = s.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

async function getYtLink(text) {
  try {
    const id = extractVideoId(text)
    if (id) {
      const r = await yts({ videoId: id }).catch(() => null)
      if (r) return { videoId: id, title: r.title, channel: r.author?.name || 'Desconocido', timestamp: r.timestamp, seconds: r.seconds, views: r.views, image: r.image, url: r.url }
    }
    const r = await yts(text)
    const v = r?.videos?.[0]
    if (!v) return null
    return { videoId: v.videoId, title: v.title, channel: v.author?.name || 'Desconocido', timestamp: v.timestamp, seconds: v.seconds, views: v.views, image: v.image, url: v.url }
  } catch {
    return null
  }
}

// Funciones de descarga usando las APIs globales de settings.js y respaldos
async function getYTMP3(url) {
  const apis = [
    async () => {
      const res = await fetch(`${global.APIs?.evogb?.url}/dl/ytmp3?url=${encodeURIComponent(url)}&key=${global.APIs?.evogb?.key}`).then(r => r.json())
      return res?.status && res?.data?.dl ? res.data.dl : null
    },
    async () => {
      const res = await fetch(`${global.APIs?.vreden?.url}/api/ytmp3?url=${encodeURIComponent(url)}`).then(r => r.json())
      return res?.status && res?.result?.download?.url ? res.result.download.url : null
    },
    async () => {
      const res = await fetch(`${global.APIs?.yuki?.url}/dl/ytmp3?url=${encodeURIComponent(url)}&apikey=${global.APIs?.yuki.key}`).then(r => r.json())
      return res?.status && res?.result ? res.result : null
    }
  ]

  for (const api of apis) {
    try {
      const link = await api()
      if (link) return link
    } catch {}
  }
  return null
}

async function getYTMP4(url) {
  const apis = [
    async () => {
      const res = await fetch(`${global.APIs?.evogb?.url}/dl/ytmp4?url=${encodeURIComponent(url)}&key=${global.APIs?.evogb?.key}`).then(r => r.json())
      return res?.status && res?.data?.dl ? res.data.dl : null
    },
    async () => {
      const res = await fetch(`${global.APIs?.vreden?.url}/api/ytmp4?url=${encodeURIComponent(url)}`).then(r => r.json())
      return res?.status && res?.result?.download?.url ? res.result.download.url : null
    }
  ]

  for (const api of apis) {
    try {
      const link = await api()
      if (link) return link
    } catch {}
  }
  return null
}

const parseDurationToSec = (d) => {
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

      const durationSec = videoInfo.seconds || parseDurationToSec(videoInfo.timestamp)
      if (durationSec > MAX_DURATION_SEC) {
        return sock.sendMessage(chatId, { 
          text: `*(U-um...)* \n> El video dura *${videoInfo.timestamp}* y es muy largo para mí... El límite es de *${MAX_DURATION_MIN} minutos*. Gomenasai! 💦` 
        }, options)
      }

      const finalUrl = videoInfo.url
      const canal = videoInfo.channel || 'Desconocido'
      const vistas = formatViews(videoInfo.views)

      const infoMessage = `🌸 *¡Lo encontré!* (Ayudo con mucho gusto)\n\n` +
        `> 🎧 *Título* › *${videoInfo.title}*\n` +
        `> ❖ *Canal* › ${canal}\n` +
        `> ⴵ *Duración* › ${videoInfo.timestamp || 'Desconocido'}\n` +
        `> ✿ *Vistas* › ${vistas}\n` +
        `> ❒ *Enlace* › ${finalUrl}\n\n` +
        `*(Por favor, presiona un botoncito o respóndeme con "mp3" o "mp4" aquí abajito)* ✨`

      const buttons = [
        { buttonId: `ytaudio|${finalUrl}`, buttonText: { displayText: '🎧 MP3 (Audio)' }, type: 1 },
        { buttonId: `ytvideo|${finalUrl}`, buttonText: { displayText: '🎥 MP4 (Video)' }, type: 1 }
      ]

      let sent
      try { 
        const buf = await getBuffer(videoInfo.image)
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
        
        let type, targetUrl
        if (btnId) { 
          const p = btnId.split('|')
          type = p[0]
          targetUrl = p[1]
        } else { 
          const ctx = m.message?.extendedTextMessage?.contextInfo
          if (ctx?.stanzaId !== sentId) return
          if (['mp3','audio','ytaudio'].includes(raw)) type = 'ytaudio'
          else if (['mp4','video','ytvideo'].includes(raw)) type = 'ytvideo'
          else return
          targetUrl = finalUrl
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

          const safeName = videoInfo.title.replace(/[\\/:*?"<>|]/g, '').slice(0, 80).trim() || 'media'

          if (type === 'ytvideo') {
            const dlUrl = await getYTMP4(targetUrl)
            if (!dlUrl) { 
              processingTypes.delete(type)
              return sock.sendMessage(chatId, { text: '*(E-etto...) No pude preparar el video MP4 con ninguna API... Perónteme.* 💧' }, { quoted: m }) 
            }

            await sock.sendMessage(chatId, { video: { url: dlUrl }, mimetype: 'video/mp4', fileName: `${safeName}.mp4`, caption: `🌸 *¡Aquí tienes tu video, con mucho cariño!* (๑>◡<๑)` }, { quoted: m })
            usedTypes.add(type)
          } else {
            const dlUrl = await getYTMP3(targetUrl)
            if (!dlUrl) { 
              processingTypes.delete(type)
              return sock.sendMessage(chatId, { text: '*(Lo siento...) No pude descargar el audio MP3 con las APIs...* 🥺' }, { quoted: m }) 
            }

            await sock.sendMessage(chatId, { audio: { url: dlUrl }, mimetype: 'audio/mpeg', fileName: `${safeName}.mp3` }, { quoted: m })
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
