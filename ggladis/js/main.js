// DOMが読み込まれたらゲームを開始
window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // ゲームのメインインスタンスを生成
    const game = new Game(canvas, ctx);

    // ゲームを初期化（非同期処理を含む）
    game.init().then(() => {
        let lastTime = 0;

        // ゲームループを開始
        function gameLoop(timestamp) {
            const deltaTime = timestamp - lastTime;
            lastTime = timestamp;

            game.update(deltaTime);
            game.draw();

            requestAnimationFrame(gameLoop);
        }

        // 最初のフレームを要求
        requestAnimationFrame(gameLoop);
    });
});