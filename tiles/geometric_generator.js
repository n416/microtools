/**
 * Geometric Pattern Generator Pro
 * メインアプリケーションロジック
 */

/* ===== グローバル状態 ===== */
const state = {
  /* 第1ペイン */
  compositeMode: false,
  simpleMode: true,        // 単純化トグル状態
  generatedTiles: [],

  /* 第2ペイン：お気に入りリスト */
  favorites: [],

  /* 第3ペイン：コンポジション */
  undoStack: [],
  randomColorMode: false,
  noSymbolsMode: false,
  autoGenerate: true,      // ストック変更時の自動コンポジション生成
  compositionZoom: 1.0,    // コンポジションペインのズーム倍率

  /* 追加設定 */
  canvasBgColor: '#ffffff',
  canvasBgOpacity: 1.0,
  canvasBgImage: null,
  originalCanvasBgImage: null,
  tileOpacity: 1.0,

  /* カラーパレット */
  currentPalette: null,     // { name, tags, colors: [5色] }
  palettes: [],             // パレットデータ（外部ファイルから読み込み）

  /* ドラッグ＆ドロップ用状態 */
  dragState: {
    isActive: false,        // ドラッグ操作自体の有効判定（長押し遅延後）
    isDragging: false,
    tileIdx: null,          // ドラッグ中のタイルのインデックス
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    hasMoved: false,        // 移動したかどうか（クリックとドラッグの判定用）
    activationTimer: null   // タッチ時の長押し判定用タイマー
  },

  /* パン（スクロール）機能用状態 */
  panState: {
    isSpaceDown: false,     // PCでSpaceキーが押下されているか
    isActive: false,        // パン操作中か
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
    pointerId: null
  },

  /* モバイルタブ管理 */
  activeTab: 'pane-generator',  // 現在アクティブなモバイルタブのID
  unreadStockCount: 0,          // 未確認のストック追加数
  isCompositionNew: false       // 構成が未確認の状態で更新されたか
};

/* ===== 定数 ===== */
const TILE_SIZE = 100;      // SVG内部座標でのタイルサイズ
const GENERATOR_COUNT = 200; // 第1ペインで生成するタイル数
const SHAPE_TYPES = [
  'square', 'quarter-circle', 'half-circle', 'right-triangle', 'blank',
  'circle-center', 'circle-center-large', 'circle-corners',
  'circle-grid-1', 'circle-grid-2', 'circle-grid-3', 'circle-grid-4',
  'triangle-grid-1', 'triangle-grid-2', 'triangle-grid-3', 'triangle-grid-4',
  'square-center', 'square-grid-1', 'square-grid-2', 'square-grid-3', 'square-grid-4',
  'symbol-star', 'symbol-heart', 'symbol-clover-3', 'symbol-clover-4', 'symbol-diamond', 'symbol-spade', 'symbol-drop'
];
const ROTATIONS = [0, 90, 180, 270];

/* ===== SVG名前空間 ===== */
const SVG_NS = 'http://www.w3.org/2000/svg';

/* ===== ユーティリティ ===== */
function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

/** トースト通知 */
function showToast(message, icon) {
  icon = icon || '✓';
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast animate-fade-in';
  const iconSpan = document.createElement('span');
  iconSpan.className = 'toast-icon';
  iconSpan.textContent = icon;
  const textSpan = document.createElement('span');
  textSpan.textContent = message;
  toast.appendChild(iconSpan);
  toast.appendChild(textSpan);
  container.appendChild(toast);
  setTimeout(function () {
    toast.classList.add('fade-out');
    setTimeout(function () { toast.remove(); }, 300);
  }, 2000);
}

/** 通知バッジの表示を更新 */
function updateBadgeDisplays() {
  var favBadge = document.getElementById('badge-favorites');
  var compBadge = document.getElementById('badge-composition');

  if (favBadge) {
    if (state.unreadStockCount > 0) {
      favBadge.textContent = state.unreadStockCount > 99 ? '99+' : state.unreadStockCount;
      favBadge.style.display = 'inline-flex';
    } else {
      favBadge.style.display = 'none';
    }
  }

  if (compBadge) {
    if (state.isCompositionNew) {
      compBadge.textContent = 'NEW!';
      compBadge.style.display = 'inline-flex';
    } else {
      compBadge.style.display = 'none';
    }
  }
}

/* ===== 図形のSVGパス生成 ===== */
function createShapePath(type, s, gridIndices) {
  switch (type) {
    case 'square':
      return 'M0,0 L' + s + ',0 L' + s + ',' + s + ' L0,' + s + ' Z';
    case 'quarter-circle':
      return 'M0,0 L' + s + ',0 A' + s + ',' + s + ' 0 0,1 0,' + s + ' Z';
    case 'half-circle':
      var r = s / 2;
      return 'M0,' + r + ' A' + r + ',' + r + ' 0 0,1 ' + s + ',' + r + ' L0,' + r + ' Z';
    case 'right-triangle':
      return 'M0,0 L' + s + ',0 L0,' + s + ' Z';
    case 'blank':
      return '';

    /* 新規追加：真円パターン群 (Aコマンドで円を描画。rx,ry, x-axis-rotation, large-arc-flag, sweep-flag, x,y) */
    case 'circle-center':
      // 中央真円
      var rC = s / 2;
      return 'M0,' + rC + ' A' + rC + ',' + rC + ' 0 1,1 ' + s + ',' + rC + ' A' + rC + ',' + rC + ' 0 1,1 0,' + rC + ' Z';
    case 'circle-center-large':
      // 1/4円のネガ外周にぴったり内接するサイズに変更
      // タイルの中心から角への距離は s / √2 なので、半径sの円弧と接する円の半径は s * (1 - 1/√2)
      var rS = s * (1 - Math.SQRT1_2);
      var cS = s / 2;
      return 'M' + cS + ',' + (cS - rS) + ' A' + rS + ',' + rS + ' 0 1,1 ' + cS + ',' + (cS + rS) + ' A' + rS + ',' + rS + ' 0 1,1 ' + cS + ',' + (cS - rS) + ' Z';
    case 'circle-corners':
      // 4つ角に真円を配置すると隣のタイルにはみ出してしまうため、枠内に収まる「1/4の扇形」として描画する
      var rC4 = s / 4;
      var path = '';
      // 左上 (中心 0,0)
      path += 'M0,0 L' + rC4 + ',0 A' + rC4 + ',' + rC4 + ' 0 0,1 0,' + rC4 + ' Z ';
      // 右上 (中心 s,0)
      path += 'M' + s + ',0 L' + (s - rC4) + ',0 A' + rC4 + ',' + rC4 + ' 0 0,0 ' + s + ',' + rC4 + ' Z ';
      // 左下 (中心 0,s)
      path += 'M0,' + s + ' L0,' + (s - rC4) + ' A' + rC4 + ',' + rC4 + ' 0 0,1 ' + rC4 + ',' + s + ' Z ';
      // 右下 (中心 s,s)
      path += 'M' + s + ',' + s + ' L' + s + ',' + (s - rC4) + ' A' + rC4 + ',' + rC4 + ' 0 0,0 ' + (s - rC4) + ',' + s + ' Z ';
      return path;
    case 'circle-grid-1':
    case 'circle-grid-2':
    case 'circle-grid-3':
    case 'circle-grid-4':
      // 4つに区切ったセル(2x2グリッド)に指定個数ランダム配置
      var rG = s / 4;
      var num = parseInt(type.split('-').pop(), 10);
      var cells = [[s / 4, s / 4], [s * 0.75, s / 4], [s / 4, s * 0.75], [s * 0.75, s * 0.75]];
      // 生成時の固定インデックスがあれば利用（チラつき防止）
      var selected = gridIndices ? gridIndices.map(function (i) { return cells[i]; }) : cells.sort(function () { return 0.5 - Math.random(); }).slice(0, num);
      var gPath = '';
      selected.forEach(function (pt) {
        var px = pt[0], py = pt[1];
        gPath += 'M' + (px - rG) + ',' + py + ' A' + rG + ',' + rG + ' 0 1,1 ' + (px + rG) + ',' + py + ' A' + rG + ',' + rG + ' 0 1,1 ' + (px - rG) + ',' + py + ' Z ';
      });
      return gPath;

    case 'triangle-grid-1':
    case 'triangle-grid-2':
    case 'triangle-grid-3':
    case 'triangle-grid-4':
      // 4つに区切ったセルの「外側の角」に直角三角形(セルサイズs/2の角)を指定個数ランダム配置
      var hs = s / 2; // half size
      var tNum = parseInt(type.split('-').pop(), 10);

      // 各セルの四隅の頂点と、直角三角形のパスデータを定義
      // 0: 左上 (直角が0,0)
      // 1: 右上 (直角がs,0)
      // 2: 左下 (直角が0,s)
      // 3: 右下 (直角がs,s)
      var cornerTriangles = [
        'M0,0 L' + hs + ',0 L0,' + hs + ' Z',                      // 左上セル
        'M' + s + ',0 L' + hs + ',0 L' + s + ',' + hs + ' Z',      // 右上セル
        'M0,' + s + ' L' + hs + ',' + s + ' L0,' + hs + ' Z',      // 左下セル
        'M' + s + ',' + s + ' L' + hs + ',' + s + ' L' + s + ',' + hs + ' Z' // 右下セル
      ];

      var tSelected = gridIndices ? gridIndices.map(function (i) { return cornerTriangles[i]; }) : cornerTriangles.sort(function () { return 0.5 - Math.random(); }).slice(0, tNum);
      return tSelected.join(' ');

    case 'square-center':
      // 中央の1/8正方形 (面積1/8 = 1辺s/2.828)
      var es = s / Math.sqrt(8);
      var cs = s / 2;
      return 'M' + (cs - es / 2) + ',' + (cs - es / 2) + ' L' + (cs + es / 2) + ',' + (cs - es / 2) + ' L' + (cs + es / 2) + ',' + (cs + es / 2) + ' L' + (cs - es / 2) + ',' + (cs + es / 2) + ' Z';

    case 'square-grid-1':
    case 'square-grid-2':
    case 'square-grid-3':
    case 'square-grid-4':
      // 4つに区切ったそれぞれのセルの角に1/8正方形
      var sq_s = s / Math.sqrt(8);
      var sqNum = parseInt(type.split('-').pop(), 10);
      var cornerSquares = [
        'M0,0 L' + sq_s + ',0 L' + sq_s + ',' + sq_s + ' L0,' + sq_s + ' Z',
        'M' + s + ',0 L' + (s - sq_s) + ',0 L' + (s - sq_s) + ',' + sq_s + ' L' + s + ',' + sq_s + ' Z',
        'M0,' + s + ' L' + sq_s + ',' + s + ' L' + sq_s + ',' + (s - sq_s) + ' L0,' + (s - sq_s) + ' Z',
        'M' + s + ',' + s + ' L' + (s - sq_s) + ',' + s + ' L' + (s - sq_s) + ',' + (s - sq_s) + ' L' + s + ',' + (s - sq_s) + ' Z'
      ];
      // 描画インデックス固定化
      var sqSelected = gridIndices ? gridIndices.map(function (i) { return cornerSquares[i]; }) : cornerSquares.sort(function () { return 0.5 - Math.random(); }).slice(0, sqNum);
      return sqSelected.join(' ');

    case 'symbol-star':
      var k1 = s / 100;
      return 'M' + (50 * k1) + ',' + (10 * k1) + ' L' + (61.8 * k1) + ',' + (38.2 * k1) + ' L' + (90 * k1) + ',' + (38.2 * k1) + ' L' + (67.6 * k1) + ',' + (55.9 * k1) + ' L' + (76.5 * k1) + ',' + (85.3 * k1) + ' L' + (50 * k1) + ',' + (67.6 * k1) + ' L' + (23.5 * k1) + ',' + (85.3 * k1) + ' L' + (32.4 * k1) + ',' + (55.9 * k1) + ' L' + (10 * k1) + ',' + (38.2 * k1) + ' L' + (38.2 * k1) + ',' + (38.2 * k1) + ' Z';

    case 'symbol-heart':
      var k2 = s / 100;
      return 'M' + (50 * k2) + ',' + (90 * k2) + ' C' + (50 * k2) + ',' + (90 * k2) + ' ' + (10 * k2) + ',' + (60 * k2) + ' ' + (10 * k2) + ',' + (35 * k2) + ' A' + (20 * k2) + ',' + (20 * k2) + ' 0 0,1 ' + (50 * k2) + ',' + (30 * k2) + ' A' + (20 * k2) + ',' + (20 * k2) + ' 0 0,1 ' + (90 * k2) + ',' + (35 * k2) + ' C' + (90 * k2) + ',' + (60 * k2) + ' ' + (50 * k2) + ',' + (90 * k2) + ' ' + (50 * k2) + ',' + (90 * k2) + ' Z';

    case 'symbol-clover-3':
      var gc = s / 100;
      return 'M' + (40 * gc) + ',' + (90 * gc) + ' C' + (43 * gc) + ',' + (85 * gc) + ' ' + (48 * gc) + ',' + (75 * gc) + ' ' + (48 * gc) + ',' + (65 * gc) + ' A' + (15 * gc) + ',' + (15 * gc) + ' 0 1,1 ' + (40 * gc) + ',' + (45 * gc) + ' A' + (15 * gc) + ',' + (15 * gc) + ' 0 1,1 ' + (60 * gc) + ',' + (45 * gc) + ' A' + (15 * gc) + ',' + (15 * gc) + ' 0 1,1 ' + (52 * gc) + ',' + (65 * gc) + ' C' + (52 * gc) + ',' + (75 * gc) + ' ' + (57 * gc) + ',' + (85 * gc) + ' ' + (60 * gc) + ',' + (90 * gc) + ' Z';

    case 'symbol-clover-4':
      var k3 = s / 100;
      return 'M' + (50 * k3) + ',' + (50 * k3) + ' C' + (20 * k3) + ',' + (10 * k3) + ' ' + (80 * k3) + ',' + (10 * k3) + ' ' + (50 * k3) + ',' + (50 * k3) + ' C' + (90 * k3) + ',' + (20 * k3) + ' ' + (90 * k3) + ',' + (80 * k3) + ' ' + (50 * k3) + ',' + (50 * k3) + ' C' + (80 * k3) + ',' + (90 * k3) + ' ' + (20 * k3) + ',' + (90 * k3) + ' ' + (50 * k3) + ',' + (50 * k3) + ' C' + (10 * k3) + ',' + (80 * k3) + ' ' + (10 * k3) + ',' + (20 * k3) + ' ' + (50 * k3) + ',' + (50 * k3) + ' Z';

    case 'symbol-diamond':
      var k4 = s / 100;
      return 'M' + (50 * k4) + ',' + (10 * k4) + ' L' + (85 * k4) + ',' + (50 * k4) + ' L' + (50 * k4) + ',' + (90 * k4) + ' L' + (15 * k4) + ',' + (50 * k4) + ' Z';

    case 'symbol-spade':
      var k5 = s / 100;
      return 'M' + (50 * k5) + ',' + (15 * k5) + ' C' + (75 * k5) + ',' + (35 * k5) + ' ' + (85 * k5) + ',' + (45 * k5) + ' ' + (85 * k5) + ',' + (65 * k5) + ' C' + (85 * k5) + ',' + (80 * k5) + ' ' + (65 * k5) + ',' + (85 * k5) + ' ' + (50 * k5) + ',' + (68 * k5) + ' C' + (50 * k5) + ',' + (80 * k5) + ' ' + (58 * k5) + ',' + (90 * k5) + ' ' + (60 * k5) + ',' + (90 * k5) + ' L' + (40 * k5) + ',' + (90 * k5) + ' C' + (42 * k5) + ',' + (90 * k5) + ' ' + (50 * k5) + ',' + (80 * k5) + ' ' + (50 * k5) + ',' + (68 * k5) + ' C' + (35 * k5) + ',' + (85 * k5) + ' ' + (15 * k5) + ',' + (80 * k5) + ' ' + (15 * k5) + ',' + (65 * k5) + ' C' + (15 * k5) + ',' + (45 * k5) + ' ' + (25 * k5) + ',' + (35 * k5) + ' ' + (50 * k5) + ',' + (15 * k5) + ' Z';

    case 'symbol-drop':
      var k6 = s / 100;
      return 'M' + (50 * k6) + ',' + (5 * k6) + ' C' + (60 * k6) + ',' + (30 * k6) + ' ' + (85 * k6) + ',' + (45 * k6) + ' ' + (85 * k6) + ',' + (60 * k6) + ' A' + (35 * k6) + ',' + (35 * k6) + ' 0 0,1 ' + (15 * k6) + ',' + (60 * k6) + ' C' + (15 * k6) + ',' + (45 * k6) + ' ' + (40 * k6) + ',' + (30 * k6) + ' ' + (50 * k6) + ',' + (5 * k6) + ' Z';

    default:
      return '';
  }
}

/** 1タイル分のShapeDataを生成 */
function generateShapeData(compositeMode) {
  var layers = [];
  var layerCount = compositeMode ? randomInt(1, 3) : 1;

  // 単純化モードが有効か、複合チェック時も指定の複雑パターンを除外する
  var availableShapes = SHAPE_TYPES.filter(function (type) {
    var excludedTypes = [];

    // 単純化ON（分割なし）時、以下の細かい分割図形を除外する
    // square-grid-1 はユーザー仕様により分割図形とは扱わないため除外しない
    if (state.simpleMode) {
      excludedTypes = excludedTypes.concat([
        'circle-corners',
        'circle-grid-1', 'circle-grid-2', 'circle-grid-3', 'circle-grid-4',
        'triangle-grid-1', 'triangle-grid-2', 'triangle-grid-3', 'triangle-grid-4',
        'square-grid-2', 'square-grid-3', 'square-grid-4' // ユーザー指定により2,3,4のみ分割扱い
      ]);
    }

    if (state.noSymbolsMode) {
      excludedTypes = excludedTypes.concat([
        'symbol-star', 'symbol-heart', 'symbol-clover-3', 'symbol-clover-4', 'symbol-diamond', 'symbol-spade', 'symbol-drop'
      ]);
    }

    return excludedTypes.indexOf(type) === -1;
  });

  for (var i = 0; i < layerCount; i++) {
    var shapeType = randomFrom(availableShapes);
    var layerData = {
      type: shapeType,
      rotation: randomFrom(ROTATIONS),
      inverted: Math.random() < 0.5
    };

    // 星や雫など、90度/270度で不自然になる図形は、回転を0度か180度に制限する
    var isVerticalSymbol = ['symbol-star', 'symbol-heart', 'symbol-clover-3', 'symbol-clover-4', 'symbol-spade', 'symbol-drop'].indexOf(shapeType) !== -1;
    if (isVerticalSymbol) {
      layerData.rotation = randomFrom([0, 180]);
    }

    // grid系でセルの一部を使う場合、生成時に使うセルを固定化（描画時のチラつき防止）
    if (shapeType.indexOf('-grid-') !== -1) {
      var n = parseInt(shapeType.split('-').pop(), 10);
      layerData.gridIndices = [0, 1, 2, 3].sort(function () { return 0.5 - Math.random(); }).slice(0, n);
    }
    layers.push(layerData);
  }
  return { layers: layers };
}

/** ShapeDataからSVG要素群を生成 */
function renderShapeToSVG(shapeData, size, colors) {
  var g = document.createElementNS(SVG_NS, 'g');
  var defaultColors = ['#212529', '#495057', '#6c757d'];
  var useColors = colors || defaultColors;

  shapeData.layers.forEach(function (layer, idx) {
    if (layer.type === 'blank') return;
    var path = createShapePath(layer.type, size, layer.gridIndices);
    if (!path) return;

    if (layer.inverted) {
      path = 'M0,0 h' + size + ' v' + size + ' h-' + size + ' Z ' + path;
    }

    var el = document.createElementNS(SVG_NS, 'path');
    el.setAttribute('d', path);
    if (layer.inverted) {
      el.setAttribute('fill-rule', 'evenodd');
    }
    el.setAttribute('fill', useColors[idx % useColors.length]);

    // 星は5角で回転(90/270度)すると18度傾いて見えるため、常に回転を0度に固定して直立させる
    var applyRotation = (layer.type === 'symbol-star') ? 0 : layer.rotation;

    el.setAttribute('transform',
      'translate(' + (size / 2) + ',' + (size / 2) + ') ' +
      'rotate(' + applyRotation + ') ' +
      'translate(' + (-size / 2) + ',' + (-size / 2) + ')'
    );
    g.appendChild(el);
  });
  return g;
}

/* ===== 第1ペイン：100個グリッド生成 ===== */

/** 被りなしShapeDataキーを生成 */
function shapeDataKey(sd, ignoreRotation) {
  return sd.layers.map(function (l) {
    var base = ignoreRotation ? l.type : (l.type + '_' + l.rotation);
    if (l.gridIndices) {
      base += '_g' + l.gridIndices.slice().sort().join('');
    }
    return base + (l.inverted ? '_inv' : '');
  }).join('|');
}

/** 100個の被りなしタイルを生成 */
function generateAllTiles() {
  var seen = {};
  state.generatedTiles = [];
  var maxAttempts = 5000;
  var attempts = 0;

  /* 
   * 複合OFF時は回転違いも無視するため、
   * 図形種別(15種) × 反転(2種) の30通り
   */
  var ignoreRotation = !state.compositeMode;
  var targetCount = state.compositeMode ? GENERATOR_COUNT : 30;

  while (state.generatedTiles.length < targetCount && attempts < maxAttempts) {
    attempts++;
    var sd = generateShapeData(state.compositeMode);

    /* 空白のみのタイルはスキップ */
    var allBlank = sd.layers.every(function (l) { return l.type === 'blank'; });
    if (allBlank) continue;

    /* 重複判定のための正規化キー生成 */
    var canonicalKey = "";
    if (ignoreRotation) {
      // 複合OFF時は、配置や回転を一切無視して純粋な図形種別・反転状態のみをキーにする
      var l0 = sd.layers[0];
      canonicalKey = l0.type + (l0.inverted ? "_inv" : "");
    } else {
      var keysRound = [];
      for (var angle = 0; angle < 360; angle += 90) {
        var layerKeys = sd.layers.map(function (l) {
          var newRot = (l.rotation + angle) % 360;
          var newIndices = l.gridIndices ? l.gridIndices.slice() : null;

          if (newIndices) {
            var steps = newRot / 90;
            var map90 = { 0: 1, 1: 3, 3: 2, 2: 0 };
            for (var i = 0; i < steps; i++) {
              newIndices = newIndices.map(function (idx) { return map90[idx]; });
            }
            newIndices.sort(function (a, b) { return a - b; });
            // グリッド図形の回転は全て位置移動に吸収されるため、回転角を0に固定
            newRot = 0;
          } else if (['square', 'blank', 'circle-center', 'circle-center-large', 'circle-corners', 'square-center', 'symbol-star', 'symbol-clover-4'].indexOf(l.type) !== -1) {
            newRot = 0;
          } else if (l.type === 'symbol-diamond') {
            newRot = newRot % 180;
          }

          return l.type + '_' + newRot + (newIndices ? '_g' + newIndices.join('') : '') + (l.inverted ? '_inv' : '');
        });
        keysRound.push(layerKeys.join('|'));
      }
      keysRound.sort();
      canonicalKey = keysRound[0];
    }

    /* 重複判定 */
    if (!seen[canonicalKey]) {
      seen[canonicalKey] = true;
      state.generatedTiles.push(sd);
    }
  }
  renderGeneratorGrid();
}

/** 第1ペインのグリッドを描画 */
function renderGeneratorGrid() {
  var grid = document.getElementById('generatorGrid');
  grid.innerHTML = '';

  state.generatedTiles.forEach(function (sd, idx) {
    var tile = document.createElement('div');
    tile.className = 'generator-tile animate-scale-in';
    tile.setAttribute('data-tile-idx', idx);

    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + TILE_SIZE + ' ' + TILE_SIZE);
    var bg = document.createElementNS(SVG_NS, 'rect');
    bg.setAttribute('width', TILE_SIZE);
    bg.setAttribute('height', TILE_SIZE);
    bg.setAttribute('fill', 'white');
    svg.appendChild(bg);
    svg.appendChild(renderShapeToSVG(sd, TILE_SIZE));
    tile.appendChild(svg);

    /* クリックでお気に入りに追加 */
    tile.addEventListener('click', function (e) {
      var currentIdx = parseInt(e.currentTarget.getAttribute('data-tile-idx'), 10);
      addToFavoritesFromGenerator(currentIdx, e.currentTarget);
    });

    grid.appendChild(tile);
  });
}

/** ジェネレーターのタイルをお気に入りに追加 */
function addToFavoritesFromGenerator(idx, tileElement) {
  var sd = state.generatedTiles[idx];
  if (!sd) return;
  state.favorites.push({
    id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    shapeData: JSON.parse(JSON.stringify(sd)),
    lockedColor: null
  });
  /* 使用済みタイルを配列から除去 */
  state.generatedTiles.splice(idx, 1);

  /* 全再描画を防ぐため、直接DOM要素を削除し、以降のインデックスを詰める */
  if (tileElement && tileElement.parentNode) {
    var grid = tileElement.parentNode;
    grid.removeChild(tileElement);
    var children = grid.children;
    for (var i = idx; i < children.length; i++) {
      var el = children[i];
      var currentIdx = parseInt(el.getAttribute('data-tile-idx'), 10);
      el.setAttribute('data-tile-idx', currentIdx - 1);
    }
  } else {
    renderGeneratorGrid();
  }

  renderFavorites();
  showToast('ストックに追加しました', '📌');

  if (state.activeTab !== 'pane-favorites') {
    state.unreadStockCount++;
    updateBadgeDisplays();
  }

  if (state.autoGenerate) {
    generateComposition();
  }
}

/* ===== 第2ペイン：お気に入り管理 ===== */
function addToFavorites() {
  /* 旧API互換用 - 現在はaddToFavoritesFromGeneratorを使用 */
}

function removeFavorite(id) {
  state.favorites = state.favorites.filter(function (f) { return f.id !== id; });
  renderFavorites();
  showToast('削除しました', '🗑');

  var hasRemovedInComp = false;
  if (state.composition && state.composition.tiles) {
    state.composition.tiles.forEach(function (t) {
      if (t.favId === id) {
        t.shapeData = { layers: [{ type: 'blank', rotation: 0 }] };
        t.rotation = 0;
        t.favId = null;
        t.lockedColor = null;
        hasRemovedInComp = true;
      }
    });
    if (hasRemovedInComp) {
      renderComposition();
    }
  }

  if (state.autoGenerate && state.favorites.length > 0) {
    generateComposition();
  }
}

function setFavoriteLockColor(id, color) {
  var fav = state.favorites.find(function (f) { return f.id === id; });
  if (fav) {
    fav.lockedColor = color;
    renderFavorites();
    if (state.composition) renderComposition();
  }
}

function clearFavoriteLockColor(id) {
  var fav = state.favorites.find(function (f) { return f.id === id; });
  if (fav) {
    fav.lockedColor = null;
    renderFavorites();
    if (state.composition) renderComposition();
  }
}

function renderFavorites() {
  var grid = document.getElementById('favoritesGrid');
  var empty = document.getElementById('favoritesEmpty');
  var countEl = document.getElementById('favCount');
  countEl.textContent = '(' + state.favorites.length + ')';

  if (state.favorites.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('sr-only');
    return;
  }
  empty.classList.add('sr-only');
  grid.innerHTML = '';

  state.favorites.forEach(function (fav) {
    var item = document.createElement('div');
    item.className = 'favorite-item animate-scale-in' + (fav.lockedColor ? ' color-locked' : '');

    /* プレビュー */
    var preview = document.createElement('div');
    preview.className = 'favorite-preview';
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + TILE_SIZE + ' ' + TILE_SIZE);
    var bg = document.createElementNS(SVG_NS, 'rect');
    bg.setAttribute('width', TILE_SIZE);
    bg.setAttribute('height', TILE_SIZE);
    bg.setAttribute('fill', 'white');
    svg.appendChild(bg);

    var colors = fav.lockedColor ? [fav.lockedColor] : undefined;
    svg.appendChild(renderShapeToSVG(fav.shapeData, TILE_SIZE, colors));
    preview.appendChild(svg);

    /* ロックインジケーター */
    var lockInd = document.createElement('div');
    lockInd.className = 'lock-indicator';
    lockInd.textContent = '🔒';

    /* アクションボタン */
    var actions = document.createElement('div');
    actions.className = 'favorite-actions';

    var btnColor = document.createElement('button');
    btnColor.className = 'btn btn-ghost btn-icon btn-sm';
    btnColor.textContent = '🎨';
    btnColor.type = 'button';
    btnColor.title = '特色ロック';
    btnColor.addEventListener('click', function (e) {
      e.stopPropagation();
      openColorPicker(fav.id, btnColor);
    });

    var btnExport = document.createElement('button');
    btnExport.className = 'btn btn-ghost btn-icon btn-sm';
    btnExport.textContent = '⬇';
    btnExport.type = 'button';
    btnExport.title = 'SVG保存';
    btnExport.addEventListener('click', function (e) {
      e.stopPropagation();
      exportSingleTile(fav);
    });

    var btnDelete = document.createElement('button');
    btnDelete.className = 'btn btn-danger btn-icon btn-sm';
    btnDelete.textContent = '✕';
    btnDelete.type = 'button';
    btnDelete.title = '削除';
    btnDelete.addEventListener('click', function (e) {
      e.stopPropagation();
      removeFavorite(fav.id);
    });

    actions.appendChild(btnColor);
    actions.appendChild(btnExport);
    actions.appendChild(btnDelete);

    item.appendChild(preview);
    item.appendChild(lockInd);
    item.appendChild(actions);
    grid.appendChild(item);
  });
}

/* ===== カラーピッカー ===== */
var activeColorPickerId = null;

function openColorPicker(favId, anchor) {
  activeColorPickerId = favId;
  var popover = document.getElementById('colorPickerPopover');
  var rect = anchor.getBoundingClientRect();
  popover.classList.add('visible');

  var top = rect.bottom + 4;
  var left = rect.left;
  if (top + 120 > window.innerHeight) top = rect.top - 120;
  if (left + 150 > window.innerWidth) left = window.innerWidth - 160;

  popover.setAttribute('data-top', top + 'px');
  popover.setAttribute('data-left', left + 'px');
  /* クラスでポジション設定する代わりにCSS変数を使用 */
  popover.style.setProperty('--picker-top', top + 'px');
  popover.style.setProperty('--picker-left', left + 'px');

  var fav = state.favorites.find(function (f) { return f.id === favId; });
  document.getElementById('colorPickerInput').value = fav && fav.lockedColor ? fav.lockedColor : '#333333';
}

function closeColorPicker() {
  document.getElementById('colorPickerPopover').classList.remove('visible');
  activeColorPickerId = null;
}

/* ===== 第3ペイン：コンポジション ===== */

/** グリッド寸法のパース */
function getGridDimensions() {
  var val = document.getElementById('gridSizeSelect').value;
  if (val.indexOf('x') !== -1) {
    var parts = val.split('x');
    return { cols: parseInt(parts[0], 10), rows: parseInt(parts[1], 10) };
  }
  var size = parseInt(val, 10);
  return { cols: size, rows: size };
}

/** コンポジション生成 */
function generateComposition() {
  if (state.favorites.length === 0) {
    showToast('先にお気に入りを追加してください', '⚠');
    return;
  }

  var dims = getGridDimensions();
  var cols = dims.cols;
  var rows = dims.rows;
  var tiles = [];

  for (var i = 0; i < cols * rows; i++) {
    var randomColorIndex = Math.floor(Math.random() * 5);
    var baseColorIndex = i % 5;
    var blankPriority = Math.random();

    var fav = randomFrom(state.favorites);

    // コンポジションの初期生成時にも、垂直固定シンボルがある場合は0/180度に限定
    var initRotation = randomFrom(ROTATIONS);
    for (var k = 0; k < fav.shapeData.layers.length; k++) {
      var sType = fav.shapeData.layers[k].type;
      if (['symbol-star', 'symbol-heart', 'symbol-clover-3', 'symbol-clover-4', 'symbol-spade', 'symbol-drop'].indexOf(sType) !== -1) {
        initRotation = randomFrom([0, 180]);
        break;
      }
    }

    tiles.push({
      id: 'tile_' + Date.now() + '_' + i + '_' + Math.random().toString(36).slice(2, 6),
      shapeData: JSON.parse(JSON.stringify(fav.shapeData)),
      rotation: initRotation,
      favId: fav.id,
      randomColorIndex: randomColorIndex,
      baseColorIndex: baseColorIndex,
      blankPriority: blankPriority,
      lockedColor: fav.lockedColor
    });
  }

  /* Undoスタック保存 */
  pushUndo();

  state.composition = { cols: cols, rows: rows, gridSize: Math.max(cols, rows), tiles: tiles };
  renderComposition();
  showToast('コンポジション生成完了', '✨');

  if (state.activeTab !== 'pane-composition') {
    state.isCompositionNew = true;
    updateBadgeDisplays();
  }
}

/** コンポジション描画 */
function renderComposition() {
  var emptyEl = document.getElementById('compositionEmpty');
  var canvasEl = document.getElementById('compositionCanvas');

  if (!state.composition) {
    emptyEl.classList.remove('sr-only');
    canvasEl.innerHTML = '';
    return;
  }
  emptyEl.classList.add('sr-only');

  var gs = state.composition.gridSize || 8;
  var cols = state.composition.cols || gs;
  var rows = state.composition.rows || gs;
  var totalWidth = cols * TILE_SIZE;
  var totalHeight = rows * TILE_SIZE;

  var svg = document.getElementById('compositionSVG');
  // SVGが存在しない、またはグリッドサイズが変わった場合は作り直す
  if (!svg || svg.getAttribute('viewBox') !== '0 0 ' + totalWidth + ' ' + totalHeight) {
    canvasEl.innerHTML = '';
    svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + totalWidth + ' ' + totalHeight);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('xmlns', SVG_NS);
    svg.id = 'compositionSVG';

    /* 背景画像と背景色（透過）の順序を変更するため、
       ここでは背景画像を敷き、その上に透過色を被せる。
       エクスポート時はこの背景用要素ではなく、別途Canvas側で描画順を制御する方針に変更 */
    var bg = document.createElementNS(SVG_NS, 'rect');
    bg.setAttribute('width', totalWidth);
    bg.setAttribute('height', totalHeight);
    bg.setAttribute('fill', 'transparent');
    bg.id = 'compositionSvgBg';
    svg.appendChild(bg);

    /* グリッド作成（タイルの背面にするためここで追加） */
    for (var i = 1; i < rows; i++) {
      var lineH = document.createElementNS(SVG_NS, 'line');
      lineH.className = 'grid-line';
      lineH.setAttribute('x1', 0);
      lineH.setAttribute('y1', i * TILE_SIZE);
      lineH.setAttribute('x2', totalWidth);
      lineH.setAttribute('y2', i * TILE_SIZE);
      lineH.setAttribute('stroke', 'rgba(0,0,0,0.03)');
      lineH.setAttribute('stroke-width', '0.3');
      svg.appendChild(lineH);
    }
    for (var j = 1; j < cols; j++) {
      var lineV = document.createElementNS(SVG_NS, 'line');
      lineV.className = 'grid-line';
      lineV.setAttribute('x1', j * TILE_SIZE);
      lineV.setAttribute('y1', 0);
      lineV.setAttribute('x2', j * TILE_SIZE);
      lineV.setAttribute('y2', totalHeight);
      lineV.setAttribute('stroke', 'rgba(0,0,0,0.03)');
      lineV.setAttribute('stroke-width', '0.3');
      svg.appendChild(lineV);
    }

    canvasEl.appendChild(svg);
  }

  var palette = state.currentPalette ? state.currentPalette.colors : ['#212529', '#495057', '#6c757d', '#adb5bd', '#dee2e6'];
  var blankRate = parseInt(document.getElementById('blankSlider').value) / 100;

  // 現在のタイルのIDセットを取得（削除されたタイルを特定するため）
  var activeIds = new Set(state.composition.tiles.map(function (t) { return t.id; }));

  // SVG内の既存タイルをチェックし、不要なものを削除
  var existingTiles = svg.querySelectorAll('.comp-tile');
  existingTiles.forEach(function (el) {
    if (!activeIds.has(el.id)) {
      svg.removeChild(el);
    }
  });

  state.composition.tiles.forEach(function (tile, idx) {
    // IDが欠落している場合のフォールバック（Undo時などのため）
    if (!tile.id) {
      tile.id = 'tile_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).slice(2, 6);
    }

    var col = idx % cols;
    var row = Math.floor(idx / cols);
    var x = col * TILE_SIZE;
    var y = row * TILE_SIZE;

    // ドラッグ中のタイルはマウス位置に直接合わせるため、ここでは本来の位置を計算
    var isDraggingThis = state.dragState.isDragging && state.dragState.tileIdx === idx;

    var tileG = document.getElementById(tile.id);
    if (!tileG) {
      tileG = document.createElementNS(SVG_NS, 'g');
      tileG.id = tile.id;
      tileG.classList.add('comp-tile');
      tileG.addEventListener('pointerdown', function (e) {
        // クロージャの古いidxではなく、要素の最新属性から取得する
        var currentIdx = parseInt(e.currentTarget.getAttribute('data-tile-idx'), 10);
        handlePointerDown(e, currentIdx);
      });
      svg.appendChild(tileG);
    }

    // インデックスが変わっていれば更新
    tileG.setAttribute('data-tile-idx', idx);

    // ドラッグ状態のクラス付け替え
    if (isDraggingThis) {
      tileG.classList.add('dragging');
      tileG.style.opacity = '0.5';

      // ドラッグ中の座標計算
      var canvasRect = canvasEl.getBoundingClientRect();
      var dragX = (state.dragState.currentX - canvasRect.left) / state.compositionZoom - TILE_SIZE / 2;
      var dragY = (state.dragState.currentY - canvasRect.top) / state.compositionZoom - TILE_SIZE / 2;
      tileG.style.transform = 'translate(' + dragX + 'px,' + dragY + 'px)';
    } else {
      tileG.classList.remove('dragging');
      tileG.style.opacity = '';
      tileG.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    }

    /* タイルの色を決定（内容が変わった可能性があるため常に再生成） */
    tileG.innerHTML = '';

    // 個別の白背景は透過を妨げるため追加しない
    // (以前の仕様: 隙間対策で tileBg を追加していた)

    /* 追加の回転を適用 */
    var innerG = document.createElementNS(SVG_NS, 'g');
    if (tile.rotation !== 0) {
      innerG.setAttribute('transform',
        'translate(' + (TILE_SIZE / 2) + ',' + (TILE_SIZE / 2) + ') ' +
        'rotate(' + tile.rotation + ') ' +
        'translate(' + (-TILE_SIZE / 2) + ',' + (-TILE_SIZE / 2) + ')'
      );
    }

    /* タイル自身に透明度を反映させる（背景を透けさせるため） */
    if (state.tileOpacity < 1.0) {
      innerG.setAttribute('opacity', state.tileOpacity);
    }

    /* 空白判定 */
    var isBlank = (!isNaN(tile.blankPriority) && tile.blankPriority < blankRate) || (tile.shapeData.layers.every(function (l) { return l.type === 'blank'; }));

    if (isBlank) {
      innerG.appendChild(renderShapeToSVG({ layers: [{ type: 'blank', rotation: 0 }] }, TILE_SIZE, []));
    } else {
      var tileColors;
      if (tile.lockedColor) {
        tileColors = [tile.lockedColor];
      } else {
        var cIndex = state.randomColorMode ? (tile.randomColorIndex || 0) : (tile.baseColorIndex || 0);
        // 古いデータ構造からの移行のために paletteColorIndex も一応チェック
        if (tile.randomColorIndex === undefined && tile.baseColorIndex === undefined && tile.paletteColorIndex !== undefined) {
          cIndex = tile.paletteColorIndex;
        }
        tileColors = [palette[cIndex % palette.length]];
        /* 複合図形の場合、複数色を割り当て */
        if (tile.shapeData.layers.length > 1) {
          tileColors = tile.shapeData.layers.map(function (_, i) {
            return palette[(cIndex + i) % palette.length];
          });
        }
      }
      innerG.appendChild(renderShapeToSVG(tile.shapeData, TILE_SIZE, tileColors));
    }
    tileG.appendChild(innerG);
  });

  /* Canvas要素自体の背景設定を更新（背景画像＋背景色の合成） */
  // HTML上で背景画像を下に、色を上に重ねるためには、擬似要素や複数背景プロパティなどを使う
  // CSSの linear-gradient で単色オーバーレイを作り、その下に url() を配置する手法をとる
  if (state.canvasBgImage) {
    // RGBAカラーを計算
    var hex = state.canvasBgColor;
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    var rgba = 'rgba(' + r + ',' + g + ',' + b + ',' + state.canvasBgOpacity + ')';

    canvasEl.style.backgroundImage = 'linear-gradient(' + rgba + ', ' + rgba + '), url(' + state.canvasBgImage + ')';
    canvasEl.style.backgroundSize = 'auto, cover';
    canvasEl.style.backgroundPosition = 'center, center';
    canvasEl.style.backgroundColor = 'transparent'; // 背景色が透けるように
  } else {
    // 画像がない場合は単色のみ
    canvasEl.style.backgroundImage = 'none';

    var hex = state.canvasBgColor;
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    var rgba = 'rgba(' + r + ',' + g + ',' + b + ',' + state.canvasBgOpacity + ')';
    canvasEl.style.backgroundColor = rgba;
  }

  /* ズーム倍率を適用 */
  updateCompositionZoom();
}

/** コンポジションのズーム状態を更新 */
function updateCompositionZoom() {
  if (!state.composition) return;
  var canvasEl = document.getElementById('compositionCanvas');
  var svg = document.getElementById('compositionSVG');
  if (!canvasEl || !svg) return;

  var gs = state.composition.gridSize || 8;
  var cols = state.composition.cols || gs;
  var rows = state.composition.rows || gs;
  var totalWidth = cols * TILE_SIZE;
  var totalHeight = rows * TILE_SIZE;
  var scaledWidth = totalWidth * state.compositionZoom;
  var scaledHeight = totalHeight * state.compositionZoom;

  canvasEl.style.width = scaledWidth + 'px';
  canvasEl.style.height = scaledHeight + 'px';
  // CSSのmax-width/max-heightを無効化して拡大できるようにする
  canvasEl.style.maxWidth = 'none';
  canvasEl.style.maxHeight = 'none';

  svg.setAttribute('width', scaledWidth);
  svg.setAttribute('height', scaledHeight);

  // ズーム倍率のUI表示更新を追加
  var zoomValueEl = document.getElementById('zoomValue');
  if (zoomValueEl) {
    var percent = Math.round(state.compositionZoom * 100);
    zoomValueEl.textContent = percent + '%';
  }
}

/** タイル回転 */
function rotateTile(idx) {
  if (!state.composition) return;
  pushUndo();
  var tile = state.composition.tiles[idx];

  // タイル内のレイヤーに垂直固定が必要なシンボルが含まれているかチェック
  var hasVerticalSymbol = false;
  for (var i = 0; i < tile.shapeData.layers.length; i++) {
    var sType = tile.shapeData.layers[i].type;
    if (['symbol-star', 'symbol-heart', 'symbol-clover-3', 'symbol-clover-4', 'symbol-spade', 'symbol-drop'].indexOf(sType) !== -1) {
      hasVerticalSymbol = true;
      break;
    }
  }

  // 垂直固定シンボルがある場合は180度回転(天地反転)、それ以外は90度回転
  var rotationStep = hasVerticalSymbol ? 180 : 90;
  tile.rotation = (tile.rotation + rotationStep) % 360;

  renderComposition();
}

/* ===== ドラッグ＆ドロップ関連イベントハンドラ ===== */

/** ポインターダウン（ドラッグ開始準備） */
function handlePointerDown(e, idx) {
  if (!state.composition) return;
  // 左クリックまたはタッチ以外は無視
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  // ピンチズームなど、複数指でのタッチの2本目以降は開始しない
  if (e.pointerType === 'touch' && !e.isPrimary) return;

  var compArea = document.getElementById('compositionArea');

  // 【PC専用パン】Spaceが押されていれば、タイルのドラッグではなくパン操作とする
  if (state.panState.isSpaceDown && e.pointerType === 'mouse') {
    state.panState.isActive = true;
    state.panState.startX = e.clientX;
    state.panState.startY = e.clientY;
    state.panState.scrollLeft = compArea ? compArea.scrollLeft : 0;
    state.panState.scrollTop = compArea ? compArea.scrollTop : 0;
    state.panState.pointerId = e.pointerId;
    if (compArea) compArea.style.cursor = 'grabbing';
    return; // タイルのドラッグ処理は発火させない
  }

  // タイルのドラッグ用：既存のタイマーがあればクリア
  if (state.dragState.activationTimer) {
    clearTimeout(state.dragState.activationTimer);
  }

  // 初期情報セット
  state.dragState.tileIdx = idx;
  state.dragState.startX = e.clientX;
  state.dragState.startY = e.clientY;
  state.dragState.currentX = e.clientX;
  state.dragState.currentY = e.clientY;
  state.dragState.hasMoved = false;
  state.dragState.isDragging = false;

  // マウスの場合は即座にアクティブ、タッチの場合は遅延（長押し）後にアクティブ化
  if (e.pointerType === 'mouse') {
    state.dragState.isActive = true;
  } else {
    state.dragState.isActive = false;
    state.dragState.activationTimer = setTimeout(function () {
      // 200ms 動かさなければドラッグ可能状態とみなす
      state.dragState.isActive = true;
      // 見た目だけドラッグ待機状態にするため再描画
      state.dragState.isDragging = true;
      renderComposition();
    }, 200);

    // 【モバイルパン】タッチ操作の場合、タイルの遅延中であってもパンの初期位置を記録しておく
    var compArea = document.getElementById('compositionArea');
    state.panState.isActive = false; // まだ確定はしない
    state.panState.startX = e.clientX;
    state.panState.startY = e.clientY;
    state.panState.scrollLeft = compArea ? compArea.scrollLeft : 0;
    state.panState.scrollTop = compArea ? compArea.scrollTop : 0;
    state.panState.pointerId = e.pointerId;
  }
}

/** 
 * ポインターダウン（キャンバスの余白部分を直接触った時のパン）
 */
function handleCanvasPointerDown(e) {
  // すでにタイルのドラッグやパンが始まっている場合はスキップ
  if (state.dragState.tileIdx !== null || state.panState.isActive) return;

  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (e.pointerType === 'touch' && !e.isPrimary) return;

  var compArea = document.getElementById('compositionArea');

  state.panState.isActive = true; // 余白を触った場合は即座にパン可能
  state.panState.startX = e.clientX;
  state.panState.startY = e.clientY;
  state.panState.scrollLeft = compArea ? compArea.scrollLeft : 0;
  state.panState.scrollTop = compArea ? compArea.scrollTop : 0;
  state.panState.pointerId = e.pointerId;

  if (e.pointerType === 'mouse') {
    if (compArea) compArea.style.cursor = 'grabbing';
  }
}

/** ポインター移動（動的な入れ替え または パン動作） */
function handlePointerMove(e) {
  var compArea = document.getElementById('compositionArea');

  // 【パン処理の実装】
  if (state.panState.isActive && state.panState.pointerId === e.pointerId) {
    if (compArea) {
      var dxPan = e.clientX - state.panState.startX;
      var dyPan = e.clientY - state.panState.startY;
      compArea.scrollLeft = state.panState.scrollLeft - dxPan;
      compArea.scrollTop = state.panState.scrollTop - dyPan;
    }
    return; // パン実行中はドラッグ処理を行わない
  }

  // ドラッグ操作対象でなければ何もしない
  if (state.dragState.tileIdx === null) return;

  var dx = e.clientX - state.dragState.startX;
  var dy = e.clientY - state.dragState.startY;
  var dist = Math.hypot(dx, dy);

  // タッチ環境でスレッショルド以上の移動（かつまだアクティブでない）場合は、
  // ドラッグ操作ではなく「ズームまたはパン」とみなし、操作をキャンセルする
  if (!state.dragState.isActive && e.pointerType === 'touch') {
    if (dist > 10) {
      if (state.dragState.activationTimer) clearTimeout(state.dragState.activationTimer);
      state.dragState.tileIdx = null;

      // パンをアクティブ化
      state.panState.isActive = true;
    }
    return;
  }

  if (!state.dragState.isActive) return;

  // わずかな移動（閾値5px）を検知してドラッグとみなす
  if (!state.dragState.hasMoved && Math.hypot(dx, dy) > 5) {
    state.dragState.hasMoved = true;
  }

  // 5pxを超えておらず、かつ長押し等でまだドラッグ中になっていない場合は保留
  if (!state.dragState.hasMoved && !state.dragState.isDragging) return;

  state.dragState.isDragging = true;

  state.dragState.currentX = e.clientX;
  state.dragState.currentY = e.clientY;

  if (state.dragState.hasMoved) {
    // スクロールやCSSズームの影響を排除して、正確にカーソル直下のセルを計算する
    var canvasEl = document.getElementById('compositionCanvas');
    var rect = canvasEl.getBoundingClientRect();

    // canvas内のローカル座標（ズーム考慮）
    var localX = (e.clientX - rect.left) / state.compositionZoom;
    var localY = (e.clientY - rect.top) / state.compositionZoom;

    var gs = state.composition.gridSize || 8;
    var cols = state.composition.cols || gs;
    var rows = state.composition.rows || gs;
    // 枠外へのドラッグは無視
    if (localX >= 0 && localX < cols * TILE_SIZE && localY >= 0 && localY < rows * TILE_SIZE) {
      var col = Math.floor(localX / TILE_SIZE);
      var row = Math.floor(localY / TILE_SIZE);
      var targetIdx = row * cols + col;
      var sourceIdx = state.dragState.tileIdx;

      // 無関係なセルとの入れ替え（特に遠く離れたセルへのジャンプ）を防ぐため、
      // 現在のインデックスから前後左右（または斜め）の隣接セルにのみ入れ替えを許可する
      var sCol = sourceIdx % cols;
      var sRow = Math.floor(sourceIdx / cols);

      var isAdjacent = Math.abs(col - sCol) <= 1 && Math.abs(row - sRow) <= 1;

      if (targetIdx !== sourceIdx && isAdjacent) {
        // タイルの入れ替え（パズドラ風挙動）
        var tiles = state.composition.tiles;
        var temp = tiles[sourceIdx];
        tiles[sourceIdx] = tiles[targetIdx];
        tiles[targetIdx] = temp;

        state.dragState.tileIdx = targetIdx;
      }
    }
  }

  renderComposition();
}

/** ポインターアップ（ドラッグ または パンの終了） */
function handlePointerUp(e) {
  // 【パン処理の終了】
  if (state.panState.isActive && state.panState.pointerId === e.pointerId) {
    state.panState.isActive = false;
    state.panState.pointerId = null;
    var compArea = document.getElementById('compositionArea');
    if (compArea && !state.panState.isSpaceDown) {
      compArea.style.cursor = '';
    } else if (compArea && state.panState.isSpaceDown) {
      compArea.style.cursor = 'grab';
    }
    return;
  }

  // 以下、既存のドラッグ用のアップ処理
  // タイマーがあればクリア
  if (state.dragState.activationTimer) {
    clearTimeout(state.dragState.activationTimer);
    state.dragState.activationTimer = null;
  }

  // 5px未満の移動で離した場合はクリック判定（長押し後のドラッグ無しアップも含む）
  if (state.dragState.tileIdx !== null && !state.dragState.hasMoved) {
    rotateTile(state.dragState.tileIdx);

    // 状態をリセット
    state.dragState.isActive = false;
    state.dragState.isDragging = false;
    state.dragState.tileIdx = null;
    renderComposition();
    return;
  }

  if (!state.dragState.isDragging) {
    state.dragState.isActive = false;
    state.dragState.isDragging = false;
    state.dragState.tileIdx = null;
    return;
  }

  // 入れ替え完了としてUndoを保存
  pushUndo();

  state.dragState.isActive = false;
  state.dragState.isDragging = false;
  state.dragState.tileIdx = null;
  renderComposition();
}

/* ===== Undo ===== */
function pushUndo() {
  if (state.composition) {
    state.undoStack.push(JSON.stringify(state.composition));
    /* 最大50ステップ */
    if (state.undoStack.length > 50) state.undoStack.shift();
  }
}

function undo() {
  if (state.undoStack.length === 0) {
    showToast('これ以上戻れません', '⚠');
    return;
  }
  state.composition = JSON.parse(state.undoStack.pop());
  renderComposition();
  showToast('元に戻しました', '↩');
}

/* ===== カラーパレットシステム ===== */
var currentTagFilter = 'すべて';

function initPalettes() {
  /* 外部ファイルから読み込んだパレットデータを使用 */
  if (typeof PALETTE_DATA !== 'undefined') {
    state.palettes = PALETTE_DATA;
  }
  renderPaletteTags();
}

function renderPaletteTags() {
  var tagsEl = document.getElementById('paletteTags');
  tagsEl.innerHTML = '';
  var allTags = ['すべて'];
  state.palettes.forEach(function (p) {
    p.tags.forEach(function (t) {
      if (allTags.indexOf(t) === -1) allTags.push(t);
    });
  });

  allTags.forEach(function (tag) {
    var btn = document.createElement('button');
    btn.className = 'tag-btn' + (tag === currentTagFilter ? ' active' : '');
    btn.textContent = tag;
    btn.type = 'button';
    btn.addEventListener('click', function () {
      currentTagFilter = tag;
      renderPaletteTags();
      renderPaletteGrid();
    });
    tagsEl.appendChild(btn);
  });
}

function renderPaletteGrid() {
  var grid = document.getElementById('paletteGrid');
  grid.innerHTML = '';
  var filtered = currentTagFilter === 'すべて'
    ? state.palettes
    : state.palettes.filter(function (p) { return p.tags.indexOf(currentTagFilter) !== -1; });

  filtered.forEach(function (pal) {
    var card = document.createElement('div');
    card.className = 'palette-card' +
      (state.currentPalette && state.currentPalette.name === pal.name ? ' selected' : '');

    var colors = document.createElement('div');
    colors.className = 'palette-colors';
    pal.colors.forEach(function (c) {
      var swatch = document.createElement('div');
      swatch.className = 'palette-color-swatch';
      swatch.style.backgroundColor = c;
      colors.appendChild(swatch);
    });

    var name = document.createElement('div');
    name.className = 'palette-name';
    name.textContent = pal.name;

    card.appendChild(colors);
    card.appendChild(name);

    card.addEventListener('click', function () {
      state.currentPalette = pal;
      if (state.composition) renderComposition();
      renderPaletteGrid();
      showToast('パレット適用: ' + pal.name, '🎨');
    });

    grid.appendChild(card);
  });
}

function openPaletteModal() {
  renderPaletteGrid();
  document.getElementById('paletteModal').classList.add('visible');
}

function closePaletteModal() {
  document.getElementById('paletteModal').classList.remove('visible');
}

/* ===== SVGエクスポート ===== */
function exportSVG(svgElement, filename) {
  var clone = svgElement.cloneNode(true);
  clone.setAttribute('xmlns', SVG_NS);
  var serializer = new XMLSerializer();
  var source = serializer.serializeToString(clone);
  source = '<?xml version="1.0" encoding="UTF-8"?>\n' + source;
  var blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportSingleTile(fav) {
  var svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 ' + TILE_SIZE + ' ' + TILE_SIZE);
  svg.setAttribute('width', '200');
  svg.setAttribute('height', '200');
  var bg = document.createElementNS(SVG_NS, 'rect');
  bg.setAttribute('width', TILE_SIZE);
  bg.setAttribute('height', TILE_SIZE);
  bg.setAttribute('fill', 'white');
  svg.appendChild(bg);
  var colors = fav.lockedColor ? [fav.lockedColor] : undefined;
  svg.appendChild(renderShapeToSVG(fav.shapeData, TILE_SIZE, colors));
  exportSVG(svg, 'tile_' + fav.id + '.svg');
  showToast('SVGを保存しました', '⬇');
}

function exportComposition() {
  var svg = document.getElementById('compositionSVG');
  if (!svg) {
    showToast('コンポジションがありません', '⚠');
    return;
  }

  // 出力画像用の一時的な状態変更（背景色や画像を落として白背景のみにする処理）
  var bgObj = document.getElementById('compositionSvgBg');
  var prevFill = bgObj ? bgObj.getAttribute('fill') : 'transparent';
  if (bgObj) {
    bgObj.setAttribute('fill', 'white'); // エクスポート時は白背景を適用
  }

  // 追加: エクスポート時は実寸サイズを明示
  var prevWidth = svg.getAttribute('width');
  var prevHeight = svg.getAttribute('height');
  var gs = state.composition.gridSize || 8;
  var cols = state.composition.cols || gs;
  var rows = state.composition.rows || gs;
  svg.setAttribute('width', cols * TILE_SIZE);
  svg.setAttribute('height', rows * TILE_SIZE);

  exportSVG(svg, 'composition_' + Date.now() + '.svg');

  // 状態復元
  if (bgObj) {
    bgObj.setAttribute('fill', prevFill);
  }
  svg.setAttribute('width', prevWidth);
  svg.setAttribute('height', prevHeight);

  showToast('タイルSVGを保存しました', '⬇');
}

function exportCompositionAsImage() {
  var svg = document.getElementById('compositionSVG');
  if (!svg) {
    showToast('コンポジションがありません', '⚠');
    return;
  }

  var clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', SVG_NS);

  // 追加: エクスポート時は実寸サイズを明示（ブラウザのviewport依存を避ける）
  var gs = state.composition.gridSize || 8;
  var cols = state.composition.cols || gs;
  var rows = state.composition.rows || gs;
  clone.setAttribute('width', cols * TILE_SIZE);
  clone.setAttribute('height', rows * TILE_SIZE);

  var serializer = new XMLSerializer();
  var source = serializer.serializeToString(clone);

  var img = new Image();
  var blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  var url = URL.createObjectURL(blob);

  img.onload = function () {
    var canvas = document.createElement('canvas');
    var gs = state.composition.gridSize || 8;
    var cols = state.composition.cols || gs;
    var rows = state.composition.rows || gs;
    canvas.width = cols * TILE_SIZE;
    canvas.height = rows * TILE_SIZE;
    var ctx = canvas.getContext('2d');

    var drawAndExport = function () {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      canvas.toBlob(function (blob) {
        var a = document.createElement('a');
        a.download = 'composition_' + Date.now() + '.png';
        var pngUrl = URL.createObjectURL(blob);
        a.href = pngUrl;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(pngUrl);

        showToast('画像(PNG)を保存しました', '⬇');
      }, 'image/png');
    };

    if (state.canvasBgImage) {
      var bgImg = new Image();
      bgImg.onload = function () {
        // 1. 背景画像を一番下に描画（トリミング済み画像がセットされている前提なのでそのまま全画面描画）
        ctx.drawImage(bgImg, 0, 0, bgImg.width, bgImg.height, 0, 0, canvas.width, canvas.height);

        // 2. 背景色をその上にオーバーレイ描画
        var hex = state.canvasBgColor;
        var r = parseInt(hex.slice(1, 3), 16);
        var g = parseInt(hex.slice(3, 5), 16);
        var b = parseInt(hex.slice(5, 7), 16);
        ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + state.canvasBgOpacity + ')';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 3. SVG結果を描画してエクスポート
        drawAndExport();
      };
      bgImg.onerror = function () {
        var hex = state.canvasBgColor;
        var r = parseInt(hex.slice(1, 3), 16);
        var g = parseInt(hex.slice(3, 5), 16);
        var b = parseInt(hex.slice(5, 7), 16);
        ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + state.canvasBgOpacity + ')';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawAndExport();
      };
      bgImg.src = state.canvasBgImage;
    } else {
      var hex = state.canvasBgColor;
      var r = parseInt(hex.slice(1, 3), 16);
      var g = parseInt(hex.slice(3, 5), 16);
      var b = parseInt(hex.slice(5, 7), 16);
      ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + state.canvasBgOpacity + ')';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawAndExport();
    }
  };

  img.src = url;
}

/* ===== ピンチズーム（タッチ／モバイル操作） ===== */

/**
 * compositionArea に対してピンチズーム操作を設定する。
 * 2本指の中点をピボットとして、指間距離の変化量に応じてインクリメンタルにズームを行い、
 * scrollLeft / scrollTop をリアルタイム補正することで「地図アプリ的な」操作感を実現する。
 *
 * @param {HTMLElement} compArea - スクロール可能なコンテナ要素
 */
function initPinchZoom(compArea) {
  // ピンチ操作の状態管理
  var lastDist = null;      // 前フレームの指間距離
  var lastCenter = null;    // 前フレームの指の中心点（compArea基準）

  /**
   * 2本指の中心点をcompAreaの相対座標で取得する。
   * getBoundingClientRect() でブラウザのスクロールや位置を正確に考慮する。
   */
  function getTouchCenter(touches, areaRect) {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2 - areaRect.left,
      y: (touches[0].clientY + touches[1].clientY) / 2 - areaRect.top
    };
  }

  /** 2本指の距離を取得する */
  function getTouchDist(touches) {
    var dx = touches[0].clientX - touches[1].clientX;
    var dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  compArea.addEventListener('touchstart', function (e) {
    // 2本指以上のタッチが検出された場合、進行中の操作（ドラッグやパン）を強制キャンセルする
    if (e.touches.length >= 2) {
      if (state.dragState.activationTimer) clearTimeout(state.dragState.activationTimer);

      var canceledIdx = state.dragState.tileIdx;

      // ドラッグのキャンセル
      state.dragState.isActive = false;
      state.dragState.isDragging = false;
      state.dragState.tileIdx = null;

      // パンのキャンセル
      state.panState.isActive = false;
      state.panState.pointerId = null;

      // DOM全体を再構築する renderComposition() を呼ぶと、タッチ対象の要素(EventTarget)が
      // 削除されてしまい、ブラウザが「touchcancel」を発火させてピンチ操作が中断してしまいます。
      // そのため、ドラッグ中だったタイルの変形とクラスだけを手動クリーンアップします。
      if (canceledIdx !== null && state.composition) {
        var tile = state.composition.tiles[canceledIdx];
        if (tile && tile.id) {
          var el = document.getElementById(tile.id);
          if (el) {
            el.classList.remove('dragging');
            el.style.opacity = '';
            var gs = state.composition.gridSize || 8;
            var cols = state.composition.cols || gs;
            var col = canceledIdx % cols;
            var row = Math.floor(canceledIdx / cols);
            el.style.transform = 'translate(' + (col * TILE_SIZE) + 'px,' + (row * TILE_SIZE) + 'px)';
          }
        }
      }
    }

    // 2本指のタッチ開始時のみ初期化する
    if (e.touches.length !== 2) return;
    // ブラウザ標準のズーム/スクロールを確実に防ぐ
    e.preventDefault();

    var areaRect = compArea.getBoundingClientRect();
    lastDist = getTouchDist(e.touches);
    lastCenter = getTouchCenter(e.touches, areaRect);
  }, { passive: false });

  compArea.addEventListener('touchmove', function (e) {
    // 2本指でない場合、またはピンチ未開始の場合は無視する
    if (e.touches.length !== 2 || lastDist === null) return;
    e.preventDefault(); // ブラウザのパン・バウンスを防ぐ

    if (!state.composition) return;

    var areaRect = compArea.getBoundingClientRect();
    var currentDist = getTouchDist(e.touches);
    var currentCenter = getTouchCenter(e.touches, areaRect);

    // --- インクリメンタルなズーム計算 ---
    // 前フレームとの比率でズームを掛け合わせることで、滑らかなズームを実現する
    var scaleFactor = currentDist / lastDist;
    var newZoom = state.compositionZoom * scaleFactor;
    newZoom = Math.min(Math.max(0.1, newZoom), 10.0);

    // --- ピボット補正（スクロール位置を更新して中心点がズレないようにする） ---
    // 現在の中心点が指す「コンテンツ内の絶対座標」を計算する
    var contentX = (compArea.scrollLeft + currentCenter.x) / state.compositionZoom;
    var contentY = (compArea.scrollTop + currentCenter.y) / state.compositionZoom;

    // ズーム倍率を更新してコンテンツサイズを変更する
    state.compositionZoom = newZoom;
    updateCompositionZoom();

    // ズーム後に同じコンテンツ座標が中心点に来るようスクロール位置を補正する
    compArea.scrollLeft = contentX * state.compositionZoom - currentCenter.x;
    compArea.scrollTop = contentY * state.compositionZoom - currentCenter.y;

    // 次フレームのために今回の値を保存する
    lastDist = currentDist;
    lastCenter = currentCenter;
  }, { passive: false });

  compArea.addEventListener('touchend', function (e) {
    // 2本指が揃っていなければリセット
    if (e.touches.length < 2) {
      lastDist = null;
      lastCenter = null;
    }
  });

  compArea.addEventListener('touchcancel', function () {
    // キャンセル時もリセット
    lastDist = null;
    lastCenter = null;
  });
}

/* ===== UIポジション調整 ===== */
function adjustDropdownPosition(menuElement) {
  if (window.innerWidth <= 768) {
    menuElement.style.left = '';
    menuElement.style.right = '';
    return;
  }

  // 位置の測定のためインラインスタイルをリフレッシュ
  menuElement.style.left = '';
  menuElement.style.right = '';

  var rect = menuElement.getBoundingClientRect();
  var compPane = document.getElementById('pane-composition');
  var paneRect = compPane ? compPane.getBoundingClientRect() : { left: 0, right: window.innerWidth };

  // メニューの左端がペインの左端を越えて隠れてしまう場合は、基準を右から左に変更する
  if (rect.left < paneRect.left) {
    menuElement.style.right = 'auto';
    menuElement.style.left = '0';
  }
}

/* ===== イベントバインド ===== */
function initEvents() {
  /* 第1ペイン */
  document.getElementById('btnGenNormal').addEventListener('click', function () {
    state.compositeMode = false;
    generateAllTiles();
  });
  document.getElementById('btnGenComposite').addEventListener('click', function () {
    state.compositeMode = true;
    generateAllTiles();
  });
  document.getElementById('checkIncludeGrid').addEventListener('change', function () {
    state.simpleMode = !this.checked; // 「分割を含める」なので、checked=trueのときsimpleMode=false
    generateAllTiles();
  });
  document.getElementById('checkIncludeSymbol').addEventListener('change', function () {
    state.noSymbolsMode = !this.checked; // 「シンボルを含める」なので、checked=trueのときnoSymbolsMode=false
    generateAllTiles();
  });

  /* 第3ペイン */
  document.getElementById('btnGenComposition').addEventListener('click', function () {
    // 手動生成クリックで、オート生成を解除
    if (state.autoGenerate) {
      state.autoGenerate = false;
      var toggleBtn = document.getElementById('toggleAutoGenerate');
      if (toggleBtn) {
        toggleBtn.classList.remove('active');
        toggleBtn.setAttribute('aria-pressed', 'false');
      }
    }
    generateComposition();
  });
  document.getElementById('btnUndo').addEventListener('click', undo);
  document.getElementById('gridSizeSelect').addEventListener('change', function () {
    generateComposition();
    if (state.originalCanvasBgImage) {
      applyBackgroundImageCrop();
    }
  });
  document.getElementById('blankSlider').addEventListener('input', function () {
    document.getElementById('blankValue').textContent = this.value + '%';
    if (state.composition) renderComposition();
  });
  document.getElementById('toggleRandomColor').addEventListener('click', function () {
    state.randomColorMode = !state.randomColorMode;
    this.classList.toggle('active', state.randomColorMode);
    this.setAttribute('aria-pressed', state.randomColorMode);
    if (state.composition) renderComposition();
  });

  document.getElementById('toggleAutoGenerate').addEventListener('click', function () {
    state.autoGenerate = !state.autoGenerate;
    this.classList.toggle('active', state.autoGenerate);
    this.setAttribute('aria-pressed', state.autoGenerate);
    if (state.autoGenerate && state.favorites.length > 0) {
      generateComposition();
    }
  });

  /* コンポジションドラッグ操作 */
  var compCanvas = document.getElementById('compositionCanvas');
  if (compCanvas) {
    // モバイル環境でのスクロール（スワイプ）によるドラッグの中断をキャンバス全体で確実に防ぐ
    compCanvas.style.touchAction = 'none';

    // キャンバスの余白部分を直接触った場合のパン開始用
    compCanvas.addEventListener('pointerdown', handleCanvasPointerDown);

    // 枠外へのドロップでも正しくトラッキングできるよう window にバインド
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }

  /* コンポジションキャンバスのズーム（マウスホイール & ピンチ操作） */
  var compArea = document.getElementById('compositionArea');
  if (compArea) {
    // マウスホイールズーム（ポインター位置を基準にズーム）
    compArea.addEventListener('wheel', function (e) {
      if (!state.composition) return;
      e.preventDefault();

      var zoomStep = 0.05;
      var newZoom = state.compositionZoom + (e.deltaY < 0 ? zoomStep : -zoomStep);
      // 0.1倍〜10倍の範囲に制限
      newZoom = Math.min(Math.max(0.1, newZoom), 10.0);

      if (newZoom !== state.compositionZoom) {
        // マウス位置を基準にズームするためのスクロール位置を補正
        var rect = compArea.getBoundingClientRect();
        var pointerX = e.clientX - rect.left;
        var pointerY = e.clientY - rect.top;

        var contentTargetX = (compArea.scrollLeft + pointerX) / state.compositionZoom;
        var contentTargetY = (compArea.scrollTop + pointerY) / state.compositionZoom;

        state.compositionZoom = newZoom;
        updateCompositionZoom();

        compArea.scrollLeft = contentTargetX * state.compositionZoom - pointerX;
        compArea.scrollTop = contentTargetY * state.compositionZoom - pointerY;
      }
    }, { passive: false });

    // ピンチズーム処理の初期化
    initPinchZoom(compArea);
  }

  /* ズーム用インラインボタン (+/-) */
  var zoomStep = 0.1;
  var minZoom = 0.1;
  var maxZoom = 5.0;

  var btnZoomOut = document.getElementById('btnZoomOut');
  if (btnZoomOut) {
    btnZoomOut.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!state.composition) return;
      state.compositionZoom = Math.max(minZoom, state.compositionZoom - zoomStep);
      updateCompositionZoom();
    });
  }

  var btnZoomIn = document.getElementById('btnZoomIn');
  if (btnZoomIn) {
    btnZoomIn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!state.composition) return;
      state.compositionZoom = Math.min(maxZoom, state.compositionZoom + zoomStep);
      updateCompositionZoom();
    });
  }

  /* ズームリセットボタン */
  var btnResetZoom = document.getElementById('btnResetZoom');
  if (btnResetZoom) {
    btnResetZoom.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!state.composition) return;
      state.compositionZoom = 1.0;
      updateCompositionZoom();

      // リセット時にスクロールも中央へ戻す（オプション）
      var compArea = document.getElementById('compositionArea');
      if (compArea) {
        compArea.scrollLeft = 0;
        compArea.scrollTop = 0;
      }
    });
  }

  /* 新規：設定（歯車）メニュー */
  var btnSettingsMenu = document.getElementById('btnSettingsMenu');
  var settingsMenuContent = document.getElementById('settingsMenuContent');

  if (btnSettingsMenu && settingsMenuContent) {
    btnSettingsMenu.addEventListener('click', function (e) {
      e.stopPropagation();
      settingsMenuContent.classList.toggle('visible');
    });

    document.addEventListener('click', function (e) {
      if (settingsMenuContent.classList.contains('visible') && e.target !== btnSettingsMenu && !settingsMenuContent.contains(e.target)) {
        settingsMenuContent.classList.remove('visible');
      }
    });

    // グリッドサイズが変わったときはメニューを閉じる
    document.getElementById('gridSizeSelect').addEventListener('change', function () {
      settingsMenuContent.classList.remove('visible');
    });
  }

  /* 新規：装飾メニュー */
  var btnDecorationMenu = document.getElementById('btnDecorationMenu');
  var decorationMenuContent = document.getElementById('decorationMenuContent');

  if (btnDecorationMenu && decorationMenuContent) {
    btnDecorationMenu.addEventListener('click', function (e) {
      e.stopPropagation();
      decorationMenuContent.classList.toggle('visible');
      if (decorationMenuContent.classList.contains('visible')) {
        adjustDropdownPosition(decorationMenuContent);
      }
    });

    document.addEventListener('click', function (e) {
      if (decorationMenuContent.classList.contains('visible') && e.target !== btnDecorationMenu && !decorationMenuContent.contains(e.target)) {
        decorationMenuContent.classList.remove('visible');
      }
    });

    /* モーダル呼び出し */
    var btnMenuPalette = document.getElementById('btnMenuPalette');
    var btnMenuBgColor = document.getElementById('btnMenuBgColor');
    var btnMenuBgImage = document.getElementById('btnMenuBgImage');

    if (btnMenuPalette) {
      btnMenuPalette.addEventListener('click', function () {
        decorationMenuContent.classList.remove('visible');
        openPaletteModal();
      });
    }

    if (btnMenuBgColor) {
      btnMenuBgColor.addEventListener('click', function () {
        decorationMenuContent.classList.remove('visible');
        document.getElementById('bgColorModal').classList.add('visible');
        document.getElementById('modalBgColorPicker').value = state.canvasBgColor;
        document.getElementById('modalBgOpacitySlider').value = state.canvasBgOpacity;
        document.getElementById('modalBgOpacityValue').textContent = state.canvasBgOpacity.toFixed(2);
      });
    }

    if (btnMenuBgImage) {
      btnMenuBgImage.addEventListener('click', function () {
        decorationMenuContent.classList.remove('visible');
        document.getElementById('bgImageModal').classList.add('visible');
      });
    }
  }

  /* モーダル閉じるイベント共通設定 */
  document.getElementById('btnCloseBgColorModal').addEventListener('click', function () {
    document.getElementById('bgColorModal').classList.remove('visible');
  });
  document.getElementById('bgColorModal').addEventListener('click', function (e) {
    if (e.target === this) this.classList.remove('visible');
  });

  document.getElementById('btnCloseBgImageModal').addEventListener('click', function () {
    document.getElementById('bgImageModal').classList.remove('visible');
  });
  document.getElementById('bgImageModal').addEventListener('click', function (e) {
    if (e.target === this) this.classList.remove('visible');
  });

  /* パレットモーダル (既存保持) */
  document.getElementById('btnCloseModal').addEventListener('click', closePaletteModal);
  document.getElementById('paletteModal').addEventListener('click', function (e) {
    if (e.target === this) closePaletteModal();
  });

  /* カラーピッカー */
  document.getElementById('btnApplyColor').addEventListener('click', function () {
    if (activeColorPickerId) {
      var color = document.getElementById('colorPickerInput').value;
      setFavoriteLockColor(activeColorPickerId, color);
      closeColorPicker();
      showToast('特色を設定しました', '🔒');
    }
  });
  document.getElementById('btnClearColor').addEventListener('click', function () {
    if (activeColorPickerId) {
      clearFavoriteLockColor(activeColorPickerId);
      closeColorPicker();
      showToast('特色を解除しました', '🔓');
    }
  });
  document.addEventListener('click', function (e) {
    var popover = document.getElementById('colorPickerPopover');
    if (popover.classList.contains('visible') && !popover.contains(e.target)) {
      closeColorPicker();
    }
  });

  /* 背景色モーダル内の設定 */
  var modalBgColorPicker = document.getElementById('modalBgColorPicker');
  if (modalBgColorPicker) {
    modalBgColorPicker.addEventListener('input', function () {
      state.canvasBgColor = this.value;
      if (state.composition) renderComposition();
    });
  }

  var modalBgOpacitySlider = document.getElementById('modalBgOpacitySlider');
  var modalBgOpacityValue = document.getElementById('modalBgOpacityValue');
  if (modalBgOpacitySlider && modalBgOpacityValue) {
    modalBgOpacitySlider.addEventListener('input', function () {
      state.canvasBgOpacity = parseFloat(this.value);
      modalBgOpacityValue.textContent = state.canvasBgOpacity.toFixed(2);
      if (state.composition) renderComposition();
    });
  }

  var btnModalBgColorClear = document.getElementById('btnModalBgColorClear');
  if (btnModalBgColorClear) {
    btnModalBgColorClear.addEventListener('click', function () {
      state.canvasBgColor = '#ffffff';
      state.canvasBgOpacity = 1.0;
      if (modalBgColorPicker) modalBgColorPicker.value = state.canvasBgColor;
      if (modalBgOpacitySlider) modalBgOpacitySlider.value = state.canvasBgOpacity;
      if (modalBgOpacityValue) modalBgOpacityValue.textContent = state.canvasBgOpacity.toFixed(2);
      if (state.composition) renderComposition();
      showToast('背景色をリセットしました', '✓');
    });
  }

  /* 背景画像クロップの適用 */
  function applyBackgroundImageCrop() {
    if (!state.originalCanvasBgImage) return;

    var img = new Image();
    img.onload = function () {
      var dims = getGridDimensions();
      var targetRatio = dims.cols / dims.rows;
      var imgRatio = img.width / img.height;
      var cropWidth, cropHeight, cropX, cropY;

      if (imgRatio > targetRatio) {
        cropHeight = img.height;
        cropWidth = img.height * targetRatio;
        cropX = (img.width - cropWidth) / 2;
        cropY = 0;
      } else {
        cropWidth = img.width;
        cropHeight = img.width / targetRatio;
        cropX = 0;
        cropY = (img.height - cropHeight) / 2;
      }

      var cropCanvas = document.createElement('canvas');
      cropCanvas.width = cropWidth;
      cropCanvas.height = cropHeight;
      var ctx = cropCanvas.getContext('2d');
      ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

      var croppedUrl = cropCanvas.toDataURL('image/jpeg', 0.85);
      state.canvasBgImage = croppedUrl;

      var modalBgImagePreview = document.getElementById('modalBgImagePreview');
      if (modalBgImagePreview) {
        modalBgImagePreview.src = croppedUrl;
      }

      if (state.composition) renderComposition();
    };
    img.src = state.originalCanvasBgImage;
  }

  /* 背景画像モーダル内の設定（クライアントサイドトリミング） */
  var btnModalBgImageSelect = document.getElementById('btnModalBgImageSelect');
  var modalBgImageInput = document.getElementById('modalBgImageInput');
  var btnModalBgImageClear = document.getElementById('btnModalBgImageClear');
  var modalBgImagePreview = document.getElementById('modalBgImagePreview');

  if (btnModalBgImageSelect && modalBgImageInput && btnModalBgImageClear && modalBgImagePreview) {
    btnModalBgImageSelect.addEventListener('click', function () {
      modalBgImageInput.click();
    });

    modalBgImageInput.addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) {
        var reader = new FileReader();
        reader.onload = function (evt) {
          state.originalCanvasBgImage = evt.target.result;
          applyBackgroundImageCrop();

          modalBgImagePreview.style.display = 'block';
          btnModalBgImageClear.disabled = false;
        };
        reader.readAsDataURL(e.target.files[0]);
      }
    });

    btnModalBgImageClear.addEventListener('click', function () {
      state.canvasBgImage = null;
      state.originalCanvasBgImage = null;
      modalBgImageInput.value = '';
      modalBgImagePreview.src = '';
      modalBgImagePreview.style.display = 'none';
      this.disabled = true;
      if (state.composition) renderComposition();
      showToast('画像をクリアしました', '✓');
    });
  }

  var opacitySlider = document.getElementById('tileOpacitySlider');
  var opacityValue = document.getElementById('tileOpacityValue');
  if (opacitySlider && opacityValue) {
    opacitySlider.addEventListener('input', function () {
      state.tileOpacity = parseFloat(this.value);
      opacityValue.textContent = state.tileOpacity.toFixed(2);
      if (state.composition) renderComposition();
    });
  }

  /* 保存メニューとエクスポート機能 */
  var btnSaveMenu = document.getElementById('btnSaveMenu');
  var saveMenuContent = document.getElementById('saveMenuContent');

  if (btnSaveMenu && saveMenuContent) {
    btnSaveMenu.addEventListener('click', function (e) {
      e.stopPropagation();
      saveMenuContent.classList.toggle('visible');
      if (saveMenuContent.classList.contains('visible')) {
        adjustDropdownPosition(saveMenuContent);
      }
    });

    document.addEventListener('click', function (e) {
      if (saveMenuContent.classList.contains('visible') && e.target !== btnSaveMenu && !saveMenuContent.contains(e.target)) {
        saveMenuContent.classList.remove('visible');
      }
    });

    var btnExportTile = document.getElementById('btnExportTile');
    if (btnExportTile) {
      btnExportTile.addEventListener('click', function () {
        exportComposition();
        saveMenuContent.classList.remove('visible');
      });
    }

    var btnExportImage = document.getElementById('btnExportImage');
    if (btnExportImage) {
      btnExportImage.addEventListener('click', function () {
        exportCompositionAsImage();
        saveMenuContent.classList.remove('visible');
      });
    }
  }

  /* キーボードショートカット */
  document.addEventListener('keydown', function (e) {
    if (e.key === ' ' && document.activeElement === document.body) {
      e.preventDefault();
      if (!state.panState.isSpaceDown) {
        state.panState.isSpaceDown = true;
        var compArea = document.getElementById('compositionArea');
        if (compArea) compArea.style.cursor = 'grab';
      }
    }
    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      undo();
    }
    if (e.key === 'Escape') {
      closePaletteModal();
      closeColorPicker();
    }
  });

  document.addEventListener('keyup', function (e) {
    if (e.key === ' ') {
      state.panState.isSpaceDown = false;
      var compArea = document.getElementById('compositionArea');
      if (compArea) compArea.style.cursor = '';
    }
  });

  /* モバイル：ボトムナビのクリックイベント */
  var navBtnGenerator = document.getElementById('nav-btn-generator');
  var navBtnFavorites = document.getElementById('nav-btn-favorites');
  var navBtnComposition = document.getElementById('nav-btn-composition');
  if (navBtnGenerator) {
    navBtnGenerator.addEventListener('click', function () { switchTab('pane-generator'); });
    navBtnFavorites.addEventListener('click', function () { switchTab('pane-favorites'); });
    navBtnComposition.addEventListener('click', function () { switchTab('pane-composition'); });
  }
}

/* ===== モバイルタブ切り替え ===== */

/**
 * 指定ペインをアクティブにし、それ以外を非表示にする。
 * デスクトップ幅（768px超）では何もしない。
 */
function switchTab(targetPaneId) {
  var paneIds = ['pane-generator', 'pane-favorites', 'pane-composition'];
  var navBtnMap = {
    'pane-generator': 'nav-btn-generator',
    'pane-favorites': 'nav-btn-favorites',
    'pane-composition': 'nav-btn-composition'
  };

  // デスクトップでは全ペインを表示（クラス除去のみ行いレイアウトはCSSに任せる）
  if (window.innerWidth > 768) {
    paneIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.classList.remove('pane-hidden', 'pane-entering');
      }
    });
    // ナビボタンのアクティブ状態もリセット
    Object.values(navBtnMap).forEach(function (btnId) {
      var btn = document.getElementById(btnId);
      if (btn) {
        btn.classList.remove('active');
        btn.removeAttribute('aria-current');
      }
    });
    return;
  }

  state.activeTab = targetPaneId;

  // バッジのリセット
  if (targetPaneId === 'pane-favorites') {
    state.unreadStockCount = 0;
    updateBadgeDisplays();
  } else if (targetPaneId === 'pane-composition') {
    state.isCompositionNew = false;
    updateBadgeDisplays();
  }

  // ペインの表示切り替え
  paneIds.forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    if (id === targetPaneId) {
      el.classList.remove('pane-hidden');
      // 入場アニメーションを再トリガー
      el.classList.remove('pane-entering');
      // reflow強制（再アニメーションのため）
      void el.offsetWidth;
      el.classList.add('pane-entering');
    } else {
      el.classList.add('pane-hidden');
      el.classList.remove('pane-entering');
    }
  });

  // ナビボタンのアクティブ状態更新
  Object.keys(navBtnMap).forEach(function (paneId) {
    var btn = document.getElementById(navBtnMap[paneId]);
    if (!btn) return;
    var isActive = (paneId === targetPaneId);
    btn.classList.toggle('active', isActive);
    if (isActive) {
      btn.setAttribute('aria-current', 'page');
    } else {
      btn.removeAttribute('aria-current');
    }
  });
}

/* ===== 初期化 ===== */
document.addEventListener('DOMContentLoaded', function () {
  /* 初期状態の反映（HTML側のchecked属性を正とする） */
  state.simpleMode = !document.getElementById('checkIncludeGrid').checked;
  state.noSymbolsMode = !document.getElementById('checkIncludeSymbol').checked;

  initPalettes();
  initEvents();
  generateAllTiles();

  /* モバイル初期タブを確定 */
  switchTab(state.activeTab);

  /* ウィンドウリサイズ時：デスクトップ幅になったら全ペインを表示状態に戻す */
  window.addEventListener('resize', function () {
    switchTab(state.activeTab);
  });
});
