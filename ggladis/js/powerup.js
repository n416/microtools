class PowerUpCapsule {
    constructor(game, x, y) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 15;
        this.speedY = 1;
        this.angle = Math.random() * Math.PI * 2;
        this.isActive = true;
    }

    update(deltaTime) {
        // ★追加: ゲームのスクロール速度に合わせて左に移動する
        this.x -= this.game.scrollSpeed;

        // 画面外（左側）に出たら消す
        if (this.y > this.game.canvas.height || this.x < -this.width) {
            this.isActive = false;
        }
    }

    draw() {
        this.game.ctx.fillStyle = 'orange';
        this.game.ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}