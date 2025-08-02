/**
 * フラッシュクラス (爆発の中心で一瞬光る)
 */
class Flash {
    constructor(game, x, y, options = {}) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.isActive = true;
        this.maxSize = options.radius || 80;
        this.life = 45; // 短い寿命
        this.initialLife = this.life;
    }

    update() {
        this.life--;
        if (this.life <= 0) this.isActive = false;
    }

    draw() {
        const lifeRatio = this.life / this.initialLife;
        const currentRadius = this.maxSize * (1 - lifeRatio);
        
        const gradient = this.game.ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, currentRadius);
        gradient.addColorStop(0, `rgba(255, 255, 220, ${lifeRatio * 1})`);
        gradient.addColorStop(0.5, `rgba(255, 220, 180, ${lifeRatio * 1})`);
        gradient.addColorStop(1, `rgba(255, 180, 0, 0)`);
        
        this.game.ctx.fillStyle = gradient;
        this.game.ctx.fillRect(this.x - currentRadius, this.y - currentRadius, currentRadius * 2, currentRadius * 2);
    }
}


/**
 * 破片パーティクルクラス (外側に飛び散る用)
 */
class DebrisParticle {
    constructor(game, x, y, options = {}) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.isActive = true;

        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * (options.speed || 7) + 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.friction = options.friction || 0.97;

        this.size = Math.random() * (options.maxSize || 5) + 2;
        this.initialLife = Math.random() * 60 + 50;
        this.life = this.initialLife;
        this.colorStops = options.colorStops || [
            { stop: 1, color: '#FFFFFF' },
            { stop: 0.8, color: '#FFFF00' },
            { stop: 0.5, color: '#FF8800' },
            { stop: 0.2, color: '#FF0000' },
            { stop: 0, color: '#444444' }
        ];
        this.trail = [];
        this.trailLength = 5;
    }

    update() {
        this.life--;
        if (this.life <= 0) this.isActive = false;

        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > this.trailLength) {
            this.trail.shift();
        }

        this.vx *= this.friction;
        this.vy *= this.friction;
        this.x += this.vx;
        this.y += this.vy;
    }

    draw() {
        const lifeRatio = Math.max(0, this.life / this.initialLife);
        
        this.game.ctx.lineWidth = this.size * 0.5;
        for (let i = 0; i < this.trail.length - 1; i++) {
            const segmentAlpha = (i / this.trailLength) * lifeRatio * 0.5;
            this.game.ctx.strokeStyle = `rgba(255, 150, 0, ${segmentAlpha})`;
            this.game.ctx.beginPath();
            this.game.ctx.moveTo(this.trail[i].x, this.trail[i].y);
            this.game.ctx.lineTo(this.trail[i+1].x, this.trail[i+1].y);
            this.game.ctx.stroke();
        }

        this.game.ctx.globalAlpha = lifeRatio;

        let currentColor = this.colorStops[this.colorStops.length - 1].color;
        for (let i = 0; i < this.colorStops.length - 1; i++) {
            if (lifeRatio > this.colorStops[i + 1].stop) {
                currentColor = this.colorStops[i].color;
                break;
            }
        }
        
        this.game.ctx.fillStyle = currentColor;
        this.game.ctx.beginPath();
        this.game.ctx.arc(this.x, this.y, this.size * lifeRatio, 0, Math.PI * 2);
        this.game.ctx.fill();
        
        this.game.ctx.globalAlpha = 1.0;
    }
}

/**
 * エネルギーパーティクルクラス (中心に収縮する用)
 */
class EnergyParticle {
    constructor(game, centerX, centerY, options = {}) {
        this.game = game;
        this.centerX = centerX;
        this.centerY = centerY;
        this.isActive = true;

        this.radius = (Math.random() * 0.8 + 0.2) * (options.radius || 80);
        this.angle = Math.random() * Math.PI * 2;
        this.speed = (options.speed || 1.5) + Math.random() * 2;

        this.size = Math.random() * 4 + 2;
        this.initialLife = 60;
        this.life = this.initialLife;
        this.color = options.color || '#00ffff';
    }

    update() {
        this.life--;
        if (this.life <= 0 || this.radius <= 0) this.isActive = false;
        
        this.radius -= this.speed;
        this.x = this.centerX + Math.cos(this.angle) * this.radius;
        this.y = this.centerY + Math.sin(this.angle) * this.radius;
    }

    draw() {
        const lifeRatio = Math.max(0, this.life / this.initialLife);
        this.game.ctx.globalAlpha = lifeRatio;
        this.game.ctx.fillStyle = this.color;
        this.game.ctx.beginPath();
        this.game.ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        this.game.ctx.fill();
        this.game.ctx.globalAlpha = 1.0;
    }
}

/**
 * 爆発エフェクトの管理クラス（飛び散るタイプ）
 */
class Explosion {
    constructor(game, x, y, size = 'normal') {
        this.game = game;
        this.debris = []; // ★ 破片用の配列
        this.flash = null;  // ★ 光用のプロパティ
        this.isActive = true;

        let particleCount;
        let options;

        switch (size) {
            case 'small':
                particleCount = 20;
                options = { speed: 6, maxSize: 4 };
                this.flash = new Flash(this.game, x, y, { radius: 40 });
                break;
            case 'large':
                particleCount = 120;
                options = { speed: 12, maxSize: 10, friction: 0.98 };
                this.flash = new Flash(this.game, x, y, { radius: 150 });
                break;
            case 'player':
                particleCount = 180;
                options = { speed: 15, maxSize: 12, friction: 0.985, colorStops: [{ stop: 1, color: '#FFFFFF' }, { stop: 0.8, color: '#00FFFF' }, { stop: 0.5, color: '#00AAFF' }, { stop: 0, color: '#666666' }] };
                this.flash = new Flash(this.game, x, y, { radius: 200 });
                break;
            default:
                particleCount = 50;
                options = { speed: 9, maxSize: 8, friction: 0.97 };
                this.flash = new Flash(this.game, x, y, { radius: 100 });
                break;
        }

        for (let i = 0; i < particleCount; i++) {
            this.debris.push(new DebrisParticle(this.game, x, y, options));
        }
    }

    update(deltaTime) {
        if(this.flash) this.flash.update(deltaTime);
        this.debris.forEach(p => p.update(deltaTime));

        this.debris = this.debris.filter(p => p.isActive);
        if(this.flash && !this.flash.isActive) this.flash = null;

        if (this.debris.length === 0 && !this.flash) this.isActive = false;
    }

    draw() {
        this.game.ctx.globalCompositeOperation = 'lighter';
        // ★ 破片を先に描画
        this.debris.forEach(p => p.draw());
        // ★ 光を後から描画
        if(this.flash) this.flash.draw();
        this.game.ctx.globalCompositeOperation = 'source-over';
    }
}

/**
 * 爆縮エフェクトの管理クラス
 */
class Implosion {
    constructor(game, x, y, size = 'normal') {
        this.game = game;
        this.particles = [];
        this.isActive = true;
        
        let particleCount;
        let options;
        
        switch(size) {
            case 'small':
                particleCount = 30;
                options = { radius: 40, speed: 1, color: '#ffdd00' };
                break;
            default: // normal
                particleCount = 70;
                options = { radius: 80, speed: 1.5, color: '#9a70ff' };
                break;
        }

        for (let i = 0; i < particleCount; i++) {
            this.particles.push(new EnergyParticle(this.game, x, y, options));
        }
    }

    update(deltaTime) {
        this.particles.forEach(p => p.update(deltaTime));
        this.particles = this.particles.filter(p => p.isActive);
        if (this.particles.length === 0) this.isActive = false;
    }

    draw() {
        this.game.ctx.globalCompositeOperation = 'lighter';
        this.particles.forEach(p => p.draw());
        this.game.ctx.globalCompositeOperation = 'source-over';
    }
}