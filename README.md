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

## 同時接続と並列処理

### llama.cpp の処理モデル

llama.cpp はデフォルトで **1リクエストずつ順番に処理** します。複数のリクエストが同時に届いた場合、先のリクエストの生成が完了するまでキューで待機します。

```
# parallel=1（デフォルト）の場合
受講者A → [生成中...........] → 完了
受講者B →       [待機]         [生成中...........] → 完了
受講者C →       [待機]               [待機]         [生成中...] → 完了
```

### `--parallel` オプション

`--parallel N` を指定すると、KVキャッシュを N 分割して複数リクエストを同時処理できます。

```
# parallel=4 の場合
受講者A → [KVキャッシュ 1/4]
受講者B → [KVキャッシュ 1/4]  ← 同時処理
受講者C → [KVキャッシュ 1/4]  ← 同時処理
受講者D → [KVキャッシュ 1/4]  ← 同時処理
```

**トレードオフ：** 並列数を増やすと1人あたりのKVキャッシュが減り、各ユーザーの生成速度（tokens/秒）が低下します。  
現在は `--ctx-size 32768` ÷ `--parallel 4` = **1スロットあたり 8,192 tokens** で運用しています。

### 研修での目安（E4B Q4_K_M、parallel=4）

| 同時送信人数 | 挙動 |
|------------|------|
| 1〜4人 | 同時処理。各自の生成速度はやや低下 |
| 5〜8人 | 4人ずつバッチ処理。5人目以降は待機 |
| 10人以上 | 後の人は数十秒〜数分待つ可能性あり |

研修の進行上、受講者が全員まったく同時に送信することは稀なため、parallel=4 で十分対応できるケースがほとんどです。

---

## LLM パフォーマンス記録

### 検証環境

| 項目 | 内容 |
|------|------|
| ハードウェア | Mac Studio / Apple M4 Max / 36GB |
| LLM サーバー | llama.cpp |
| モデル | Google Gemma 4 12B IT（ベンチマーク時） |
| 計測日 | 2026-06-12 |

### 量子化別ベンチマーク（Gemma 4 12B）

| 量子化 | ファイルサイズ | プリフィル速度 | 生成速度 | 備考 |
|--------|-------------|-------------|---------|------|
| Q8_0  | 12 GB | 78 t/s | 28 t/s | M4 Max では最速 |
| Q4_K_M | 7.1 GB | 63 t/s | 36 t/s | Q4 でも Q8 より遅い（Metal GPU との相性） |

> **M4 Max では Q4_K_M より Q8_0 の方が速い。**  
> Metal GPU は Q8_0 の演算を効率よく処理するため、量子化による帯域削減よりも dequantization のオーバーヘッドが大きくなる。

### チューニング結果

| オプション | 効果 |
|-----------|------|
| `--flash-attn on` | 生成速度が低下。Metal 実装では decode フェーズに逆効果 |
| `--ubatch-size 2048` | 長い会話の prefill 改善を期待したが効果なし |
| `--cache-type-k/v q8_0` | 生成速度がさらに低下 |

### 現在の llama-server 起動設定

```
llama-server
  -m  /Users/matsumura/Models/llama.cpp/gemma-4-E4B-it/gemma-4-E4B-it-Q4_K_M.gguf
  --mmproj /Users/matsumura/Models/llama.cpp/gemma-4-E4B-it/mmproj-gemma-4-E4B-it-Q8_0.gguf
  -ngl 999            # 全レイヤーを Metal GPU にオフロード
  --host 127.0.0.1
  --port 8080
  --ctx-size 32768    # 全スロット合計のKVキャッシュ（parallel=4で1スロット8192tokens）
  --parallel 4        # 同時処理スロット数
```

launchd サービス: `~/Library/LaunchAgents/jp.co.occ.ted.llama-server.plist`

### モデル別の特性比較

| モデル | メモリ使用量 | 生成速度目安 | 研修用途 |
|--------|-----------|------------|--------|
| Gemma 4 12B Q8_0 | ~15 GB | 28 t/s | 高品質・差が出にくい |
| **Gemma 4 E4B Q4_K_M（現在）** | ~6 GB | ~60-80 t/s | **研修推奨**・推論ON/OFFの差が見えやすい |
| Gemma 4 E2B | ~3 GB | ~120+ t/s | 速いが品質が低い |

---

## ライセンス

MIT
