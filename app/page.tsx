'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkCjkFriendly from 'remark-cjk-friendly'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    setError(null)
    const userMessage: Message = { role: 'user', content: text }
    const history = [...messages, userMessage]
    setMessages([...history, { role: 'assistant', content: '' }])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error ?? 'エラーが発生しました')
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('ストリームを取得できませんでした')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6)
          if (payload === '[DONE]') continue
          try {
            const parsed = JSON.parse(payload)
            const chunk = parsed.choices?.[0]?.delta?.content ?? ''
            if (chunk) {
              setMessages((prev) => {
                const last = prev[prev.length - 1]
                return [...prev.slice(0, -1), { ...last, content: last.content + chunk }]
              })
            }
          } catch {
            // 不正なJSONは無視
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
      setMessages((prev) => prev.slice(0, -1))
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSubmit(e as unknown as FormEvent)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-zinc-900">
      <header className="flex-none bg-white dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 px-4 py-3">
        <h1 className="text-base font-semibold text-gray-800 dark:text-zinc-100">
          AI チャット
        </h1>
        <p className="text-xs text-gray-400 dark:text-zinc-400 mt-0.5">
          Powered by llama.cpp + Gemma
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400 dark:text-zinc-500 text-sm">
              メッセージを送信してAIと会話を始めてください
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="flex-none w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold mr-2 mt-1">
                AI
              </div>
            )}
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words ${
                msg.role === 'user'
                  ? 'bg-indigo-500 text-white rounded-tr-sm whitespace-pre-wrap'
                  : 'bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 border border-gray-200 dark:border-zinc-700 rounded-tl-sm prose prose-sm dark:prose-invert max-w-none'
              }`}
            >
              {msg.content === '' && msg.role === 'assistant' ? (
                <span className="flex gap-1 py-0.5">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </span>
              ) : msg.role === 'assistant' ? (
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkCjkFriendly]}>
                  {msg.content}
                </ReactMarkdown>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        {error && (
          <div className="flex justify-center">
            <p className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-lg">
              {error}
            </p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex-none bg-white dark:bg-zinc-800 border-t border-gray-200 dark:border-zinc-700 p-3"
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="メッセージを入力（Enterで送信、Shift+Enterで改行）"
            rows={1}
            disabled={loading}
            className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-700 px-4 py-2.5 text-sm text-gray-800 dark:text-zinc-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50 max-h-32 overflow-y-auto"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex-none rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            送信
          </button>
        </div>
      </form>
    </div>
  )
}
