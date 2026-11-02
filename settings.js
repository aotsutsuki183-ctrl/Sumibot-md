import fs from 'fs';
import { watchFile, unwatchFile } from 'fs';
import { fileURLToPath } from 'url';

global.owner = [
  // mai
    '573015200599',
    '104260465336559@lid',
  // Bryan
    '593989068253',
    '584148014097',
 // 亗𝙽𝚎𝚝𝚑𝚎𝚛𝙻𝚘𝚛𝚍亗
    '5491157745642',
    '5491128178894',
  '51983564381', // capy
];

global.devs = [
  '584228025606', // 🤍💖
];

global.staff = [
  '5215548732469', // Zaako
  '51962502233', // 𝓙𝓮𝓼𝓾𝓾
  '50245695772', // JL
  '57995580944547@lid', //Stevan (Sair)
  '5217441863414', // werkito⁶⁶⁶
  '51983564381', //Alexa
];

global.inv = [
  '51983564381', // no tocar att Mai
  //uwu
    '51914797450',
    '265957830295654@lid',
];

global.dev = "Created by @mai";
global.links = {
  api: 'https://api.evogb.org',
  channel: "https://whatsapp.com/channel/0029VbCbocKJpe8WhogtnG0w",
  github: "https://github.com/mai1206-art",
  gmail: "reyesmichael706@gmail.com"
};

global.my = {
  ch: "120363420992828502@newsletter", // Oficial
  ch2: "120363405689107729@newsletter", // Api
  ch1: '120363401404146384@newsletter'
};

global.APIs = { 
  yuki: { url: "https://api.yuki-wabot.my.id", key: "YukiBot-MD" },
  vreden: { url: "https://api.vreden.web.id", key: null },
  ootaizumi: { url: "https://api.ootaizumi.web.id", key: null },
  delirius: { url: "https://api.delirius.online", key: null },
  zenzxz: { url: "https://api.zenzxz.my.id", key: null },
  siputzx: { url: "https://app.siputzx.my.id", key: null },
  evogb: {
    url: 'https://api.evogb.org',
    key: 'Apex-Predator2010'
  },
  pollinations: {
    url: 'https://gen.pollinations.ai',
    key: 'sk_DqqXIJt…' // <--- Tu clave de Pollinations que creaste en la web
  },
  genimg: {
    // Rutas candidatas: {prompt} y {key} se reemplazan solos.
    // En cuanto confirmes la ruta real, déjala PRIMERA o deja solo esa.
    normal: [
      '/ai/imagen?prompt={prompt}&key={key}',
      '/ai/generate-image?prompt={prompt}&key={key}',
      '/ai/text2img?prompt={prompt}&key={key}',
      '/ai/flux?prompt={prompt}&key={key}',
      '/ai/dalle?prompt={prompt}&key={key}'
    ],
    nsfw: [
      '/nsfw/imagen?prompt={prompt}&key={key}',
      '/nsfw/ia?prompt={prompt}&key={key}',
      '/nsfw/text2img?prompt={prompt}&key={key}',
      '/ai/nsfw?prompt={prompt}&key={key}',
      '/ai/imagen?prompt={prompt}&key={key}&nsfw=true'
    ]
  }
};

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
  comandooff: 'ღゝ◡╹ )ノ Estos comandos están desactivados en este grupo.'
};

let file = fileURLToPath(import.meta.url);
watchFile(file, () => {
  unwatchFile(file);
  import(`${file}?update=${Date.now()}`);
});
    
