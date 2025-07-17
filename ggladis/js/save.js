class SaveManager {
    constructor(game) {
        this.game = game;
        this.saveKey = 'gradiusGameSaveData';
    }

    /**
     * 現在のゲーム状態をlocalStorageに保存する
     */
    saveGame() {
        const saveData = {
            stage: this.game.currentStageNumber, // Gameオブジェクトのステージ番号を保存
            score: this.game.score,
            player: {
                hp: this.game.player.hp,
                powerUpState: this.game.player.powerUpState
            }
        };

        try {
            // JSON文字列に変換して保存
            localStorage.setItem(this.saveKey, JSON.stringify(saveData));
            console.log('Game saved successfully.', saveData);
            alert('Game Saved!'); // ユーザーに保存完了を通知
        } catch (error) {
            console.error('Failed to save game:', error);
            alert('Failed to save game.');
        }
    }

    /**
     * localStorageからゲーム状態を読み込み復元する
     * @returns {boolean} ロードに成功したか
     */
    loadGame() {
        const data = localStorage.getItem(this.saveKey);
        if (!data) {
            console.log('No save data found.');
            return false;
        }

        try {
            const saveData = JSON.parse(data);

            // Gameオブジェクトの状態を復元
            this.game.score = saveData.score;
            this.game.currentStageNumber = saveData.stage; // ステージ番号を復元

            // Playerの状態を復元
            this.game.player.hp = saveData.player.hp;
            this.game.player.powerUpState = saveData.player.powerUpState;

            // プレイヤーの能力値をパワーアップ状態から再計算
            this.game.player.applyPowerUpState();
            
            // 復元したステージ番号でステージを開始
            this.game.stageManager.startStage(this.game.currentStageNumber);
            
            console.log('Game loaded successfully.', saveData);
            return true;
        } catch (error) {
            console.error('Failed to load game:', error);
            return false;
        }
    }

    /**
     * セーブデータの有無を確認する
     * @returns {boolean} セーブデータが存在するか
     */
    hasSaveData() {
        return localStorage.getItem(this.saveKey) !== null;
    }
}