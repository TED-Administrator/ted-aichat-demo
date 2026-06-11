# AI チャットデモ

ローカル LLM（llama.cpp + Gemma）を使った AI チャットアプリです。  
AIリテラシー研修での活用を想定したシンプルな構成になっています。

## 技術スタック

| 役割 | 技術 |
|------|------|
| フレームワーク | Next.js 16 (App Router) |
| UI | React 19 + Tailwind CSS v4 |
| LLM バックエンド | llama.cpp（OpenAI 互換 API） |
| マークダウン描画 | react-markdown + remark-gfm + remark-cjk-friendly |

## 必要環境

- Node.js 18 以上
- llama.cpp サーバー（Gemma モデル推奨）

## セットアップ

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd ted-aichat-demo
```

### 2. 依存パッケージのインストール

```bash
npm install
```

### 3. 環境変数の設定

`.env.local.example` をコピーして `.env.local` を作成します。

```bash
cp .env.local.example .env.local
```

| 変数名 | デフォルト値 | 説明 |
|--------|------------|------|
| `LLAMA_API_URL` | `http://localhost:8080` | llama.cpp サーバーの URL |
| `LLAMA_MODEL` | `gemma4` | 使用するモデル名 |

### 4. llama.cpp サーバーの起動

```bash
llama-server -m /path/to/gemma-model.gguf --port 8080
```

llama.cpp サーバーは OpenAI 互換の `/v1/chat/completions` エンドポイントを提供します。

### 5. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

## アーキテクチャ

```
ブラウザ
  │  POST /api/chat（メッセージ配列）
  ▼
Next.js API Route（app/api/chat/route.ts）
  │  POST /v1/chat/completions（stream: true）
  ▼
llama.cpp サーバー（localhost:8080）
  │  SSE ストリーム
  └─► API Route がそのままブラウザにプロキシ
```

AI の回答はトークンが生成されるたびにリアルタイムでブラウザに送信されます（Server-Sent Events）。

## 使い方

- **送信**：メッセージを入力して `Enter`
- **改行**：`Shift + Enter`
- 日本語 IME での変換確定（`Enter`）は送信に誤動作しません

---

## 日本語 Markdown 対応について

### 問題の背景

CommonMark（Markdown の標準仕様）では、太字（`**`）や斜体（`*`）の区切り記号が有効かどうかを **フランキング区切り子ルール** で判定します。このルールは英語を前提に設計されており、**日本語・中国語（CJK）テキストと隣接する場合に正しく機能しない**ことが知られています。

影響を受けるパターン例：

```markdown
# 閉じ括弧の直後に通常文字が続くケース → 太字にならない
**石破 茂（いしば しげる）**氏です。

# 句点の直後に通常文字が続くケース → 太字にならない
**このテキストは太字にならない。**続く文章
```

これは remark・markdown-it など主要な JavaScript 実装すべてで再現します。メンテナーは「仕様通りの動作」として修正しない方針をとっており、[CommonMark 仕様 Issue #650](https://github.com/commonmark/commonmark-spec/issues/650)（2020年〜）で継続議論中です。

### 原因の詳細

CommonMark の **右フランキング（closing delimiter）** の条件：

> 閉じ `**` の直前が Unicode 句読点文字の場合、直後も空白または句読点でなければ閉じデリミタと認定されない

日本語の閉じ括弧 `）`（Unicode カテゴリ Pe）や句点 `。`（Po）は Unicode 句読点に分類されます。そのため `）**氏` のように句読点の直後に `**` が来て、さらに後ろに通常の文字が続くと、閉じデリミタとして認識されず太字が適用されません。

### 本アプリでの対処法

[`remark-cjk-friendly`](https://github.com/tats-u/markdown-cjk-friendly) を使用しています。

```tsx
import remarkCjkFriendly from 'remark-cjk-friendly'

<ReactMarkdown remarkPlugins={[remarkGfm, remarkCjkFriendly]}>
  {content}
</ReactMarkdown>
```

このプラグインは CJK 句読点を ASCII 句読点と同様に扱うようフランキング判定を拡張します。CJK 以外の入力に対しては CommonMark と完全に同一の動作を維持するため、後方互換性があります。

同じ問題に対応するプラグインが各パーサー向けに提供されています：

| パーサー | プラグイン |
|---------|-----------|
| remark（react-markdown） | `remark-cjk-friendly` |
| micromark | `micromark-extension-cjk-friendly` |
| markdown-it | `markdown-it-cjk-friendly` |

### IME 制御

日本語入力中の `Enter`（変換確定）がメッセージ送信にならないよう、`isComposing` を確認しています。

```tsx
function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
    e.preventDefault()
    handleSubmit(e)
  }
}
```

`e.nativeEvent.isComposing` が `true` の間（IME 変換中）は Enter を無視し、変換確定後の Enter のみ送信を実行します。

## ライセンス

MIT
