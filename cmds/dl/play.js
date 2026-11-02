import fetch from 'node-fetch'
import yts from 'yt-search'
import { getBuffer } from '#serialize'

async function getVideoInfo(query, videoMatch, text) {
  if (videoMatch && videoMatch[1]) {
    const vidId = videoMatch[1]
    return {
      videoId: vidId,
      url: `https://www.youtube.com/watch?v=${vidId}`,
      title: 'Audio de YouTube',
      image: `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`,
      timestamp: 'Desconocido',
      views: 0,
      ago: 'Desconocido',
      author: { name: 'Desconocido' }
    }
  }

  try {
    const evoUrl = global.APIs?.evogb?.url || 'https://api.evogb.org'
    const evoKey = global.APIs?.evogb?.key || 'Apex-Predator2010'
    const endpoint = `${evoUrl}/search/yt?query=${encodeURIComponent(text)}&key=${encodeURIComponent(evoKey)}`
    const res = await fetch(endpoint).then(r => r.json())
    if (res?.status && Array.isArray(res.result) && res.result.length) {
      const v = res.result[0]
      return {
        videoId: v.url?.match(/([a-zA-Z0-9_-]{11})/)?.[1] || '',
        url: v.url,
        title: v.title || 'Audio de YouTube',
        image: v.banner || v.thumbnail || `https://i.ytimg.com/vi/${v.url?.match(/([a-zA-Z0-9_-]{11})/)?.[1]}/hqdefault.jpg`,
        timestamp: v.duration || 'Desconocido',
        views: v.views || 0,
        ago: 'Desconocido',
        author: { name: v.autor || v.author || 'Desconocido' }
      }
    }
  } catch (e) {}

  try {
    const res = await yts(query)
    const video = res?.videos?.[0]
    if (video) {
      return {
        videoId: video.videoId,
        url: video.url,
        title: video.title,
        image: video.thumbnail,
        timestamp: video.timestamp,
        views: video.views,
        ago: video.ago,
        author: { name: video.author?.name || 'Desconocido' }
      }
    }
  } catch (e) {}

  const searchApis = [
    `https://api.siputzx.my.id/api/s/ytsearch?q=${encodeURIComponent(text)}`,
    `https://delirius-api-oficial.vercel.app/search/ytsearch?q=${encodeURIComponent(text)}`,
    `https://api.vreden.my.id/api/ytsearch?q=${encodeURIComponent(text)}`
  ]

  for (const endpoint of searchApis) {
    try {
      const res = await fetch(endpoint).then(r => r.json())
      const items = res?.data || res?.result || res?.results || []
      if (Array.isArray(items) && items.length > 0) {
        const item = items[0]
        const vidId = item.videoId || item.id || item.url?.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/))([a-zA-Z0-9_-]{11})/)?.[1]
        if (vidId) {
          return {
            videoId: vidId,
            url: `https://www.youtube.com/watch?v=${vidId}`,
            title: item.title || item.name || 'Audio de YouTube',
            image: item.thumbnail || item.image || item.thumb || `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`,
            timestamp: item.timestamp || item.duration || 'Desconocido',
            views: item.views || 0,
            ago: item.ago || item.published || 'Desconocido',
            author: { name: item.author?.name || item.channel || 'Desconocido' }
          }
        }
      }
    } catch (e) {}
  }

  return null
}

export default {
  command: ['play', 'mp3', 'ytmp3', 'ytaudio', 'playaudio'],
  category: 'downloader',
  run: async ({ sock, msg, args, usedPrefix, command }) => {
    try {
      const isChannel = msg.chat.endsWith('@newsletter')
      const options = isChannel ? undefined : { quoted: msg }

      if (!args || !args[0]) {
        return sock.sendMessage(msg.chat, { 
          text: '*(E-etto...)* \n> Disculpa... ¿p-podrías decirme el nombre o enlace de lo que deseas buscar? (｡>﹏<｡)' 
        }, options)
      }

      const text = args.join(' ')
      const videoMatch = text.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/))([a-zA-Z0-9_-]{11})/)
      const query = videoMatch ? 'https://youtu.be/' + videoMatch[1] : text

      let videoInfo = null
      try {
        videoInfo = await getVideoInfo(query, videoMatch, text)
      } catch (err) {}

      if (!videoInfo || !videoInfo.url) {
        return sock.sendMessage(msg.chat, { 
          text: '*(Lo siento mucho...)* \n> No pude encontrar ningún resultado con ese nombre... ¿Podrías intentarlo de nuevo? 🥺' 
        }, options)
      }

      await sock.sendMessage(msg.chat, { react: { text: '🌸', key: msg.key } })

      try {
        const thumbBuffer = await getBuffer(videoInfo.image)
        const vistas = (videoInfo.views || 0).toLocaleString()
        const canal = videoInfo.author?.name || 'Desconocido'
        
        const infoMessage = `🌸 *¡Lo encontré!* (Ayudo con mucho gusto)\n\n` +
          `> 🎧 *Título* › *${videoInfo.title}*\n` +
          `> ❖ *Canal* › *${canal}*\n` +
          `> ⴵ *Duración* › *${videoInfo.timestamp || 'Desconocido'}*\n` +
          `> ✿ *Vistas* › *${vistas}*\n` +
          `> ❒ *Enlace* › *${videoInfo.url}*\n\n` +
          `*(Preparando tu audio con mucho cariño... un momentito por favor)* ✨`

        await sock.sendMessage(msg.chat, { image: thumbBuffer, caption: infoMessage }, options)
      } catch (e) {}

      const downloadUrl = await getAudioMedia(videoInfo.url)

      if (!downloadUrl) {
        return sock.sendMessage(msg.chat, { 
          text: '*(Lo siento...) No pude obtener el enlace de descarga en este momento... Gomenasai!* 💧' 
        }, options)
      }

      const response = await fetch(downloadUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        }
      })

      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = Buffer.from(arrayBuffer)

      if (audioBuffer.length < 50000) {
        return sock.sendMessage(msg.chat, { 
          text: '*(Oh...)* El servidor entregó un archivo vacio... ¿Podrías intentar con otra cancioncita? (._.)' 
        }, options)
      }

      await sock.sendMessage(msg.chat, {
        audio: audioBuffer,
        fileName: `${videoInfo.title || 'audio'}.mp3`,
        mimetype: 'audio/mpeg'
      }, options)

      await sock.sendMessage(msg.chat, { react: { text: '🌸', key: msg.key } })

    } catch (e) {
      const isChannel = msg.chat.endsWith('@newsletter')
      const options = isChannel ? undefined : { quoted: msg }
      await sock.sendMessage(msg.chat, { 
        text: `*(A-ayuda...)* Ocurrió un error inesperado al ejecutar *${usedPrefix + command}*: ${e.message} (T_T)` 
      }, options)
    }
  }
}

async function getAudioMedia(url) {
  // evoGB - PRINCIPAL con la api key estructurada correctamente
  try {
    const evoUrl = global.APIs?.evogb?.url || 'https://api.evogb.org'
    const evoKey = global.APIs?.evogb?.key || 'Apex-Predator2010'
    const endpoint = `${evoUrl}/dl/ytmp3?url=${encodeURIComponent(url)}&key=${encodeURIComponent(evoKey)}`
    const res = await fetch(endpoint).then(r => r.json())
    if (res?.status && res?.data?.dl) {
      return res.data.dl
    }
  } catch (e) {}

  try {
    const skyRes = await fetch('https://api-sky.ultraplus.click/youtube/resolve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'Russellxz',
        'Accept': 'application/json, */*'
      },
      body: JSON.stringify({
        url: url,
        type: 'audio',
        format: 'mp3'
      })
    }).then(r => r.json())

    const media = skyRes?.result?.media || skyRes?.data?.media
    const directUrl = media?.direct || media?.dl_download || media?.dl_inline || media?.url || (typeof media === 'string' ? media : null)
    if (directUrl) {
      return directUrl.startsWith('/') ? `https://api-sky.ultraplus.click${directUrl}` : directUrl
    }
  } catch (e) {}

  const apis = [
    {
      endpoint: `https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(url)}`,
      extractor: res => res?.data?.dl || res?.data?.url || res?.url || res?.download || res?.dl || null
    },
    {
      endpoint: `https://delirius-api-oficial.vercel.app/download/ytmp3?url=${encodeURIComponent(url)}`,
      extractor: res => res?.data?.download || res?.url || res?.download || res?.result?.dl || null
    },
    {
      endpoint: `https://api.vreden.my.id/api/ytmp3?url=${encodeURIComponent(url)}`,
      extractor: res => res?.result?.url || res?.result?.download || res?.data?.url || res?.data?.download || res?.url || null
    }
  ]

  for (const { endpoint, extractor } of apis) {
    try {
      const res = await fetch(endpoint).then(r => r.json())
      const result = extractor(res)
      if (result) return result
    } catch {}
    await new Promise(r => setTimeout(r, 500))
  }
  return null
        }
          
