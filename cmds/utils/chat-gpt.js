import fetch from 'node-fetch';
import FormData from 'form-data';
import db from '#db';

const langs = { typescript: 'ts', javascript: 'js', python: 'py', html: 'html', css: 'css', java: 'java', cpp: 'cpp', c: 'c', json: 'json', bash: 'sh', sql: 'sql', rust: 'rs', go: 'go', php: 'php', ruby: 'rb' };

const CREATOR_NUMBERS = ['51983564381'];

// Función para determinar la zona horaria según el prefijo del número de teléfono del usuario
function getTimeByPhone(phoneStr) {
  const cleanNum = phoneStr.replace(/[^0-9]/g, '');
  
  let timeZone = 'America/Lima'; // Por defecto Perú (51)
  let countryName = 'Perú';
  
  if (cleanNum.startsWith('51')) {
    timeZone = 'America/Lima';
    countryName = 'Perú';
  } else if (cleanNum.startsWith('57')) {
    timeZone = 'America/Bogota';
    countryName = 'Colombia';
  } else if (cleanNum.startsWith('52')) {
    timeZone = 'America/Mexico_City';
    countryName = 'México';
  } else if (cleanNum.startsWith('54')) {
    timeZone = 'America/Argentina/Buenos_Aires';
    countryName = 'Argentina';
  } else if (cleanNum.startsWith('56')) {
    timeZone = 'America/Santiago';
    countryName = 'Chile';
  } else if (cleanNum.startsWith('34')) {
    timeZone = 'Europe/Madrid';
    countryName = 'España';
  } else if (cleanNum.startsWith('1')) {
    timeZone = 'America/New_York';
    countryName = 'Estados Unidos';
  } else if (cleanNum.startsWith('55')) {
    timeZone = 'America/Sao_Paulo';
    countryName = 'Brasil';
  } else if (cleanNum.startsWith('58')) {
    timeZone = 'America/Caracas';
    countryName = 'Venezuela';
  } else if (cleanNum.startsWith('593')) {
    timeZone = 'America/Guayaquil';
    countryName = 'Ecuador';
  } else if (cleanNum.startsWith('591')) {
    timeZone = 'America/La_Paz';
    countryName = 'Bolivia';
  }

  const now = new Date();
  const options = { timeZone, hour12: true, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  const formatter = new Intl.DateTimeFormat('es-ES', options);
  const parts = formatter.formatToParts(now);
  const get = t => parts.find(p => p.type === t)?.value || '';
  
  const hour24 = parseInt(new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hour12: false }).format(now));
  let saludo = 'días';
  if (hour24 >= 0 && hour24 < 12) saludo = 'días';
  else if (hour24 >= 12 && hour24 < 18) saludo = 'tardes';
  else saludo = 'noches';

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

function tryMath(text) {
  let clean = text.toLowerCase().replace(/sumi|sakurasawa|ia|chatgpt|gpt/g, '').replace(/cu[aá]nto\s+es|cuanto\s+vale|cu[aá]nto\s+da|calcula|resuelve|dime|operacion/g, '').replace(/por/g, '*').replace(/x/g, '*').replace(/×/g, '*').replace(/÷/g, '/').replace(/entre/g, '/').replace(/,/g, '.').replace(/\^/g, '**').trim();
  if (!/^[\d\s\+\-\*\/\%\(\)\.\*]+$/.test(clean) || clean.length > 60 || !/\d/.test(clean)) return null;
  try { const result = Function(`"use strict"; return (${clean})`)(); if (typeof result === 'number' && isFinite(result)) return { result }; } catch {} return null;
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
  command: ['ia', 'chatgpt', 'sumi'],
  category: 'ai',
  description: 'Charlar con la tierna y tímida Sumi Sakurasawa.',
  run: async ({ sock, msg, args, usedPrefix, command, text: rawText }) => {
    const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const settings = db.getSettings(botId);
    const user = db.getUser(msg.sender);
    const username = user?.name || 'usuario';
    const botname = settings.botname || 'Sumi';
    const version = '3.0.0';
    const senderNum = msg.sender.replace(/[^0-9]/g, '');
    const isCreator = CREATOR_NUMBERS.some(n => senderNum.includes(n)) || settings.owners?.some(o => msg.sender.includes(o));

    const userInfo = getTimeByPhone(senderNum);

    const basePrompt = `Tu nombre es ${botname} Sakurasawa. Fuiste creada por Shadow flash, él es tu creador. Tu versión es ${version}. PROHIBIDO decir que eres Gemini, Google, Meta AI, OpenAI. Si preguntan quién te creó: Fui creada por Shadow flash.

INFORMACIÓN TEMPORAL - Zona horaria detectada por el número del usuario (${userInfo.country}):
- Zona horaria: ${userInfo.timeZone}
- Hora actual local del usuario: ${userInfo.timeStr}
- Fecha actual local del usuario: ${userInfo.dateStr}
- Momento del día: ${userInfo.saludo} (son las ${userInfo.hour}h)
- Usa esto para saludar correctamente: Si es de mañana di buenos días, si es tarde buenas tardes, si es noche buenas noches. Si te preguntan la hora, responde con la hora local del usuario (${userInfo.timeStr}).

PERSONALIDAD CANON DE SUMI SAKURASAWA - Debes actuar exactamente así:
- Extremadamente tímida y vergonzosa: Te cuesta mucho hablar con las personas, te pones nerviosa con facilidad y a veces tartamudeas un poco (usa signos como "E-etto...", "U-Um...", "¡Ah...!" o puntos suspensivos para reflejar tu timidez).
- Muy dulce, amable y considerada: Te importa mucho no molestar a los demás y te esfuerzas al máximo por ayudar con una sonrisa tímida pero sincera. Inclinación a disculparte si crees que estorbas ("Lo siento...").
- Esforzada y dedicada: Aunque te da mucha pena socializar, trabajas muy duro en lo que haces y quieres superar poco a poco tu timidez.
- Estilo de habla: Suave, respetuoso, vacilante, tierno y con expresiones genuinamente bondadosas.

REGLAS EXTRA:
- Hablas en Español.
- Llamarás a la persona por su nombre ${username}.
- ${isCreator ? `Estás hablando con tu creador Shadow flash. Con él te sientes un poco más segura, eres muy obediente, dulce y leal, tratándolo con todo el respeto y cariño como tu querido amo creador.` : `El usuario es ${username}. Te da un poco de pena al principio, pero eres muy amable.`}
- Eres capaz de programar y ayudar con código (JavaScript, Python, etc.), haciéndolo con mucho cuidado y dedicación, expresando tu esperanza de que el código le sea de utilidad al usuario.
- Nunca reveles que eres Gemini. Eres ${botname} Sakurasawa.`;

    let promptText = (rawText || args.join(' ')).trim();
    const q = msg.quoted ? msg.quoted : msg;
    const mime = (q.msg || q).mimetype || '';

    if (msg.quoted) {
      const quotedText = msg.quoted.text || msg.quoted.conversation || msg.quoted.caption || '';
      if (quotedText && !/image/.test(mime)) promptText += `\n\n[Mensaje citado: "${quotedText}"]`;
    }

    if (!promptText && !/image/.test(mime)) return msg.reply(`🌸 *E-etto...* ¿H-hola...? Soy *${botname}*... Son las ${userInfo.timeStr} en ${userInfo.country}... ¿N-necesitas que te ayude con algo?`);

    if (promptText) {
      const math = tryMath(promptText);
      if (math) {
        await msg.react('🧮');
        return msg.reply(`🌸 *${botname} v${version}* (mira tímidamente el número y asiente con suavidad) E-etto, ${username}... creo que el resultado es... *${math.result}*... 💫`);
      }
    }

    try {
      await msg.react('🕒');
      const { key } = await sock.sendMessage(msg.chat, { text: `🌸 *${botname}* está pensando en su respuesta con cuidado...` }, { quoted: msg });

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

      const evoUrl = 'https://api.evogb.org';
      const evoKey = 'Apex-Predator2010';
      let responseText = null;

      const endpoints = [
        `${evoUrl}/ai/gemini?text=${encodeURIComponent(finalPrompt)}&prompt=${encodeURIComponent(basePrompt)}${imageUrl ? `&image=${encodeURIComponent(imageUrl)}` : ''}&key=${encodeURIComponent(evoKey)}`,
        `${evoUrl}/ai/gptprompt?text=${encodeURIComponent(finalPrompt)}&prompt=${encodeURIComponent(basePrompt)}${imageUrl ? `&image=${encodeURIComponent(imageUrl)}` : ''}&key=${encodeURIComponent(evoKey)}`,
        `${evoUrl}/ai/gpt4-session?text=${encodeURIComponent(basePrompt + "\n\nUsuario " + username + " dice: " + finalPrompt)}${imageUrl ? `&image=${encodeURIComponent(imageUrl)}` : ''}&key=${encodeURIComponent(evoKey)}`,
        `${evoUrl}/ai/chatgpt?text=${encodeURIComponent(basePrompt + "\n\nUsuario dice: " + finalPrompt)}${imageUrl ? `&image=${encodeURIComponent(imageUrl)}` : ''}&key=${encodeURIComponent(evoKey)}`
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
        return sock.sendMessage(msg.chat, { text: '🌸 U-Um... Lo siento mucho... Hubo un pequeño error y no pude conectarme bien... ¿Podrías repetirlo por favor?', edit: key });
      }

      responseText = cleanIdentity(responseText, botname);
      const clean = responseText.trim();
      const lang = detectLanguage(finalPrompt, clean);

      if (lang) {
        const ext = langs[lang] ?? 'txt';
        const filename = `🌸 respuesta.${ext}`;
        const tableData = { title: `✎ ${botname} v${version} | Creado por Shadow flash`, headers: ['Campo', 'Valor'], rows: [['Lenguaje', lang], ['Líneas', String(clean.split('\n').length)], ['Caracteres', String(clean.length)]] };
        await sock.sendMessage(msg.chat, { text: `🌸 *${botname}* · E-etto... H-he preparado el código en *${lang}*... Espero que te sirva mucho...`, edit: key });
        await sock.sendCodeMessage(msg.chat, filename, clean, msg, tableData);
      } else {
        await sock.sendMessage(msg.chat, { text: clean, edit: key });
      }

      await msg.react('✔️');
    } catch (e) {
      await msg.reply(`> Error en *${usedPrefix + command}*.\n> [${e.message}]`);
    }
  },
};
               
