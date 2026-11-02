// lib/genimg.js — genera imágenes probando endpoints en orden y cayendo a respaldo
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

function aBuffer(valor) {
  if (!valor) return null
  if (Buffer.isBuffer(valor)) return valor
  if (typeof valor === 'string' && valor.startsWith('data:image')) {
    return Buffer.from(valor.split(',')[1] || '', 'base64')
  }
  return null
}

async function pedir(url) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'image/*, application/json', 'User-Agent': 'Mozilla/5.0' }
    })
    if (!res.ok) return null

    const tipo = (res.headers.get('content-type') || '').toLowerCase()

    if (tipo.startsWith('image/') || tipo === 'application/octet-stream') {
      return Buffer.from(await res.arrayBuffer())
    }

    let json
    try { json = await res.json() } catch { return null }
    if (json?.status === false || json?.error || json?.success === false) return null

    const hallado = extraerImagen(json)
    if (!hallado) return null

    const directo = aBuffer(hallado)
    if (directo) return directo

    const img = await fetch(hallado, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!img.ok) return null
    return Buffer.from(await img.arrayBuffer())
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
