# AGENTS.md

八百万OS（Yaoyorozu OS）は、ブラウザを筐体にしたオペレーティングシステムである。宣言スライドではない。エージェントは **動く機械** として扱い、メタファーを説明用の飾りに落とさない。

回答とコミットメッセージは日本語。技術用語（BEM、CSS、syscall、IndexedDB など）は英語のままにしてよい。

## 起動

ビルドは無い。静的ファイルをそのまま読む。

```bash
python3 -m http.server 8765
```

または:

```bash
npm install
npm run dev
```

ブラウザで開き、Enter または「起動する」。ES module と Worker のため、`file://` では動かない。

## 検証

```bash
npm test
```

内訳:

| コマンド | 内容 |
| --- | --- |
| `npm test` | `map-land` → `e2e/all` → `phone` → `ui-all` |
| `npm run test:e2e` | 卓の操作・奉納・縁fs・神・間 |
| `npm run test:ui` | 登録アプリを鳥居から開き、窓が出ること |
| `npm run test:phone` | `html.is-phone`、ドック、シェード |
| `npm run test:shots` | 画面を撮る（既定では `npm test` に含まない） |

E2E は Puppeteer で Chrome を起動し、`python3 -m http.server` を当てる。

- Chrome: `CHROME`（既定 `/usr/bin/google-chrome-stable`）
- Puppeteer: `e2e/*.mjs` が `/tmp/node_modules/puppeteer-core/...` を直接 import する
- 画面: `YAO_SHOTS`。ポート: `YAO_PORT`

UI・レイアウト・ルーティング・クライアント状態を変えたら、テスト通過だけでは足りない。ブラウザで該当フローを端まで触る。見た目のスクリーンショット一枚は検証ではない。空・エラー・電話幅（`is-phone`）も見る。共有する状態を変えたら、それを読む他画面も確認する。

## 壊してはいけない原則

README の六原則に加え、実装上の不変条件:

1. **神は殺さない。** `hold` / `wake` / `nice` / `harai` はある。神への `kill` は EPERM。`kill` が触ってよいのは窓（アプリプロセス）だけ。
2. **ログアウトは遷宮まで EPERM。** `#logout-pill` を押しても卓は消えない。
3. **東京は親プロセスではない。** 47 県は同等の空間（カーネル）。県 ID は `data/prefectures.js` の 47 件。
4. **注連縄は既定 deny。** `child` / `dead` / `illness` / `fail` / `pray` は `locked: true`。外せない。
5. **GDP ではなく GEP。** 縁の量を積む。スコア化のためのダッシュボードを足さない。
6. **無縁はゴミ箱の別名ではない。** パケットロスとして扱い、戻せる。`rm` は無縁へ送る。
7. UI 文言は日本語のOS語彙を使う。Process Manager、Trash、Logout、Settings に翻訳しない。

## 語彙

| このOS | 触っているもの |
| --- | --- |
| 神 | プロセス。マイクロサービス |
| 氏子 | この器の利用者。`localStorage yaoyorozu.ujiko` |
| 柏手 | 認証。左手と右手。パスワードではない |
| 縁fs | IndexedDB のファイルシステム |
| 札 | ファイル。`.gate` はアプリ起動の結び |
| 匣 | ディレクトリ |
| 無縁 | 削除先。`/var/muen`。清める（purge）で消える |
| 奉納 | シェル（`term`） |
| 言霊 | テキスト。エディタとクリップ |
| 列島 / 空間 | 47 県。`'` で送り、`[` `]` で隣県 |
| 間 | スリープ。通知沈黙。IRQ を緩める |
| 注連縄 | ファイアウォール |
| 鳥居 | ランチャー |
| 当直 | 今日の県と神。日付シードのハッシュ |
| 遷宮 | リリース。ログアウトが許される時 |
| 此岸 | File System Access API で結ぶ外の匣（`/konoyo`） |
| 渡り | `/watari` の WebSocket 舟 |
| 器 | 容量。quota |

syscall の戻り: `ATTACHED` `EPERM` `ENOSPC` `ENOMEN` `SEASON_HOLD` `MIGRATE_QUEUED`。

## 構成

```
index.html          筐体。boot / 卓 / 鳥居 / 柏手 / 電話ドック
worker.js           Cloudflare Worker。`/watari` だけ動的。他は ASSETS
sw.js               PWA キャッシュ
js/main.js          起動。アプリ register。卓・鍵盤・軒先
js/kernel.js        核。状態、syscall、神、空間、seedFs
js/kernel-worker.js 壁時計
js/runtime.js       アプリ登録と launch / openPath / sharePath
js/wm.js            生きているウィンドウマネージャ
js/vfs.js           縁fs（IndexedDB `yaoyorozu-vfs`）
js/intent.js        `/etc/assoc` の開き先
js/apps/*.js        窓になるアプリ（default export）
js/boot.js          使っていない（boot は main.js）
js/app.js           使っていない（古い宣言レンダラ）
js/windows.js       使っていない（古い WM）。触るな。使うのは wm.js
css/*.css           変数は css/os.css の :root
data/*.js           window.YAOYOROZU_* のグローバル。ES module ではない
svg/japan-prefectures.svg   47 path。id は県の英語 id
svg/_parts/         香川以降の断片（25.txt〜62.txt）。磁盤と一致必須
e2e/                Puppeteer。harness.mjs が boot / 鳥居 / 奉納を担う
```

生きている入口は `index.html` → `js/main.js`。`js/app.js` や `js/windows.js` を直して「直した」ことにしない。

## アプリの足し方

窓アプリは次を揃える。

1. `js/apps/<id>.js` を `export default { id, title, width, height, spawn }` で書く
2. `js/main.js` で `import` し `register(...)`
3. `icons/<id>.svg` を置き、`js/icons.js` の `IDS` と `NAMES` に載せる
4. 卓の札にするなら `kernel.seedFs()` の `gates` に `.gate` を足す（既存札は氏子の縁fsに既にあるので、シードは未作成のときだけ書く）
5. ファイル種別で開くなら `js/intent.js` の `defaultAssoc()`
6. 渡す先にするなら `js/runtime.js` の `shareTargets()`
7. 専用スタイルなら `css/<id>.css` を足し、`index.html` から link する
8. 窓になるなら `e2e/ui-all.mjs` の `APPS` に `[id, タイトル]` を足す

`spawn({ kernel, wm, pid, launch, path, offer })` は `{ el, title, onClose, onFocus, onPause, onResume, onDrop, onOffer }` を返す。DOM は `document.createElement` と文字列 HTML。フレームワークは足さない。

描画は `lastSig` で間引き、イベントは `bindOnce` がこのコードベースの型である。`kernel` は `EventTarget`。`tick` / `dmesg` / `vfs` / `ps` / `auth` を購読したら `onClose` で外す。

## 縁fs

- DB 名: `yaoyorozu-vfs`。キーは path。
- 宣言・憲法・プロトコルは `/etc` と `/etc/ofuda`。
- 卓は `/home/<氏子>/desktop`。
- `/proc` は仮想。実体の write 先ではない。
- `/mnt/<県id>` はマウント。移すな、消せ。
- `rm` → 無縁。`restore` で戻す。`purge` は二度押し。
- ルート `/` の削除・改名は EPERM。

カーネル状態は VFS の meta `state`。窓配置は meta `windows`。別タブは `BroadcastChannel("yaoyorozu-bus")` の別シェル。IndexedDB は共有する。

## 列島

`svg/japan-prefectures.svg` の `<path id="...">` は **ちょうど 47**。`e2e/map-land.mjs` が磁盤と断片の一致を見る。

- 断片は `svg/_parts/25.txt`〜`62.txt`（38 個）
- 継ぎ目は `path id="kagawa"`
- 県を足したり id を変えたりしない。色は CPU / 余白で塗るだけ

Git 履歴に文字化け修正がある。SVG 断片と `data/*.js` の日本語を「正規化」しない。`index.html` の日本語は数値文字参照が多い。既存の書き方に合わせる。

## 電話

`js/phone.js` の `isPhone()`: 幅 ≤ 720、または高さ ≤ 480 かつ幅 ≤ 980。`<html class="is-phone">`。ドックとシェードが卓のメニューバーを置き換える。電話向けの変更は `e2e/phone.mjs` と実機幅の両方を見る。

## デプロイ

本番（静的アセット + `/watari`）:

```bash
npx wrangler deploy
```

`wrangler.jsonc` の `assets.directory` が `./`。`.assetsignore` で `e2e/` や `worker.js`（Worker 本体）を静的配信から外している。

GitHub Pages（`main` への push）は `.github/workflows/deploy-pages.yml` が `index.html` / `404.html` / `css/` / `js/` / `data/` だけを stage する。`icons/` や `svg/` を Pages でも出すなら、ワークフローの stage も更新する。

## コード慣習

- 言語はブラウザの ES module。TypeScript もバンドラも足さない（頼まれたとき以外）。
- `package.json` の実行時依存は wrangler だけ。OS 本体は依存ゼロを保つ。
- 新しい色は `css/os.css` の `--sumi` `--washi` `--vermilion` `--gold` `--moss` を先に使う。
- 失敗は握りつぶさず、空 catch にするなら短いコメントを残す（既存どおり）。
- 神・県・憲法の文章を「分かりやすく」書き換えない。データファイルは作品でもある。
- コミットメッセージ:

```
<タイプ>(<スコープ>): <概要>

<必要なら理由>
```

タイプは `feat` `fix` `style` `refactor` `perf` `test` `docs` `chore` `responsive` `a11y` `anim`。概要は 50 文字以内、命令形、ピリオドなし。
