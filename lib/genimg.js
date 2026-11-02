// lib/genimg.js — motor oficial con Pollinations AI
const TIMEOUT_MS = 45000

async function pedirPollinations(prompt, { nsfw = false } = {}) {
  const url = 'https://gen.pollinations.ai/v1/images/generations'
  const apiKey = global.APIs?.pollinations?.key || 'sk_PX01yMR...'

  const payload = {
    model: 'flux',
    prompt: prompt,
    width: 1024,
    height: 1024,
    nologo: true,
    safe: !nsfw // Si es nsfw, desactivamos el filtro de seguridad
  }

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'Mozilla/5.0'
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal
    })

    if (!res.ok) {
      // Fallback a método GET directo si el POST de API requiere configuración extra
      return await pedirGetDirecto(prompt)
    }

    const json = await res.json()
    const imageUrl = json?.data?.[0]?.url || json?.url || json?.image

    if (!imageUrl) return await pedirGetDirecto(prompt)

    const imgRes = await fetch(imageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!imgRes.ok) return null
    return Buffer.from(await imgRes.arrayBuffer())

  } catch {
    return await pedirGetDirecto(prompt)
  } finally {
    clearTimeout(t)
  }
}

async function pedirGetDirecto(prompt) {
  // Método GET ultra confiable respaldado por la plataforma
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?model=flux&nologo=true&width=1024&height=1024&seed=${Math.floor(Math.random() * 999999)}`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) return null
  const buffer = Buffer.from(await res.arrayBuffer())
  if (buffer.length < 1500) return null
  return buffer
}

export async function generarImagen(prompt, { nsfw = false } = {}) {
  const buffer = await pedirPollinations(prompt, { nsfw })
  if (buffer && buffer.length > 1500) {
    return { buffer, fuente: 'pollinations:flux' }
  }
  throw new Error('No se pudo generar la imagen con Pollinations.')
          }
          
