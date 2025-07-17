class SaveManager {
    constructor(game) {
        this.game = game;
        this.saveKey = 'gradiusGameSaveData';
    }

    saveGame() {
        const saveData = {
            stage: this.game.stageManager.currentStage.stage,
            score: this.game.score,
            player: {
                hp: this.game.player.hp,
                powerUpState: this.game.player.powerUpState
            }
        };
        try {
            localStorage.setItem(this.saveKey, JSON.stringify(saveData));
            console.log('Game saved successfully.', saveData);
            alert('Game Saved!');
        } catch (error) {
            console.error('Failed to save game:', error);
            alert('Failed to save game.');
        }
    }

    loadGame() {
        const data = localStorage.getItem(this.saveKey);
        if (!data) {
            console.log('No save data found.');
            return false;
        }
        try {
            const saveData = JSON.parse(data);
            this.game.score = saveData.score;
            this.game.player.hp = saveData.player.hp;
            this.game.player.powerUpState = saveData.player.powerUpState;
            this.game.player.applyPowerUpState();
            this.game.stageManager.startStage(saveData.stage);
            console.log('Game loaded successfully.', saveData);
            return true;
        } catch (error) {
            console.error('Failed to load game:', error);
            return false;
        }
    }

    hasSaveData() {
        return localStorage.getItem(this.saveKey) !== null;
    }
}