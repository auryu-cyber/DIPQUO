# DIP見積システム — 技術設計(第2版)

画面イメージ(6画面のモックアップ)を踏まえた、技術構成の設計案。第1版で挙げた確認事項への回答を反映済み。

画面イメージ: https://claude.ai/code/artifact/dd1d7dee-74f5-4de2-b209-9c69de3fb204

## 決定事項(第1版からの更新)

| 項目 | 決定 |
|---|---|
| データ保存先リポジトリ | アプリと**別リポジトリ**(`auryu-cyber/dipquo-data`、**Private**)|
| 材料費・人件費・梱包費・輸送費の値 | フリー入力ではなく**マスターデータから選択**する方式に変更。マスターは時期別・条件別に履歴管理(詳細は2章)|
| 見積の更新前状態 | マスター・見積とも**改訂は上書きせず新しい版を追加**する方式にし、いつでも「更新前はどうだったか」を追える設計にする(詳細は2.4〜2.5章)|
| ホスティング先 | Vercelのようなサーバーレス前提をやめ、**Dockerコンテナとして社内サーバー/任意のクラウドにデプロイ**できる構成にする(詳細は5章)|

## 1. 全体構成

```
Employee User
   │  Google Workspace でログイン (OAuth 2.0, kunomura.com ドメイン限定)
   ▼
Web App (Frontend + Backend API, Docker コンテナ)
   │                              │
   │ OAuth 認証                    │ 見積・マスター・ログを保存(コミット)
   ▼                              ▼
Google Workspace (Identity)     GitHub Repository: dipquo-data (Data Store, Private)
                                   └ GitHub Actions(任意): 定期バックアップ
```

- **フロントエンド**: Next.js (App Router) + TypeScript + React。ブランドガイドラインのトークン(色・フォント)をTailwind設定に落とし込む。
- **バックエンドAPI**: Next.js の Route Handlers。GitHubへの読み書きはすべてサーバー側で行い、GitHubトークンをクライアントに渡さない。
- **認証**: Auth.js (NextAuth) の Google Provider。`hd`(hosted domain)クレームで `kunomura.com` 以外を拒否。
- **データストア**: 通常のDBは持たず、**別リポジトリ `dipquo-data`(Private)をデータストアとして使う**。書き込みはGitHub App(専用のボットID)経由のcommit。

## 2. データ設計 — マスターデータと見積の分離

### 2.1 リポジトリ構成

- `auryu-cyber/dipquo`(このリポジトリ): アプリのソースコード・設計ドキュメント
- `auryu-cyber/dipquo-data`(**新規・Private**): 見積データ、原価マスター、ログ

分ける理由:
- アプリのデプロイ履歴とデータの変更履歴が混ざらず、`git log` がそのまま「業務の変更履歴」として読める
- 原価・単価情報は社外に出せない情報のため、データリポジトリは**Private**にする(コードのリポジトリは現状Public)
- 将来的にデータリポジトリだけアクセス権を絞る、といった運用がしやすい

### 2.2 マスターデータ設計(新規)

材料価格・人件費・梱包費・輸送費は時期や条件によって変動するため、見積フォームへの直接入力ではなく、**マスターから選択する方式**にする。マスターの各レコードは**イミュータブル(作成後は編集しない)**にし、改定は「新しい有効日のレコードを追加する」形で行う。これにより、マスター自体の変更履歴(価格改定の推移)と、ある見積が「どの時点のどの値を使ったか」の両方が常に追跡できる。

```
dipquo-data/
├── masters/
│   ├── materials/
│   │   ├── pecoat-343/
│   │   │   ├── 2026-01-01.json      # 当初価格
│   │   │   └── 2026-07-01.json      # 価格改定(こちらが2026-07-01以降の「現在値」)
│   │   └── csh107/
│   │       └── 2026-01-01.json
│   ├── labor-rates/
│   │   └── default/
│   │       └── 2026-01-01.json      # { hourlyChargeTHB: 50, conditions: {} }
│   ├── packing-costs/
│   │   ├── plastic-bag/2026-01-01.json
│   │   ├── carton-box/2026-01-01.json
│   │   └── paper-pallet/2026-01-01.json
│   └── transportation/
│       └── default/2026-01-01.json
├── quotes/
│   └── ...(2.3節)
└── logs/
    └── ...(2.6節)
```

マスターレコードの例(材料):

```jsonc
// masters/materials/pecoat-343/2026-07-01.json
{
  "materialCode": "pecoat-343",
  "displayName": "Pecoat 343 (Green)",
  "pricePerKg": 114.42,
  "effectiveFrom": "2026-07-01",
  "conditions": { "factory": "Lat Krabang" },   // 条件別管理(工場・仕入先などタグで拡張可能)
  "recordedAt": "2026-06-28T10:00:00+07:00",
  "recordedBy": "h.tanaka@kunomura.com",
  "note": "サプライヤー価格改定"
}
```

- 「現在値」は「`effectiveFrom` が今日以前で最も新しいレコード」として解決する。
- 「条件別」は `conditions` に工場・仕入先・ロットサイズなどをタグとして自由に付けられるようにし、同じ材料でも条件が違えば別レコードとして共存できるようにする。
- 人件費・梱包費・輸送費も同じ形(ディレクトリ=品目、ファイル名=有効日)で管理する。

### 2.3 見積データのJSONスキーマ(マスター参照+スナップショット併記)

見積はマスターの**どのレコードを使ったか(参照)**と、**その時点で解決された値(スナップショット)**の両方を保存する。参照だけだとマスター側の運用ミスに弱く、スナップショットだけだと「なぜその値になったか」の追跡ができないため、両方を持たせる。

```jsonc
{
  "id": "F4P0010",
  "variant": "current",
  "productName": "F4P0010",
  "status": "confirmed",
  "monthlyQty": 40000,
  "updatedAt": "2026-08-20T18:42:00+07:00",
  "updatedBy": "h.tanaka@kunomura.com",

  "materialRef": { "materialCode": "pecoat-343", "effectiveFrom": "2026-07-01" },
  "material": {                          // 保存時点のスナップショット(参照先が変わっても過去の見積は影響を受けない)
    "name": "Pecoat 343 (Green)",
    "pricePerKg": 114.42,
    "weightG": 9.5,
    "lossRate": { "setting": 0.02, "moulding": 0.02, "cutting": 0.02, "inspection": 0.02 }
  },

  "laborRef": { "record": "labor-rates/default/2026-01-01" },
  "labor": {
    "hourlyChargeTHB": 50,
    "processes": [
      { "name": "Dipping", "qtyPerShot": 180, "cycleTimeMin": 6, "machines": 1, "lossRate": 0.04 },
      { "name": "Cutting (Manual)", "qtyPerHour": 100, "lossRate": 0.02 },
      { "name": "Inspection", "secPerPc": 10, "lossRate": 0.02 },
      { "name": "Packing", "secPerPc": 3, "lossRate": 0.02 }
    ]
  },

  "packingRef": { "records": ["packing-costs/plastic-bag/2026-01-01", "packing-costs/paper-pallet/2026-01-01"] },
  "packing": {
    "items": [
      { "name": "Plastic Bag", "priceTHB": 0.5, "qtyPerUnit": 50 },
      { "name": "Carton Box", "priceTHB": 0, "qtyPerUnit": 8000 },
      { "name": "Paper Pallet", "priceTHB": 350, "qtyPerUnit": 128000 }
    ]
  },

  "transportationRef": { "record": "transportation/default/2026-01-01" },
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

  "calculated": {                        // 計算結果もスナップショットとして保存(監査性重視の方針を反映)
    "materialCostPerPc": 1.174,
    "laborCostPerPc": 0.723,
    "packingCostPerPc": 0.013,
    "transportationCostPerPc": 0.007,
    "cogs": 1.917,
    "overhead": 0.192,
    "profit": 0.958,
    "totalPrice": 3.067,
    "materialPct": 0.383,
    "grossMarginPct": 0.375,
    "finalPriceToCustomer": 3.25
  }
}
```

- マスター選択欄がフリー入力を上書きした場合(現場判断で一時的に別値を使うケースなど)は `material.overridden: true` のようなフラグを立て、UI上で「マスター値と異なる」ことが分かるようにする。

### 2.4 「更新前の状態」を確認できるようにする仕組み

見積・マスターともファイル単位でコミットするため、**Gitの履歴がそのまま変更履歴になる**。UI側では以下を提供する:

- 見積詳細画面に「変更履歴」タブを追加し、`GET /api/quotes/:id/history` でそのファイルのコミット一覧(日時・実行者・コミットメッセージ)を取得
- 特定の過去コミットを選ぶと、その時点のJSON全体、または現在との差分(フィールド単位のbefore/after)を表示
- マスター側も同様に、材料・人件費などの品目ごとに「価格改定の推移」を時系列リストで見られる画面を用意(2.2節のディレクトリ構造がそのままタイムラインになる)

### 2.5 コミット戦略

- 見積・マスターの保存 = GitHub Contents API (`PUT /repos/{owner}/{repo}/contents/{path}`) でJSONを作成/更新するコミットを作成。
- コミットメッセージ規約: `quote(F4P0010): update material price by h.tanaka@kunomura.com` / `master(materials/pecoat-343): add price revision effective 2026-07-01`
- **同時編集の競合対策**: 保存APIは編集開始時に取得したファイルの `sha` を保持し、コミット時にその `sha` を指定する。他人が先に更新していれば409を検知し、「他のユーザーが更新しました。最新化してください」と表示。
- **マスターの改定**: 既存ファイルは変更せず、新しい有効日のファイルを追加するだけ(削除・上書きはしない)。誤登録の訂正が必要な場合のみ、理由を添えて例外的に修正する運用ルールとする。

### 2.6 ログの扱い

- ログイン・操作は発生頻度が見積編集より高いため、1件ごとにコミットすると①GitHub APIのレート制限②コミット履歴が肥大化しノイズになる、という懸念がある。対策:
  - 直近のログは一旦サーバー側でバッファし、**数分おき、または一定件数ごとにまとめて1コミットで追記**(`logs/login/2026-08.jsonl` のような月次JSON Lines)
  - ログ専用ブランチ(例: `logs`)にコミットし、見積・マスターのコミット履歴(`main`)と分離する

## 3. 認証・認可設計

- **ログイン**: Auth.js の Google OAuth Provider。スコープは `openid email profile` のみ。
- **ドメイン制限**: Googleが返す `hd` クレームが `kunomura.com` と一致しない場合はログインを拒否し、Activity Logに `Failed (unauthorized domain)` として記録。
- **セッション**: JWTベースのセッション(Docker常駐サーバーでも問題なく使える)。
- **認可(権限)**: 初期は全社員が閲覧・作成可、「履歴ログ」画面とマスター管理画面は管理者ロールに限定。ロール情報は当面 `dipquo-data/config/admins.json` のような設定ファイルで管理。
- **GitHubへの書き込み権限**: エンドユーザーのGitHubアカウントは使わない。専用の **GitHub App**(最小権限)をサーバー側のみに保持し、`dipquo-data` にのみアクセスさせる。

## 4. API設計(概要)

| メソッド | パス | 用途 |
|---|---|---|
| `GET` | `/api/quotes` | 一覧・検索・絞り込み |
| `GET` | `/api/quotes/:id` | 個別見積の詳細(variant込み) |
| `PUT` | `/api/quotes/:id` | 見積の作成・更新(GitHubへコミット、`sha`で楽観ロック) |
| `GET` | `/api/quotes/:id/history` | その見積ファイルのgitコミット履歴・差分(変更履歴表示用) |
| `GET` | `/api/masters/:type` | マスター一覧(材料・人件費・梱包・輸送)、現在値+履歴 |
| `POST` | `/api/masters/:type` | マスターの新規レコード追加(新しい有効日で追加、既存は変更しない) |
| `POST` | `/api/export/spreadsheet` | 選択した見積群をCSV/XLSXに変換して返す |
| `POST` | `/api/export/google-sheets` | (任意)Google Sheets APIで新規シートを作成しデータを流し込む |
| `GET` | `/api/logs/login` | ログイン履歴(管理者のみ) |
| `GET` | `/api/logs/activity` | 操作履歴(管理者のみ) |

## 5. ホスティング設計

サーバーレス(Vercel等)前提をやめ、**Dockerコンテナとして社内サーバー/任意のクラウドにデプロイできる構成**にする。

- Next.jsを `output: "standalone"` でビルドし、軽量なNode.jsベースイメージでコンテナ化(`Dockerfile` を用意)
- コンテナはHTTPで内部ポートを待ち受け、手前にリバースプロキシ(Nginx等)を置いてTLS終端・ドメイン設定を行う(社内サーバーでもクラウドVMでも同じ構成で動く)
- `docker-compose.yml` を用意し、社内サーバーでもクラウドVMでも `docker compose up -d` だけで起動できるようにする
- 環境変数(Google OAuthクライアントシークレット、GitHub Appの秘密鍵など)は `.env`(サーバー上)またはクラウド側のシークレット管理機能で注入し、リポジトリにはコミットしない
- ステートレスな作りにしておけば、将来的にクラウドのコンテナサービス(ECS/Cloud Run/Azure Container Apps等)への移行も容易

## 6. スプレッドシート展開・エクスポート

- CSV: サーバー側で単純に生成(追加ライブラリ不要)。
- Excel: `exceljs` などでブランドに合わせた簡易な書式(ヘッダー色など)を付けて生成。
- Google スプレッドシートで開く: Google Sheets APIで新規スプレッドシートを作成しユーザーのGoogleアカウント権限で書き込む(要 `spreadsheets` スコープの追加同意)。優先度は低めでよい機能。

## 7. セキュリティ / 運用

- GitHubトークン・Google OAuthシークレットはサーバー側の環境変数でのみ管理し、クライアントに絶対露出させない。
- `dipquo-data` は原価・単価情報を含むため **Private** リポジトリとし、アクセス権をアプリ用のGitHub Appのみに限定する。
- 監査性: 見積・マスター・ログとも最終的な正はGitのコミット履歴。改ざん検知が必要なら将来的にコミット署名(GPG/Sigstore)も検討可能。
- バックアップ: GitHub自体が変更履歴を保持するため追加バックアップの必要性は低いが、任意でGitHub Actionsによる定期エクスポート(例: 週次でCSVをアーカイブ)を用意可能。

## 8. 残っている確認事項

1. **管理者ロールの管理方法**: 設定ファイル運用でよいか、Google Groups連携が必要か
2. **Googleスプレッドシート連携の要否**: CSV/Excelダウンロードのみで十分か、直接Sheetsに書き出す機能まで必要か
3. **デプロイ先の具体的な環境**: 社内サーバーの場合はホスト名・利用可能なポート/リバースプロキシ構成、クラウドの場合はどのプロバイダかを教えてほしい(Dockerイメージであればどちらでも同じ手順で動く)

---

次のステップ: `dipquo-data` リポジトリ(Private)を作成し、見積・マスターのJSONスキーマに沿ったサンプルデータを投入した上で、Next.jsプロジェクトの雛形・認証設定・GitHub連携APIの実装に着手する。
