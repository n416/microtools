/**
 * ジェットエンジンの炎パーティクルクラス (コメント付き改良版)
 */
class JetParticle {
    constructor(game, x, y, options = {}) {
        this.game = game; // ゲーム本体のインスタンス
        this.x = x;       // パーティクルのX座標
        this.y = y;       // パーティクルのY座標
        this.isActive = true; // パーティクルが有効かどうかのフラグ

        // --- 動きに関する設定 ---
        const angle = options.angle || 0; // 噴出する角度（ラジアン）
        // Math.random()で速度に幅を持たせ、単調にならないようにする
        const speed = 10;//Math.random() * (options.speed || 10) + 5; 
        this.vx = Math.cos(angle) * speed; // X方向の速度
        this.vy = Math.sin(angle) * speed; // Y方向の速度
        this.friction = options.friction || 0.98; // 摩擦係数。大きいほど遠くまで飛ぶ

        // --- 見た目に関する設定 ---
        this.size = Math.random() * (options.maxSize || 8) + 4; // パーティクルの初期サイズ
        this.initialLife = 5; // パーティクルの寿命（フレーム数）
        this.life = this.initialLife; // 現在の残り寿命
        
        // パーティクルの色の変化を定義
        this.colorStops = options.colorStops || [
            { stop: 1, color: '#aaccff' },    // 発生時（中心核）
            { stop: 0.8, color: '#FFFFFF' },  // すぐ外側
            { stop: 0.3, color: '#FFDDBB' },  // 中間
            { stop: 0, color: 'rgba(255, 100, 0, 0.2)' } // 消える直前
        ];
    }

    update() {
        // 毎フレーム寿命を減らす
        this.life--;
        if (this.life <= 0) {
            this.isActive = false; // 寿命が尽きたら非表示に
        }

        // 座標を更新
        this.x += this.vx;
        this.y += this.vy;
        
        // 摩擦で徐々に減速させる
        this.vx *= this.friction;
        this.vy *= this.friction;

        // 時間経過で少しずつ小さくする
        this.size *= 0.97; 
    }

    draw() {
        const lifeRatio = Math.max(0, this.life / this.initialLife); // 残り寿命の割合 (0.0 ~ 1.0)
        
        this.game.ctx.globalAlpha = lifeRatio * 0.8; // 寿命が近づくほど薄くなるように

        const length = this.size * 2.5; // 炎の長さを決める
        const angle = Math.atan2(this.vy, this.vx); // 現在の進行方向から角度を計算

        this.game.ctx.save(); // 現在の描画設定を保存
        this.game.ctx.translate(this.x, this.y); // パーティクルの位置に原点を移動
        this.game.ctx.rotate(angle); // パーティクルの進行方向に合わせて描画を回転
        
        // 炎のグラデーションを作成
        const gradient = this.game.ctx.createLinearGradient(-length / 2, 0, length / 2, 0);
        gradient.addColorStop(0, 'rgba(255, 50, 0, 0)'); // 後端は透明に
        gradient.addColorStop(0.5, this.getColor(lifeRatio)); // 中間色
        gradient.addColorStop(1, '#FFFFFF'); // 先端は白く

        this.game.ctx.fillStyle = gradient;
        // 回転させた状態で、横長の長方形を描画することで炎の形を作る
        this.game.ctx.fillRect(-length / 2, -this.size / 2, length, this.size);
        
        this.game.ctx.restore(); // 描画設定を元に戻す
        
        this.game.ctx.globalAlpha = 1.0; // 透明度を元に戻す
    }
    
    // 残り寿命の割合に応じて色を取得する関数
    getColor(lifeRatio) {
        for (let i = 0; i < this.colorStops.length - 1; i++) {
            if (lifeRatio >= this.colorStops[i + 1].stop) {
                return this.colorStops[i].color;
            }
        }
        return this.colorStops[this.colorStops.length - 1].color;
    }
}