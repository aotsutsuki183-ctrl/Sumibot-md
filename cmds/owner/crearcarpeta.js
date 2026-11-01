import fetch from 'node-fetch';

let handler = async (m, { conn, text, usedPrefix, command }) => {
    if (!text) {
        return conn.sendMessage(m.chat, { text: `*⚠️ Por favor, ingresa la ruta de la carpeta y el archivo.*\n\n*Ejemplo:* \`${usedPrefix + command} src/mi_carpeta/README.md\`` }, { quoted: m });
    }

    // Tus datos de GitHub configurados
    const GITHUB_TOKEN = global.github_token || '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';
    const REPO_OWNER = global.github_owner || 'aotsutsuki183-ctrl';
    const REPO_NAME = global.github_repo || 'Sumibot-md';
    const BRANCH = 'main';

    // Validación única y limpia por si el token estuviera vacío
    if (!GITHUB_TOKEN) {
        return conn.sendMessage(m.chat, { text: `*❌ Error:* No se ha detectado ningún Token de GitHub configurado.` }, { quoted: m });
    }

    try {
        let filePath = text.trim().replace(/^\/+/, '');
        let commitMessage = `Crear carpeta y archivo ${filePath} via bot`;
        let fileContent = Buffer.from(`# Creado automáticamente por el bot\nCarpeta: ${filePath}`).toString('base64');

        await conn.sendMessage(m.chat, { text: `*⏳ Conectando con GitHub para crear la carpeta/archivo...*` }, { quoted: m });

        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`;

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'User-Agent': 'Node-Bot'
            },
            body: JSON.stringify({
                message: commitMessage,
                content: fileContent,
                branch: BRANCH
            })
        });

        const data = await response.json();

        if (response.ok) {
            await conn.sendMessage(m.chat, { text: `*✅ ¡Carpeta y archivo creados en GitHub con éxito!* \n\n📁 **Ruta:** \`${filePath}\`\n\n*💡 Haz un pull o usa tu comando de actualización para reflejarlo localmente.*` }, { quoted: m });
        } else {
            await conn.sendMessage(m.chat, { text: `*❌ Error de GitHub:* \`${data.message || 'No se pudo completar la acción'}\`` }, { quoted: m });
        }

    } catch (error) {
        console.error('Error al conectar con GitHub:', error);
        await conn.sendMessage(m.chat, { text: `*❌ Ocurrió un error crítico:* \`${error.message}\`` }, { quoted: m });
    }
};

handler.help = ['crearcarpeta <ruta/archivo>'];
handler.tags = ['owner'];
handler.command = ['crearcarpeta', 'addfolder', 'nuevacarpeta'];
handler.rowner = true;

export default handler;
    
