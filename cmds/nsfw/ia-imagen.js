import { generarImagen } from '../../lib/genimg.js'

const cooldown = new Map()
const COOLDOWN_MS = 15000 // Reducido a 15s para mayor fluidez

export default {
  command: ['imagen', 'img', 'draw', 'dalle', 'flux'],
  category: 'ia',
  description: 'Genera una imagen con IA a partir de una descripción detallada',
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    const prompt = (args || []).join(' ').trim().replace(/^["']|["']$/g, '')
    
    if (!prompt) {
      return sock.reply(msg.chat, 
        `《✧》 *Falta la descripción*\n` +
        `> Uso correcto » *${usedPrefix + command} <descripción>*\n` +
        `> Ejemplo » *${usedPrefix + command} un lobo cósmico brillando en el espacio, 4k*`, 
        msg
      )
    }
    
    if (prompt.length < 3) {
      return sock.reply(msg.chat, '《⚠️》 La descripción es demasiado corta. Escribe al menos 3 caracteres.', msg)
    }

    const id = msg.sender
    const tiempoRestante = COOLDOWN_MS - (Date.now() - (cooldown.get(id) || 0))
    if (tiempoRestante > 0) {
      return sock.reply(msg.chat, `《⏳》 Por favor espera *${Math.ceil(tiempoRestante / 1000)}s* antes de usar otro comando de imagen.`, msg)
    }

    cooldown.set(id, Date.now())
    await msg.react('🎨')

    try {
      const { buffer, fuente } = await generarImagen(prompt)
      
      await sock.sendMessage(msg.chat, {
        image: buffer,
        caption: `ꕥ *¡Imagen Generada con Éxito!*\n\n` +
                 `> 📌 *Prompt* » ${prompt}\n` +
                 `> ⚙️ *Motor/Vía* » ${fuente}\n` +
                 `> 👤 *Solicitado por* » @${id.split('@')[0]}`,
        mentions: [id]
      }, { quoted: msg })
      
      await msg.react('✅')
    } catch (e) {
      cooldown.delete(id)
      await msg.react('❌')
      await sock.reply(msg.chat, `《❌》 *Error al generar la imagen*\n> Detalle » [${e.message || 'Desconocido'}]`, msg)
    }
  }
               }
    
