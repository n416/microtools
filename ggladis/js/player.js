class Bullet {
  constructor(game, x, y, vx, vy, type = 'normal') {
    this.game = game;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.width = 10;
    this.height = 3;
    this.type = type;
    this.isActive = true;
  }
  update(deltaTime) {
    this.x += this.vx;
    this.y += this.vy;
    if (this.x > this.game.canvas.width) this.isActive = false;
  }
  draw() {
    this.game.ctx.fillStyle = 'white';
    this.game.ctx.fillRect(this.x, this.y, this.width, this.height);
  }
}
class Missile {
  constructor(game, x, y) {
    this.game = game;
    this.x = x;
    this.y = y;
    this.width = 12;
    this.height = 6;
    this.speedX = 4;
    this.speedY = 2;
    this.groundY = this.game.canvas.height - 50;
    this.onGround = false;
    this.isActive = true;
  }
  update(deltaTime) {
    if (!this.onGround) {
      this.y += this.speedY;
      if (this.y >= this.groundY) {
        this.y = this.groundY;
        this.onGround = true;
      }
    }
    this.x += this.speedX;
    if (this.x > this.game.canvas.width) this.isActive = false;
  }
  draw() {
    this.game.ctx.fillStyle = '#99ff99';
    this.game.ctx.fillRect(this.x, this.y, this.width, this.height);
  }
}
class LaserBullet {
  constructor(game, source, isOptionLaser = false) {
    this.game = game;
    this.source = source;
    this.isOptionLaser = isOptionLaser;
    this.width = 400;
    this.height = 3;
    this.x = source.x + source.width;
    this.y = source.y + source.height / 2;
    this.speed = 10;
    this.isActive = true;
  }
  update(deltaTime) {
    this.x += this.speed;
    this.y = this.source.y + this.source.height / 2 - this.height / 2;
    if (this.x > this.game.canvas.width) this.isActive = false;
  }
  draw() {
    this.game.ctx.fillStyle = '#ff8a8a';
    this.game.ctx.fillRect(this.x, this.y, this.width, this.height);
  }
}
class Option {
  constructor(game, player) {
    this.game = game;
    this.player = player;
    this.x = player.x;
    this.y = player.y;
    this.width = 16;
    this.height = 16;
  }
  update(history, index) {
    const delay = (index + 1) * 20;
    if (history.length > delay) {
      const targetPos = history[delay];
      this.x = targetPos.x;
      this.y = targetPos.y;
    }
  }
  shoot(powerUpState) {
    const bulletSpeed = 7;
    if (powerUpState.laser) this.game.playerBullets.push(new LaserBullet(this.game, this, true));
    else if (powerUpState.double) {
      this.game.playerBullets.push(new Bullet(this.game, this.x, this.y + this.height / 2, bulletSpeed, 0, 'option_double'));
      this.game.playerBullets.push(new Bullet(this.game, this.x, this.y, bulletSpeed, -2.5, 'option_double'));
    } else this.game.playerBullets.push(new Bullet(this.game, this.x, this.y + this.height / 2, bulletSpeed, 0, 'option'));
    if (powerUpState.missile) this.game.playerBullets.push(new Missile(this.game, this.x + this.width / 2, this.y + this.height));
  }
  draw() {
    this.game.ctx.fillStyle = '#ffb400';
    this.game.ctx.beginPath();
    this.game.ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
    this.game.ctx.fill();
  }
}
class Barrier {
  constructor(game, player) {
    this.game = game;
    this.player = player;
    this.durability = 5;
    this.radius = 40;
    this.x = player.x + player.width / 2;
    this.y = player.y + player.height / 2;
    this.width = this.radius * 2;
    this.height = this.radius * 2;
    this.isActive = true;
  }
  update() {
    if (!this.isActive) return;
    this.x = this.player.x + this.player.width / 2 - this.radius;
    this.y = this.player.y + this.player.height / 2 - this.radius;
  }
  takeDamage(amount) {
    this.durability -= amount;
    if (this.durability <= 0) {
      this.isActive = false;
      console.log('Barrier destroyed!');
    }
  }
  draw() {
    if (!this.isActive) return;
    const centerX = this.player.x + this.player.width / 2;
    const centerY = this.player.y + this.player.height / 2;
    this.game.ctx.beginPath();
    this.game.ctx.arc(centerX, centerY, this.radius, 0, Math.PI * 2);
    this.game.ctx.fillStyle = `rgba(100, 200, 255, ${0.2 + this.durability * 0.05})`;
    this.game.ctx.fill();
  }
}

class Player {
  constructor(game, x, y, hitboxDefinitions = []) {
    this.game = game;
    this.x = x;
    this.y = y;
    this.width = 150;
    this.height = 100;
    this.baseSpeed = 4;
    this.speed = this.baseSpeed;
    this.hp = 3;
    this.isAlive = true;

    this.powerUpOptions = ['SPEED UP', 'MISSILE', 'DOUBLE', 'LASER', 'OPTION', '?'];
    this.powerUpGaugeIndex = -1;
    this.options = [];
    this.positionHistory = [];
    this.historyLength = 120;
    this.barrier = null;
    this.powerUpState = {speedLevel: 0, missile: false, double: false, laser: false};
    this.shootCooldown = 0;
    this.bulletOffsetX = this.width;
    this.hitboxDefinitions = hitboxDefinitions;
    this.targetTilt = 0;
    this.currentTilt = 0;
    this.jetCooldown = 0;
  }

  update(keys) {
    const lastX = this.x;
    const lastY = this.y;

    this.targetTilt = 0;
    if (keys['ArrowUp']) {
      this.y -= this.speed;
      this.targetTilt = -45;
    }
    if (keys['ArrowDown']) {
      this.y += this.speed;
      this.targetTilt = 45;
    }
    if (keys['ArrowLeft']) this.x -= this.speed;
    if (keys['ArrowRight']) this.x += this.speed;

    if (this.jetCooldown > 0) this.jetCooldown--;
    if (this.isAlive && this.jetCooldown <= 0) {
        this.spawnJetParticles(keys);
    }
    
    this.x = Math.max(0, Math.min(this.game.canvas.width - this.width, this.x));
    this.y = Math.max(0, Math.min(this.game.canvas.height - this.height, this.y));

    const hasMoved = this.x !== lastX || this.y !== lastY;

    if (hasMoved) {
      this.positionHistory.unshift({x: this.x, y: this.y});
      if (this.positionHistory.length > this.historyLength) this.positionHistory.pop();
      this.options.forEach((option, index) => option.update(this.positionHistory, index));
    }

    if (this.barrier) {
      this.barrier.update();
      if (!this.barrier.isActive) this.barrier = null;
    }

    if (this.shootCooldown > 0) this.shootCooldown -= 1;

    if (keys['Space'] && this.shootCooldown === 0) {
      this.shoot();
      this.shootCooldown = this.powerUpState.laser ? 25 : 15;
    }

    if (keys['ShiftLeft'] || keys['ShiftRight']) {
      if (this.powerUpGaugeIndex !== -1) {
        this.activatePowerUp();
        delete keys['ShiftLeft'];
        delete keys['ShiftRight'];
      }
    }

    this.currentTilt += (this.targetTilt - this.currentTilt) * 0.2;
  }

  spawnJetParticles(keys) {
    // パーティクルの発生源を自機後方に設定
    const particleOriginX = this.x + 10;
    const particleOriginY = this.y + this.height / 2;
    // THREE.MathUtils.degToRadで角度を度からラジアンに変換。180度は真後ろ。
    // this.currentTiltは機体の傾き。0.5を掛けることで炎の追従を少しマイルドにしている。
    const baseAngle = THREE.MathUtils.degToRad(180 + this.currentTilt * 0.5); 

    let options = {}; // パーティクルに渡す設定
    let particleCount = 1; // 1回あたりに生成するパーティクルの数

    if (keys['ArrowRight']) { // 前進している時
        particleCount = 3; // たくさん出す
        options = {
            angle: baseAngle + (Math.random() - 0.5) * 0.1, // 噴出角度。少しだけランダムなブレを加える
            speed: 5,     // 噴出スピード
            maxSize: 12,   // パーティクルの最大サイズ
            friction: 0.99, // 摩擦（大きいほど減速しにくい）
        };
        this.jetCooldown = 10; // 次の噴射までの待機時間（フレーム）。0で毎フレーム噴射。
    } else if (keys['ArrowLeft']) { // 後進している時
        particleCount = 0; // 少なく出す
        options = {
            angle: baseAngle, // ブレさせない
            speed: 1,
            maxSize: 5,
            friction: 0.9,
        };
        this.jetCooldown = 5;
    } else { // 停止（アイドリング）している時
        particleCount = 1; // 少なく出す
        options = {
            angle: baseAngle,// + (Math.random() - 0.5) * 0.05, // ブレはごく僅かに
            speed: 2,
            maxSize: 7,
            friction: 0.92,
        };
        this.jetCooldown = 10;
    }
    
    // 設定した数だけパーティクルを生成する
    for (let i = 0; i < particleCount; i++) {
        // 噴射口に幅があるように見せるため、Y座標を少しだけランダムにずらす
        const yOffset = (Math.random() - 0.5) * (this.height * 0.2);
        this.game.jetParticles.push(new JetParticle(this.game, particleOriginX, particleOriginY + yOffset, options));
    }
  }

  shoot() {
    const bulletOffsetX = this.bulletOffsetX;
    if (this.powerUpState.laser) {
      if (this.game.playerBullets.some((b) => b instanceof LaserBullet && !b.isOptionLaser)) return;
      this.game.playerBullets.push(new LaserBullet(this.game, this, false));
    } else if (this.powerUpState.double) {
      if (this.game.playerBullets.some((b) => b.type === 'double')) return;
      this.game.playerBullets.push(new Bullet(this.game, this.x + bulletOffsetX, this.y + this.height / 2, 7, 0, 'double'));
      this.game.playerBullets.push(new Bullet(this.game, this.x + bulletOffsetX, this.y, 7, -2.5, 'double'));
    } else this.game.playerBullets.push(new Bullet(this.game, this.x + bulletOffsetX, this.y + this.height / 2, 7, 0, 'normal'));
    if (this.powerUpState.missile) this.game.playerBullets.push(new Missile(this.game, this.x + this.width / 2, this.y + this.height));
    this.options.forEach((option) => option.shoot(this.powerUpState));
  }

  addPowerUp() {
    this.powerUpGaugeIndex = (this.powerUpGaugeIndex + 1) % this.powerUpOptions.length;
  }

  activatePowerUp() {
    if (this.powerUpGaugeIndex === -1) return;
    const selectedPowerUp = this.powerUpOptions[this.powerUpGaugeIndex];
    console.log('Activating:', selectedPowerUp);
    switch (selectedPowerUp) {
      case 'SPEED UP':
        this.powerUpState.speedLevel = (this.powerUpState.speedLevel || 0) + 1;
        break;
      case 'MISSILE':
        this.powerUpState.missile = true;
        break;
      case 'DOUBLE':
        this.powerUpState.double = true;
        this.powerUpState.laser = false;
        break;
      case 'LASER':
        this.powerUpState.laser = true;
        this.powerUpState.double = false;
        break;
      case 'OPTION':
        if (this.options.length < 4) this.options.push(new Option(this.game, this));
        break;
      case '?':
        this.barrier = this.barrier && this.barrier.isActive ? ((this.barrier.durability = 5), this.barrier) : new Barrier(this.game, this);
        break;
    }
    this.applyPowerUpState();
    this.powerUpGaugeIndex = -1;
  }

  applyPowerUpState() {
    this.speed = this.baseSpeed + (this.powerUpState.speedLevel || 0) * 2;
  }

  drawPowerUpGauge() {
    const FONT_SIZE = 18;
    const PADDING = 10;
    const BOX_WIDTH = 110;
    const startY = this.game.canvas.height - FONT_SIZE - PADDING;
    this.game.ctx.font = `${FONT_SIZE}px Arial`;
    this.powerUpOptions.forEach((option, i) => {
      this.game.ctx.textAlign = 'left';
      this.game.ctx.fillStyle = i === this.powerUpGaugeIndex ? 'yellow' : 'gray';
      this.game.ctx.fillText(option, PADDING + i * BOX_WIDTH, startY);
    });
  }

  takeDamage(amount) {
    if (!this.isAlive) return;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.isAlive = false;
      this.game.addExplosion(this.x + this.width / 2, this.y + this.height / 2, 'player');
      this.game.startTransition('gameOver', 2000);
      console.log('Player destroyed. Transitioning to Game Over...');
    }
  }
}