class Enemy {
  constructor(game, x, y, enemyData) {
    this.game = game;
    this.x = x;
    this.y = y;
    this.isAlive = true;

    this.hp = enemyData.hp;
    this.score = enemyData.score;
    this.speed = enemyData.speed;
    this.width = enemyData.width || 40;
    this.height = enemyData.height || 40;
    this.dropsPowerUp = enemyData.dropsPowerUp || false;
    this.movementPattern = enemyData.movementPattern || 'straight';

    this.initialY = y;
    this.angle = 0;
  }

  update(deltaTime) {
    switch (this.movementPattern) {
      case 'sine':
        this.x -= this.speed;
        this.angle += 0.04;
        this.y = this.initialY + Math.sin(this.angle) * 50;
        break;
      case 'straight':
      default:
        this.x -= this.speed;
        break;
    }
    this.x -= this.game.scrollSpeed;
    if (this.x < -this.width) this.isAlive = false;
  }

  draw() {
    this.game.ctx.fillStyle = this.dropsPowerUp ? '#ff5555' : 'red';
    if (this.movementPattern === 'sine') this.game.ctx.fillStyle = '#9a70ff';
    this.game.ctx.fillRect(this.x, this.y, this.width, this.height);
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0 && this.isAlive) {
      this.isAlive = false;
      this.game.score += this.score;
      if (this.dropsPowerUp) {
        this.game.powerUps.push(new PowerUpCapsule(this.game, this.x, this.y));
      }
    }
  }
}
