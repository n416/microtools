class Game {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.webglCanvas = document.getElementById('webgl-canvas');

    this.gameState = 'title';
    this.currentStageNumber = 1;
    this.scrollSpeed = 2;

    this.player = new Player(this, 100, this.canvas.height / 2);
    this.stageManager = new StageManager(this);
    this.saveManager = new SaveManager(this);

    this.modelLoader = new ModelLoader(this.webglCanvas);
    this.playerModel = null;
    this.modelCenterOffset = new THREE.Vector3();
    this.playerHitboxDefinitions = [];

    this.WORLD_VIEW_HEIGHT = 6.0;
    this.WORLD_VIEW_WIDTH = this.WORLD_VIEW_HEIGHT * (this.canvas.width / this.canvas.height);

    this.enemies = [];
    this.playerBullets = [];
    this.enemyBullets = [];
    this.powerUps = [];
    this.explosions = [];
    this.implosions = [];
    this.jetParticles = [];

    this.score = 0;

    this.transitionTimer = 0;
    this.nextState = null;
    this.isStageClearSequenceInitiated = false;

    this.keys = {};
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyS' && this.gameState === 'playing') {
        this.saveManager.saveGame();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  startTransition(nextState, delay) {
    console.log(`%c[TRANSITION START] To: ${nextState}, Delay: ${delay}ms`, 'color: blue; font-weight: bold;');

    if (nextState === 'stageClear') {
      this.gameState = 'stageClearTransition';
    } else if (nextState === 'gameOver') {
      this.gameState = 'gameOverTransition';
    }

    this.nextState = nextState;
    this.transitionTimer = delay;
  }

  async init() {
    console.log('Initializing game data...');
    await Promise.all([
      this.stageManager.loadData('data/stages.json', 'data/enemies.json'),
      this.modelLoader.loadFighter('data/fighter.json').then((result) => {
        if (result && result.model) {
          this.playerModel = result.model;
          this.playerModel.rotation.y = Math.PI / 2;
          this.playerHitboxDefinitions = result.hitboxes || [];
          const modelBox = new THREE.Box3().setFromObject(this.playerModel);
          const modelSize = new THREE.Vector3();
          modelBox.getSize(modelSize);
          modelBox.getCenter(this.modelCenterOffset);
          const modelNaturalWidth = modelSize.z;
          const modelNaturalHeight = modelSize.y;
          const desiredPixelWidth = 120;
          this.WORLD_VIEW_WIDTH = (modelNaturalWidth * this.canvas.width) / desiredPixelWidth;
          this.WORLD_VIEW_HEIGHT = this.WORLD_VIEW_WIDTH / (this.canvas.width / this.canvas.height);
          this.modelLoader.updateCameraProjection(this.WORLD_VIEW_WIDTH, this.WORLD_VIEW_HEIGHT);
          this.player.width = desiredPixelWidth;
          this.player.height = (modelNaturalHeight / modelNaturalWidth) * desiredPixelWidth;
          const modelFrontIn3D = modelBox.max.z;
          const pixelOffsetX = (modelFrontIn3D / this.WORLD_VIEW_WIDTH) * this.canvas.width;
          this.player.bulletOffsetX = pixelOffsetX + 5;
        }
      }),
    ]);
    console.log('Data loaded. Ready at title screen.');
  }

  startNewGame() {
    this.currentStageNumber = 1;
    this.score = 0;
    this.player = new Player(this, 100, this.canvas.height / 2, this.playerHitboxDefinitions);
    this.resetEntities();
    this.stageManager.startStage(this.currentStageNumber);
    this.gameState = 'playing';
    this.isStageClearSequenceInitiated = false;
  }

  continueGame() {
    if (this.saveManager.loadGame()) {
      this.resetEntities();
      this.gameState = 'playing';
    } else {
      alert('Save data could not be loaded.');
    }
  }

  startNextStage() {
    this.currentStageNumber++;
    const nextStageData = this.stageManager.stageData.find((s) => s.stage === this.currentStageNumber);

    if (nextStageData) {
      console.log(`Proceeding to stage ${this.currentStageNumber}`);
      this.resetEntities();
      this.player.x = 100;
      this.player.y = this.canvas.height / 2;
      this.player.isAlive = true;
      this.stageManager.startStage(this.currentStageNumber);
      this.gameState = 'playing';
      this.isStageClearSequenceInitiated = false;
    } else {
      console.log('All stages cleared! Game Clear!');
      this.gameState = 'gameClear';
    }
  }

  resetEntities() {
    this.enemies = [];
    this.playerBullets = [];
    this.enemyBullets = [];
    this.powerUps = [];
    this.explosions = [];
    this.implosions = [];
    this.jetParticles = [];
  }

  update(deltaTime) {
    this.explosions.forEach((ex) => ex.update(deltaTime));
    this.implosions.forEach((imp) => imp.update(deltaTime));
    this.jetParticles.forEach((p) => p.update(deltaTime));

    if (this.transitionTimer > 0) {
      this.transitionTimer -= deltaTime;
      if (this.transitionTimer <= 0) {
        this.gameState = this.nextState;
        this.nextState = null;
      }
    }

    switch (this.gameState) {
      case 'playing':
        if (this.player.isAlive) {
          this.player.update(this.keys);
          this.updatePlayerModelPosition();
        }
        this.stageManager.update(deltaTime);
        this.enemies.forEach((enemy) => enemy.update(deltaTime));
        this.playerBullets.forEach((b) => b.update(deltaTime));
        this.enemyBullets.forEach((b) => b.update(deltaTime));
        this.powerUps.forEach((p) => p.update(deltaTime));
        this.checkCollisions();

        const boss = this.enemies.find((e) => e instanceof Boss);
        if (boss && !boss.isAlive && !this.isStageClearSequenceInitiated) {
          console.log('%c[BOSS DEFEATED] Initiating stage clear sequence.', 'color: orange; font-weight: bold;');
          this.isStageClearSequenceInitiated = true;
          this.startTransition('stageClear', 2000);
        }
        break;

      case 'stageClearTransition':
        if (this.player.isAlive) {
          this.player.update(this.keys);
          this.updatePlayerModelPosition();
        }
        this.playerBullets.forEach((b) => b.update(deltaTime));
        this.enemyBullets.forEach((b) => b.update(deltaTime));
        this.powerUps.forEach((p) => p.update(deltaTime));
        break;

      case 'gameOverTransition':
        this.enemies.forEach((enemy) => enemy.update(deltaTime));
        this.playerBullets.forEach((b) => b.update(deltaTime));
        this.enemyBullets.forEach((b) => b.update(deltaTime));
        this.powerUps.forEach((p) => p.update(deltaTime));
        break;

      case 'title':
        if (this.keys['Enter']) this.startNewGame();
        if (this.keys['KeyL'] && this.saveManager.hasSaveData()) this.continueGame();
        break;

      case 'stageClear':
        if (this.keys['Enter']) {
          this.startNextStage();
          delete this.keys['Enter'];
        }
        break;

      case 'gameOver':
      case 'gameClear':
        if (this.keys['Enter']) this.gameState = 'title';
        break;
    }

    if (this.gameState === 'playing') {
      this.enemies = this.enemies.filter((e) => e.isAlive);
    }
    this.playerBullets = this.playerBullets.filter((b) => b.isActive);
    this.enemyBullets = this.enemyBullets.filter((b) => b.isActive);
    this.powerUps = this.powerUps.filter((p) => p.isActive);
    this.explosions = this.explosions.filter((ex) => ex.isActive);
    this.implosions = this.implosions.filter((imp) => imp.isActive);
    this.jetParticles = this.jetParticles.filter((p) => p.isActive);
  }

  updatePlayerModelPosition() {
    if (this.playerModel && this.player.isAlive) {
      const playerCenterX = this.player.x + this.player.width / 2;
      const playerCenterY = this.player.y + this.player.height / 2;
      const worldX = (playerCenterX / this.canvas.width) * this.WORLD_VIEW_WIDTH - this.WORLD_VIEW_WIDTH / 2;
      const worldY = -(playerCenterY / this.canvas.height) * this.WORLD_VIEW_HEIGHT + this.WORLD_VIEW_HEIGHT / 2 + 1.5;
      this.playerModel.position.set(worldX - this.modelCenterOffset.x, worldY - this.modelCenterOffset.y, 0 - this.modelCenterOffset.z);
      this.playerModel.rotation.z = THREE.MathUtils.degToRad(this.player.currentTilt);
    }
  }

  checkCollisions() {
    if (!this.player.isAlive) return;

    this.playerBullets.forEach((bullet) => {
      this.enemies.forEach((enemy) => {
        if (isColliding(bullet, enemy)) {
          enemy.takeDamage(1);
          if (!(bullet instanceof LaserBullet)) {
            bullet.isActive = false;
          }
        }
      });
    });

    const barrier = this.player.barrier;
    const playerScreenHitboxes = this.player.hitboxDefinitions.map((hb) => {
      const playerCenterX = this.player.x + this.player.width / 2;
      const playerCenterY = this.player.y + this.player.height / 2;
      const pixelsPerUnitX = this.canvas.width / this.WORLD_VIEW_WIDTH;
      const pixelsPerUnitY = this.canvas.height / this.WORLD_VIEW_HEIGHT;
      const hbWidth = hb.width * pixelsPerUnitX;
      const hbHeight = hb.height * pixelsPerUnitY;
      const drawX = playerCenterX + (hb.offsetX - this.modelCenterOffset.x) * pixelsPerUnitX - hbWidth / 2;
      const drawY = playerCenterY - (hb.offsetY - this.modelCenterOffset.y) * pixelsPerUnitY - hbHeight / 2;
      return {x: drawX, y: drawY, width: hbWidth, height: hbHeight};
    });

    this.enemyBullets.forEach((bullet) => {
      if (barrier && barrier.isActive && isColliding(bullet, barrier)) {
        barrier.takeDamage(1);
        bullet.isActive = false;
      } else {
        for (const hitbox of playerScreenHitboxes) {
          if (isColliding(bullet, hitbox)) {
            this.player.takeDamage(1);
            bullet.isActive = false;
            break;
          }
        }
      }
    });

    this.enemies.forEach((enemy) => {
      if (barrier && barrier.isActive && isColliding(enemy, barrier)) {
        barrier.takeDamage(1);
        enemy.takeDamage(100);
      } else {
        for (const hitbox of playerScreenHitboxes) {
          if (isColliding(enemy, hitbox)) {
            this.player.takeDamage(1);
            enemy.takeDamage(100);
            break;
          }
        }
      }
    });

    this.powerUps.forEach((powerUp) => {
      if (isColliding(this.player, powerUp)) {
        this.player.addPowerUp();
        powerUp.isActive = false;
      }
    });
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.modelLoader.renderer.render(this.modelLoader.scene, this.modelLoader.camera);

    if (this.gameState === 'playing' || this.gameState.includes('Transition')) {
      this.ctx.globalCompositeOperation = 'lighter';
      this.jetParticles.forEach((p) => p.draw());
      this.ctx.globalCompositeOperation = 'source-over';

      if (this.player.isAlive) {
        this.ctx.strokeStyle = 'rgba(255, 0, 255, 0.7)';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(this.player.x, this.player.y, this.player.width, this.player.height);

        this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
        this.ctx.lineWidth = 1;
        const playerCenterX = this.player.x + this.player.width / 2;
        const playerCenterY = this.player.y + this.player.height / 2;
        const pixelsPerUnitX = this.canvas.width / this.WORLD_VIEW_WIDTH;
        const pixelsPerUnitY = this.canvas.height / this.WORLD_VIEW_HEIGHT;
        this.player.hitboxDefinitions.forEach((hb) => {
          const hbWidth = hb.width * pixelsPerUnitX;
          const hbHeight = hb.height * pixelsPerUnitY;
          const drawX = playerCenterX + (hb.offsetX - this.modelCenterOffset.x) * pixelsPerUnitX - hbWidth / 2;
          const drawY = playerCenterY - (hb.offsetY - this.modelCenterOffset.y) * pixelsPerUnitY - hbHeight / 2;
          this.ctx.strokeRect(drawX, drawY, hbWidth, hbHeight);
        });
      }
      this.player.options.forEach((option) => option.draw());
      if (this.player.barrier) this.player.barrier.draw();
      this.enemies.forEach((enemy) => enemy.draw());
      this.playerBullets.forEach((b) => b.draw());
      this.enemyBullets.forEach((b) => b.draw());
      this.powerUps.forEach((p) => p.draw());
      this.explosions.forEach((ex) => ex.draw());
      this.implosions.forEach((imp) => imp.draw());
      this.drawUI();
    } else if (this.gameState === 'title') this.drawTitleScreen();
    else if (this.gameState === 'stageClear') this.drawStageClearScreen();
    else if (this.gameState === 'gameOver') this.drawGameOverScreen();
    else if (this.gameState === 'gameClear') this.drawGameClearScreen();
  }

  drawTitleScreen() {
    this.ctx.fillStyle = 'white';
    this.ctx.textAlign = 'center';
    this.ctx.font = '50px Arial';
    this.ctx.fillText('ADVANCED SHOOTER', this.canvas.width / 2, this.canvas.height / 2 - 80);
    this.ctx.font = '24px Arial';
    this.ctx.fillText('Press [Enter] to Start New Game', this.canvas.width / 2, this.canvas.height / 2 + 20);
    if (this.saveManager.hasSaveData()) {
      this.ctx.fillStyle = 'cyan';
      this.ctx.fillText('Press [L] to Continue', this.canvas.width / 2, this.canvas.height / 2 + 70);
    }
  }

  drawStageClearScreen() {
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = 'cyan';
    this.ctx.font = '50px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('STAGE CLEAR', this.canvas.width / 2, this.canvas.height / 2);
    this.ctx.font = '24px Arial';
    this.ctx.fillText('Press [Enter] to Continue', this.canvas.width / 2, this.canvas.height / 2 + 50);
  }

  drawGameOverScreen() {
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = 'red';
    this.ctx.font = '50px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2);
    this.ctx.font = '24px Arial';
    this.ctx.fillText('Press [Enter] to Return to Title', this.canvas.width / 2, this.canvas.height / 2 + 50);
  }

  drawGameClearScreen() {
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = 'gold';
    this.ctx.font = '50px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('GAME CLEAR', this.canvas.width / 2, this.canvas.height / 2 - 40);
    this.ctx.font = '30px Arial';
    this.ctx.fillText(`Final Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2 + 20);
    this.ctx.font = '24px Arial';
    this.ctx.fillText('Press [Enter] to Return to Title', this.canvas.width / 2, this.canvas.height / 2 + 70);
  }

  drawUI() {
    this.ctx.fillStyle = 'white';
    this.ctx.textAlign = 'left';
    this.ctx.font = '20px Arial';
    this.ctx.fillText(`Score: ${this.score}`, 10, 30);
    this.ctx.fillText(`HP: ${this.player.hp}`, 10, 60);
    this.ctx.fillText(`Stage: ${this.currentStageNumber}`, this.canvas.width - 100, 30);
    this.player.drawPowerUpGauge();
  }

  addEnemy(type, x, y) {
    const enemyData = this.stageManager.getEnemyData(type);
    if (enemyData) this.enemies.push(new Enemy(this, x, y, enemyData));
  }

  addBoss(type) {
    const bossData = this.stageManager.getEnemyData(type);
    if (bossData) this.enemies.push(new Boss(this, this.canvas.width, this.canvas.height / 2 - bossData.height / 2, bossData));
  }

  addExplosion(x, y, size) {
    this.explosions.push(new Explosion(this, x, y, size));
  }
  addImplosion(x, y, size) {
    this.implosions.push(new Implosion(this, x, y, size));
  }
}
