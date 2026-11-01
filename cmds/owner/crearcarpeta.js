import fetch from 'node-fetch'

const handler = async (m, { conn, text, command }) => {
  // ==========================================
  // CONFIGURACIÓN PRINCIPAL
  // ==========================================
  const GITHUB_TOKEN = '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' // Tu token de GitHub
  const REPO_OWNER = 'aotsutsuki183-ctrl'                // Tu usuario
  const REPO_NAME = 'Sumibot-md'                         // Tu repositorio
  const BRANCH = 'main'                             // Tu rama
  // ==========================================

  // Números permitidos (Owner)
  const permitidos = ['51983564381', '573015200599', '5491128178894', '5491157745642', '593989068253', '104260465336559@lid']
  const who = m?.sender || m?.key?.participant || m?.key?.remoteJid
  const normalizar = (jid = '') => jid.replace(/[^0-9]/g, '')
  
  if (!permitidos.map(normalizar).includes(normalizar(who))) {
    return conn.sendMessage(m.chat, { text: '《✧》 No tienes permiso para usar este comando.' }, { quoted: m })
  }

  if (GITHUB_TOKEN.includes('PEGA_TU_TOKEN')) {
    return conn.sendMessage(m.chat, { text: '⚠️ Falta configurar tu Token de GitHub en el archivo.' }, { quoted: m })
  }

  if (!text) {
    return conn.sendMessage(m.chat, { text: `《✦》 **Uso incorrecto.**\n\n* Ejemplo:\n  * \`_.crearcarpeta plugins/test.js | console.log("Hola");\`` }, { quoted: m })
  }

  try {
    const [pathInput, ...contentParts] = text.split('|')
    const filePath = pathInput.trim()
    const fileContent = contentParts.join('|').trim()

    if (!filePath) {
      return conn.sendMessage(m.chat, { text: '⚠️ Especifica la ruta y el nombre del archivo.' }, { quoted: m })
    }

    const message = `Create ${filePath} via Sumibot-md`
    const encodedContent = Buffer.from(fileContent || '# Creado automáticamente').toString('base64')
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Sumibot-md'
      },
      body: JSON.stringify({ message, content: encodedContent, branch: BRANCH })
    })

    const resJson = await response.json()
    if (response.ok) {
      await conn.sendMessage(m.chat, { text: `✅ **¡Éxito!** Archivo creado en la ruta:\n\`${filePath}\`` }, { quoted: m })
    } else {
      await conn.sendMessage(m.chat, { text: `❌ **Error de GitHub:** ${resJson.message || 'No se pudo crear.'}` }, { quoted: m })
    }
  } catch (error) {
    console.error(error)
    await conn.sendMessage(m.chat, { text: `⚠️ Error inesperado al conectar con GitHub.` }, { quoted: m })
  }
}

handler.command = ['crearcarpeta']
handler.rowner = true
export default handler
