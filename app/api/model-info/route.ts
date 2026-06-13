const LLAMA_URL = process.env.LLAMA_API_URL ?? 'http://localhost:8080'

export async function GET() {
  try {
    const res = await fetch(`${LLAMA_URL}/v1/models`, { cache: 'no-store' })
    if (!res.ok) return Response.json({ model: null })
    const data = await res.json()
    const id: string = data.data?.[0]?.id ?? null
    // .gguf 拡張子を除いて返す
    const model = id ? id.replace(/\.gguf$/i, '') : null
    return Response.json({ model })
  } catch {
    return Response.json({ model: null })
  }
}
