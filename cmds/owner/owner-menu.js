import db from "#db"
import fs from 'fs'
import path from 'path'
import { prepareWAMessageMedia } from 'baileys'
import moment from 'moment-timezone'
import os from 'os'

const ALLOWED_CATS = ['stickers', 'anime', 'economy', 'gacha', 'dl', 'group', 'Main', 'profile', 'socket', 'stikers', 'nsfw', 'utils', 'owner']

function getFilesRecursively(dir) {
  let results = []
  if (!fs.existsSync(dir)) return results
  const items = fs.readdirSync(dir, { withFileTypes: true })
  for (const item of items) {
    const fullPath = path.join(dir, item.name)
    if (item.isDirectory()) {
      results = results.concat(getFilesRecursively(fullPath))
    } else if (item.isFile() && item.name.endsWith('.js')) {
      results.push(fullPath)
    }
  }
  return results
}

function parseCommandFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')
    const cmdMatch = cleanContent.match(/command:\s*\[([^\]]+)\]/s)
    const descMatch = cleanContent.match(/description:\s*['"`]([^'"`]+)['"`]/)
    const usoMatch = cleanContent.match(/uso:\s*['"`]([^'"`]+)['"`]/)
    // Detectar si el comando pertenece explícitamente a owner (ya sea por tag o categoría)
    const isOwnerCmd = /tag:\s*['"`]owner['"`]|category:\s*['"`]owner['"`]|owner:\s*true/i.test(cleanContent)

    if (!cmdMatch) return null
    const alias = cmdMatch[1]
     .split(',')
     .map(a => a.replace(/['"`\s]/g, '').split(/[\/#!+.\-]+/).pop().toLowerCase())
     .filter(Boolean)
     
    return {
      alias,
      desc: descMatch ? descMatch[1] : 'Sin descripción',
      uso: usoMatch ? usoMatch[1] : '',
      isOwner: isOwnerCmd || filePath.toLowerCase().includes('owner')
    }
  } catch { return null }
}

export default {
  command: ['ownermenu', 'menudueño', 'menusecreto'],
  customPrefix: /^(?:ownermenu|menudueño|menusecreto)(?=\s*$|\s+\w+\s*$)/i,
  category: 'owner',
  description: 'Muestra el menú exclusivo de comandos de Owner',
  run: async ({ msg, sock, args, command, usedPrefix }) => {
    try {
      // 1. Verificación estricta de Owner usando los settings del bot
      const botId = sock?.user?.id.split(':')[0] + '@s.whatsapp.net' || ''
      const botSettings = (await db.getSettings(botId)) || {}
      const ownerList = global.owner || [] 

      const sender = msg.sender.replace(/[^0-9]/g, '')
      const isOwner = ownerList.some(owner => owner[0].replace(/[^0-9]/g, '') === sender) || msg.key.fromMe

      // Si no es owner, se sale de forma silenciosa para que el handler lo ignore como comando inexistente
      if (!isOwner) return

      const botTime = moment().tz('America/Bogota').format('DD MMM YYYY, hh:mm A')
      const chatData = (await db.getChat(msg.chat)) || {}
      if (chatData.primaryBot && chatData.primaryBot !== botId) return
      
      const { namebot = '', namebot2 = '', banner = '', owner = '' } = botSettings
      const sinPrefijo = /^(ownermenu|menudueño|menusecreto)$/i.test(usedPrefix)
      const cfg = botSettings.prefijo
      const prefix = sinPrefijo ? (Array.isArray(cfg) ? cfg[0] : typeof cfg === 'string' ? cfg : '') : usedPrefix
      const link = 'https://api.evogb.org'
      const platform = `${os.type()} ${os.release()} ${os.arch()}`
      const own = await db.getUser(owner)
      const dev = owner && !isNaN(owner.replace('@s.whatsapp.net', '')) ? own.name : owner || 'Oculto'

      let menu = `> *¡ʜᴏʟᴀ, ᴏᴡɴᴇʀ!* Panel de control administrativo de *${namebot2}* ʚ♡⃛ɞ(ू•ᴗ•ू❁)*\n\n` +
      ` ⌒࣪᷼⏜͡ ۪ ࿚ꨪᰰ࿙ ࣭࣪⢏࣭۟⢢࣭ׄ᎐፝֟᎐࣭ׄ⡔࣭۟⡹࣭ׄ ࿚ꨪᰰ࿙ ۪ ͡⏜ׄ᷼⌒\n\n` +
      `: ̗̀〄 *ᴅᴇᴠᴇʟᴏᴘᴇʀ ::* 𝐴𝑒𝑡ℎ𝑒𝙧 𝐿𝐴𝐵𝑆\n` +
      `: ̗̀☕︎ *ᴏᴡɴᴇʀ ::* ${dev}\n` +
      `: ̗̀☄︎ *sɪsᴛᴇᴍᴀ/ᴏᴘʀ ::* ${platform}\n` +
      `: ̗̀❖ *ᴍɪ ᴛɪᴇᴍᴘᴏ ::* ${botTime} (Colombia)\n\n` +
      ` ⌒࣪᷼⏜͡ ۪ ࿚ꨪᰰ࿙ ࣭࣪⢏࣭۟⢢࣭ׄ᎐፝֟᎐࣭ׄ⡔࣭۟⡹࣭ׄ ࿚ꨪᰰ࿙ ۪ ͡⏜ׄ᷼⌒\n\n` +
      `⋆｡ﾟ☁ ｡° *ᴄᴏᴍ꯭ᴀ꯭ɴᴅᴏs ᴅᴇ ᴏᴡɴᴇʀ* ﾟ｡˚₊ 𓂃\n`

      const basePath = './cmds'
      let ownerCommands = []
      
      // Escanear directorios buscando exclusivamente comandos de owner
      const allDirs = getFilesRecursively(basePath)
      for (const filePath of allDirs) {
        const parsed = parseCommandFile(filePath)
        if (parsed && parsed.isOwner) {
          const exists = ownerCommands.some(c => c.alias[0] === parsed.alias[0])
          if (!exists) ownerCommands.push(parsed)
        }
      }

      if (ownerCommands.length > 0) {
        menu += `\n╭╼ׅࣶ፝֟╾╌ֵ╾͜─ํ͜┈ְ ࣭࣪⢏࣭ࣧ⢢࣭ׄ᎐፝֟͟͝᎐࣭ׄ⡔࣭ࣧ⡹࣭ׄ࣪ ְ┈ํ͜─͜╼ꨪᰰ╾࣮╌╼ࣶׅ፝֟╾╮\n│❀ *Owner Commands* ☆(ﾉ◕ヮ◕)ﾉ*\n├╾ׅ╴ׂ╌╶ׅ╌ׂ─ 〫─ׂ┄ׅ╴ׂ╌ׅ╶╼. ╾ׅ╴ׂ╌╶ׅ╶╼. ╾ׅ╴ׂ╌╶ׅ╌ׂ\n`
        ownerCommands.forEach(cmd => {
          menu += `│✿ ${cmd.alias.map(a => prefix + a.toLowerCase()).join(' › ')} ${cmd.uso ? `+ ${cmd.uso}` : ''}\n> ✺ ${cmd.desc}\n`
        })
        menu += `╰╼ׅࣶ፝֟╾╌ֵ╾͜─ํ͜┈ְ ࣭࣪⢏࣭ࣧ⢢࣭ׄ᎐፝֟͟͝᎐࣭ׄ⡔࣭ࣧ⡹࣭ׄ࣪ ְ┈ํ͜─͜╼ꨪᰰ╾࣮╌╼ࣶׅ፝֟╾╯ \n`
      } else {
        menu += `\n> ⚠️ No se encontraron comandos de owner registrados en las carpetas.`
      }

      menu += `\n> ${namebot2} panel exclusivo de administración`
      
      const finalText = menu.trim()
      const ctx = { mentionedJid: null, isForwarded: false }

      try {
        if (!banner) throw new Error('No banner')
        const isVideo = /\.(mp4|gif|webm)$/i.test(banner)

        if (isVideo) {
          await sock.sendMessage(msg.chat, { video: { url: banner }, caption: finalText, contextInfo: ctx }, { quoted: msg })
        } else {
          const preview = link ? await prepareWAMessageMedia({ image: { url: banner } }, { upload: sock.waUploadToServer, mediaTypeOverride: 'thumbnail-link' }).then(m => ({ 'canonical-url': link, 'matched-text': link, title: namebot, description: `${namebot2}, Panel Owner`, jpegThumbnail: m.imageMessage?.jpegThumbnail ? Buffer.from(m.imageMessage.jpegThumbnail) : undefined, highQualityThumbnail: m.imageMessage || undefined })) : undefined
          await sock.sendMessage(msg.chat, { text: finalText, linkPreview: preview, contextInfo: ctx }, { quoted: msg })
        }
      } catch (err) {
        await sock.sendMessage(msg.chat, { text: finalText, contextInfo: ctx }, { quoted: msg })
      }

    } catch (e) {
      console.log(e)
    }
  }
}
