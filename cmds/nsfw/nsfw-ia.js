import { generarImagen } from '../../lib/genimg.js'

const cooldown = new Map()
const COOLDOWN_MS = 15000
const REFUERZO = 'highly detailed, uncensored, adult, masterpiece, sharp focus, natural lighting'
const NEGATIVO = 'censorship, blurry, watermark, text, extra limbs, bad anatomy'

export default {
  command: ['nsfw', 'nsfwimg', 'pornoimg', 'hentaiimg', 'img18'],
  category: 'nsfw',
  description: 'Genera imágenes NSFW sin censura',
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    let asDoc = false
    const limpio = []
    
    for (const a of args || []) {
      if (a.toLowerCase() === '--doc') asDoc = true
      else limpio.push(a)
    }

    const base = limpio.join(' ').trim().replace(/^["']|["']$/g, '')
    
    if (!base) {
      return sock.reply(msg.chat,
        `《🔞》 *Generador NSFW*\n\n` +
        `> Uso » *${usedPrefix + command} <descripción>* [--doc]\n` +
        `> Ejemplo » *${usedPrefix + command} chica anime en la playa, atardecer*\n` +
        `> *Nota* » Añade *--doc* al final si la quieres recibir sin compresión de WhatsApp.`, 
        msg
      )
    }

    const id = msg.sender
    const tiempoRestante = COOLDOWN_MS - (Date.now() - (cooldown.get(id) || 0))
    if (tiempoRestante > 0) {
      return sock.reply(msg.chat, `《⏳》 Espera *${Math.ceil(tiempoRestante / 1000)}s* para generar otra imagen.`, msg)
    }

    cooldown.set(id, Date.now())
    await msg.react('🔥')

    const prompt = `${base}, ${REFUERZO}`

    try {
      const { buffer, fuente } = await generarImagen(prompt, { nsfw: true })
      const caption = `ꕥ *Imagen NSFW Generada*\n\n` +
                      `> 📌 *Prompt* » ${base}\n` +
                      `> ⚙️ *Vía* » ${fuente}\n` +
                      `> 👤 *Pedido por* » @${id.split('@')[0]}`

      if (asDoc) {
        await sock.sendMessage(msg.chat, {
          document: buffer,
          mimetype: 'image/jpeg',
          fileName: `nsfw-${Date.now()}.jpg`,
          caption,
          mentions: [id]
        }, { quoted: msg })
      } else {
        await sock.sendMessage(msg.chat, { 
          image: buffer, 
          caption, 
          mentions: [id] 
        }, { quoted: msg })
      }
      
      await msg.react('✅')
    } catch (e) {
      cooldown.delete(id)
      await msg.react('❌')
      await sock.reply(msg.chat, `《❌》 *No se pudo procesar la solicitud.*\n> [${e.message || 'Error de red'}]`, msg)
    }
  }
    }
    
