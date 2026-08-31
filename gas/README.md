# DIPQUO — Google Apps Script 版 セットアップ手順

これまで Next.js / Vercel / GitHub で作っていた見積システムを、**Google スプレッドシート + Google Apps Script (GAS)** だけで動く版に移植したものです。機能・デザインは既存版と同じです（Phase 1 の範囲。詳細は下記「現時点でできること／まだのこと」参照）。

対象スプレッドシート:
https://docs.google.com/spreadsheets/d/1iR9XRg-T4v_i_M6Zl-MnHmhW01kW3oine11d-YDbB9Y/edit

すべてのデータ（見積、マスターデータ、顧客マスター、操作ログ）はこのスプレッドシートに保存されます。GitHubは使用しません。

デプロイ済みウェブアプリ URL（社内共有用・固定）:
https://script.google.com/a/macros/kunomura.com/s/AKfycbzjDUqa4QZ470V7YmMmU9aC-4anSiXhJH4Hkb_8dof-xLVxxduKndzsUV9PRg8ZGOOe/exec

## 1. Apps Script プロジェクトを開く

1. 上記スプレッドシートを開く
2. メニュー「拡張機能」→「Apps Script」をクリック
3. Apps Script エディタが新しいタブで開きます（このスプレッドシートに紐づいた状態になります）

## 2. ファイルを作成してコードを貼り付ける

デフォルトで `Code.gs` という空ファイルが1つあります。このリポジトリの `gas/` フォルダにある **12個のファイル**（`.gs` 9個 + `.html` 3個）を、同じファイル名で1つずつ作成し、中身をコピー＆ペーストしてください。

Apps Script エディタでのファイル追加方法:
- `.gs` ファイル: 左側ファイル一覧の「+」→「スクリプト」→ ファイル名を入力（拡張子 `.gs` は自動で付くので入力不要）
- `.html` ファイル: 左側ファイル一覧の「+」→「HTML」→ ファイル名を入力（拡張子 `.html` は自動で付くので入力不要）

作成するファイル一覧（このリポジトリの `gas/` フォルダのパス → Apps Script 上のファイル名）:

| このリポジトリのファイル | Apps Script 上のファイル名 | 種類 |
|---|---|---|
| `gas/Code.gs` | `Code` | スクリプト（既存の `Code.gs` の中身を全部消してこの内容に置き換える） |
| `gas/Schema.gs` | `Schema` | スクリプト |
| `gas/SheetStore.gs` | `SheetStore` | スクリプト |
| `gas/Auth.gs` | `Auth` | スクリプト |
| `gas/Calc.gs` | `Calc` | スクリプト |
| `gas/Masters.gs` | `Masters` | スクリプト |
| `gas/Customers.gs` | `Customers` | スクリプト |
| `gas/Logs.gs` | `Logs` | スクリプト |
| `gas/Quotes.gs` | `Quotes` | スクリプト |
| `gas/Index.html` | `Index` | HTML |
| `gas/QuotesList.html` | `QuotesList` | HTML |
| `gas/QuoteForm.html` | `QuoteForm` | HTML |

**重要**: ファイル名は上記の通り、拡張子なし・大文字小文字も揃えて入力してください（`Index.html` の中で `include('QuotesList')` のように名前で参照しているため、名前が違うとエラーになります）。

マニフェスト（`appsscript.json`）の編集:
1. Apps Script エディタの左側「プロジェクトの設定」（歯車アイコン）を開く
2. 「"appsscript.json" マニフェスト ファイルをエディタで表示する」にチェックを入れる
3. 左側ファイル一覧に `appsscript.json` が表示されるのでクリック
4. 中身を `gas/appsscript.json` の内容に置き換える

## 3. 管理者を設定する

`gas/Schema.gs` の `seedInitialData_` が、初回アクセス時に `Admins` シートへ `a.uryu@kunomura.com` を自動登録します（Claude が読み取り確認済み — スプレッドシートの内容はすでに正しく初期化されています）。他の方も管理者にしたい場合は、スプレッドシートの `Admins` タブを開き、Google アカウントのメールアドレスを1行1件で追加してください（列は `email`）。管理者は「Master Data」「Customers」「Activity Log」メニューが見えるようになります（Phase 1時点ではこれらは編集用の簡易案内のみで、実際の編集はスプレッドシートのタブから行います。詳細は下記）。

**補足（Claudeの操作範囲について）**: このセッションから Google スプレッドシートの内容を読み取ることはできますが、セルを直接書き込む・編集するAPIアクセスは今のところありません。そのため「スプレッドシートに直接編集を」という点は、閲覧・内容確認はできますが、行の追加や値の変更はユーザー側（またはアプリのUI経由）での操作をお願いすることになります。現状は上記の通り初期データが正しく入っており、追加の手作業は不要です。

## 4. ウェブアプリとしてデプロイする

1. Apps Script エディタ右上の「デプロイ」→「新しいデプロイ」
2. 「種類の選択」の歯車アイコン →「ウェブアプリ」を選択
3. 設定:
   - **実行するユーザー**: 「アクセスしているユーザー」（`appsscript.json` の `executeAs: USER_ACCESSING` と一致させる）
   - **アクセスできるユーザー**: 「[組織のドメイン名] のユーザー」を選択 → 社内（Google Workspace ドメイン）のユーザーのみアクセス可能になります
4. 「デプロイ」をクリック
5. 初回は Google からアクセス許可の確認画面が出るので承認する
6. 発行された「ウェブアプリの URL」をコピーして、社内で共有してください。これが今後のアクセスURLになります

### 今後コードを更新するたびに（重要・URLを固定するために）

Claude（この開発アシスタント）は Apps Script のデプロイ操作を直接行うことができません（このセッションには Apps Script API/clasp のアクセス権がなく、コードを GitHub に push しても Apps Script 側には自動反映されません）。そのため、コードを更新するたびに、以下の手順を**必ず「新しいデプロイ」ではなくこの手順で**行ってください。これでURL（上記の固定URL）は変わりません。

1. `gas/` フォルダの該当ファイルの最新内容を Apps Script エディタの対応するファイルに上書きコピー＆ペースト
2. 「デプロイ」→「デプロイを管理」
3. 対象デプロイ（既存のもの）の鉛筆アイコン（編集）をクリック
4. 「バージョン」のドロップダウンを「新バージョン」に変更
5. 「デプロイ」をクリック

「新しいデプロイ」を選んでしまうと別のURLが発行されてしまうので、必ず「デプロイを管理」から既存デプロイを編集してください。

## Version表示について

サイドバーのロゴ下に「Version 1.1.0 · 2026-08-31」のように表示されます。これは `gas/Code.gs` の `APP_VERSION` / `APP_VERSION_DATE` 定数から出ています。今後 Claude がコードを更新するたびにこの値を更新するので、**画面のVersion表示が最新のものになっているか**で、正しく再デプロイできたかどうかを一目で確認できます（表示が古いままなら、上記の再デプロイ手順がまだ行われていないということです）。

## 5. 動作確認

1. 発行された URL にアクセス
2. 見積一覧画面（Quotes）が表示され、「Loading quotes…」のあと「No quotes yet. Create one to get started.」と出れば正常です
3. 「+ New Quote」から新規見積を作成し、保存できることを確認してください
4. スプレッドシートの `Quotes` タブに行が追加されていれば成功です

## 現時点でできること（Phase 1）

- 見積の一覧表示（顧客ごとにグループ化・最新問い合わせ日順）、検索
- 見積の新規作成・編集・保存（スプレッドシートへの読み書き）
- 見積の複製（1件ずつ／一覧からの複数選択一括複製）
- Material / Labor / Packing / Transportation / Exchange Rate の各コストセクション、Master Data に登録済みの日付から「Rate as of」を選択
- Labor の Dipping/Cutting/Inspection ロス率の自動連動（Material のロス率から算出）
- Tooling Cost（項目追加・削除、小計表示、Customer Markup 編集）
- Final Price to Customer の上書き入力、THB/JPY/USD 相互編集・同サイズ表示、「Quoted in」通貨選択
- F-D CODE（任意入力）／Product Name（必須）
- Undo/Redo（Ctrl+Z / Ctrl+Y）
- Activity Log への保存（フィールド単位の変更差分）はサーバー側で記録されますが、閲覧UIは未実装（下記参照）

## まだのこと（Phase 2・今後追加予定）

ナビゲーションの「Master Data」「Customers」「Activity Log」は現在プレースホルダー表示のみです。それまでの間は、スプレッドシートの該当タブを直接編集してください:

- **Master Data**: `Materials` / `LaborRates` / `PackingCosts` / `Transportation` / `ExchangeRates` タブを直接編集（新しい行を追加する形でレート改定を登録）
- **Customers**: `Customers` タブを直接編集
- **Activity Log / Login Log**: `ActivityLog` / `LoginLog` タブを直接閲覧

これらの管理画面（追加・編集・削除のUI）は次のフェーズで実装します。動作確認後にご連絡いただければ、続けて着手します。

## 既知の制限事項

- 同時編集の排他制御は `LockService`（30秒待機）による簡易ロックです。GitHub版で使っていたsha方式の楽観的ロックほど厳密ではありませんが、通常の利用（数名〜十数名が同時に使う程度）では問題ありません。
- 既存の Vercel / Next.js / GitHub 版は変更・削除しておらず、引き続き並行して利用できます。切り替えのタイミングは追ってご判断ください。
