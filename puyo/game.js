// ==============================
// 1. 定数定義 (Constants)
// ==============================
const COLS = 6;
const ROWS = 12;
const BLOCK_SIZE = 30; // 1ぷよのピクセルサイズ
const PUYO_COLORS = {
    1: 'red',
    2: 'green',
    3: 'blue',
    4: 'yellow',
    5: 'purple'
};

// ==============================
// 2. ゲーム状態変数 (Game State)
// ==============================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = COLS * BLOCK_SIZE;
canvas.height = ROWS * BLOCK_SIZE;

let board = []; // フィールドの状態を保持する2次元配列
let currentPuyo = null; // 現在操作中のぷよ
let gameOver = false;
let score = 0; // スコア（今回は単純な消去数）

// ==============================
// 3. 初期化処理 (Initialization)
// ==============================
function init() {
    // フィールドを空の状態で初期化 (0は空セル)
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    spawnPuyo();
    gameLoop();
}

// ==============================
// 4. ぷよの生成 (Puyo Spawning)
// ==============================
function spawnPuyo() {
    // 2色のぷよをランダムに生成
    const puyo1 = Math.floor(Math.random() * Object.keys(PUYO_COLORS).length) + 1;
    const puyo2 = Math.floor(Math.random() * Object.keys(PUYO_COLORS).length) + 1;

    currentPuyo = {
        x: 2, // 初期位置 (中央)
        y: 0,
        axis: { x: 0, y: 0, color: puyo1 }, // 軸ぷよ
        child: { x: 0, y: -1, color: puyo2 } // 子ぷよ
    };

    // 窒息（ゲームオーバー）判定
    if (!isValidMove(currentPuyo.x, currentPuyo.y, currentPuyo)) {
        gameOver = true;
    }
}

// ==============================
// 5. 描画関数 (Drawing Functions)
// ==============================
function draw() {
    // 画面クリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 固定されたぷよを描画
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (board[y][x] > 0) {
                drawBlock(x, y, PUYO_COLORS[board[y][x]]);
            }
        }
    }

    // 操作中のぷよを描画
    if (currentPuyo && !gameOver) {
        const { x, y, axis, child } = currentPuyo;
        drawBlock(x + axis.x, y + axis.y, PUYO_COLORS[axis.color]);
        drawBlock(x + child.x, y + child.y, PUYO_COLORS[child.color]);
    }
    
    if (gameOver) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillRect(0, canvas.height / 2 - 30, canvas.width, 60);
        ctx.fillStyle = 'black';
        ctx.font = '30px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 + 10);
    }
}

function drawBlock(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    ctx.strokeStyle = '#333';
    ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
}

// ==============================
// 6. 衝突判定 (Collision Detection)
// ==============================
function isValidMove(x, y, puyo) {
    const { axis, child } = puyo;
    const cells = [
        { x: x + axis.x, y: y + axis.y },
        { x: x + child.x, y: y + child.y }
    ];

    for (const cell of cells) {
        // 壁との衝突判定
        if (cell.x < 0 || cell.x >= COLS || cell.y >= ROWS) {
            return false;
        }
        // 他のぷよとの衝突判定
        if (cell.y >= 0 && board[cell.y][cell.x] > 0) {
            return false;
        }
    }
    return true;
}

// ==============================
// 7. ぷよ操作 (Puyo Control)
// ==============================
function movePuyo(dx, dy) {
    if (gameOver) return;
    const { x, y } = currentPuyo;
    if (isValidMove(x + dx, y + dy, currentPuyo)) {
        currentPuyo.x += dx;
        currentPuyo.y += dy;
    } else if (dy > 0) { // 下に移動しようとして失敗した場合
        placePuyo();
    }
}

function rotatePuyo() {
    if (gameOver) return;
    const { child } = currentPuyo;
    // 子ぷよを90度右回転させる (x,y) -> (-y,x)
    const newChild = { x: -child.y, y: child.x, color: child.color };
    const tempPuyo = { ...currentPuyo, child: newChild };
    
    if (isValidMove(currentPuyo.x, currentPuyo.y, tempPuyo)) {
        currentPuyo.child = newChild;
    }
}

function hardDrop() {
    if (gameOver) return;
    while(isValidMove(currentPuyo.x, currentPuyo.y + 1, currentPuyo)) {
        currentPuyo.y++;
    }
    placePuyo();
}

// ==============================
// 8. 連鎖ロジック (Chain Logic)
// ==============================
function placePuyo() {
    // ぷよをボードに固定
    const { x, y, axis, child } = currentPuyo;
    board[y + axis.y][x + axis.x] = axis.color;
    // 子ぷよが画面外（y<0）にある場合は設置しない
    if (y + child.y >= 0) {
        board[y + child.y][x + child.x] = child.color;
    }

    currentPuyo = null; // 操作ぷよをクリア
    // ★★★ 修正点 ★★★
    // 設置直後に一度落下させてから、連鎖処理を開始する
    applyGravity(); 
    handleChains();
}

async function handleChains() {
    let chainCount = 0;
    while(true) {
        const groups = findConnectionGroups();
        if (groups.length === 0) break; // 消せるぷよがなければループ終了

        chainCount++;
        score += groups.flat().length * chainCount * 10; // 簡単なスコア計算
        
        clearPuyos(groups);
        await sleep(300); // 消える演出のための待機
        draw();
        
        applyGravity();
        await sleep(300); // 落ちる演出のための待機
        draw();
    }
    // 次のぷよを生成
    if(!gameOver) spawnPuyo();
}

function findConnectionGroups() {
    const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    const allGroups = [];

    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (board[y][x] > 0 && !visited[y][x]) {
                const color = board[y][x];
                const group = [];
                const queue = [{x, y}];
                visited[y][x] = true;

                while (queue.length > 0) {
                    const current = queue.shift();
                    group.push(current);
                    
                    // 上下左右の隣接セルをチェック
                    const neighbors = [
                        {x: current.x, y: current.y - 1}, {x: current.x, y: current.y + 1},
                        {x: current.x - 1, y: current.y}, {x: current.x + 1, y: current.y}
                    ];
                    
                    for (const n of neighbors) {
                        if (n.x >= 0 && n.x < COLS && n.y >= 0 && n.y < ROWS &&
                            board[n.y][n.x] === color && !visited[n.y][n.x]) {
                            visited[n.y][n.x] = true;
                            queue.push(n);
                        }
                    }
                }
                
                if (group.length >= 4) {
                    allGroups.push(group);
                }
            }
        }
    }
    return allGroups;
}

function clearPuyos(groups) {
    for (const group of groups) {
        for (const puyo of group) {
            board[puyo.y][puyo.x] = 0; // ぷよを消去(0にする)
        }
    }
}

function applyGravity() {
    let moved = false; // このターンでぷよが1マスでも動いたか
    do {
        moved = false;
        // 下の行からチェックしていく
        for (let y = ROWS - 2; y >= 0; y--) {
            for (let x = 0; x < COLS; x++) {
                // 現在のセルにぷよがあり、その真下が空の場合
                if (board[y][x] > 0 && board[y + 1][x] === 0) {
                    // ぷよを1マス下に移動させる
                    board[y + 1][x] = board[y][x];
                    board[y][x] = 0;
                    moved = true; // ぷよが動いたことを記録
                }
            }
        }
        // 1マスでもぷよが動いたら、再度全チェックを行う
    } while (moved);
}
// ==============================
// 9. ゲームループと入力 (Game Loop & Input)
// ==============================
let fallCounter = 0;
const fallSpeed = 30; // 30フレーム(約0.5秒)ごとに1マス落下

function gameLoop() {
    if (gameOver) {
        draw();
        return;
    }
    
    fallCounter++;
    if (fallCounter >= fallSpeed) {
        if (currentPuyo) movePuyo(0, 1);
        fallCounter = 0;
    }
    
    draw();
    requestAnimationFrame(gameLoop); // ブラウザの描画タイミングでループ
}

document.addEventListener('keydown', (e) => {
    if (!currentPuyo || gameOver) return;
    switch (e.key) {
        case 'ArrowLeft':
            movePuyo(-1, 0);
            break;
        case 'ArrowRight':
            movePuyo(1, 0);
            break;
        case 'ArrowDown':
            movePuyo(0, 1);
            fallCounter = 0; // 加速したら落下タイマーリセット
            break;
        case 'ArrowUp':
        case 'z': // 右回転
            rotatePuyo();
            break;
        case ' ': // ハードドロップ
            hardDrop();
            break;
    }
});

// ユーティリティ
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ゲーム開始
init();