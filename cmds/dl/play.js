import ytsearch from "yt-search"
import { getBuffer } from "#serialize"
import fetch from "node-fetch"

export default {
  command: ["play", "mp3", "mp4", "spotify", "ytmp3", "ytmp4"],
  category: "downloader",
  run: async ({ msg, sock, args, command, usedPrefix }) => {
    try {
      const text = args.join(" ")

      // 1. Si ejecutan directamente .mp3 o .ytmp3 (Manual o por clic en botón)
      if (command === "mp3" || command === "ytmp3") {
        if (!text) return msg.reply(`《✧》 Por favor, especifica el enlace o título a descargar.\n*Ejemplo:* \`${usedPrefix}mp3 Bad Bunny\``)
        let targetUrl = text.startsWith("http") ? text : null
        let title = "Audio Descargado"

        if (!targetUrl) {
          const search = await ytsearch(text)
          if (!search.videos?.length) return msg.reply("《✧》 No se encontró información del video.")
          targetUrl = search.videos[0].url
          title = search.videos[0].title
        }
        return await downloadMedia(msg, sock, targetUrl, "audio", title)
      }

      // 2. Si ejecutan directamente .mp4 o .ytmp4 (Manual o por clic en botón)
      if (command === "mp4" || command === "ytmp4") {
        if (!text) return msg.reply(`《✧》 Por favor, especifica el enlace o título a descargar.\n*Ejemplo:* \`${usedPrefix}mp4 Bad Bunny\``)
        let targetUrl = text.startsWith("http") ? text : null
        let title = "Video Descargado"

        if (!targetUrl) {
          const search = await ytsearch(text)
          if (!search.videos?.length) return msg.reply("《✧》 No se encontró información del video.")
          targetUrl = search.videos[0].url
          title = search.videos[0].title
        }
        return await downloadMedia(msg, sock, targetUrl, "video", title)
      }

      // 3. Flujo normal con el comando .play
      if (!text) {
        return msg.reply(`《✧》 Por favor, ingresa el nombre o enlace de lo que deseas descargar.\n*Ejemplo:* \`${usedPrefix}play Bad Bunny\``)
      }

      const searchResult = await ytsearch(text)
      if (!searchResult.videos || !searchResult.videos.length) {
        return msg.reply("《✧》 No se encontró información del video.")
      }

      const video = searchResult.videos[0]
      const { title, author, timestamp: duration, views, url, image } = video
      const vistas = (views || 0).toLocaleString()
      const canal = author?.name || author || "Desconocido"
      
      const thumbBuffer = await getBuffer(image).catch(() => null)

      const caption = `【　✿　】 _\`୨୧  Media Downloader\` ───── *${title}*_

> _✐ \`Canal\` ── ${canal}_
> _ⴵ \`Duración\` ── ${duration || ''}_
> _✰ \`Vistas\` ── ${vistas}_
> _🜸 \`Enlace\` ── ${url}_

> _──  ִ    ۟  *Selecciona una opción abajo para descargar:*_`

      // Estructura de botones interactivos compatibles con Baileys
      const buttonsMessage = {
        image: thumbBuffer || { url: image },
        caption: caption,
        footer: "Aether Labs • Downloader",
        buttons: [
          { buttonId: `${usedPrefix}mp3 ${url}`, buttonText: { displayText: "🎵 Descargar MP3" }, type: 1 },
          { buttonId: `${usedPrefix}mp4 ${url}`, buttonText: { displayText: "🎬 Descargar MP4" }, type: 1 }
        ],
        headerType: 4
      }

      await sock.sendMessage(msg.chat, buttonsMessage, { quoted: msg })

    } catch (e) {
      console.error(e)
      await msg.reply(global.msgglobal)
    }
  }
}

// Función auxiliar para procesar la descarga usando las APIs de global.APIs
async function downloadMedia(msg, sock, url, type, title) {
  await msg.reply(`《✧》 _Procesando ${type === 'video' ? 'video (MP4)' : 'audio (MP3)'}, por favor espera..._`)

  let downloadUrl = null
  let apiList = []

  if (type === "video") {
    apiList = [
      {
        url: `${global.APIs.vreden.url}/api/ytmp4?url=${encodeURIComponent(url)}`,
        parser: (res) => res?.status && res?.result?.download?.url ? res.result.download.url : null
      },
      {
        url: `${global.APIs.evogb.url}/dl/ytmp4?url=${encodeURIComponent(url)}&key=${global.APIs.evogb.key}`,
        parser: (res) => res?.status && res?.data?.dl ? res.data.dl : null
      }
    ]
  } else {
    apiList = [
      {
        url: `${global.APIs.evogb.url}/dl/ytmp3?url=${encodeURIComponent(url)}&key=${global.APIs.evogb.key}`,
        parser: (res) => res?.status && res?.data?.dl ? res.data.dl : null
      },
      {
        url: `${global.APIs.yuki.url}/dl/ytmp3?url=${encodeURIComponent(url)}&apikey=${global.APIs.yuki.key}`,
        parser: (res) => res?.status && res?.result ? res.result : null
      },
      {
        url: `${global.APIs.vreden.url}/api/ytmp3?url=${encodeURIComponent(url)}`,
        parser: (res) => res?.status && res?.result?.download?.url ? res.result.download.url : null
      }
    ]
  }

  for (let endpoint of apiList) {
    try {
      const response = await fetch(endpoint.url)
      const json = await response.json()
      downloadUrl = endpoint.parser(json)
      if (downloadUrl) break
    } catch (err) {
      continue
    }
  }

  if (!downloadUrl) {
    return msg.reply("《✧》 No se pudo completar la descarga con las APIs disponibles.")
  }

  const bufferData = await getBuffer(downloadUrl)
  if (!bufferData) {
    return msg.reply("《✧》 Error al obtener el archivo multimedia.")
  }

  const safeName = (title || "media").replace(/[\\/:*?"<>|]/g, '')

  if (type === "video") {
    await sock.sendMessage(msg.chat, {
      video: bufferData,
      mimetype: 'video/mp4',
      fileName: `${safeName}.mp4`,
      caption: `_Aquí tienes tu video: *${title}*_`
    }, { quoted: msg })
  } else {
    await sock.sendMessage(msg.chat, {
      audio: bufferData,
      mimetype: 'audio/mpeg',
      fileName: `${safeName}.mp3`,
      ptt: false
    }, { quoted: msg })
  }
    }
        
