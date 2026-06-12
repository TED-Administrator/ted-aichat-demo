'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkCjkFriendly from 'remark-cjk-friendly'
import rehypeKatex from 'rehype-katex'
import HandsonPanel from './components/HandsonPanel'

type Token = { id: number; piece: string }

type Message = {
  role: 'user' | 'assistant'
  content: string
  tokens?: Token[]
  showTokens?: boolean
}

const TOKEN_COLORS = [
  'bg-rose-100 dark:bg-rose-900/40',
  'bg-amber-100 dark:bg-amber-900/40',
  'bg-lime-100 dark:bg-lime-900/40',
  'bg-sky-100 dark:bg-sky-900/40',
  'bg-violet-100 dark:bg-violet-900/40',
  'bg-orange-100 dark:bg-orange-900/40',
]

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelMounted, setPanelMounted] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    setPanelOpen(localStorage.getItem('handson-panel-open') === 'true')
    setPanelMounted(true)
  }, [])

  function togglePanel() {
    setPanelOpen((prev) => {
      localStorage.setItem('handson-panel-open', String(!prev))
      return !prev
    })
  }

  async function handleTokenToggle(index: number, content: string, hasTokens: boolean) {
    if (hasTokens) {
      setMessages(prev => prev.map((m, j) =>
        j === index ? { ...m, showTokens: !m.showTokens } : m
      ))
      return
    }
    try {
      const res = await fetch('/api/tokenize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const data = await res.json()
      if (data.tokens) {
        setMessages(prev => prev.map((m, j) =>
          j === index ? { ...m, tokens: data.tokens, showTokens: true } : m
        ))
      }
    } catch { /* ignore */ }
  }

  function handleClearChat() {
    abortControllerRef.current?.abort()
    setMessages([])
    setInput('')
    setError(null)
    setLoading(false)
    inputRef.current?.focus()
  }

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
      abortControllerRef.current = new AbortController()
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
        signal: abortControllerRef.current.signal,
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
      if (err instanceof Error && err.name === 'AbortError') return
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
      <header className="flex-none bg-white dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold text-gray-800 dark:text-zinc-100">
            AI チャット
          </h1>
          <span className="text-gray-300 dark:text-zinc-600 select-none">|</span>
          <p className="text-xs text-gray-400 dark:text-zinc-500">
            Powered by llama.cpp + Gemma
          </p>
        </div>
        {panelMounted && (
          <button
            onClick={togglePanel}
            title={panelOpen ? 'テキストを閉じる' : 'テキストを開く'}
            aria-label={panelOpen ? 'テキストを閉じる' : 'テキストを開く'}
            className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-colors ${
              panelOpen
                ? 'border-indigo-400 bg-indigo-50 text-indigo-500 dark:border-indigo-500 dark:bg-indigo-900/30 dark:text-indigo-400'
                : 'border-gray-200 dark:border-zinc-600 text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </button>
        )}
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
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
                    <>
                      {msg.showTokens && msg.tokens ? (
                        <div className="not-prose">
                          <p className="text-sm leading-loose font-mono break-all">
                            {msg.tokens.map((t, ti) => (
                              <span
                                key={ti}
                                className={`${TOKEN_COLORS[ti % TOKEN_COLORS.length]} rounded px-0.5 cursor-default`}
                                title={`ID: ${t.id}`}
                              >
                                {t.piece}
                              </span>
                            ))}
                          </p>
                        </div>
                      ) : (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath, remarkCjkFriendly]}
                          rehypePlugins={[rehypeKatex]}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      )}
                      {!(loading && i === messages.length - 1) && (
                        <div className="not-prose flex justify-end mt-1">
                          <button
                            type="button"
                            onClick={() => handleTokenToggle(i, msg.content, !!msg.tokens)}
                            title={msg.showTokens ? 'マークダウン表示に戻す' : 'トークン単位で表示'}
                            className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors ${
                              msg.showTokens
                                ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400'
                                : 'text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300'
                            }`}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="4" y1="9" x2="20" y2="9" />
                              <line x1="4" y1="15" x2="20" y2="15" />
                              <line x1="10" y1="3" x2="8" y2="21" />
                              <line x1="16" y1="3" x2="14" y2="21" />
                            </svg>
                            {msg.showTokens
                              ? `${msg.tokens!.length} tokens`
                              : 'トークン'}
                          </button>
                        </div>
                      )}
                    </>
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
              <button
                type="button"
                onClick={handleClearChat}
                title="新規チャット"
                className="flex-none w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </button>
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
                aria-label="送信"
                title="送信"
                className="flex-none w-9 h-9 flex items-center justify-center rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </form>
        </div>

        <HandsonPanel
          isOpen={panelOpen}
          onUsePrompt={(text) => {
            setInput(text)
            inputRef.current?.focus()
          }}
        />
      </div>

      <footer className="flex-none bg-white dark:bg-zinc-800 border-t border-gray-200 dark:border-zinc-700 px-4 py-2 flex items-center justify-between text-xs text-gray-400 dark:text-zinc-500">
        <span>© 2026 TED</span>
        <span>AI の回答は参考情報です。重要な意思決定には専門家へご確認ください。</span>
      </footer>
    </div>
  )
}
