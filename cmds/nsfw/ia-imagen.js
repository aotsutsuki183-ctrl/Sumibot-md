import { generarImagen } from '../lib/genimg.js'

const cooldown = new Map()
const COOLDOWN_MS = 20000

export default {
  command: ['imagen', 'img', 'draw', 'dalle', 'flux'],
  category: 'ia',
  description: 'Genera una imagen con IA a partir de una descripción',
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    const prompt = (args || []).join(' ').trim().replace(/^["']|["']$/g, '')
    if (!prompt) return sock.reply(msg.chat, `《✧》 Escribe una descripción.\n> Ejemplo » *${usedPrefix + command} un dragón de cristal sobre la nieve, 4k*`, msg)
    if (prompt.length < 3) return sock.reply(msg.chat, '《✧》 La descripción es muy corta.', msg)

    const id = msg.sender
    const restante = COOLDOWN_MS - (Date.now() - (cooldown.get(id) || 0))
    if (restante > 0) return sock.reply(msg.chat, `《✧》 Espera *${Math.ceil(restante / 1000)}s*.`, msg)

    cooldown.set(id, Date.now())
    await msg.react('🎨')

    try {
      const { buffer, fuente } = await generarImagen(prompt)
      await sock.sendMessage(msg.chat, {
        image: buffer,
        caption: `ꕥ *Imagen generada*\n> Prompt » ${prompt}\n> Vía » ${fuente}\n> Por » @${id.split('@')[0]}`,
        mentions: [id]
      }, { quoted: msg })
      await msg.react('✅')
    } catch (e) {
      cooldown.delete(id)
      await msg.react('❌')
      await msg.reply(`> No se pudo generar la imagen.\n> [${e.message}]`)
    }
  }
                    }
      
