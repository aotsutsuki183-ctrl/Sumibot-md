// lib/genimg.js — optimizado para que tanto normal como nsfw usen respaldos funcionales
const TIMEOUT_MS = 45000

const RESPALDO = {
  normal: (p) => `https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?model=flux&nologo=true&width=1024&height=1024`,
  nsfw: (p) => `https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?model=flux&nologo=true&width=1024&height=1024`
}

const CANDIDATOS_DEFECTO = {
  normal: ['/ai/imagen?prompt={prompt}&key={key}'],
  nsfw: ['/nsfw/imagen?prompt={prompt}&key={key}']
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

    if ((tipo.startsWith('image/') || tipo === 'application/octet-stream') && buffer.length > 1500) {
      return buffer
    }

    let json
    try {
      json = JSON.parse(buffer.toString('utf8'))
    } {
      if (buffer.length > 1500) return buffer
      return null
    }

    if (json?.status === false || json?.error || json?.success === false) return null

    const hallado = json.url || json.result || json.image || json.data
    if (!hallado || typeof hallado !== 'string') return null

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

  // Intentar primero con la API principal si estuviera disponible
  for (const plantilla of plantillas) {
    const ruta = plantilla
      .replace('{prompt}', encodeURIComponent(prompt))
      .replace('{key}', encodeURIComponent(key))

    const buffer = await pedir(`${base}${ruta}`)
    if (buffer && buffer.length > 1500) return { buffer, fuente: ruta.split('?')[0] }
  }

  // Si la API principal falla, usar el respaldo automático infalible
  const buffer = await pedir(RESPALDO[modo](prompt))
  if (buffer && buffer.length > 1500) return { buffer, fuente: 'respaldo:flux' }

  throw new Error('Ningún endpoint devolvió una imagen válida.')
        }
    
