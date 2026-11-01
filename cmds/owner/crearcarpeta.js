import fetch from 'node-fetch'

const handler = async (m, argumentsObj) => {
  // Extraemos las propiedades de forma segura para evitar fallos de undefined
  const conn = argumentsObj?.conn || global.conn
  const text = argumentsObj?.text

  // Verificación de seguridad por si conn no está disponible
  if (!conn || typeof conn.sendMessage !== 'function') {
    console.error('Error crítico: conn.sendMessage no está disponible.')
    return
  }

  // ==========================================
  // CONFIGURACIÓN PRINCIPAL
  // ==========================================
  const GITHUB_TOKEN = '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' // Tu token de GitHub
  const REPO_OWNER = 'aotsutsuki183-ctrl'                // Tu usuario
  const REPO_NAME = 'Sumibot-md'                         // Tu repositorio
  const BRANCH = 'principal'                             // Tu rama
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
    return conn.sendMessage(m.chat, { text: `《✦》 **Uso incorrecto.**\n\n* Ejemplo:\n  * \`_.crearcarpeta comandos/test.js | console.log("Hola");\`` }, { quoted: m })
  }

  try {
    const separatorIndex = text.indexOf('|')
    if (separatorIndex === -1) {
      return conn.sendMessage(m.chat, { text: '⚠️ Debes usar una barra vertical (|) para separar la ruta del contenido del archivo.' }, { quoted: m })
    }

    const filePath = text.slice(0, separatorIndex).trim()
    const fileContent = text.slice(separatorIndex + 1).trim()

    if (!filePath) {
      return conn.sendMessage(m.chat, { text: '⚠️ Especifica la ruta y el nombre del archivo.' }, { quoted: m })
    }

    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`
    
    let fileSha = null
    const checkFile = await fetch(url, {
      headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'User-Agent': 'Sumibot-md' }
    })
    
    if (checkFile.ok) {
      const fileData = await checkFile.json()
      fileSha = fileData.sha
    }

    const message = `Update/Create ${filePath} via Sumibot-md`
    const encodedContent = Buffer.from(fileContent || '# Creado automáticamente', 'utf-8').toString('base64')
    
    const bodyData = {
      message: message,
      content: encodedContent,
      branch: BRANCH
    }
    
    if (fileSha) {
      bodyData.sha = fileSha
    }

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Sumibot-md'
      },
      body: JSON.stringify(bodyData)
    })

    const resJson = await response.json()
    if (response.ok) {
      await conn.sendMessage(m.chat, { text: `✅ **¡Éxito!** Archivo creado o actualizado correctamente en:\n\`${filePath}\`` }, { quoted: m })
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
