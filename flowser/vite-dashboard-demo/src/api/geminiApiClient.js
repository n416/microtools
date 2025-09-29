export class GeminiApiClient {
    #geminiApiKey = null;
    #isKeyValid = false;
    // ★★★ 宛先をGoogle AI Studio (Generative Language API) の形式に変更 ★★★
    #baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

    constructor() {
        try {
            const storedKey = localStorage.getItem('geminiApiKey');
            if (storedKey) {
                this.#geminiApiKey = storedKey;
                this.#isKeyValid = true;
            } else {
                this.#isKeyValid = false;
            }
        } catch (e) {
            console.error('Failed to access localStorage for API Key:', e);
            this.#isKeyValid = false;
        }
    }

    get isAvailable() {
        return this.#isKeyValid;
    }

    /**
     * 利用可能なモデルのリストを取得します。
     * @static
     * @param {string} apiKey 
     * @returns {Promise<Array<any>>}
     */
    static async listAvailableModels(apiKey) {
        if (!apiKey) {
            throw new Error('APIキーがありません。');
        }
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();
        if (!response.ok) {
            const detail = data?.error?.message || '不明なエラー';
            throw new Error(`モデルリストの取得に失敗しました (${response.status}): ${detail}`);
        }
        return data.models;
    }


    /**
     * 指定されたプロンプトとモデルでコンテンツを生成します。
     * @param {string} prompt 
     * @param {string} modelId 
     * @returns {Promise<string>}
     */
    async generateContent(prompt, modelId) {
        if (!this.isAvailable) {
            throw new Error('Gemini APIキーが設定されていません。');
        }

        // ▼▼▼ プロジェクトIDは不要になったため削除 ▼▼▼

        // Generative Language API用の正しいURLを組み立て
        const cleanModelId = modelId.startsWith('models/') ? modelId.split('/')[1] : modelId;
        // ★★★ APIキーをURLのクエリパラメータとして付与 ★★★
        const apiUrl = `${this.#baseUrl}/${cleanModelId}:generateContent?key=${this.#geminiApiKey}`;

        const requestBody = {
            contents: [{ parts: [{ "text": prompt }] }],
            safetySettings: [
                { "category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE" },
                { "category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE" },
                { "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE" },
                { "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE" }
            ]
        };

        // ★★★ ヘッダーから 'X-Goog-Api-Key' を削除 ★★★
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        const data = await response.json();

        if (!response.ok) {
            const detail = data?.error?.message || '不明なエラー';
            throw new Error(`APIリクエストに失敗しました (${response.status}): ${detail}`);
        }

        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
            // エラーの詳細をより分かりやすく表示
            if(data.candidates?.[0]?.finishReason === 'SAFETY') {
                 throw new Error(`AIから有効な応答が得られませんでした。理由: 安全性設定によりブロックされました。`);
            }
            const reason = data.promptFeedback?.blockReason || data.candidates?.[0]?.finishReason || '不明';
            throw new Error(`AIから有効な応答が得られませんでした。理由: ${reason}`);
        }
        return data.candidates[0].content.parts[0].text;
    }
}