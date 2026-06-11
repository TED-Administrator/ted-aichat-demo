import { NextRequest } from 'next/server'

const LLAMA_URL = process.env.LLAMA_API_URL ?? 'http://localhost:8080'
const MODEL = process.env.LLAMA_MODEL ?? 'gemma4'

export async function POST(request: NextRequest) {
  const { messages } = await request.json()

  let upstream: Response
  try {
    upstream = await fetch(`${LLAMA_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages, stream: true }),
    })
  } catch {
    return Response.json(
      { error: 'AIサーバーに接続できませんでした。llama.cpp サーバーが起動しているか確認してください。' },
      { status: 503 }
    )
  }

  if (!upstream.ok) {
    const text = await upstream.text()
    return Response.json({ error: text }, { status: upstream.status })
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
