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

const PAGES = [
  { id: 1, title: 'AIリテラシー', file: '/handson/handson.md' },
  { id: 2, title: 'AIの仕組み', file: '/handson/handson2.md' },
]

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (React.isValidElement(node)) {
    return extractText((node.props as { children?: React.ReactNode }).children)
  }
  return ''
}

export default function HandsonPanel({ isOpen, onUsePrompt }: Props) {
  const [currentPage, setCurrentPage] = useState(1)
  const [contents, setContents] = useState<Record<number, string>>({})
  const [fetchError, setFetchError] = useState<Record<number, boolean>>({})

  useEffect(() => {
    if (!isOpen || contents[currentPage] !== undefined) return
    const page = PAGES.find((p) => p.id === currentPage)!
    fetch(page.file)
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.text()
      })
      .then((text) => setContents((prev) => ({ ...prev, [currentPage]: text })))
      .catch(() => setFetchError((prev) => ({ ...prev, [currentPage]: true })))
  }, [isOpen, currentPage, contents])

  if (!isOpen) return null

  const content = contents[currentPage]
  const hasError = fetchError[currentPage]

  return (
    <aside className="w-[40%] min-w-80 max-w-2xl flex-none flex flex-col border-l border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
      <div className="flex-none px-5 pt-3 pb-0 border-b border-gray-200 dark:border-zinc-700 sticky top-0 bg-white dark:bg-zinc-800 z-10">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-zinc-200 mb-2">
          ハンズオンテキスト
        </h2>
        <div className="flex gap-1">
          {PAGES.map((page) => (
            <button
              key={page.id}
              type="button"
              onClick={() => setCurrentPage(page.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-t border-b-2 transition-colors ${
                currentPage === page.id
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30'
                  : 'border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-700'
              }`}
            >
              {page.title}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {hasError && (
          <p className="text-sm text-red-500">
            テキストの読み込みに失敗しました。
          </p>
        )}
        {!content && !hasError && (
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
                        aria-label="入力"
                        title="入力"
                        className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
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
