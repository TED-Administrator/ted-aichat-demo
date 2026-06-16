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
  └─► API Route がそのままブラウザにプロキシ（推論モード時）
```

AI の回答はトークンが生成されるたびにリアルタイムでブラウザに送信されます（Server-Sent Events）。

**通常モード（推論OFF）では tool calling のエージェントループが動きます：**

```
ブラウザ ──POST /api/chat──► API Route
                              │  ① tools 付きで llama.cpp に問い合わせ（stream）
                              │  ② 応答に tool_calls があれば…
                              │     ├─ web_search → curl で DuckDuckGo 検索（失敗時 Wikipedia API）
                              │     └─ open_url   → curl でページ取得＋本文抽出
                              │  ③ ツール結果を履歴に足して再度 llama.cpp（②へループ）
                              │  ④ tool_calls が無くなったら最終回答をストリーム
                              ▼
              ツール実行の進捗（🔍検索中 / 📄取得中）も SSE でブラウザに表示
```

ツール定義は `lib/tools.ts`、実行ロジックは `lib/execute-tool.ts` にあります。

## 使い方

- **送信**：メッセージを入力して `Enter`
- **改行**：`Shift + Enter`
- 日本語 IME での変換確定（`Enter`）は送信に誤動作しません

---

## tool calling（Web検索）

Web検索（tool calling）は、ハンズオンテキスト**5ページ目「AIとWeb検索」を開いているときだけ**有効になります。研修の段階づけのため、1〜4ページ目では従来どおりツールなしで応答します（クライアントが現在のページに応じて `webSearch` フラグを送り、API Route がループの有無を切り替えます）。Web検索が有効なときは、AI が必要に応じてインターネットを調べてから回答します。

### 2つのツール

| ツール | 役割 | 実装 |
|--------|------|------|
| `web_search` | キーワードで検索し、結果一覧（タイトル・URL・説明）を返す | `curl` で DuckDuckGo を検索。弾かれた場合は **Wikipedia 検索API** にフォールバック |
| `open_url` | 指定URLを開いて本文テキストを抽出して返す | `curl` でページ取得 → 簡易HTML→テキスト変換 |

人間の「①キーワード検索 → ②結果を選ぶ → ③ページを開いて読む」という流れを、そのまま2つのツールにマッピングしています。MCP サーバーや API キーは不要です。

### なぜ `fetch` ではなく `curl` か

Node.js の `fetch`（undici）は DuckDuckGo の anti-bot に弾かれ（HTTP 202）ますが、`curl` は通常どおり結果を取得できます。そのため検索・取得は `child_process` 経由で `curl` を実行しています。**`curl` が PATH に必要です**（macOS / Linux には標準搭載）。

### 安全策（SSRF対策など）

- `http` / `https` 以外のスキームは拒否
- ホスト名をDNS解決し、ループバック・プライベート・リンクローカル（`127.0.0.0/8`, `10/8`, `172.16/12`, `192.168/16`, `169.254/16`（クラウドメタデータ含む）, `::1`, `fc00::/7`, `fe80::/10`）への接続を拒否
- リダイレクトは自動追従せず、各ホップで再度ガード（最大3）
- タイムアウト・最大取得サイズ（512KB）・取得テキストの最大文字数で上限を設定

### 環境変数（任意）

| 変数名 | デフォルト | 説明 |
|--------|-----------|------|
| `TOOL_FETCH_TIMEOUT_MS` | `8000` | 検索・取得のタイムアウト（ミリ秒） |
| `TOOL_MAX_TEXT_CHARS` | `4000` | 1ページから取り込む最大文字数 |
| `TOOL_MAX_ITERATIONS` | `5` | エージェントループの最大反復回数 |

### llama.cpp 側の要件

OpenAI 互換の tool calling には llama-server の `--jinja`（チャットテンプレート有効化）が必要ですが、**近年の llama.cpp ビルドでは既定で有効**のため、追加設定なしで動作します。tool_calls が返らない場合は、起動引数に `--jinja` を明示するか、よりツール対応の安定したモデル（Gemma 4 12B など）への切り替えを検討してください。動作確認：

```bash
curl -s http://localhost:8080/v1/chat/completions -H 'Content-Type: application/json' -d '{
  "messages":[{"role":"user","content":"明日の東京の天気を調べて"}],
  "tools":[{"type":"function","function":{"name":"web_search","parameters":{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}}}],
  "tool_choice":"auto","stream":false
}' | jq '.choices[0].message.tool_calls'
```

`tool_calls` が返れば OK です。

> 注: tool calling と推論（`<think>`）を小型モデルで同時に行うと不安定なため、Web検索が有効なページでは推論モードより検索を優先します（推論は自動的にOFF扱い）。

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
