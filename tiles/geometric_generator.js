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
  composition: null,       // { gridSize, tiles: [{shapeData, rotation, paletteColorIndex, lockedColor}] }
  undoStack: [],
  randomColorMode: false,
  noSymbolsMode: false,
  compositionZoom: 1.0,    // コンポジションペインのズーム倍率

  /* カラーパレット */
  currentPalette: null,     // { name, tags, colors: [5色] }
  palettes: [],             // パレットデータ（外部ファイルから読み込み）

  /* ドラッグ＆ドロップ用状態 */
  dragState: {
    isDragging: false,
    tileIdx: null,          // ドラッグ中のタイルのインデックス
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    hasMoved: false         // 移動したかどうか（クリックとドラッグの判定用）
  }
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
    var key = shapeDataKey(sd, ignoreRotation);
    /* 空白のみのタイルはスキップ */
    var allBlank = sd.layers.every(function (l) { return l.type === 'blank'; });
    if (allBlank) continue;

    /* 重複判定 */
    if (!seen[key]) {
      seen[key] = true;
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
}

/* ===== 第2ペイン：お気に入り管理 ===== */
function addToFavorites() {
  /* 旧API互換用 - 現在はaddToFavoritesFromGeneratorを使用 */
}

function removeFavorite(id) {
  state.favorites = state.favorites.filter(function (f) { return f.id !== id; });
  renderFavorites();
  showToast('削除しました', '🗑');
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

/** コンポジション生成 */
function generateComposition() {
  if (state.favorites.length === 0) {
    showToast('先にお気に入りを追加してください', '⚠');
    return;
  }

  var gridSize = parseInt(document.getElementById('gridSizeSelect').value);
  var blankRate = parseInt(document.getElementById('blankSlider').value) / 100;
  var tiles = [];

  for (var i = 0; i < gridSize * gridSize; i++) {
    var cIndex = state.randomColorMode ? Math.floor(Math.random() * 5) : i % 5;
    if (Math.random() < blankRate) {
      tiles.push({
        id: 'tile_' + Date.now() + '_' + i + '_' + Math.random().toString(36).slice(2, 6),
        shapeData: { layers: [{ type: 'blank', rotation: 0 }] },
        rotation: 0,
        favId: null,
        paletteColorIndex: cIndex,
        lockedColor: null
      });
    } else {
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
        paletteColorIndex: cIndex,
        lockedColor: fav.lockedColor
      });
    }
  }

  /* Undoスタック保存 */
  pushUndo();

  state.composition = { gridSize: gridSize, tiles: tiles };
  renderComposition();
  showToast('コンポジション生成完了', '✨');
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

  var gs = state.composition.gridSize;
  var totalSize = gs * TILE_SIZE;

  var svg = document.getElementById('compositionSVG');
  // SVGが存在しない、またはグリッドサイズが変わった場合は作り直す
  if (!svg || svg.getAttribute('viewBox') !== '0 0 ' + totalSize + ' ' + totalSize) {
    canvasEl.innerHTML = '';
    svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + totalSize + ' ' + totalSize);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('xmlns', SVG_NS);
    svg.id = 'compositionSVG';

    /* 白背景 */
    var bg = document.createElementNS(SVG_NS, 'rect');
    bg.setAttribute('width', totalSize);
    bg.setAttribute('height', totalSize);
    bg.setAttribute('fill', 'white');
    svg.appendChild(bg);

    /* グリッド作成（タイルの背面にするためここで追加） */
    for (var i = 1; i < gs; i++) {
      var lineH = document.createElementNS(SVG_NS, 'line');
      lineH.className = 'grid-line';
      lineH.setAttribute('x1', 0);
      lineH.setAttribute('y1', i * TILE_SIZE);
      lineH.setAttribute('x2', totalSize);
      lineH.setAttribute('y2', i * TILE_SIZE);
      lineH.setAttribute('stroke', 'rgba(0,0,0,0.03)');
      lineH.setAttribute('stroke-width', '0.3');
      svg.appendChild(lineH);

      var lineV = document.createElementNS(SVG_NS, 'line');
      lineV.className = 'grid-line';
      lineV.setAttribute('x1', i * TILE_SIZE);
      lineV.setAttribute('y1', 0);
      lineV.setAttribute('x2', i * TILE_SIZE);
      lineV.setAttribute('y2', totalSize);
      lineV.setAttribute('stroke', 'rgba(0,0,0,0.03)');
      lineV.setAttribute('stroke-width', '0.3');
      svg.appendChild(lineV);
    }

    canvasEl.appendChild(svg);
  }

  var palette = state.currentPalette ? state.currentPalette.colors : ['#212529', '#495057', '#6c757d', '#adb5bd', '#dee2e6'];

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

    var col = idx % gs;
    var row = Math.floor(idx / gs);
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

    /* タイル個別の白背景（隙間対策） */
    var tileBg = document.createElementNS(SVG_NS, 'rect');
    tileBg.setAttribute('width', TILE_SIZE);
    tileBg.setAttribute('height', TILE_SIZE);
    tileBg.setAttribute('fill', 'white');
    tileG.appendChild(tileBg);

    var tileColors;
    if (tile.lockedColor) {
      tileColors = [tile.lockedColor];
    } else {
      tileColors = [palette[tile.paletteColorIndex % palette.length]];
      /* 複合図形の場合、複数色を割り当て */
      if (tile.shapeData.layers.length > 1) {
        tileColors = tile.shapeData.layers.map(function (_, i) {
          return palette[(tile.paletteColorIndex + i) % palette.length];
        });
      }
    }

    /* 追加の回転を適用 */
    var innerG = document.createElementNS(SVG_NS, 'g');
    if (tile.rotation !== 0) {
      innerG.setAttribute('transform',
        'translate(' + (TILE_SIZE / 2) + ',' + (TILE_SIZE / 2) + ') ' +
        'rotate(' + tile.rotation + ') ' +
        'translate(' + (-TILE_SIZE / 2) + ',' + (-TILE_SIZE / 2) + ')'
      );
    }
    innerG.appendChild(renderShapeToSVG(tile.shapeData, TILE_SIZE, tileColors));
    tileG.appendChild(innerG);
  });

  /* ズーム倍率を適用 */
  updateCompositionZoom();
}

/** コンポジションのズーム状態を更新 */
function updateCompositionZoom() {
  if (!state.composition) return;
  var canvasEl = document.getElementById('compositionCanvas');
  var svg = document.getElementById('compositionSVG');
  if (!canvasEl || !svg) return;

  var gs = state.composition.gridSize;
  var totalSize = gs * TILE_SIZE;
  var scaledSize = totalSize * state.compositionZoom;

  canvasEl.style.width = scaledSize + 'px';
  canvasEl.style.height = scaledSize + 'px';
  // CSSのmax-width/max-heightを無効化して拡大できるようにする
  canvasEl.style.maxWidth = 'none';
  canvasEl.style.maxHeight = 'none';

  svg.setAttribute('width', scaledSize);
  svg.setAttribute('height', scaledSize);
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

  state.dragState.isDragging = true;
  state.dragState.tileIdx = idx;
  state.dragState.startX = e.clientX;
  state.dragState.startY = e.clientY;
  state.dragState.currentX = e.clientX;
  state.dragState.currentY = e.clientY;
  state.dragState.hasMoved = false;

  // 意図しないセルのロック（バグ）を防ぐため setPointerCapture は使用しない
  // e.currentTarget.setPointerCapture(e.pointerId);

  // ドラッグ中のタイルのスタイルを変更するため再描画
  renderComposition();
}

/** ポインター移動（動的な入れ替え） */
function handlePointerMove(e) {
  if (!state.dragState.isDragging) return;

  var dx = e.clientX - state.dragState.startX;
  var dy = e.clientY - state.dragState.startY;

  // わずかな移動（閾値5px）を検知してドラッグとみなす
  if (!state.dragState.hasMoved && Math.hypot(dx, dy) > 5) {
    state.dragState.hasMoved = true;
  }

  state.dragState.currentX = e.clientX;
  state.dragState.currentY = e.clientY;

  if (state.dragState.hasMoved) {
    // スクロールやCSSズームの影響を排除して、正確にカーソル直下のセルを計算する
    var canvasEl = document.getElementById('compositionCanvas');
    var rect = canvasEl.getBoundingClientRect();

    // canvas内のローカル座標（ズーム考慮）
    var localX = (e.clientX - rect.left) / state.compositionZoom;
    var localY = (e.clientY - rect.top) / state.compositionZoom;

    var gs = state.composition.gridSize;
    // 枠外へのドラッグは無視
    if (localX >= 0 && localX < gs * TILE_SIZE && localY >= 0 && localY < gs * TILE_SIZE) {
      var col = Math.floor(localX / TILE_SIZE);
      var row = Math.floor(localY / TILE_SIZE);
      var targetIdx = row * gs + col;
      var sourceIdx = state.dragState.tileIdx;

      // 無関係なセルとの入れ替え（特に遠く離れたセルへのジャンプ）を防ぐため、
      // 現在のインデックスから前後左右（または斜め）の隣接セルにのみ入れ替えを許可する
      var sCol = sourceIdx % gs;
      var sRow = Math.floor(sourceIdx / gs);

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

/** ポインターアップ（終了） */
function handlePointerUp(e) {
  if (!state.dragState.isDragging) return;

  if (!state.dragState.hasMoved) {
    // 移動が少ない場合は「クリック」として扱い回転させる
    rotateTile(state.dragState.tileIdx);
  } else {
    // 入れ替え完了としてUndoを保存
    pushUndo();
  }

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
  exportSVG(svg, 'composition_' + Date.now() + '.svg');
  showToast('コンポジションSVGを保存しました', '⬇');
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
  document.getElementById('btnGenComposition').addEventListener('click', generateComposition);
  document.getElementById('btnUndo').addEventListener('click', undo);
  document.getElementById('gridSizeSelect').addEventListener('change', generateComposition);
  document.getElementById('blankSlider').addEventListener('input', function () {
    document.getElementById('blankValue').textContent = this.value + '%';
  });
  document.getElementById('toggleRandomColor').addEventListener('click', function () {
    state.randomColorMode = !state.randomColorMode;
    this.classList.toggle('active', state.randomColorMode);
    this.setAttribute('aria-pressed', state.randomColorMode);
    generateComposition();
  });

  /* コンポジションドラッグ操作 */
  var compCanvas = document.getElementById('compositionCanvas');
  if (compCanvas) {
    // モバイル環境でのスクロール（スワイプ）によるドラッグの中断をキャンバス全体で確実に防ぐ
    compCanvas.style.touchAction = 'none';

    // 枠外へのドロップでも正しくトラッキングできるよう window にバインド
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }

  /* コンポジションキャンバスのズーム（マウスホイール & ピンチ操作） */
  var compArea = document.getElementById('compositionArea');
  if (compArea) {
    // マウスホイール
    compArea.addEventListener('wheel', function (e) {
      if (!state.composition) return;
      e.preventDefault();

      var zoomStep = 0.05;
      var newZoom = state.compositionZoom + (e.deltaY < 0 ? zoomStep : -zoomStep);
      // 0.1倍〜10倍の範囲に制限
      newZoom = Math.min(Math.max(0.1, newZoom), 10.0);

      if (newZoom !== state.compositionZoom) {
        // マウス位置を中心にズームするためのスクロール補正計算
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

    // タッチ操作（ピンチ）
    var initialDist = null;
    var initialZoom = null;
    var initialCenter = null;

    compArea.addEventListener('touchstart', function (e) {
      if (!state.composition || e.touches.length !== 2) return;
      var dx = e.touches[0].clientX - e.touches[1].clientX;
      var dy = e.touches[0].clientY - e.touches[1].clientY;
      initialDist = Math.hypot(dx, dy);
      initialZoom = state.compositionZoom;

      var rect = compArea.getBoundingClientRect();
      initialCenter = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top
      };
    }, { passive: false });

    compArea.addEventListener('touchmove', function (e) {
      if (!state.composition || e.touches.length !== 2 || initialDist === null) return;
      e.preventDefault(); // デフォルトのパンスクロール等を防ぐ

      var dx = e.touches[0].clientX - e.touches[1].clientX;
      var dy = e.touches[0].clientY - e.touches[1].clientY;
      var currentDist = Math.hypot(dx, dy);

      var zoomFactor = currentDist / initialDist;
      var newZoom = initialZoom * zoomFactor;
      newZoom = Math.min(Math.max(0.1, newZoom), 10.0);

      if (newZoom !== state.compositionZoom) {
        var contentTargetX = (compArea.scrollLeft + initialCenter.x) / state.compositionZoom;
        var contentTargetY = (compArea.scrollTop + initialCenter.y) / state.compositionZoom;

        state.compositionZoom = newZoom;
        updateCompositionZoom();

        compArea.scrollLeft = contentTargetX * state.compositionZoom - initialCenter.x;
        compArea.scrollTop = contentTargetY * state.compositionZoom - initialCenter.y;
      }
    }, { passive: false });

    compArea.addEventListener('touchend', function (e) {
      if (e.touches.length < 2) {
        initialDist = null;
        initialZoom = null;
        initialCenter = null;
      }
    });
  }

  /* カラーパレット */
  document.getElementById('btnPalette').addEventListener('click', openPaletteModal);
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

  /* SVGエクスポート */
  document.getElementById('btnExportAll').addEventListener('click', exportComposition);

  /* キーボードショートカット */
  document.addEventListener('keydown', function (e) {
    if (e.key === ' ' && document.activeElement === document.body) {
      e.preventDefault();
      generateAllTiles();
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
}

/* ===== 初期化 ===== */
document.addEventListener('DOMContentLoaded', function () {
  /* 初期状態の反映（HTML側のchecked属性を正とする） */
  state.simpleMode = !document.getElementById('checkIncludeGrid').checked;
  state.noSymbolsMode = !document.getElementById('checkIncludeSymbol').checked;

  initPalettes();
  initEvents();
  generateAllTiles();
});
