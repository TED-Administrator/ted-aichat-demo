import { NextRequest } from 'next/server'

const LLAMA_URL = process.env.LLAMA_API_URL ?? 'http://localhost:8080'
const MODEL = process.env.LLAMA_MODEL ?? 'gemma4'

export async function POST(request: NextRequest) {
  const { messages, thinking } = await request.json()

  const allMessages = thinking
    ? [
        {
          role: 'system',
          content:
            'あなたは丁寧に考えてから回答するAIアシスタントです。回答する前に必ず <think> と </think> タグで囲んで日本語で思考プロセスを記述し、その後に最終的な回答を記述してください。',
        },
        ...messages,
      ]
    : messages

  let upstream: Response
  try {
    upstream = await fetch(`${LLAMA_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages: allMessages, stream: true }),
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
