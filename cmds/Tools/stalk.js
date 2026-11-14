import db from "#db"

const norm = (jid = "") => jid.split(":")[0]
const clean = (jid = "") => jid.split(":")[0].split("@")[0]

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

export default {
  command: ["stalk", "whois", "spy", "hack", "radar", "dossier"],
  category: "tools",
  run: async ({ msg, sock, args }) => {
    const full = args.some(a => /^(--full|--raw|-f)$/i.test(a))
    const limpios = args.filter(a => !a.startsWith("--") && !/^-f$/i.test(a))
    const raw = msg.mentionedJid?.[0] || msg.quoted?.sender || limpios[0] || msg.sender
    if (!raw) return sock.sendMessage(msg.chat, { text: "❏ Menciona, responde o escribe un número para investigar." }, { quoted: msg })

    const target = norm(String(raw).includes("@") ? String(raw) : String(raw).replace(/\D/g, "") + "@s.whatsapp.net")
    const isGroup = target.endsWith("@g.us")

    let botName = "Sumibot-md"
    try { botName = (await db.getSettings(sock.user.id.split(":")[0] + "@s.whatsapp.net")).namebot || botName } catch {}

    try { await sock.sendMessage(msg.chat, { react: { text: "🔎", key: msg.key } }) } catch {}

    /* ═══ Existencia / JID canónico ═══ */
    let exists = isGroup
    let jid = target
    let lid = null
    if (!isGroup) {
      try {
        const res = await sock.onWhatsApp(target)
        if (Array.isArray(res) && res.length) {
          exists = !!res[0].exists
          jid = norm(res[0].jid || target)
          lid = res[0].lid ? clean(res[0].lid) : null
        } else exists = false
      } catch { exists = false }
      if (!exists) return sock.sendMessage(msg.chat, { text: `❏ *${clean(target)}* no tiene WhatsApp.` }, { quoted: msg })
    }

    const crudo = {}

    /* ═══ Bloqueo ═══ */
    let blocked = false
    try { blocked = (await sock.fetchBlocklist()).some(j => norm(j) === jid) } catch {}

    /* ═══ Contacto / agenda / store ═══ */
    const contact = sock.store?.contacts?.[jid] || {}
    crudo.contact = contact
    const savedName = contact.name || contact.verifiedName || contact.notify || null
    const inAgenda = !!contact.name
    const lidStore = contact.lid ? clean(contact.lid) : null
    const imgStore = contact.imgUrl || null

    /* ═══ Estado del chat en el store ═══ */
    const chat = sock.store?.chats?.[jid] || {}
    crudo.chat = chat
    const unread = chat.unreadCount || 0
    const pinned = !!chat.pinned
    const archived = !!chat.archived
    const muteado = !!chat.muteEndTime && Number(chat.muteEndTime) * 1000 > Date.now()
    const ultimoMsg = chat.conversationTimestamp || null

    /* ═══ Foto de perfil ═══ */
    let pp = null
    let ppPrev = null
    try { pp = await sock.profilePictureUrl(jid, "image") } catch {}
    try { ppPrev = await sock.profilePictureUrl(jid, "preview") } catch {}

    /* ═══ Frase (about) ═══ */
    let about = null
    let aboutAt = null
    try {
      const st = await sock.fetchStatus(jid)
      about = st?.status || null
      aboutAt = st?.setAt || null
    } catch {}

    /* ═══ Mensajes temporales del contacto ═══ */
    let efimero = null
    try { efimero = await sock.fetchDisappearingDuration(jid) } catch {}

    /* ═══ Dispositivos vinculados (usync) ═══ */
    let dispositivos = null
    try {
      const dev = await sock.fetchDevices([jid])
      const d = Array.isArray(dev) ? dev.find(x => norm(x.user) === jid) : null
      if (d?.devices) dispositivos = d.devices.length
    } catch {}

    /* ═══ Cuenta business ═══ */
    let biz = null
    try { biz = await sock.getBusinessProfile(jid) } catch {}

    /* ═══ Catálogo business ═══ */
    let catalogo = null
    if (biz) { try { catalogo = (await sock.getCatalog({ jid, limit: 10 }))?.products?.length ?? null } catch {} }

    /* ═══ Labels ═══ */
    let labels = []
    try {
      const all = await sock.fetchLabels()
      labels = (all || []).filter(l => (l.chats || []).some(c => norm(c) === jid)).map(l => l.name || l.id)
    } catch {}

    /* ═══ Presencia en vivo ═══ */
    let pres = sock.store?.presences?.[jid] || null
    if (!isGroup) {
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
        setTimeout(() => finish(null), 5000)
      })
      if (vivo) pres = vivo
    }

    /* ═══ Historial de mensajes ═══ */
    let hist = []
    if (!isGroup) {
      try { hist = await sock.loadMessages(jid, 250) } catch {
        try { hist = await sock.fetchMessagesFromWA(jid, 250) } catch {}
      }
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
      const t = Object.keys(h.message || {})[0]
      const k = TIPO(t)
      tipos[k] = (tipos[k] || 0) + 1
      const txt = h.message?.conversation || h.message?.extendedTextMessage?.text || ""
      chars += txt.length
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

    /* ═══ Vínculos / grupos ═══ */
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

    /* ═══ Metadata de grupo ═══ */
    let gmeta = null
    if (isGroup) { try { gmeta = await sock.groupMetadata(jid) } catch {} }

    /* ═══ Exposición de privacidad ═══ */
    const exposiciones = []
    const sumar = (cond, label) => { if (cond) exposiciones.push(label) }
    sumar(!!pp, "Foto de perfil abierta")
    sumar(!!about, "Frase visible")
    sumar(!!aboutAt, "Fecha de la frase expuesta")
    sumar(!!pres?.lastKnownPresence && pres.lastKnownPresence === "available", "Conexión en vivo visible")
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
    L.push(`> ⴵ *${botName}* ⵈ 𝗲𝘀𝗰𝗮𝗻𝗲𝗼 𝗽𝗿𝗼𝗳𝘂𝗻𝗱𝗼 𝗰𝗼𝗺𝗽𝗹𝗲𝘁𝗮𝗱𝗼`)
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
      L.push(`> ⴵ Número ⵈ wa.me/${clean(jid)}`)
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
      if (comunes.length) L.push(`> ⴵ ${comunes.slice(0, 8).map(g => "• " + g).join("\n> ")}`)
    }

    L.push("ⵈⵈⵈⵈⵈⵈⵈⵈⵈⵈⵈⵈⵈⵈⵈ")
    L.push(`> *${botName}* ⴵ 𝗱𝗼𝘀𝘀𝗶𝗲𝗿 𝗰𝗲𝗿𝗿𝗮𝗱𝗼`)

    const text = L.join("\n")
    const mentions = isGroup ? [] : [jid]

    if (pp && !isGroup) {
      await sock.sendMessage(msg.chat, { image: { url: pp }, caption: text, mentions }, { quoted: msg })
    } else {
      await sock.sendMessage(msg.chat, { text, mentions }, { quoted: msg })
    }

    /* ═══ Volcado crudo ═══ */
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
