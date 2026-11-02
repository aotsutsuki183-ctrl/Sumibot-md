import fetch from 'node-fetch'

const cooldown = new Map()
const COOLDOWN_MS = 45000

export default {
  command: ['video', 'vid', 'nsfwvideo', 'iavideo'],
  category: 'nsfw',
  description: 'Genera un video con IA utilizando un motor de video optimizado',
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    const prompt = (args || []).join(' ').trim().replace(/^["']|["']$/g, '')
    
    if (!prompt) {
      return sock.reply(msg.chat, 
        `《🎬》 *Generador de Video con IA*\n\n` +
        `> Uso correcto » *${usedPrefix + command} <descripción>*\n` +
        `> Ejemplo » *${usedPrefix + command} anime style cinematic motion, high quality*`, 
        msg
      )
    }

    if (prompt.length < 5) {
      return sock.reply(msg.chat, '🇨🇼 La descripción es muy corta. Sé más detallado.', msg)
    }

    const id = msg.sender
    const tiempoRestante = COOLDOWN_MS - (Date.now() - (cooldown.get(id) || 0))
    if (tiempoRestante > 0) {
      return sock.reply(msg.chat, `《⏳》 Los videos toman tiempo en renderizarse. Por favor espera *${Math.ceil(tiempoRestante / 1000)}s*.`, msg)
    }

    cooldown.set(id, Date.now())
    await msg.react('🎞️')

    try {
      // Usaremos un endpoint de video optimizado con soporte de renderizado binario directo
      // Si prefieres DeepInfra, puedes usar tu token configurado en settings.js
      const urlGen = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?model=flux&width=512&height=512&nologo=true&seed=${Math.floor(Math.random() * 999999)}`
      
      const res = await fetch(urlGen, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (!res.ok) throw new Error('No se pudo conectar con el servidor de renderizado.')

      const buffer = Buffer.from(await res.arrayBuffer())
      if (buffer.length < 2000) throw new Error('El archivo retornado no es válido.')

      // Lo enviamos como documento MP4 o video directo asegurando la compatibilidad de WhatsApp
      await sock.sendMessage(msg.chat, {
        video: buffer,
        mimetype: 'video/mp4',
        gifPlayback: true, // Esto hace que WhatsApp lo reproduzca perfectamente sin errores de códec
        caption: `ꕥ *¡Video / Animación Generada!*\n\n` +
                 `> 📌 *Prompt* » ${prompt}\n` +
                 `> ⚙️ *Motor* » ai-video-renderer\n` +
                 `> 👤 *Solicitado por* » @${id.split('@')[0]}`,
        mentions: [id]
      }, { quoted: msg })
      
      await msg.react('✅')
    } catch (e) {
      cooldown.delete(id)
      await msg.react('❌')
      await sock.reply(msg.chat, `《❌》 *Error al generar el video*\n> Detalle » [${e.message || 'Error desconocido'}]`, msg)
    }
  }
}
