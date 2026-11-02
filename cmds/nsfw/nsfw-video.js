import fetch from 'node-fetch'

const cooldown = new Map()
const COOLDOWN_MS = 45000

// Endpoints alternativos de respaldo para video e imágenes en movimiento
const RESPALDOS_VIDEO = [
  (p) => `https://pollinations.ai/p/${encodeURIComponent(p)}?width=512&height=512&seed=${Math.floor(Math.random() * 999999)}&model=video`,
  (p) => `https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?model=flux&nologo=true&width=768&height=768`
]

export default {
  command: ['video', 'vid', 'nsfwvideo', 'iavideo'],
  category: 'nsfw',
  description: 'Genera un video o animación con IA a partir de una descripción',
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    const prompt = (args || []).join(' ').trim().replace(/^["']|["']$/g, '')
    
    if (!prompt) {
      return sock.reply(msg.chat, 
        `《🎬》 *Generador de Video con IA*\n\n` +
        `> Uso correcto » *${usedPrefix + command} <descripción>*\n` +
        `> Ejemplo » *${usedPrefix + command} cinematic shot of a cyberpunk city flying cars, 4k*`, 
        msg
      )
    }

    if (prompt.length < 5) {
      return sock.reply(msg.chat, '《⚠️》 La descripción del video es muy corta. Sé más descriptivo.', msg)
    }

    const id = msg.sender
    const tiempoRestante = COOLDOWN_MS - (Date.now() - (cooldown.get(id) || 0))
    if (tiempoRestante > 0) {
      return sock.reply(msg.chat, `《⏳》 Los videos toman tiempo en renderizarse. Por favor espera *${Math.ceil(tiempoRestante / 1000)}s*.`, msg)
    }

    cooldown.set(id, Date.now())
    await msg.react('🎞️')

    let buffer = null
    let fuenteUsada = ''

    // Intentar con los generadores y respaldos en secuencia
    for (let i = 0; i < RESPALDOS_VIDEO.length; i++) {
      try {
        const urlGen = RESPALDOS_VIDEO[i](prompt)
        const res = await fetch(urlGen, { headers: { 'User-Agent': 'Mozilla/5.0' } })
        
        if (res.ok) {
          const tempBuffer = Buffer.from(await res.arrayBuffer())
          // Validar que el archivo tenga un tamaño razonable para ser multimedia
          if (tempBuffer.length > 5000) {
            buffer = tempBuffer
            fuenteUsada = i === 0 ? 'pollinations:video' : 'pollinations:flux-fallback'
            break
          }
        }
      } catch {
        continue
      }
    }

    if (!buffer) {
      cooldown.delete(id)
      await msg.react('❌')
      return sock.reply(msg.chat, '《❌》 No se pudo generar el video en este momento. Inténtalo de nuevo más tarde.', msg)
    }

    try {
      await sock.sendMessage(msg.chat, {
        video: buffer,
        mimetype: 'video/mp4',
        caption: `ꕥ *¡Video Generado con Éxito!*\n\n` +
                 `> 📌 *Prompt* » ${prompt}\n` +
                 `> ⚙️ *Motor* » ${fuenteUsada}\n` +
                 `> 👤 *Solicitado por* » @${id.split('@')[0]}`,
        mentions: [id]
      }, { quoted: msg })
      
      await msg.react('✅')
    } catch (e) {
      cooldown.delete(id)
      await msg.react('❌')
      await sock.reply(msg.chat, `《❌》 *Error al enviar el video por WhatsApp*\n> Detalle » [${e.message || 'Error de envío'}]`, msg)
    }
  }
}
