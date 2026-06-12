import { NextRequest } from 'next/server'

const LLAMA_URL = process.env.LLAMA_API_URL ?? 'http://localhost:8080'

export async function POST(request: NextRequest) {
  const { content } = await request.json()

  try {
    const res = await fetch(`${LLAMA_URL}/tokenize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, add_special: false, with_pieces: true }),
    })
    if (!res.ok) {
      return Response.json({ error: 'tokenize failed' }, { status: res.status })
    }
    return Response.json(await res.json())
  } catch {
    return Response.json({ error: 'tokenize failed' }, { status: 503 })
  }
}
