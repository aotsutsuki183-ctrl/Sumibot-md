import yts from 'yt-search'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { getBuffer } from '#serialize'

const YT = 'https://www.youtube.com'
const CNV = 'https://cnv.cx/v2'
const FRAME = 'https://frame.y2meta-uk.com'
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'
const FALLBACK = { key: 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8', version: '2.20261002.10.00' }

const cnv = axios.create({
  timeout: 30000,
  headers: { 'User-Agent': UA, Referer: FRAME + '/', Origin: FRAME }
})

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

async function getDownloadUrl(videoId, isAudio) {
  try {
    const key = await getKey(videoId)
    const url = isAudio 
      ? await convert(key, videoId, 'mp3', 720, 128).catch(() => null)
      : await convert(key, videoId, 'mp4', 360, 128).catch(() => null)
    if (url) return url
  } catch {}

  // Respaldo secundario con tus global.APIs si el conversor principal falla
  try {
    const apiEndpoint = isAudio 
      ? `${global.APIs?.evogb?.url}/dl/ytmp3?url=https://youtu.be/${videoId}&key=${global.APIs?.evogb?.key}`
      : `${global.APIs?.evogb?.url}/dl/ytmp4?url=https://youtu.be/${videoId}&key=${global.APIs?.evogb?.key}`
    const res = await fetch(apiEndpoint).then(r => r.json())
    return res?.status && res?.data?.dl ? res.data.dl : null
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

async function getYtLink(text) {
  try {
    const id = extractVideoId(text)
    if (id) {
      const r = await yts({ videoId: id }).catch(() => null)
      if (r) return { videoId: id, title: r.title, channel: r.author?.name || 'Desconocido', timestamp: r.timestamp, views: r.views, image: r.image, url: r.url }
    }
    const r = await yts(text)
    const v = r?.videos?.[0]
    if (!v) return null
    return { videoId: v.videoId, title: v.title, channel: v.author?.name || 'Desconocido', timestamp: v.timestamp, views: v.views, image: v.image, url: v.url }
  } catch {
    return null
  }
}

function formatViews(n) { if (!n) return 'Desconocido'; return Number(n).toLocaleString('es-ES') }

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

      const videoInfo = await getYtLink(q)
      if (!videoInfo) {
        return sock.sendMessage(chatId, { 
          text: '*(Lo siento mucho...)* \n> No pude encontrar nada con ese nombre... ¿Podrías intentarlo de nuevo? 🥺' 
        }, options)
      }

      const infoMessage = `🌸 *¡Lo encontré!* (Ayudo con mucho gusto)\n\n` +
        `> 🎧 *Título* › *${videoInfo.title}*\n` +
        `> ❖ *Canal* › ${videoInfo.channel}\n` +
        `> ⴵ *Duración* › ${videoInfo.timestamp || 'Desconocido'}\n` +
        `> ✿ *Vistas* › ${formatViews(videoInfo.views)}\n` +
        `> ❒ *Enlace* › ${videoInfo.url}\n\n` +
        `*(Por favor, presiona un botoncito o respóndeme con "mp3" o "mp4" aquí abajito)* ✨`

      const buttons = [
        { buttonId: `ytaudio|${videoInfo.videoId}`, buttonText: { displayText: '🎧 MP3 (Audio)' }, type: 1 },
        { buttonId: `ytvideo|${videoInfo.videoId}`, buttonText: { displayText: '🎥 MP4 (Video)' }, type: 1 }
      ]

      let sent
      try { 
        const buf = await getBuffer(videoInfo.image)
        sent = await sock.sendMessage(chatId, { image: buf, caption: infoMessage, buttons, footer: `Sumi Sakurasawa • Assistant` }, options) 
      } catch { 
        sent = await sock.sendMessage(chatId, { text: infoMessage, buttons, footer: `Sumi Sakurasawa • Assistant` }, options) 
      }

      const sentId = sent.key.id
      const collector = async (upsert) => {
        const m = upsert.messages?.[0]
        if (!m || m.key.remoteJid !== chatId) return

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

        sock.ev.off('messages.upsert', collector)
        await sock.sendMessage(chatId, { react: { text: '⏳', key: m.key } })

        const isAudio = type === 'ytaudio'
        const dlUrl = await getDownloadUrl(vId, isAudio)

        if (!dlUrl) {
          return sock.sendMessage(chatId, { text: '*(Lo siento...) No pude procesar el archivo... Gomenasai!* 🥺' }, { quoted: m })
        }

        const safeName = videoInfo.title.replace(/[\\/:*?"<>|]/g, '').slice(0, 80).trim() || 'media'

        if (isAudio) {
          await sock.sendMessage(chatId, { audio: { url: dlUrl }, mimetype: 'audio/mpeg', fileName: `${safeName}.mp3` }, { quoted: m })
        } else {
          await sock.sendMessage(chatId, { video: { url: dlUrl }, mimetype: 'video/mp4', fileName: `${safeName}.mp4`, caption: `🌸 *¡Aquí tienes tu video, con mucho cariño!* (๑>◡<๑)` }, { quoted: m })
        }

        await sock.sendMessage(chatId, { react: { text: '🌸', key: m.key } })
      }

      sock.ev.on('messages.upsert', collector)

    } catch (e) { 
      await sock.sendMessage(msg.chat, { text: `*(A-ayuda...)* Ocurrió un error inesperado: ${e.message} (T_T)` }, { quoted: msg }) 
    }
  }
    }
                                 
