'use client'

import React, { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkCjkFriendly from 'remark-cjk-friendly'
import rehypeKatex from 'rehype-katex'

type Props = {
  isOpen: boolean
  onUsePrompt: (text: string) => void
}

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (React.isValidElement(node)) {
    return extractText((node.props as { children?: React.ReactNode }).children)
  }
  return ''
}

export default function HandsonPanel({ isOpen, onUsePrompt }: Props) {
  const [content, setContent] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState(false)

  useEffect(() => {
    if (!isOpen || content !== null) return
    fetch('/handson/handson.md')
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.text()
      })
      .then(setContent)
      .catch(() => setFetchError(true))
  }, [isOpen, content])

  if (!isOpen) return null

  return (
    <aside className="w-[40%] min-w-80 max-w-2xl flex-none flex flex-col border-l border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
      <div className="flex-none px-5 py-3 border-b border-gray-200 dark:border-zinc-700 sticky top-0 bg-white dark:bg-zinc-800 z-10">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-zinc-200">
          ハンズオンテキスト
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {fetchError && (
          <p className="text-sm text-red-500">
            テキストの読み込みに失敗しました。
            <code className="ml-1 text-xs">public/handson/handson.md</code> が存在するか確認してください。
          </p>
        )}
        {!content && !fetchError && (
          <p className="text-sm text-gray-400 dark:text-zinc-500 animate-pulse">読み込み中...</p>
        )}
        {content && (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath, remarkCjkFriendly]}
              rehypePlugins={[rehypeKatex]}
              components={{
                pre({ children }) {
                  const text = extractText(children).trimEnd()
                  return (
                    <div className="relative my-3">
                      <pre className="!bg-gray-100 dark:!bg-zinc-700 !text-gray-800 dark:!text-zinc-200 rounded-lg px-4 py-3 text-sm overflow-x-auto">
                        {children}
                      </pre>
                      <button
                        type="button"
                        onClick={() => onUsePrompt(text)}
                        className="absolute top-2 right-2 rounded px-2 py-1 text-xs font-medium bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
                      >
                        入力
                      </button>
                    </div>
                  )
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </aside>
  )
}
