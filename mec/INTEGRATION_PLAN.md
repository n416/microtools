# mec → pixelchar 統合計画

mec（このディレクトリ、3Dメカエディタ）を、pixelchar（`C:\Users\nakam\pixelchar`、ドット絵生成アプリ）の
絵の供給源にする。SD生成で起きていたフレーム間の別人化・左右反転・色ブレを、
決定的な3Dレンダリングで置き換えるのが目的。

## PoCの結果 (2026-07-08、`pixelpoc.html`)

`pixelpoc.html`（このディレクトリ、mec本体は無改変）で縦切り検証済み。結論: **成立する**。

- オルソカメラで 0°/90°/180°/270° の4方向をレンダリング → pixelate処理 → 4方向とも
  同一機体・同一スケール・同一パレットのスプライトが安定して出る
- pixelchar の `src/lib/pixelate.ts` のロジックはレンダリング元を問わず動く
  （pixelpoc.html 内に型注釈だけ除いた移植版がある）

### PoCで得た技術的knob（そのまま本実装に引き継ぐこと）

- **アンチエイリアスOFF** (`WebGLRenderer({antialias:false})`) — エッジの混色を防ぎ、
  背景フラッドフィルと減色が安定する
- **背景はマゼンタ** (`0xff00ff`) — フラッドフィル背景除去の基準色。キャラ色と被らない
- **ライトは固定、モデル(pivot)を回す** — 全方向で画面上の陰影方向が一致する（ゲームスプライトの流儀）
- **画角は4方向のバウンディングボックスの和から一度だけ決める** — 全方向で同一スケールを保証
- **モデル中心を原点に寄せてから回す** — mechaGroupの子は絶対座標なので、そのまま回すと軸ずれする
- **metalnessは0.4にクランプ** — 環境マップ無しの metalness=1 は黒く潰れてパレットが死ぬ
- **減色時に背景ピクセルを除外**（PoCで追加した改良。SD版は背景も混ぜていたが、3D版は背景が既知なので
  キャラ色だけでmedianCutを組める。パレットの無駄が消える）
- 正面ビューをmedianCutで減色 → `extractPalette` → 残り方向へ `fixedPalette` で強制（pixelcharと同じ流儀）

## mec側の前提知識

- vanilla JS + Three.js 0.178 (CDN importmap)、ビルド無し。`Main.js` → `MechaCreatorApp.js` が起点
- 依存はすべて `appContext` 経由で注入。undo/redoは `History.js` + Commandパターン
  (`CommandEdit.js` の `TransformCommand` / `JointTransformCommand` / `MacroCommand`)
- シーン形式: `SceneIo.js` 参照。`{objects, joints, objectCounter}`。
  objects = プリミティブ種別 + position/rotation/scale + material(color/metalness/emissive)。
  CSG結果は `geometryType:'Custom'`（BufferGeometry.toJSON）。保存ボタンで `mecha-data.json` を書き出す
- ジョイント: `jointGroup` の子。`userData.{isJoint, type: sphere|cylinder|slide, parentObject, childObjects}`
  で mechaGroup のパーツと参照し合う（Three.jsの親子ではなくグラフ）
- IK: `IkFeatures.js`。自作CCDソルバー。接続グラフをBFSしてチェインを自動解決。
  ポーズの実体は**全オブジェクトの position/quaternion**（ボーンという概念はない）

## 機体のAI自動生成 (2026-07-08 検証済み)

mecのシーン形式はただのJSON（プリミティブ+座標+色+ジョイント）なので、**LLMが機体そのものを直接生成できる**。
メッシュ生成AI（Meshy/Tripo等）は不要かつ不適合（メッシュが部位分割されずジョイントを張れない、
OBJはシーンJSONに永続化されない）。

- `sample-mecha.json`（このディレクトリ）= Claudeが生成した人型サンプル。18パーツ+15ジョイント、
  人間プロポーション約6.5頭身、骨盤ピン留め済みで**mecの自作IKがそのまま効くリグ付き**。
  mecの「読込」ボタンで開ける。pixelpoc.html にも「AI生成サンプル機体」ボタンあり
- ジョイント生成の要点: 肘・膝・足首は `type:"cylinder"` + `rotation:[0,0,π/2]`（Y軸→X軸に倒す）、
  肩・股関節・首は `type:"sphere"`。parentObject/childObjects はuuid文字列参照
- 発展形: パラメトリックな人型テンプレート（頭身・肉付き・配色・装飾をパラメータ化）を実装し、
  LLMにはパラメータだけ決めさせると、リグの正しさが構造的に保証されて安定する

## 残る実装 (優先順)

### 1. mec: ポーズのキーフレーム化とタイムライン ✅実装済み (2026-07-08)

`AnimationFeatures.js` として実装。コマ追加/削除/リネーム、コマ復元はJointTransformCommand経由でundo可、
シーンJSONの `animations` フィールドに永続化（旧形式と後方互換）。当初の設計方針:

- ポーズスナップショット = mechaGroup + jointGroup 全子の `{uuid, position, quaternion}` の配列。
  `IkFeatures.js` の `initialStates` と同じ構造（あれをそのまま流用できる）
- アニメーション = `{name, frames: [pose, ...]}`。補間は最初は無し（パラパラアニメでよい。
  pixelcharのアクションもコマ送り）。将来 slerp 補間を足す余地だけ残す
- UI: 「現在のポーズをコマとして追加」ボタン + コマ一覧 + コマ選択でポーズ復元、程度で十分
- 保存: シーンJSONに `animations` フィールドを追加（`SceneIo.js` の save/load 両方に手を入れる）

### 2. mec: スプライト書き出し ✅実装済み (2026-07-08)

`SpriteExport.js` として実装。全コマ×4方向を1枚のシートPNG（列=コマ、行=方向、セル512px、
ファイル名 `sprite_{アニメ名}_{列}x4_512.png`）で出力。ライブmechaGroupのクローン方式なので
CSG結果・OBJ由来パーツも書き出せる。画角/センタリングは全コマ×4方向のbbox和から一度だけ決定。当初の設計方針:

- `pixelpoc.html` のレンダリング部を流用: 各コマ × 各方向をオルソレンダリング
- 出力はPNG連番 or 1枚のスプライトシート。**ドット化はここでやらず生画像を出す**
  （ドット化・パレット管理・編集はpixelchar側の責務に寄せる）

### 3. pixelchar: 画像インポート

- 「SDで生成」の代わりに手持ち画像(PNG連番/シート)を取り込むエントリポイントを追加
- 既存の pixelate → パレットロック → SpriteEditor → GIF/シート出力のフローにそのまま接続
- ここまでできると、SD生成と3D由来が同じギャラリーに並ぶ

### 4. 品質向上 (後回しでよい)

- 輪郭線 (アウトライン) 付与オプション — スプライトの視認性が上がる
- ライティングのプリセット化（現状 ambient 0.65 + directional 0.9 固定）
- 45°刻み8方向対応

## 運用メモ

- PoCの起動: pixelchar の `.claude/launch.json` に `mec-poc` 設定あり
  (`npx http-server <このディレクトリ> -p 8321`)。→ http://localhost:8321/pixelpoc.html
- mecで機体を作って「保存」→ `mecha-data.json` を PoC ページに読み込ませると実機体で確認できる
- OBJインポート由来のパーツはシーンJSONにジオメトリが残らないため PoC では読めない（スキップされる）
