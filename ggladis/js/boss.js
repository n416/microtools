class EnemyBullet {
  constructor(game, x, y, vx, vy) {
    this.game = game;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.width = 8;
    this.height = 8;
    this.isActive = true;
  }
  update(deltaTime) {
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < 0 || this.x > this.game.canvas.width || this.y < 0 || this.y > this.game.canvas.height) {
      this.isActive = false;
    }
  }
  draw() {
    this.game.ctx.fillStyle = 'magenta';
    this.game.ctx.fillRect(this.x, this.y, this.width, this.height);
  }
}

class Boss extends Enemy {
  constructor(game, x, y, bossData) {
    super(game, x, y, bossData);
    this.attackInterval = bossData.attackInterval;
    this.specialAttackCooldown = bossData.specialAttackCooldown;
    this.attackTimer = this.attackInterval;
    this.specialAttackTimer = this.specialAttackCooldown;
    this.isEntering = true;
    this.targetX = this.game.canvas.width - this.width - 50;
  }

  update(deltaTime) {
    if (this.isEntering) {
      this.x -= this.speed;
      if (this.x <= this.targetX) {
        this.x = this.targetX;
        this.isEntering = false;
      }
      return;
    }
    this.attackTimer -= deltaTime / 1000;
    this.specialAttackTimer -= deltaTime / 1000;
    if (this.attackTimer <= 0) {
      this.fireForward();
      this.attackTimer = this.attackInterval;
    }
    if (this.specialAttackTimer <= 0) {
      this.fireRadial();
      this.specialAttackTimer = this.specialAttackCooldown;
    }
  }

  fireForward() {
    const bulletSpeed = -5;
    const bulletX = this.x;
    const bulletY = this.y + this.height / 2;
    this.game.enemyBullets.push(new EnemyBullet(this.game, bulletX, bulletY, bulletSpeed, 0));
  }

  fireRadial() {
    const bulletCount = 12;
    const bulletSpeed = 3;
    for (let i = 0; i < bulletCount; i++) {
      const angle = ((Math.PI * 2) / bulletCount) * i;
      const vx = Math.cos(angle) * bulletSpeed;
      const vy = Math.sin(angle) * bulletSpeed;
      this.game.enemyBullets.push(new EnemyBullet(this.game, this.x + this.width / 2, this.y + this.height / 2, vx, vy));
    }
  }

  takeDamage(amount) {
    if (this.isEntering) return;
    this.hp -= amount;
    if (this.hp <= 0 && this.isAlive) {
      this.die();
    }
  }

  die() {
    this.isAlive = false; // ★ 自身の状態を「倒された」にするだけ
    this.game.score += this.score;
    console.log('Boss defeated!');
    this.game.addExplosion(this.x + this.width / 2, this.y + this.height / 2, 'large');
    // gameStateの変更はここから削除
  }

  draw() {
    this.game.ctx.fillStyle = 'purple';
    this.game.ctx.fillRect(this.x, this.y, this.width, this.height);
  }
}
