const LLAMA_URL = process.env.LLAMA_API_URL ?? 'http://localhost:8080'

export async function GET() {
  try {
    const res = await fetch(`${LLAMA_URL}/v1/models`, { cache: 'no-store' })
    if (!res.ok) return Response.json({ model: null })
    const data = await res.json()
    const entry = data.data?.[0]
    const id: string = entry?.id ?? null
    const model = id ? id.replace(/\.gguf$/i, '') : null
    const ctxSize: number | null = entry?.meta?.n_ctx ?? null
    return Response.json({ model, ctxSize })
  } catch {
    return Response.json({ model: null })
  }
}
