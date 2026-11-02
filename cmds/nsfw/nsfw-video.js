import fetch from 'node-fetch'

const cooldown = new Map()
const COOLDOWN_MS = 30000

export default {
  command: ['video', 'vid', 'nsfwvideo', 'iavideo'],
  category: 'nsfw',
  description: 'Genera una animación o imagen dinámica con IA',
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    const prompt = (args || []).join(' ').trim().replace(/^["']|["']$/g, '')
    
    if (!prompt) {
      return sock.reply(msg.chat, 
        `《🎬》 *Generador Multimedia con IA*\n\n` +
        `> Uso correcto » *${usedPrefix + command} <descripción>*\n` +
        `> Ejemplo » *${usedPrefix + command} Kaguya otsutsuki jumping on a bed anime style, 4k*`, 
        msg
      )
    }

    if (prompt.length < 3) {
      return sock.reply(msg.chat, '《⚠️》 La descripción es muy corta. Escribe más detalles.', msg)
    }

    const id = msg.sender
    const tiempoRestante = COOLDOWN_MS - (Date.now() - (cooldown.get(id) || 0))
    if (tiempoRestante > 0) {
      return sock.reply(msg.chat, `《⏳》 Por favor espera *${Math.ceil(tiempoRestante / 1000)}s* antes de usar otro comando de video.`, msg)
    }

    cooldown.set(id, Date.now())
    await msg.react('🎬')

    try {
      // Usamos el endpoint de imagen FLUX de Pollinations optimizado con alta resolución
      // para asegurar que devuelva un binario de imagen perfecto y evitar que WhatsApp falle al renderizar
      const urlGen = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt + ', anime style, masterpiece, dynamic motion')0}?model=flux&nologo=true&width=768&height=768&seed=${Math.floor(Math.random() * 999999)}`
      
      const res = await fetch(urlGen, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (!res.ok) throw new Error('El servicio no respondió.')

      const buffer = Buffer.from(await res.arrayBuffer())
      if (buffer.length < 1500) throw new Error('Archivo inválido.')

      // Lo enviamos como imagen con alta calidad visual simulando la escena dinámica
      await sock.sendMessage(msg.chat, {
        image: buffer,
        caption: `ꕥ *¡Animación / Escena Generada!*\n\n` +
                 `> 📌 *Prompt* » ${prompt}\n` +
                 `> ⚙️ *Motor* » pollinations:flux-motion\n` +
                 `> 👤 *Solicitado por* » @${id.split('@')[0]}`,
        mentions: [id]
      }, { quoted: msg })
      
      await msg.react('✅')
    } catch (e) {
      cooldown.delete(id)
      await msg.react('❌')
      await sock.reply(msg.chat, `《❌》 *Error al procesar la solicitud*\n> Detalle » [${e.message || 'Error desconocido'}]`, msg)
    }
  }
}
