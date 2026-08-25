# DIPQUO

DIP見積計算Webアプリケーション(K.U. Nomura Thai Ltd. 社内ツール)。

設計ドキュメントは `docs/architecture.md` を参照してください。データストアは別リポジトリ [`dipquo-data`](https://github.com/auryu-cyber/dipquo-data)(Private)です。

## セットアップ

```bash
npm install
cp .env.example .env   # 値を埋める(下記参照)
npm run dev
```

### 必要な環境変数(`.env`)

| 変数 | 説明 |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud ConsoleのOAuthクライアント。kunomura.com Workspace限定で作成 |
| `ALLOWED_GOOGLE_DOMAIN` | ログインを許可するGoogle Workspaceドメイン(既定 `kunomura.com`) |
| `NEXTAUTH_URL` | アプリの公開URL |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` などで生成 |
| `GITHUB_DATA_TOKEN` | `dipquo-data` リポジトリのみにアクセスできる fine-grained PAT / GitHub App トークン |
| `GITHUB_DATA_OWNER` / `GITHUB_DATA_REPO` / `GITHUB_DATA_BRANCH` | データリポジトリの指定(既定 `auryu-cyber` / `dipquo-data` / `main`) |

## Dockerでの実行

```bash
docker compose up -d --build
```

`output: "standalone"` でビルドしているため、社内サーバー・クラウドどちらでも同じ手順で動きます。

## 実装状況

- [x] 認証(Google Workspace OAuth、ドメイン制限)
- [x] 見積一覧・作成/編集フォーム(マスターデータ連携、リアルタイム原価計算)
- [x] スプレッドシート展開・CSV/Excelエクスポート
- [x] ログイン履歴・操作履歴(管理者専用)
- [x] Docker化
- [x] マスターデータ管理画面(材料・人件費・梱包・輸送費の版管理、管理者専用)
- [ ] ログの書き込みバッファリング(現状は1イベント=1コミット。`docs/architecture.md` 2.6節の最適化は未着手)
