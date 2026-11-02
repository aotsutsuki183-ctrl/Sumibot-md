// lib/genimg.js — versión corregida para forzar la descarga de imagen en buffer
const TIMEOUT_MS = 45000

const RESPALDO = {
  normal: (p) => `https://eliasar-yt-api.vercel.app/api/ai/text2img?prompt=${encodeURIComponent(p)}`,
  nsfw: (p) =>
    `https://image.pollinations.ai/prompt/${encodeURIComponent(p)}` +
    `?model=flux&nologo=true&width=1024&height=1024&seed=${Math.floor(Math.random() * 999999)}`
}

const CANDIDATOS_DEFECTO = {
  normal: ['/ai/imagen?prompt={prompt}&key={key}'],
  nsfw: ['/nsfw/imagen?prompt={prompt}&key={key}']
}

function extraerImagen(payload) {
  if (!payload) return null
  const pilas = [payload, payload.data, payload.result, payload.response, payload.image,
    payload.images, payload.data?.images, payload.data?.result, payload.data?.data]
  for (const caja of pilas) {
    if (!caja) continue
    if (typeof caja === 'string') {
      if (/^https?:\/\//.test(caja) || caja.startsWith('data:image')) return caja
      continue
    }
    if (Array.isArray(caja)) {
      for (const item of caja) {
        if (typeof item === 'string' && (/^https?:\/\//.test(item) || item.startsWith('data:image'))) return item
        if (item && typeof item === 'object') {
          const u = item.url || item.image || item.imageUrl || item.link || item.base64
          if (u) return u
        }
      }
      continue
    }
    if (typeof caja === 'object') {
      const u = caja.url || caja.image || caja.imageUrl || caja.link || caja.base64
      if (u) return u
    }
  }
  return null
}

async function pedir(url) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'image/*, application/json, */*', 'User-Agent': 'Mozilla/5.0' }
    })
    if (!res.ok) return null

    const tipo = (res.headers.get('content-type') || '').toLowerCase()
    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Si ya es una imagen directa por el Content-Type y tiene tamaño válido
    if ((tipo.startsWith('image/') || tipo === 'application/octet-stream') && buffer.length > 1500) {
      return buffer
    }

    // Intentar leer como JSON por si devolvió un enlace
    let json
    try {
      json = JSON.parse(buffer.toString('utf8'))
    } catch {
      // Si no es JSON ni imagen válida por tipo, pero pesa bastante, intentarlo igual
      if (buffer.length > 1500) return buffer
      return null
    }

    if (json?.status === false || json?.error || json?.success === false) return null

    const hallado = extraerImagen(json)
    if (!hallado) return null

    if (hallado.startsWith('data:image')) {
      return Buffer.from(hallado.split(',')[1] || '', 'base64')
    }

    // Descargar la URL final de la imagen encontrada
    const imgRes = await fetch(hallado, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!imgRes.ok) return null
    return Buffer.from(await imgRes.arrayBuffer())
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

export async function generarImagen(prompt, { nsfw = false } = {}) {
  const modo = nsfw ? 'nsfw' : 'normal'
  const base = (global.APIs?.evogb?.url || 'https://api.evogb.org').replace(/\/+$/, '')
  const key = global.APIs?.evogb?.key || 'Apex-Predator2010'
  const plantillas = global.APIs?.genimg?.[modo] || CANDIDATOS_DEFECTO[modo]

  for (const plantilla of plantillas) {
    const ruta = plantilla
      .replace('{prompt}', encodeURIComponent(prompt))
      .replace('{key}', encodeURIComponent(key))

    const buffer = await pedir(`${base}${ruta}`)
    if (buffer && buffer.length > 1500) return { buffer, fuente: ruta.split('?')[0] }
  }

  const buffer = await pedir(RESPALDO[modo](prompt))
  if (buffer && buffer.length > 1500) return { buffer, fuente: nsfw ? 'respaldo:flux' : 'respaldo:text2img' }

  throw new Error('Ningún endpoint devolvió una imagen válida.')
                 }
        
