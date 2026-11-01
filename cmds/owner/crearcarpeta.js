import fetch from 'node-fetch';

let handler = async (m, { conn, text, usedPrefix, command }) => {
    if (!text) {
        return m.reply(`*⚠️ Por favor, ingresa la ruta de la carpeta y el archivo.*\n\n*Ejemplo:* \`${usedPrefix + command} src/mi_carpeta/README.md\`\n*(Nota: GitHub requiere crear un archivo dentro para que la carpeta se guarde).*`);
    }

    // Configura aquí tus datos de GitHub o cárgalos de tus variables de entorno / settings
    const GITHUB_TOKEN = global.github_token || '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';
    const REPO_OWNER = global.github_owner || 'aotsutsuki183-ctrl';
    const REPO_NAME = global.github_repo || 'Sumibot-md';
    const BRANCH = 'main'; // o 'master'

    if (GITHUB_TOKEN === 'TU_TOKEN_PERSONAL_DE_GITHUB') {
        return m.reply(`*❌ Error:* No has configurado tu Token de GitHub en el código del comando.`);
    }

    try {
        let filePath = text.trim().replace(/^\/+/, ''); // Limpiar slashes iniciales
        let commitMessage = `Crear carpeta y archivo ${filePath} via bot`;
        let fileContent = Buffer.from(`# Creado automáticamente por el bot\nCarpeta: ${filePath}`).toString('base64');

        await m.reply(`*⏳ Conectando con GitHub para crear la carpeta/archivo...*`);

        // URL de la API de GitHub para crear/actualizar contenidos
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
            await m.reply(`*✅ ¡Carpeta y archivo creados en GitHub con éxito!* \n\n📁 **Ruta:** \`${filePath}\`\n\n*💡 Ahora solo haz tu commit o pon tu comando de actualización para que el bot baje los cambios.*`);
        } else {
            await m.reply(`*❌ Error de GitHub:* \`${data.message || 'No se pudo completar la acción'}\``);
        }

    } catch (error) {
        console.error('Error al conectar con GitHub:', error);
        await m.reply(`*❌ Ocurrió un error crítico:* \`${error.message}\``);
    }
};

handler.help = ['crearcarpeta <ruta/archivo>'];
handler.tags = ['owner'];
handler.command = /^(crearcarpeta|ghmkdir|addfolder)$/i;
handler.rowner = true;

export default handler;
