'use client'

import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import Link from 'next/link'

export default function PresenterPage() {
  const [browserUrl, setBrowserUrl] = useState('')
  const [networkCandidates, setNetworkCandidates] = useState<string[]>([])
  const [selectedUrl, setSelectedUrl] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const origin = window.location.origin
    const port = window.location.port || '3000'
    setBrowserUrl(origin)

    fetch('/api/network-info')
      .then((r) => r.json())
      .then(({ candidates }: { candidates: string[] }) => {
        const urls = candidates.map((ip) => `http://${ip}:${port}`)
        setNetworkCandidates(urls)

        // localhost以外のLAN IPを優先選択、なければブラウザURL
        const preferred = urls.find((u) => !u.includes('localhost')) ?? origin
        setSelectedUrl(preferred)
      })
      .catch(() => {
        setSelectedUrl(origin)
      })
  }, [])

  // LAN候補取得前の初期値
  useEffect(() => {
    if (!selectedUrl && browserUrl) setSelectedUrl(browserUrl)
  }, [browserUrl, selectedUrl])

  async function copyUrl() {
    if (!selectedUrl) return
    await navigator.clipboard.writeText(selectedUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const allUrls = [
    ...networkCandidates,
    ...(browserUrl && !networkCandidates.includes(browserUrl) ? [browserUrl] : []),
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-md flex flex-col items-center gap-8">

        {/* ヘッダー */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500">
              <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
              <circle cx="8.5" cy="10" r="1" fill="currentColor" stroke="none" />
              <circle cx="15.5" cy="10" r="1" fill="currentColor" stroke="none" />
              <circle cx="12" cy="11" r="1" fill="currentColor" stroke="none" />
            </svg>
            <h1 className="text-xl font-bold text-gray-800 dark:text-zinc-100">AI チャット</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-zinc-400">受講者アクセス用 URL</p>
        </div>

        {/* QRコード */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-zinc-700">
          {selectedUrl ? (
            <QRCodeSVG
              value={selectedUrl}
              size={260}
              level="M"
              bgColor="#ffffff"
              fgColor="#1e1b4b"
            />
          ) : (
            <div className="w-[260px] h-[260px] flex items-center justify-center">
              <span className="text-gray-300 dark:text-zinc-600 text-sm animate-pulse">読み込み中...</span>
            </div>
          )}
        </div>

        {/* URL表示 + コピーボタン */}
        <div className="w-full flex items-center gap-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 shadow-sm">
          <span className="flex-1 text-base font-mono text-gray-800 dark:text-zinc-100 break-all leading-snug">
            {selectedUrl || '取得中...'}
          </span>
          <button
            type="button"
            onClick={copyUrl}
            title="URLをコピー"
            className={`flex-none flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              copied
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50'
            }`}
          >
            {copied ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                コピー済
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                コピー
              </>
            )}
          </button>
        </div>

        {/* アクセス候補一覧 */}
        {allUrls.length > 1 && (
          <div className="w-full">
            <p className="text-xs text-gray-400 dark:text-zinc-500 mb-2 font-medium">アクセス候補</p>
            <div className="flex flex-col gap-1.5">
              {allUrls.map((url) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setSelectedUrl(url)}
                  className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-left transition-colors ${
                    selectedUrl === url
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                      : 'bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-700'
                  }`}
                >
                  <span className={`flex-none w-2 h-2 rounded-full ${selectedUrl === url ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-zinc-600'}`} />
                  <span className="font-mono">{url}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* チャットに戻るリンク */}
        <Link
          href="/"
          className="text-sm text-gray-400 dark:text-zinc-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors flex items-center gap-1.5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          チャット画面に戻る
        </Link>
      </div>
    </div>
  )
}
