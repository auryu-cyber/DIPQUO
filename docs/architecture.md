# DIP見積システム — 技術設計(第1版)

前段の画面イメージ(6画面のモックアップ)を踏まえた、技術構成の設計案。まだ実装フェーズではなく、実装前に合意しておきたい構成・データ設計・認証設計をまとめたもの。

画面イメージ: https://claude.ai/code/artifact/dd1d7dee-74f5-4de2-b209-9c69de3fb204

## 1. 全体構成

```
Employee User
   │  Google Workspace でログイン (OAuth 2.0, kunomura.com ドメイン限定)
   ▼
Web App (Frontend + Backend API)
   │                              │
   │ OAuth 認証                    │ 見積データ・ログを保存(コミット)
   ▼                              ▼
Google Workspace (Identity)     GitHub Repository (Data Store)
                                   └ GitHub Actions(任意): 定期バックアップ
```

- **フロントエンド**: Next.js (App Router) + TypeScript + React。ブランドガイドラインのトークン(色・フォント)をTailwind設定に落とし込む。
- **バックエンドAPI**: Next.js の Route Handlers(同一デプロイ内)。GitHubへの読み書きはすべてサーバー側で行い、GitHubトークンをクライアントに渡さない。
- **ホスティング**: Vercel を想定(Next.jsとの親和性、社内ツール規模ならHobby/Pro枠で十分)。社内ネットワーク限定にしたい場合はVercelのアクセス制御 or 社内プロキシ配下でのセルフホストも選択肢。
- **認証**: Auth.js (NextAuth) の Google Provider。`hd`(hosted domain)クレームで `kunomura.com` 以外を拒否。
- **データストア**: 通常のDBは持たず、**GitHubリポジトリをデータストアとして使う**(要件どおり)。書き込みはGitHub App(専用のボットID)経由のcommit。

## 2. データ設計 — GitHubをデータストアにする

### 2.1 リポジトリ構成の選択

見積データ・ログは、アプリのソースコードとは**別リポジトリ**(例: `auryu-cyber/dipquo-data`)に分離することを推奨。

理由:
- アプリのデプロイ履歴とデータの変更履歴が混ざらず、`git log` がそのまま「業務の変更履歴」として読める
- CI/CDのトリガー(pushイベント)がデータコミットで誤発火しない
- 将来的にデータリポジトリだけアクセス権を絞る、といった運用がしやすい

同一リポジトリ内の `data/` ディレクトリに同居させる案も可能(小規模ならシンプル)。**どちらにするかは要確認事項**として後述。以降はデータ専用リポジトリを前提に記述。

### 2.2 ディレクトリ構造(データリポジトリ)

```
dipquo-data/
├── quotes/
│   ├── F4P0010/
│   │   ├── current.json          # 現行仕様(最新)
│   │   ├── alt-csh107.json       # 代替仕様(バリアント)
│   │   └── meta.json             # ステータス・作成者などの索引用メタ
│   ├── F3C1102/
│   │   └── current.json
│   └── ...
├── logs/
│   ├── login/2026-08.jsonl       # 月次でファイルを分割、1行1イベント(JSON Lines)
│   └── activity/2026-08.jsonl
└── index.json                    # 一覧表示を高速化するための索引(見積のサマリのみ)
```

- 1見積 = 1JSONファイル。中身は下記スキーマ(Excelの構成をそのまま踏襲)。
- **`index.json`** はダッシュボードの一覧表示専用のキャッシュ。各見積保存時にAPIが同時に更新する。壊れても `quotes/**/*.json` を全走査すれば再構築できる(信頼できる情報源はあくまで個別JSON)。
- ログは1イベント=1コミットにはせず、**月次JSONLファイルに追記**する方式(2.4節で理由を説明)。

### 2.3 見積データのJSONスキーマ(案)

```jsonc
{
  "id": "F4P0010",
  "variant": "current",              // "current" | "alt-csh107" など
  "productName": "F4P0010",
  "status": "confirmed",             // draft | pending_approval | confirmed
  "monthlyQty": 40000,
  "updatedAt": "2026-08-20T18:42:00+07:00",
  "updatedBy": "h.tanaka@kunomura.com",
  "material": {
    "name": "Pecoat 343 (Green)",
    "pricePerKg": 114.42,
    "weightG": 9.5,
    "lossRate": { "setting": 0.02, "moulding": 0.02, "cutting": 0.02, "inspection": 0.02 }
  },
  "labor": {
    "hourlyChargeTHB": 50,
    "processes": [
      { "name": "Dipping", "qtyPerShot": 180, "cycleTimeMin": 6, "machines": 1, "lossRate": 0.04 },
      { "name": "Cutting (Manual)", "qtyPerHour": 100, "lossRate": 0.02 },
      { "name": "Inspection", "secPerPc": 10, "lossRate": 0.02 },
      { "name": "Packing", "secPerPc": 3, "lossRate": 0.02 }
    ]
  },
  "packing": {
    "items": [
      { "name": "Plastic Bag", "priceTHB": 0.5, "qtyPerUnit": 50 },
      { "name": "Carton Box", "priceTHB": 0, "qtyPerUnit": 8000 },
      { "name": "Paper Pallet", "priceTHB": 350, "qtyPerUnit": 128000 }
    ]
  },
  "transportation": { "vehicleTHB": 2500, "fuelTHB": 0, "qtyPerTrip": 384000 },
  "tooling": {
    "items": [
      { "name": "Mold", "qty": 300, "unitPriceTHB": 450 },
      { "name": "Inspection Jig", "totalTHB": 10000 },
      { "name": "Hanger", "totalTHB": 5100 }
    ],
    "customerMarkup": 1.25
  },
  "overheadRate": 0.10,
  "profitRate": 0.50,
  "finalPriceToCustomer": 3.25
}
```

- 計算結果(材料費/pc, COGS, Total priceなど)は**保存時にJSONへ含めず、都度サーバー側で再計算して返す**か、監査性を重視して**計算結果もスナップショットとして保存**するかは要検討(後述の確認事項)。後者の方が「あの時点でいくらだったか」を追いやすい。

### 2.4 コミット戦略

- 見積の保存 = GitHub Contents API (`PUT /repos/{owner}/{repo}/contents/{path}`) で該当JSONを更新するコミットを作成。
- コミットメッセージ規約: `quote(F4P0010): update material price by h.tanaka@kunomura.com`
- **同時編集の競合対策**: 保存APIは編集開始時に取得したファイルの `sha` を保持し、コミット時にその `sha` を指定する。他人が先に更新していれば409を検知し、「他のユーザーが更新しました。最新化してください」と表示。
- **ログの扱い**: ログイン・操作は発生頻度が見積編集より高いため、1件ごとにコミットすると①GitHub APIのレート制限(認証済みで5000req/h、社内規模なら問題にはならない見込みだが)②コミット履歴が肥大化しノイズになる、という懸念がある。対策として:
  - 直近のログは一旦サーバー側(メモリ or 一時KV)にバッファし、**数分おき、または一定件数ごとにまとめて1コミットで追記**する
  - ログ専用ブランチ(例: `logs`)にコミットし、見積データのコミット履歴(`main`)と分離する
  - この方式でも「誰が・いつ・何をしたか」はコミット履歴として100%残る

## 3. 認証・認可設計

- **ログイン**: Auth.js の Google OAuth Provider。スコープは `openid email profile` のみ(Workspace管理者権限などは不要)。
- **ドメイン制限**: Googleが返す `hd` クレームが `kunomura.com` と一致しない場合はログインを拒否し、Activity Logに `Failed (unauthorized domain)` として記録(モックアップの履歴画面はこれを想定)。
- **セッション**: JWTベースのセッション(Vercelのサーバーレス構成と相性が良い)。
- **認可(権限)**: 初期は全社員が閲覧・作成可、「履歴ログ」画面のみ管理者ロールに限定。ロール情報は当面 `data/config/admins.json` のような設定ファイルで管理(将来Google Groupsとの連携も検討可)。
- **GitHubへの書き込み権限**: エンドユーザーのGitHubアカウントは使わない。専用の **GitHub App**(または最小権限のfine-grained PAT)をサーバー側のみに保持し、対象データリポジトリだけにアクセスさせる。

## 4. API設計(概要)

| メソッド | パス | 用途 |
|---|---|---|
| `GET` | `/api/quotes` | `index.json` を返す(一覧・検索・絞り込み) |
| `GET` | `/api/quotes/:id` | 個別見積の詳細(variant込み) |
| `PUT` | `/api/quotes/:id` | 見積の作成・更新(GitHubへコミット、`sha`で楽観ロック) |
| `GET` | `/api/quotes/:id/history` | その見積ファイルのgitコミット履歴(変更履歴表示用) |
| `POST` | `/api/export/spreadsheet` | 選択した見積群をCSV/XLSXに変換して返す |
| `POST` | `/api/export/google-sheets` | (任意)Google Sheets APIで新規シートを作成しデータを流し込む |
| `GET` | `/api/logs/login` | ログイン履歴(管理者のみ) |
| `GET` | `/api/logs/activity` | 操作履歴(管理者のみ) |

## 5. スプレッドシート展開・エクスポート

- CSV: サーバー側で単純に生成(追加ライブラリ不要)。
- Excel: `exceljs` などでブランドに合わせた簡易な書式(ヘッダー色など)を付けて生成。
- Google スプレッドシートで開く: Google Sheets APIで新規スプレッドシートを作成しユーザーのGoogleアカウント権限で書き込む(要 `spreadsheets` スコープの追加同意)。優先度は低めでよい機能。

## 6. セキュリティ / 運用

- GitHubトークン・Google OAuthシークレットはVercelの環境変数で管理し、クライアントに絶対露出させない。
- 監査性: 見積・ログとも最終的な正はGitのコミット履歴。改ざん検知が必要なら将来的にコミット署名(GPG/Sigstore)も検討可能。
- バックアップ: GitHub自体が変更履歴を保持するため追加バックアップの必要性は低いが、任意でGitHub Actionsによる定期エクスポート(例: 週次でCSVをアーカイブ)を用意可能。

## 7. 確認したい事項(実装着手前に決めたいこと)

1. **データ保存先リポジトリ**: アプリと同一リポジトリ(`dipquo`内 `data/`)か、別リポジトリ(`dipquo-data`)か
2. **計算結果の保存範囲**: 入力値のみ保存し都度再計算 / 計算結果もスナップショットとして保存(監査性重視)
3. **ホスティング先**: Vercel想定でよいか、社内サーバー/他クラウドを希望するか
4. **管理者ロールの管理方法**: 設定ファイル運用でよいか、Google Groups連携が必要か
5. **Googleスプレッドシート連携の要否**: CSV/Excelダウンロードのみで十分か、直接Sheetsに書き出す機能まで必要か

---

次のステップ: 上記の確認事項がまとまり次第、実装(Next.jsプロジェクトの雛形・認証設定・GitHub連携API)に着手する。
