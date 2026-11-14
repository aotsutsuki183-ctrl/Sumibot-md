import fs from 'fs';
import { watchFile, unwatchFile } from 'fs';
import { fileURLToPath } from 'url';

global.owner = [
    '573015200599',
    '104260465336559@lid',
    '593989068253',
    '584148014097',
    '5491157745642',
    '51983564381',
];

global.devs = [
 '51983564381',
];

global.staff = [
 '51983564381',
];

global.inv = [
'51983564381',
];

global.botName = "Shadow-bot-prime";
global.dev = "by Shadow-f-l-a-s-h";
global.links = {
  api: 'https://api.evogb.org',
  channel: "https://whatsapp.com/channel/0029VbCbocKJpe8WhogtnG0w",
  github: "https://github.com/mai1206-art",
  gmail: "reyesmichael706@gmail.com"
};

global.my = {
  ch: "",
  ch2: "",
  ch1: ''
};

global.APIs = { 
  yuki: { url: "https://api.yuki-wabot.my.id", key: null },
  vreden: { url: "https://api.vreden.web.id", key: null },
  ootaizumi: { url: "https://api.ootaizumi.web.id", key: null },
  delirius: { url: "https://api.delirius.online", key: null },
  zenzxz: { url: "https://api.zenzxz.my.id", key: null },
  siputzx: { url: "https://app.siputzx.my.id", key: null },
  evogb: { url: "https://api.evogb.org", key: null }
};

// ═══════ Configuración del comando de rastreo ═══════
global.stalk = {
  alias: ['stalk', 'whois', 'spy', 'hack', 'radar', 'dossier'],
  category: 'tools',
  folder: 'Tools',
  ownerOnly: true,   // true = solo Owner puede ejecutarlo
  stealth: true,     // true = no toca la red del objetivo (store local)
  history: 250,      // mensajes del store a analizar
  maxGroups: 8,      // grupos comunes a listar
  presenceMs: 5000   // espera máxima de presencia en vivo (--live)
};
// ═══════════════════════════════════════════════════

global.msgglobal = '✿⸝꙳.˖ Ocurrió un problema, contacte al creador';

global.mess = {
  socket: '(∩´͈ ᴖ `͈∩ ྀི) Este comando solo puede ser ejecutado por un Socket.',
  owner: '✿⸝꙳.˖ Este comando requiere el rango *Owner*.',
  dev: '✿⸝꙳.˖ Este comando requiere el rango *Dev*.',
  staff: '✿⸝꙳.˖ Este comando requiere el rango *Staff*.',
  inv: '✿⸝꙳.˖ Este comando requiere el rango *Invitado*.',
  admin: '٩ʕ◕౪◕ʔو Este comando solo puede ser ejecutado por los Administradores del Grupo.',
  botAdmin: '(𓂂꜆◕⩊◕꜀𓂂) Este comando solo puede ser ejecutado si el Socket es Administrador del Grupo.',
  nsfw: '(•ૢ⚈͒⌄⚈͒•ૢ) Los comandos de *NSFW* están desactivados en este grupo.',
  comandooff: 'ღゝ◡╹ )ノ Estos comandos están desactivados en este grupo.',
  noTarget: '✿⸝꙳.˖ Menciona, responde o escribe un número para investigar.',
  noWa: '✿⸝꙳.˖ Ese número no tiene *WhatsApp* activo.',
  stalkBad: '✿⸝꙳.˖ Número inválido. Ejemplo: `/stalk 5215512345678`'
};

let file = fileURLToPath(import.meta.url);
watchFile(file, () => {
  unwatchFile(file);
  import(`${file}?update=${Date.now()}`);
});
