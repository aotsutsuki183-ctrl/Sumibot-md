import { generarImagen } from '../lib/genimg.js'

const cooldown = new Map()
const COOLDOWN_MS = 20000
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
        `《✧》 Escribe qué quieres generar.\n` +
        `> Ejemplo » *${usedPrefix + command} mujer en lencería negra, luz de ventana*\n` +
        `> Añade *--doc* para recibirla sin compresión.`, msg)
    }

    const id = msg.sender
    const restante = COOLDOWN_MS - (Date.now() - (cooldown.get(id) || 0))
    if (restante > 0) return sock.reply(msg.chat, `《✧》 Espera *${Math.ceil(restante / 1000)}s*.`, msg)

    cooldown.set(id, Date.now())
    await msg.react('🔞')

    const prompt = `${base}, ${REFUERZO}`

    try {
      const { buffer, fuente } = await generarImagen(prompt, { nsfw: true })
      const caption = `ꕥ *Imagen NSFW generada*\n> Prompt » ${base}\n> Vía » ${fuente}\n> Por » @${id.split('@')[0]}\n> Negativo » ${NEGATIVO}`

      if (asDoc) {
        await sock.sendMessage(msg.chat, {
          document: buffer,
          mimetype: 'image/jpeg',
          fileName: `nsfw-${Date.now()}.jpg`,
          caption,
          mentions: [id]
        }, { quoted: msg })
      } else {
        await sock.sendMessage(msg.chat, { image: buffer, caption, mentions: [id] }, { quoted: msg })
      }
      await msg.react('✅')
    } catch (e) {
      cooldown.delete(id)
      await msg.react('❌')
      await msg.reply(`> No se pudo generar.\n> [${e.message}]`)
    }
  }
      }
      
