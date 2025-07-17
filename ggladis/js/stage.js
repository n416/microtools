class StageManager {
    constructor(game) {
        this.game = game;
        this.stageData = null;
        this.enemyData = null;
        this.currentStage = null;
        this.elapsedTime = 0;
        this.spawnIndex = 0;
        this.bossSpawned = false;
    }

    async loadData(stagesUrl, enemiesUrl) {
        try {
            const [stagesResponse, enemiesResponse] = await Promise.all([
                fetch(stagesUrl),
                fetch(enemiesUrl)
            ]);
            this.stageData = await stagesResponse.json();
            this.enemyData = await enemiesResponse.json();
        } catch (error) {
            console.error("Failed to load game data:", error);
        }
    }

    getEnemyData(type) {
        return this.enemyData[type];
    }

    startStage(stageNumber) {
        const stage = this.stageData.find(s => s.stage === stageNumber);
        if (stage) {
            this.currentStage = stage;
            this.elapsedTime = 0;
            this.spawnIndex = 0;
            this.bossSpawned = false;
            console.log(`Starting Stage ${stageNumber}: ${stage.name}`);
        } else {
            console.error(`Stage ${stageNumber} not found.`);
        }
    }

    update(deltaTime) {
        if (!this.currentStage) return;
        this.elapsedTime += deltaTime / 1000;
        const spawns = this.currentStage.spawns;

        while (this.spawnIndex < spawns.length && this.elapsedTime >= spawns[this.spawnIndex].time) {
            const spawnInfo = spawns[this.spawnIndex];
            this.game.addEnemy(spawnInfo.type, spawnInfo.x, spawnInfo.y);
            this.spawnIndex++;
        }
        
        const bossInfo = this.currentStage.boss;
        if (bossInfo && !this.bossSpawned && this.elapsedTime >= bossInfo.time) {
            this.game.addBoss(bossInfo.type);
            this.bossSpawned = true;
            console.log("Boss incoming!");
        }
    }
}