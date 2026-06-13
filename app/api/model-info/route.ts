const LLAMA_URL = process.env.LLAMA_API_URL ?? 'http://localhost:8080'

export async function GET() {
  try {
    const [modelsRes, slotsRes] = await Promise.all([
      fetch(`${LLAMA_URL}/v1/models`, { cache: 'no-store' }),
      fetch(`${LLAMA_URL}/slots`, { cache: 'no-store' }),
    ])

    if (!modelsRes.ok) return Response.json({ model: null, ctxSize: null, parallel: null })

    const data = await modelsRes.json()
    const entry = data.data?.[0]
    const id: string = entry?.id ?? null
    const model = id ? id.replace(/\.gguf$/i, '') : null
    const ctxSize: number | null = entry?.meta?.n_ctx ?? null

    let parallel: number | null = null
    if (slotsRes.ok) {
      const slots = await slotsRes.json()
      if (Array.isArray(slots)) parallel = slots.length
    }

    return Response.json({ model, ctxSize, parallel })
  } catch {
    return Response.json({ model: null, ctxSize: null, parallel: null })
  }
}
