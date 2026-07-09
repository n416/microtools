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

## 実装済み: 機体生成〜pixelchar連携 (2026-07-09)

- `MechaGenerator.js` — パラメトリック人型生成。シード(mulberry32で決定的)+プリセット(標準/重装/細身)から
  sample-mecha.json と同じuuid規約のリグ付きシーンデータを生成し、`SceneIo.loadFromData` で読み込む。
  配色はシードからHSLで5色スキームを構成。肩アーマー/バックパック/アンテナ/箱頭は確率で付く
- `PoseGenerator.js` — 自動ポーズ8種: 待機2/歩き4/走る4/縦飛び4/横飛び3/攻撃3/被弾2/やられ3コマ。
  関節位置(または任意点)を支点としたサブツリー回転+平行移動でコマ列を計算し `animations[0]` へ登録。
  シーンは動かさない。生成機体のuuid規約(j-waist等)が前提で、無ければ丁寧にエラーログを出して中断。
  **基準ポーズ**: 機体生成時に `app.basePose` へ素の立ちポーズを保存し、ポーズ生成は常にそれを基準にする
  (コマ復元でシーンのポーズが変わっていても二重掛けにならない)。basePoseが無い/uuid不一致なら現在ポーズへフォールバック。
  座標系の要注意点: X軸回転は支点より下のサブツリー(手足)は負の角度(FWD)で前方+Zへ、
  支点より上(上体)は同じ負の角度で「後方」へ倒れる
- **pixelchar連携ボタン**: pixelcharの取り込みパネルに「🤖 mecで自動生成」→ `?handoff=<origin>` 付きで
  mecを別タブで開く → mec側「pixelcharへ送る」が `renderSpriteSheet` の結果を `postMessage`
  (`{type:'mec-sprite-sheet', dataUrl, cols, rows, name}`) で返送 → ImportPanel が受信して
  シート取り込みフォームに自動投入(受信オリジンは localhost/127.0.0.1 のみ許可)
- mecのURLはpixelchar側 `ImportPanel.tsx` の `MEC_URL` (既定 http://localhost:8321/index.html、
  localStorage `mecUrl` で上書き可)。mecの配信は `npx http-server <mecディレクトリ> -p 8321`

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

### 3. pixelchar: 画像インポート ✅実装済み (2026-07-08)

pixelchar側 `src/components/ImportPanel.tsx` + `src/lib/sheetSlicer.ts` + `src/lib/importImages.ts` として実装
(pixelchar commit 64bf0eb)。mecの命名規則から分割数を自動検出し、シートの行=方向ごとに別アニメとして取り込む。
パレットロック・SpriteEditor・GIF出力は既存フローがそのまま効く。当初の設計方針:

- 「SDで生成」の代わりに手持ち画像(PNG連番/シート)を取り込むエントリポイントを追加
- 既存の pixelate → パレットロック → SpriteEditor → GIF/シート出力のフローにそのまま接続
- ここまでできると、SD生成と3D由来が同じギャラリーに並ぶ

### 実装済み: ②武器+構え/射撃/斬撃 (2026-07-09)

- MechaGeneratorに武器生成: `weapon: 'auto'|'rifle'|'blade'|'none'`(UIセレクトあり)。
  武器の抽選は乱数消費の最後(同一シードで機体本体が変わらない)。
  **下げた腕に沿って垂直(先端が下)に生成**し `j-grip`(sphere, parent=p-hand-r)で接続 →
  構えで腕を前方90°上げると武器が自然に前を向く。ブレードはvisor色+emissiveの光刃。
  uuid: p-weapon / p-weapon-b / p-weapon-c(PoseGeneratorのarmR/forearmR/upperBodyサブツリーに登録済み)
- PoseGeneratorに 構え2/射撃3(マズルジャンプ+のけぞり)/斬撃3(頭上振りかぶり→振り下ろし+踏み込み→残心)

### 実装済み: ③変形 (飛行/タンク) (2026-07-09)

設計方針(バックパック=変形の主役、スライドジョイント活用)通りに実装。
ポーズ=全パーツの絶対transformなので、変形も「ただのコマ」として表現している。

- MechaGeneratorのバックパックを**常時生成の変形ユニット**に再設計:
  コア`p-pack` + 羽根パネル`p-wing-l/r` + 下向きノズル`p-nozzle-l/r`。
  旧`hasPack`の乱数は「大型パック」の抽選に流用(乱数消費順を保ち同一シードの体型を維持)。
  接続は**スライドジョイント**: `j-pack`=縦レール(rotation[0,0,π/2]で軸をYへ。タンクで砲塔がせり上がる)、
  `j-wing-l/r`=横レール(飛行で羽根が外側へ展開)。slideの軸=ジョイントのrotationをX軸に適用した向き
- PoseGeneratorに `flight`(飛行形態4コマ: 羽根展開→45°浮上→水平巡航×2) と
  `tank`(タンク形態4コマ: しゃがみ→車体化+砲塔せり上がり途中→砲塔展開→砲身仰角) を追加。
  presetの`requires`(j-pack等)が無い機体では丁寧にエラーを出して中断
- **飛行**: 全身を腰支点で+90°X回転(うつ伏せ)。下向きノズルが自動的に後方噴射を向く。
  streamline(脚閉じ+爪先伸ばし+腕体側)とdeployWings(羽根を自中心で横倒し→レール沿いに外へ)で流線形化
- **タンク**: **上体を腰から前へ倒す(LEAN=0.8)のがシルエット変化の主役**——脚だけ畳むと
  「中腰」にしか見えない(初版の失敗)。脚は前に畳んで車体下部に、パックは前傾したレール軸に沿って
  頭上へせり上げ、`-(π/2+LEAN)`回転で砲身(ノズル)を世界座標の水平前方(+Z)へ向ける
- **履帯ブロック** (ユーザー判断で追加): 骨盤左右の**二枚重ね**サイドスカート
  `p-tread-{l,r}-{a,b}`(各 厚0.055×丈=腿長×1.15×奥行き0.16固定)を縦スライドレール
  `j-tread-l/r`(parent=p-pelvis、子2枚)で常時生成。タンク形態で`deployTreads`が横倒し(+90°X)し、
  外板aを前(z=0.265)・内板bを後ろ(z=-0.025)に並べて**車体全長を覆う一本の履帯**として接地(y=0.082)。
  ポーズは位置+回転のみでスケール不可なので「分割して並べ直す」方式。歩き等では骨盤付きなので揺れない
- **接地クランプ** `clampFramesToGround`: ポーズ中心座標ベースの接地計算はボックスの厚み半分が
  地面下に沈む(太い機体ほど深く)。applyPosePresetでコマ確定後、mechaGroup実メッシュのbbox8隅を
  ポーズの回転・スケールで変換して真の最下点を求め、0面より下なら持ち上げる(持ち上げのみ——
  ジャンプ/飛行の意図的な浮きは触らない)。全プリセットの食い込みが構造的に消える
- **座標系の教訓**: 上体を前傾させると、後ろへ畳んだ腕は「てこ」のように持ち上がる(後ろ向きの
  ベクトルは前傾で上を向く)。タンクの腕は肩で回さず前傾に任せて背面斜面に沿わせ、前腕+武器は
  肘折り(-FWD*0.77)で前傾と合算して水平後方=格納状態にする
- **検証の教訓**: ポーズの角度はチェックリスト(座標のassert)だけでは足りず、**レンダリング画像の
  目視が必須**(初版タンクはassert全パスだが見た目は中腰だった)。目視手順は「運用メモ」参照
- **戦車型プリセット `tankformer`** (ユーザー発案、トランスフォーマー式・ロボセン式メガトロン参考):
  戦車の形状から逆算した変形専用機体を `generateTankFormer(seed)` で生成
  (構造寸法は固定、乱数は配色/頭形状/アンテナのみ)。**タンクは四隅の履帯ポッドで接地する**:
  - **変形は「骨盤ごと全身をうつ伏せに倒す」方式** (`lieDown`: 腰支点で全身+90°X回転)。
    上体だけ前傾させる方式は骨盤が直立に残り**どうやってもガンタンク型になる**(v2/v3の失敗、
    ユーザー指摘)。うつ伏せの胴体がそのまま水平の車体スラブになる(頭=車首、背中=甲板)
  - **後部履帯 = ふくらはぎ**。脛を最初から履帯ポッド寸法(0.10×0.30×0.16)で設計し、
    太腿は股関節から真下へ畳み(履帯の間に隠す)、足を脛の前面に畳んでからふくらはぎを
    絶対座標で後部履帯位置へ(シュー面が接地する向き)
  - **前部履帯 = 背中のバックパック** (`p-tread-pod-l/r`、ポッドレール=スライドで胸に接続)。
    ロボット時は背負い、タンク形態で前方へ展開・接地。配置は`TANKFORMER`定数
    (treadX=0.17/treadY=0.08/frontZ=0.20/rearZ=-0.20)
  - **主砲はフュージョンカノン式に右前腕の外側へ装備** (`j-cannon`ヒンジ、親=p-farm-r。
    防盾+マズルブレーキ付き)。ロボットでは腕の武装(構え/射撃ポーズで腕ごと前を向く)、
    タンク形態では`deployArmTurret`が右腕を甲板上へ畳み、主砲が車体中央で前方を向く=砲塔。
    背中のターレット/レール(j-pack)は廃止 → **tankプリセットのrequiresは`requiresAny`
    ([['j-pack'],['p-cannon']])で人型/戦車型どちらのリグでも通す**
  - リグuuidは人型と共通なので歩き/走る等の既存ポーズがそのまま効く。羽根なしのため飛行形態は
    対象外(丁寧にエラー)。tankFrames内は `p-cannon` の有無で人型/戦車型の畳み方を分岐
  - **検証の教訓**: モジュール直呼び(POSE_PRESETS.build)のテストは applyPosePreset の
    requiresバリデーションを通らない — 実UI経由の確認を必ず併用する(requiresAny化はUIテストで発覚)
  - ヘルパー(box/sphere/cylinder/joint)は `makeBuilders()` としてモジュールレベルへ括り出し済み
  - **二形態両立の彫り込み** (計46パーツ): ふくらはぎ背面とポッド外面(-Z)に履帯シュー
    `p-shoe-*` / `p-podshoe-*` (横リブ×4) — ロボットでは背中とふくらはぎの履帯模様、
    タンク形態(-90°側へ倒す)で**その面がそのまま接地面になる**。主砲に防盾`p-mantlet`+
    マズルブレーキ`p-muzzle`(j-cannonの子=俯仰に追従)、胸に側面装甲`p-plate-l/r`+ハッチ`p-hatch`。
    **パーツを足すときは (1)ジョイントのchildObjects (2)PoseGeneratorのSUBTREES該当リスト
    (legL/lowerLegL/podL/pack/cannon/upperBody等) の両方への登録を忘れないこと**

### 4. 品質向上 (後回しでよい)

- 輪郭線 (アウトライン) 付与オプション — スプライトの視認性が上がる
- ライティングのプリセット化（現状 ambient 0.65 + directional 0.9 固定）
- 45°刻み8方向対応

## 運用メモ

- PoCの起動: pixelchar の `.claude/launch.json` に `mec-poc` 設定あり
  (`npx http-server <このディレクトリ> -p 8321`)。→ http://localhost:8321/pixelpoc.html
- mecで機体を作って「保存」→ `mecha-data.json` を PoC ページに読み込ませると実機体で確認できる
- OBJインポート由来のパーツはシーンJSONにジオメトリが残らないため PoC では読めない（スキップされる）
- **AI検証でのポーズ目視手順** (WebGLページはスクリーンショットがタイムアウトする環境向け):
  preview_evalで `MechaGenerator.js` / `PoseGenerator.js` を動的import(コード更新後は `?v=N` で
  キャッシュ回避)→ 生成データから基準ポーズを合成 → `POSE_PRESETS[id].build(base)` でコマ列を計算 →
  オフスクリーンWebGLRendererでコマ×視点(斜め35°/真横/背面)をcanvasに敷き詰め → dataURLを
  ローカルNode受信サーバー(CORS `*`)へfetch POSTしてJPEG保存 → Readツールで目視。
  座標のassert(接地高さ・前後関係)だけでは「見た目」は保証されない
- ページリロード後は preview_click が空振りすることがある(成功と返るがハンドラ未実行・ログ無反応)。
  その場合は preview_eval で `document.getElementById(...).click()` を直接叩く
