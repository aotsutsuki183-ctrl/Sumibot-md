let db = null
try { db = (await import('#db')).default } catch {}

const CFG = global.stalk || {}

const norm = (jid = "") => jid.split(":")[0]
const clean = (jid = "") => jid.split(":")[0].split("@")[0]
const soloDigitos = (s = "") => String(s).replace(/\D/g, "")

const PRESENCE = {
  available: "🟢 En línea",
  unavailable: "⚫ Desconectado",
  composing: "✍️ Escribiendo ahora",
  recording: "🎙️ Grabando audio",
  paused: "⏸️ Dejó de escribir"
}

const EPHEMERAL = { 0: "Desactivado", 86400: "24 horas", 604800: "7 días", 7776000: "90 días" }

const stamp = (ts) => {
  if (!ts) return "Privado"
  try { return new Date(Number(ts) * 1000).toLocaleString("es-ES") } catch { return "Privado" }
}

const bar = (pct) => {
  const total = 12
  const lleno = Math.round((pct / 100) * total)
  return "█".repeat(lleno) + "░".repeat(total - lleno) + ` ${pct}%`
}

const TIPO = (t) => {
  const map = { conversation: "texto", extendedTextMessage: "texto", imageMessage: "imagen", videoMessage: "video", audioMessage: "audio", documentMessage: "documento", stickerMessage: "sticker", locationMessage: "ubicación", contactMessage: "contacto", pollCreationMessage: "encuesta", reactionMessage: "reacción", protocolMessage: "sistema" }
  return map[t] || t || "desconocido"
}

const variantes = (n) => {
  const v = [n]
  if (n.length > 12 && n[2] === "1") v.push(n.slice(0, 2) + n.slice(3))
  if (n.startsWith("52") && n.length === 12) v.push("521" + n.slice(2))
  if (n.startsWith("52") && n.length === 11) v.push("521" + n.slice(2))
  return [...new Set(v)]
}

const esOwner = (jid = "") => {
  const n = clean(jid)
  return (global.owner || []).some(o => clean(o) === n)
}

const tarjeta = (botName) => [
  "`❏ 𝗠𝗢𝗗𝗢 𝗜𝗡𝗩𝗘𝗦𝗧𝗜𝗚𝗔𝗖𝗜𝗢𝗡`",
  `> ⴵ *${botName}* ⵈ 𝗿𝗮𝘀𝘁𝗿𝗲𝗼 𝘀𝗶𝗴𝗶𝗹𝗼𝘀𝗼`,
  "ⵈⵈⵈⵈⵈⵈⵈⵈⵈⵈⵈⵈⵈⵈⵈ",
  "✿ *Uso*",
  "> ⴵ `/stalk 5215XXXXXXXXX`",
  "> ⴵ `/stalk 5215XXXXXXXXX --full`",
  "> ⴵ Responde a una tarjeta de contacto y usa `/stalk`",
  "",
  "✿ *Flags*",
  "> ⴵ `--full` ⵈ volcado JSON crudo",
  "> ⴵ `--deep` ⵈ fuerza historial desde el servidor",
  "> ⴵ `--live` ⵈ suscribe presencia en vivo",
  "",
  "✿ *Garantía*",
  "> ⴵ Nada se envía al chat del objetivo.",
  "> ⴵ Sin confirmaciones de lectura, sin ticks.",
  "ⵈⵈⵈⵈⵈⵈⵈⵈⵈⵈⵈⵈⵈⵈⵈ",
  `> *${botName}* ⴵ 𝗹𝗶𝘀𝘁𝗼 𝗽𝗮𝗿𝗮 𝗲𝗹 𝗮𝗰𝗲𝗰𝗵𝗼`
].join("\n")

export default {
  command: CFG.alias || ["stalk", "whois", "spy", "hack", "radar", "dossier"],
  category: CFG.category || "tools",
  run: async ({ msg, sock, args }) => {
    let botName = global.botName || "Shadow-bot-prime"
    if (db?.getSettings) {
      try { botName = (await db.getSettings(sock.user.id.split(":")[0] + "@s.whatsapp.net")).namebot || botName } catch {}
    }

    if (CFG.ownerOnly && !esOwner(msg.sender)) {
      return sock.sendMessage(msg.chat, { text: global.mess.owner }, { quoted: msg })
    }

    const full = args.some(a => /^--full$/i.test(a))
    const deep = args.some(a => /^--deep$/i.test(a))
    const live = args.some(a => /^--live$/i.test(a))
    const limpios = args.filter(a => !a.startsWith("--"))

    const enDM = msg.chat.endsWith("@s.whatsapp.net")

    /* ═══ Resolver objetivo ═══ */
    const vcard = msg.quoted?.message?.contactMessage?.vCard ||
      msg.quoted?.message?.contactsArrayMessage?.contacts?.[0]?.vCard
    let tipo = null
    let valor = null

    if (vcard) {
      const tel = vcard.match(/TEL[^:]*:\s*([+\d\s\-()]+)/i)
      if (tel && soloDigitos(tel[1]).length >= 7) { tipo = "vcard"; valor = soloDigitos(tel[1]) }
    }
    if (!tipo && msg.mentionedJid?.length) { tipo = "mention"; valor = msg.mentionedJid[0] }
    if (!tipo && limpios[0]) {
      const a = limpios[0]
      if (a.includes("@lid")) { tipo = "lid"; valor = norm(a) }
      else if (a.includes("@g.us")) { tipo = "group"; valor = norm(a) }
      else if (a.includes("@")) { tipo = "jid"; valor = norm(a) }
      else if (soloDigitos(a).length >= 7) { tipo = "numero"; valor = soloDigitos(a) }
      else return sock.sendMessage(msg.chat, { text: global.mess.stalkBad }, { quoted: msg })
    }
    if (!tipo && !enDM && msg.quoted?.sender) { tipo = "reply"; valor = msg.quoted.sender }
    if (!tipo) return sock.sendMessage(msg.chat, { text: tarjeta(botName) }, { quoted: msg })

    try { await sock.sendMessage(msg.chat, { react: { text: "🥷", key: msg.key } }) } catch {}

    /* ═══ Resolver JID / existencia ═══ */
    let jid = null
    let lid = null
    let existe = false

    if (tipo === "group") { jid = valor; existe = true }

    if (tipo === "lid") {
      lid = clean(valor)
      try {
        const pn = await sock.signalRepository?.lidMapping?.getPNForLID?.(valor)
        if (pn) { jid = norm(pn); existe = true }
      } catch {}
      if (!jid) {
        try {
          const r = await sock.onWhatsApp(valor)
          if (Array.isArray(r) && r[0]?.exists) { jid = norm(r[0].jid); existe = true }
        } catch {}
      }
    }

    if (!jid && tipo !== "group") {
      const pruebas = tipo === "numero" ? variantes(valor) : [clean(valor)]
      for (const n of pruebas) {
        try {
          const r = await sock.onWhatsApp(n + "@s.whatsapp.net")
          if (Array.isArray(r) && r[0]?.exists) {
            existe = true
            jid = norm(r[0].jid)
            if (r[0].lid) lid = clean(r[0].lid)
            break
          }
        } catch {}
      }
    }

    if (!existe || !jid) return sock.sendMessage(msg.chat, { text: global.mess.noWa }, { quoted: msg })

    const isGroup = jid.endsWith("@g.us")
    const crudo = {}

    /* ═══ Bloqueo ═══ */
    let blocked = false
    try { blocked = (await sock.fetchBlocklist()).some(j => norm(j) === jid) } catch {}

    /* ═══ Store ═══ */
    const contact = sock.store?.contacts?.[jid] || {}
    crudo.contact = contact
    const savedName = contact.name || contact.verifiedName || contact.notify || null
    const inAgenda = !!contact.name
    const lidStore = contact.lid ? clean(contact.lid) : null
    const imgStore = contact.imgUrl || null

    const chat = sock.store?.chats?.[jid] || {}
    crudo.chat = chat
    const unread = chat.unreadCount || 0
    const pinned = !!chat.pinned
    const archived = !!chat.archived
    const muteado = !!chat.muteEndTime && Number(chat.muteEndTime) * 1000 > Date.now()
    const ultimoMsg = chat.conversationTimestamp || null

    /* ═══ Perfil ═══ */
    let pp = null
    let ppPrev = null
    try { pp = await sock.profilePictureUrl(jid, "image") } catch {}
    try { ppPrev = await sock.profilePictureUrl(jid, "preview") } catch {}

    let about = null
    let aboutAt = null
    try {
      const st = await sock.fetchStatus(jid)
      about = st?.status || null
      aboutAt = st?.setAt || null
    } catch {}

    let efimero = null
    try { efimero = await sock.fetchDisappearingDuration(jid) } catch {}

    let dispositivos = null
    try {
      const dev = await sock.fetchDevices([jid])
      const d = Array.isArray(dev) ? dev.find(x => norm(x.user) === jid) : null
      if (d?.devices) dispositivos = d.devices.length
    } catch {}

    let biz = null
    try { biz = await sock.getBusinessProfile(jid) } catch {}

    let catalogo = null
    if (biz) { try { catalogo = (await sock.getCatalog({ jid, limit: 10 }))?.products?.length ?? null } catch {} }

    let labels = []
    try {
      const all = await sock.fetchLabels()
      labels = (all || []).filter(l => (l.chats || []).some(c => norm(c) === jid)).map(l => l.name || l.id)
    } catch {}

    /* ═══ Presencia ═══ */
    let pres = sock.store?.presences?.[jid] || null
    const tocarPresencia = live || !CFG.stealth
    if (!isGroup && tocarPresencia) {
      const vivo = await new Promise(async (resolve) => {
        let done = false
        const finish = (v) => { if (!done) { done = true; sock.ev.off("presence.update", onUpd); resolve(v) } }
        const onUpd = (u) => {
          if (u?.id && norm(u.id) !== jid) return
          const p = u?.presences?.[jid] || Object.entries(u?.presences || {}).find(([k]) => norm(k) === jid)?.[1]
          if (p) finish(p)
        }
        sock.ev.on("presence.update", onUpd)
        try { await sock.presenceSubscribe(jid) } catch {}
        setTimeout(() => finish(null), CFG.presenceMs || 5000)
      })
      if (vivo) pres = vivo
    }

    /* ═══ Historial ═══ */
    const limite = CFG.history || 250
    let hist = []
    const cache = sock.store?.messages?.[jid]
    if (cache) hist = Object.values(cache)
    if ((!CFG.stealth || deep) && hist.length < limite) {
      try { hist = await sock.loadMessages(jid, limite) } catch {}
    }
    const histReal = (hist || []).filter(x => x?.message && !x.message.protocolMessage)
    const total = histReal.length
    const deEllos = histReal.filter(x => !x.key?.fromMe).length
    const tipos = {}
    let chars = 0
    let primera = null
    let ultima = null
    const horas = {}
    for (const h of histReal) {
      const k = TIPO(Object.keys(h.message || {})[0])
      tipos[k] = (tipos[k] || 0) + 1
      chars += (h.message?.conversation || h.message?.extendedTextMessage?.text || "").length
      const ts = Number(h.messageTimestamp) || null
      if (ts) {
        if (!primera || ts < primera) primera = ts
        if (!ultima || ts > ultima) ultima = ts
        const hr = new Date(ts * 1000).getHours()
        horas[hr] = (horas[hr] || 0) + 1
      }
    }
    const horaTop = Object.entries(horas).sort((a, b) => b[1] - a[1])[0]
    const tipoTop = Object.entries(tipos).sort((a, b) => b[1] - a[1])[0]

    /* ═══ Vínculos ═══ */
    let comunes = []
    let adminEn = 0
    if (!isGroup) {
      try {
        const all = await sock.groupFetchAllParticipating()
        for (const g of Object.values(all)) {
          const yo = g.participants?.find(p => norm(p.id) === jid)
          if (yo) { comunes.push(g.subject); if (yo.admin) adminEn++ }
        }
      } catch {}
    }

    let gmeta = null
    if (isGroup) { try { gmeta = await sock.groupMetadata(jid) } catch {} }

    /* ═══ Exposición ═══ */
    const exposiciones = []
    const sumar = (cond, label) => { if (cond) exposiciones.push(label) }
    sumar(!!pp, "Foto de perfil abierta")
    sumar(!!about, "Frase visible")
    sumar(!!aboutAt, "Fecha de la frase expuesta")
    sumar(pres?.lastKnownPresence === "available", "Conexión en vivo visible")
    sumar(!!pres?.lastSeen, "Última conexión expuesta")
    sumar(!efimero, "Sin mensajes temporales")
    sumar(!!biz, "Cuenta business pública")
    sumar(!!lid || !!lidStore, "LID resoluble")
    sumar(!!dispositivos && dispositivos > 1, "Multi-dispositivo")
    sumar(inAgenda, "Guardado en agenda del bot")
    const score = Math.round((exposiciones.length / 10) * 100)
    const nivel = score >= 80 ? "CRÍTICA" : score >= 60 ? "ALTA" : score >= 35 ? "MEDIA" : "BAJA"

    const L = []
    L.push("`❏ 𝗗𝗢𝗦𝗦𝗜𝗘𝗥 𝗗𝗘 𝗥𝗔𝗦𝗧𝗥𝗘𝗢`")
    L.push(`> ⴵ *${botName}* ⵈ 𝗺𝗼𝗱𝗼 ${CFG.stealth && !live ? "🥷 𝘀𝗶𝗴𝗶𝗹𝗼𝘀𝗼" : "🔊 𝗮𝗰𝘁𝗶𝘃𝗼"}`)
    L.push(`> ⴵ Objetivo ⵈ wa.me/${clean(jid)}`)
    L.push("ⵈⵈⵈⵈⵈⵈⵈⵈⵈⵈⵈⵈⵈⵈⵈ")

    if (isGroup && gmeta) {
      L.push("✿ *Grupo*")
      L.push(`> ⴵ Nombre ⵈ ${gmeta.subject || "—"}`)
      L.push(`> ⴵ ID ⵈ ${jid}`)
      L.push(`> ⴵ Miembros ⵈ ${gmeta.size ?? gmeta.participants?.length ?? 0}`)
      L.push(`> ⴵ Admins ⵈ ${(gmeta.participants || []).filter(p => p.admin).length}`)
      L.push(`> ⴵ Creado ⵈ ${stamp(gmeta.creation)}`)
      L.push(`> ⴵ Creador ⵈ ${gmeta.owner ? clean(gmeta.owner) : "Oculto"}`)
      L.push(`> ⴵ Solo admins ⵈ ${gmeta.announce ? "Sí" : "No"}`)
      L.push(`> ⴵ Solo admins editan ⵈ ${gmeta.restrict ? "Sí" : "No"}`)
      L.push(`> ⴵ Descripción ⵈ ${gmeta.desc ? gmeta.desc.slice(0, 200) : "—"}`)
    } else {
      L.push("✿ *Identidad*")
      L.push(`> ⴵ Número ⵈ ${clean(jid)}`)
      L.push(`> ⴵ JID ⵈ ${jid}`)
      L.push(`> ⴵ LID ⵈ ${lid || lidStore || "No resoluble"}`)
      L.push(`> ⴵ Nombre ⵈ ${savedName || msg.quoted?.pushName || "Sin guardar"}`)
      L.push(`> ⴵ En agenda ⵈ ${inAgenda ? "Sí" : "No"}`)
      L.push(`> ⴵ Bloqueado ⵈ ${blocked ? "Sí" : "No"}`)
      L.push(`> ⴵ Verificado ⵈ ${contact.verifiedName ? "Sí" : "No"}`)
      L.push(`> ⴵ Dispositivos ⵈ ${dispositivos ?? "Desconocido"}`)

      L.push("")
      L.push("✿ *Exposición de privacidad*")
      L.push(`> ⴵ Nivel ⵈ *${nivel}*`)
      L.push(`> ⴵ ${bar(score)}`)
      if (exposiciones.length) L.push(`> ${exposiciones.map(e => "• " + e).join("\n> ")}`)
      else L.push("> ⴵ Todo cerrado, objetivo hermético")

      L.push("")
      L.push("✿ *Actividad*")
      L.push(`> ⴵ Presencia ⵈ ${pres?.lastKnownPresence ? (PRESENCE[pres.lastKnownPresence] || pres.lastKnownPresence) : "Privado"}`)
      L.push(`> ⴵ Última vez ⵈ ${pres?.lastSeen ? stamp(pres.lastSeen) : "Oculto"}`)
      L.push(`> ⴵ Frase ⵈ ${about || "Privada"}`)
      L.push(`> ⴵ Frase desde ⵈ ${stamp(aboutAt)}`)
      L.push(`> ⴵ Temporales ⵈ ${efimero === null ? "Desconocido" : (EPHEMERAL[efimero] || `${efimero}s`)}`)

      L.push("")
      L.push("✿ *Rastros en el bot*")
      L.push(`> ⴵ Mensajes guardados ⵈ ${total}`)
      L.push(`> ⴵ De él/ella ⵈ ${deEllos}`)
      L.push(`> ⴵ Del bot ⵈ ${total - deEllos}`)
      L.push(`> ⴵ Primer registro ⵈ ${stamp(primera)}`)
      L.push(`> ⴵ Último registro ⵈ ${stamp(ultima || ultimoMsg)}`)
      L.push(`> ⴵ Tipo dominante ⵈ ${tipoTop ? `${tipoTop[0]} (${tipoTop[1]})` : "—"}`)
      L.push(`> ⴵ Hora pico ⵈ ${horaTop ? `${String(horaTop[0]).padStart(2, "0")}:00 (${horaTop[1]} msgs)` : "—"}`)
      L.push(`> ⴵ Media de texto ⵈ ${total ? Math.round(chars / total) : 0} caracteres`)
      L.push(`> ⴵ No leídos ⵈ ${unread}`)
      L.push(`> ⴵ Fijado ⵈ ${pinned ? "Sí" : "No"}`)
      L.push(`> ⴵ Archivado ⵈ ${archived ? "Sí" : "No"}`)
      L.push(`> ⴵ Silenciado ⵈ ${muteado ? "Sí" : "No"}`)

      L.push("")
      L.push("✿ *Perfil*")
      L.push(`> ⴵ Foto ⵈ ${pp ? "Visible" : "Privada / sin foto"}`)
      L.push(`> ⴵ Preview ⵈ ${ppPrev || imgStore ? "Disponible" : "No"}`)

      if (biz) {
        L.push("")
        L.push("✿ *Business*")
        L.push(`> ⴵ Categoría ⵈ ${biz.category || "—"}`)
        L.push(`> ⴵ Descripción ⵈ ${biz.description ? biz.description.slice(0, 200) : "—"}`)
        L.push(`> ⴵ Correo ⵈ ${biz.email || "—"}`)
        L.push(`> ⴵ Web ⵈ ${biz.website?.[0] || "—"}`)
        L.push(`> ⴵ Dirección ⵈ ${biz.address || "—"}`)
        L.push(`> ⴵ Catálogo ⵈ ${catalogo === null ? "Desconocido" : `${catalogo} productos`}`)
      }

      if (labels.length) {
        L.push("")
        L.push("✿ *Etiquetas*")
        L.push(`> ${labels.slice(0, 10).map(l => "• " + l).join("\n> ")}`)
      }

      L.push("")
      L.push("✿ *Vínculos*")
      L.push(`> ⴵ Grupos en común ⵈ ${comunes.length}`)
      L.push(`> ⴵ Es admin en ⵈ ${adminEn}`)
      if (comunes.length) L.push(`> ⴵ ${comunes.slice(0, CFG.maxGroups || 8).map(g => "• " + g).join("\n> ")}`)
    }

    L.push("ⵈⵈⵈⵈⵈⵈⵈⵈⵈⵈⵈⵈⵈⵈⵈ")
    L.push(`> *${botName}* ⴵ 𝗱𝗼𝘀𝘀𝗶𝗲𝗿 𝗰𝗲𝗿𝗿𝗮𝗱𝗼`)

    const text = L.join("\n")
    const mentions = enDM ? [] : [jid]

    if (pp && !isGroup) {
      await sock.sendMessage(msg.chat, { image: { url: pp }, caption: text, mentions }, { quoted: msg })
    } else {
      await sock.sendMessage(msg.chat, { text, mentions }, { quoted: msg })
    }

    if (full) {
      crudo.exposicion = { score, nivel, exposiciones }
      crudo.historial = { total, deEllos, tipos, horaTop, primera, ultima }
      crudo.business = biz
      crudo.ephemeral = efimero
      crudo.devices = dispositivos
      crudo.gruposComunes = comunes
      let dump = JSON.stringify(crudo, null, 2)
      if (dump.length > 3500) dump = dump.slice(0, 3500) + "\n... (truncado)"
      return sock.sendMessage(msg.chat, { text: "```json\n" + dump + "\n```" }, { quoted: msg })
    }
  }
  }
