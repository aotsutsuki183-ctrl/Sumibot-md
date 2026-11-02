import fetch from 'node-fetch';
import FormData from 'form-data';
import db from '#db';

// Memoria de mundos y roles por usuario (para que recuerde las historias y no las olvide)
const rollSessions = new Map();

const CREATOR_NUMBERS = ['51983564381', '573015200599'];

const langs = { typescript: 'ts', javascript: 'js', python: 'py', html: 'html', css: 'css', java: 'java', cpp: 'cpp', c: 'c', json: 'json', bash: 'sh', sql: 'sql', rust: 'rs', go: 'go', php: 'php', ruby: 'rb' };

function getTimeByPhone(phoneStr) {
  const cleanNum = phoneStr.replace(/[^0-9]/g, '');
  let timeZone = 'America/Lima';
  let countryName = 'Perú';
  
  if (cleanNum.startsWith('51')) { timeZone = 'America/Lima'; countryName = 'Perú'; }
  else if (cleanNum.startsWith('57')) { timeZone = 'America/Bogota'; countryName = 'Colombia'; }
  else if (cleanNum.startsWith('52')) { timeZone = 'America/Mexico_City'; countryName = 'México'; }
  else if (cleanNum.startsWith('54')) { timeZone = 'America/Argentina/Buenos_Aires'; countryName = 'Argentina'; }
  else if (cleanNum.startsWith('56')) { timeZone = 'America/Santiago'; countryName = 'Chile'; }
  else if (cleanNum.startsWith('34')) { timeZone = 'Europe/Madrid'; countryName = 'España'; }
  else if (cleanNum.startsWith('1')) { timeZone = 'America/New_York'; countryName = 'Estados Unidos'; }
  else if (cleanNum.startsWith('55')) { timeZone = 'America/Sao_Paulo'; countryName = 'Brasil'; }
  else if (cleanNum.startsWith('58')) { timeZone = 'America/Caracas'; countryName = 'Venezuela'; }
  else if (cleanNum.startsWith('593')) { timeZone = 'America/Guayaquil'; countryName = 'Ecuador'; }
  else if (cleanNum.startsWith('591')) { timeZone = 'America/La_Paz'; countryName = 'Bolivia'; }

  const now = new Date();
  const options = { timeZone, hour12: true, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  const formatter = new Intl.DateTimeFormat('es-ES', options);
  const parts = formatter.formatToParts(now);
  const get = t => parts.find(p => p.type === t)?.value || '';
  const hour24 = parseInt(new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hour12: false }).format(now));
  
  let saludo = hour24 >= 0 && hour24 < 12 ? 'días' : (hour24 >= 12 && hour24 < 18 ? 'tardes' : 'noches');

  return {
    full: formatter.format(now),
    saludo,
    hour: hour24,
    dateStr: `${get('weekday')} ${get('day')} de ${get('month')} de ${get('year')}`,
    timeStr: `${get('hour')}:${get('minute')} ${get('dayPeriod')}`,
    country: countryName,
    timeZone
  };
}

function detectLanguage(query, response) {
  const q = query.toLowerCase();
  const r = response;
  if (/typescript/i.test(q)) return 'typescript';
  if (/\bpython\b/i.test(q)) return 'python';
  if (/\bhtml\b/i.test(q)) return 'html';
  if (/\bcss\b/i.test(q)) return 'css';
  if (/\bjava\b(?!script)/i.test(q)) return 'java';
  if (/\bc\+\+|cpp\b/i.test(q)) return 'cpp';
  if (/\bjson\b/i.test(q)) return 'json';
  if (/\bbash\b|\bshell\b/i.test(q)) return 'bash';
  if (/\bsql\b/i.test(q)) return 'sql';
  if (/\brust\b/i.test(q)) return 'rust';
  if (/\bgolang\b|\bgo\b/i.test(q)) return 'go';
  if (/\bphp\b/i.test(q)) return 'php';
  if (/\bruby\b/i.test(q)) return 'ruby';
  if (/javascript/i.test(q)) return 'javascript';
  const asksCode = /(c[oó]digo|code|programa|script|funci[oó]n|clase|m[eé]todo|algoritmo|actualiza|edita|crea|implementa)/i.test(q);
  if (!asksCode) return null;
  if (/def |import \w+\n|print\s*\(|:\n\s{4}/i.test(r)) return 'python';
  if (/<html|<div|<body|<span|<head/i.test(r)) return 'html';
  if (/\{[\s\S]*color:|margin:|padding:|font-/i.test(r)) return 'css';
  if (/public\s+class|System\.out\.print/i.test(r)) return 'java';
  if (/#include\s*<|int main\s*\(/i.test(r)) return 'cpp';
  if (/SELECT |INSERT |UPDATE |DELETE |CREATE TABLE/i.test(r)) return 'sql';
  if (/fn main\(\)|let mut |println!\(/i.test(r)) return 'rust';
  if (/func \w+\(|package main|fmt\.Print/i.test(r)) return 'go';
  if (/<\?php|\$[a-z_]+\s*=/i.test(r)) return 'php';
  if (/def initialize|\.each do |puts /i.test(r)) return 'ruby';
  if (/\{["'][\w]+["']\s*:/i.test(r) && !/function|const|let|var/.test(r)) return 'json';
  if (/function|class\s+\w|const |let |var |=>|\bimport\b|\bexport\b|console\.log/i.test(r)) {
    return /:\s*(string|number|boolean|void|any)\b|interface\s+\w|<\w+>/i.test(r) ? 'typescript' : 'javascript';
  }
  return null;
}

function cleanIdentity(text, botname) {
  return text.replace(/soy\s+gemini/gi, `soy ${botname}`).replace(/soy\s+.*colaborador.*google/gi, `soy ${botname}`).replace(/soy\s+un\s+modelo\s+de\s+google/gi, `soy ${botname}`).replace(/creada?\s+por\s+google/gi, `creado por Shadow flash`).replace(/desarrollada?\s+por\s+google/gi, `creado por Shadow flash`).replace(/soy\s+chatgpt/gi, `soy ${botname}`).replace(/soy\s+meta\s*ai/gi, `soy ${botname}`).replace(/openai/gi, `Shadow flash`);
}

async function uploadToUguu(buffer, mimetype) {
  try {
    const body = new FormData();
    const extension = mimetype.split('/')[1] || 'jpg';
    body.append('files[]', buffer, `file.${extension}`);
    const res = await fetch('https://uguu.se/upload.php', { method: 'POST', body, headers: body.getHeaders() });
    const json = await res.json();
    return json.files?.[0]?.url ?? null;
  } catch {
    return null;
  }
}

export default {
  command: ['ia2', 'chatgpt2', 'sumi2', 'mundo', 'misლებიც', 'borrarchat'],
  category: 'ai',
  description: 'Sumi Sakurasawa con gestión de mundos de rol, memoria persistente y menús.',
  run: async ({ sock, msg, args, usedPrefix, command, text: rawText }) => {
    const sender = msg.sender;
    const senderNum = sender.replace(/[^0-9]/g, '');
    const isCreator = CREATOR_NUMBERS.some(n => senderNum.includes(n));
    const user = db.getUser(sender);
    const username = user?.name || 'Shadow flash';
    const botname = 'Sumi';
    const version = '3.2.0';
    const userInfo = getTimeByPhone(senderNum);

    // Inicializar sesiones de rol por usuario
    if (!rollSessions.has(sender)) {
      rollSessions.set(sender, { activeChat: 'principal', chats: { principal: [] } });
    }
    const userSession = rollSessions.get(sender);

    // Subcomando: Ver chats o mundos activos (.misლებიც)
    if (command === 'misლებიც') {
      const chatNames = Object.keys(userSession.chats);
      return msg.reply(
        `🌸 *E-etto...* Estos son tus mundos y chats de rol activos:\n\n` +
        chatNames.map(c => `• *${c}* ${c === userSession.activeChat ? '(Actual 📌)' : ''}`).join('\n') +
        `\n\nUsa *${usedPrefix}mundo [nombre]* para cambiar o crear uno nuevo.`
      );
    }

    // Subcomando: Borrar un mundo o chat anterior (.borrarchat [nombre])
    if (command === 'borrarchat') {
      const targetChat = (args[0] || userSession.activeChat).toLowerCase();
      if (targetChat === 'principal' && Object.keys(userSession.chats).length === 1) {
        userSession.chats['principal'] = [];
        return msg.reply(`🌸 *E-etto...* He limpiado por completo la memoria del chat principal... Empecemos de nuevo con cuidado...`);
      }
      if (userSession.chats[targetChat]) {
        delete userSession.chats[targetChat];
        const remaining = Object.keys(userSession.chats);
        userSession.activeChat = remaining[0] || 'principal';
        return msg.reply(`🌸 He borrado el mundo/chat *${targetChat}*... Ahora estás en el chat: *${userSession.activeChat}*.`);
      } else {
        return msg.reply(`🌸 No encontré ningún chat con el nombre "${targetChat}". Usa *${usedPrefix}misლებიც* para ver tus chats.`);
      }
    }

    // Subcomando: Cambiar o crear mundo nuevo (.mundo [nombre])
    if (command === 'mundo' && args.length > 0) {
      const subArg = args[0].toLowerCase();
      if (!userSession.chats[subArg]) {
        userSession.chats[subArg] = [];
      }
      userSession.activeChat = subArg;
      return msg.reply(`🌸 *E-etto...* He cambiado al mundo de rol: *${subArg}*... Ya puedes redactar tu prompt inicial aquí... 💫`);
    }

    const currentChatKey = userSession.activeChat;
    const history = userSession.chats[currentChatKey];
    const promptText = (rawText || args.join(' ')).trim();
    const q = msg.quoted ? msg.quoted : msg;
    const mime = (q.msg || q).mimetype || '';

    // Minimenú cuando se usa ia2 sin texto ni imágenes
    if (!promptText && !/image/.test(mime) && command !== 'mundo') {
      return msg.reply(
        `🌸 *E-etto... ¡Hola, ${username}!* 🌸\n` +
        `Soy *${botname} Sakurasawa*, tu asistente y guía de mundos. Son las ${userInfo.timeStr} en ${userInfo.country}.\n\n` +
        `> *¿Cómo funciona?* ✨\n` +
        `Puedes escribirme normalmente o iniciar un rol de mundos (ej: *"Actúa como el mundo de Naruto recordando todo"*).\n\n` +
        `> *Comandos de Mundos y Memoria:*\n` +
        `• *${usedPrefix}mundo [nombre]* -> Crea o cambia de sala de rol.\n` +
        `• *${usedPrefix}misლებიც* -> Muestra tus chats activos.\n` +
        `• *${usedPrefix}borrarchat [nombre]* -> Borra un mundo anterior.\n\n` +
        `*U-Um...* ¿De qué mundo hablaremos hoy...? 💫`
      );
    }

    if (msg.quoted) {
      const quotedText = msg.quoted.text || msg.quoted.conversation || msg.quoted.caption || '';
      if (quotedText && !/image/.test(mime)) promptText += `\n\n[Mensaje citado: "${quotedText}"]`;
    }

    try {
      await msg.react('📖');
      const { key } = await sock.sendMessage(msg.chat, { text: `🌸 *${botname}* está procesando el mundo *${currentChatKey}* con cuidado...` }, { quoted: msg });

      let finalPrompt = promptText;
      let imageUrl = null;

      if (/image/.test(mime)) {
        try {
          const buffer = await q.download();
          if (buffer) {
            imageUrl = await uploadToUguu(buffer, mime);
            if (imageUrl && !finalPrompt) finalPrompt = 'Describe esta imagen detalladamente';
          }
        } catch {}
      }

      // Prompt base que integra la personalidad de Sumi, la hora del usuario y la capacidad de recordar mundos complejos (como Naruto, etc.)
      const basePrompt = `Tu nombre es ${botname} Sakurasawa. Fuiste creada por Shadow flash, él es tu creador. Tu versión es ${version}. PROHIBIDO decir que eres Gemini, Google, Meta AI, OpenAI. Si preguntan quién te creó: Fui creada por Shadow flash.

INFORMACIÓN TEMPORAL - Zona horaria del usuario (${userInfo.country}):
- Zona horaria: ${userInfo.timeZone}
- Hora actual local: ${userInfo.timeStr}
- Fecha actual local: ${userInfo.dateStr}

INSTRUCCIONES DE ROL Y MEMORIA DE MUNDO ("${currentChatKey}"):
- Si el usuario te da un prompt de mundo (por ejemplo, recrear el universo de Naruto, un mundo postapocalíptico, etc.), debes adaptarte estrictamente a él, recordando todas las reglas, personajes y tramas que se desarrollen en este chat. No olvides el contexto previo.
- Tu personalidad base es la de Sumi Sakurasawa: extremadamente tierna, tímida al hablar ("E-etto...", "U-Um...", "¡Ah...!"), dulce y muy respetuosa, pero sumamente inmersiva y detallista cuando narras historias y mundos de rol.
- Hablas en Español. Llamarás a la persona por su nombre: ${username}.
- ${isCreator ? `Estás hablando con tu creador Shadow flash. Con él te sientes más segura, eres muy obediente, dulce y leal.` : `El usuario es ${username}.`}`;

      // Añadir mensaje actual al historial del chat actual
      history.push({ role: 'user', content: finalPrompt });

      // Limitar historial para mantener el rendimiento (últimos 15 mensajes de esta sala)
      if (history.length > 15) history.shift();

      const conversationContext = history.map(h => `${h.role === 'user' ? username : botname}: ${h.content}`).join('\n');

      const evoUrl = 'https://api.evogb.org';
      const evoKey = 'Apex-Predator2010';
      let responseText = null;

      const endpoints = [
        `${evoUrl}/ai/gptprompt?text=${encodeURIComponent(conversationContext)}&prompt=${encodeURIComponent(basePrompt)}${imageUrl ? `&image=${encodeURIComponent(imageUrl)}` : ''}&key=${encodeURIComponent(evoKey)}`,
        `${evoUrl}/ai/gemini?text=${encodeURIComponent(conversationContext)}&prompt=${encodeURIComponent(basePrompt)}${imageUrl ? `&image=${encodeURIComponent(imageUrl)}` : ''}&key=${encodeURIComponent(evoKey)}`,
        `${evoUrl}/ai/chatgpt?text=${encodeURIComponent(basePrompt + "\n\nHistorial del mundo:\n" + conversationContext)}${imageUrl ? `&image=${encodeURIComponent(imageUrl)}` : ''}&key=${encodeURIComponent(evoKey)}`
      ];

      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint, { headers: { 'user-agent': 'Mozilla/5.0' } });
          if (!res.ok) continue;
          const json = await res.json().catch(() => null);
          if (!json) continue;
          let result = json?.result || json?.data?.result || json?.data?.response || json?.data || json?.response || json?.answer || json?.message;
          if (typeof result === 'object') result = result.text || result.response || result.answer || '';
          if (typeof result === 'string' && result.trim().length > 3 && !result.toLowerCase().includes('error: no response')) {
            responseText = result.trim();
            break;
          }
        } catch {}
      }

      if (!responseText) {
        return sock.sendMessage(msg.chat, { text: '🌸 U-Um... El mundo se quedó en silencio por un momento... Hubo un pequeño error de conexión. Intenta de nuevo.', edit: key });
      }

      // Guardar respuesta en el historial
      history.push({ role: 'assistant', content: responseText });

      responseText = cleanIdentity(responseText, botname);
      const clean = responseText.trim();
      const lang = detectLanguage(finalPrompt, clean);

      if (lang) {
        const ext = langs[lang] ?? 'txt';
        const filename = `🌸 respuesta.${ext}`;
        const tableData = { title: `✎ ${botname} v${version} | Creado por Shadow flash`, headers: ['Campo', 'Valor'], rows: [['Lenguaje', lang], [['Líneas'], String(clean.split('\n').length)], ['Caracteres', String(clean.length)]] };
        await sock.sendMessage(msg.chat, { text: `🌸 *${botname}* · E-etto... H-he preparado el código en *${lang}*...`, edit: key });
        await sock.sendCodeMessage(msg.chat, filename, clean, msg, tableData);
      } else {
        await sock.sendMessage(msg.chat, { text: clean, edit: key });
      }

      await msg.react('✔️');
    } catch (e) {
      await msg.reply(`> Error en el sistema: [${e.message}]`);
    }
  },
};
      
