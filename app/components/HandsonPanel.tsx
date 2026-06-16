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
  onClose: () => void
  onWebSearchChange?: (enabled: boolean) => void
}

type Page = { id: number; title: string; file: string; webSearch?: boolean }

const PAGES: Page[] = [
  { id: 1, title: 'AIリテラシー', file: '/handson/handson.md' },
  { id: 2, title: 'AIの仕組み', file: '/handson/handson2.md' },
  { id: 3, title: 'AIとセキュリティ', file: '/handson/handson3.md' },
  { id: 4, title: 'AI推論とエージェント', file: '/handson/handson4.md' },
  { id: 5, title: 'AIとWeb検索', file: '/handson/handson5.md', webSearch: true },
]

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (React.isValidElement(node)) {
    return extractText((node.props as { children?: React.ReactNode }).children)
  }
  return ''
}

export default function HandsonPanel({ isOpen, onUsePrompt, onClose, onWebSearchChange }: Props) {
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

  const content = contents[currentPage]
  const hasError = fetchError[currentPage]

  return (
    <aside
      aria-hidden={!isOpen}
      className={`
        flex-none flex flex-col overflow-hidden
        bg-white dark:bg-zinc-800
        border-t-2 border-indigo-400 dark:border-indigo-600
        md:border-t-0 md:border-l-2 md:border-indigo-300 dark:md:border-indigo-700
        md:max-h-none md:h-auto md:w-1/2 md:min-w-0
        transition-[max-height,max-width] duration-300 ease-in-out
        ${isOpen
          ? 'max-h-[50vh] md:max-w-[50%]'
          : 'max-h-0 md:max-w-0'
        }
      `}
    >
      <div className="flex-none px-5 pt-3 pb-0 border-b border-indigo-700 dark:border-indigo-700 bg-indigo-600 dark:bg-indigo-800 z-10">
        <div className="hidden md:flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-white">
            ハンズオンテキスト
          </h2>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-px">
          {PAGES.map((page) => (
            <button
              key={page.id}
              type="button"
              onClick={() => {
                setCurrentPage(page.id)
                onWebSearchChange?.(page.webSearch === true)
              }}
              className={`flex-none px-3 py-1.5 text-xs font-medium rounded-t border-b-2 transition-colors ${
                currentPage === page.id
                  ? 'border-white text-white bg-white/15'
                  : 'border-transparent text-indigo-200 hover:text-white hover:bg-white/10'
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
        {!content && !hasError && isOpen && (
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
