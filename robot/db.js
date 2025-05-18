// db.js - IndexedDB 操作の共通ライブラリ
const DB_NAME = "RobotCardDB";
const DB_VERSION = 1;
const STORE_NAME = "cards";
let db; // DB instance
let initPromise = null; // DB初期化のPromiseを保持

/**
 * IndexedDBを初期化する。
 * 既に初期化中の場合は、そのPromiseを返す。
 */
function initDB() {
    // 既に初期化処理が進行中、または完了している場合はそのPromiseを返す
    if (initPromise) {
        return initPromise;
    }

    // 新しい初期化Promiseを作成
    initPromise = new Promise((resolve, reject) => {
        console.log("Opening IndexedDB...");
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.error);
            initPromise = null; // エラー時はPromiseをリセット
            reject("IndexedDB error: " + event.target.error);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log("Database opened successfully:", db);
            // DBインスタンスが取得できたら解決
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            console.log("IndexedDB upgrade needed...");
            let upgradDb = event.target.result; // onupgradeneeded 内でのみ有効なDBインスタンス
            if (!upgradDb.objectStoreNames.contains(STORE_NAME)) {
                try {
                    upgradDb.createObjectStore(STORE_NAME, { keyPath: "id" });
                    console.log("Object store 'cards' created");
                } catch (e) {
                     console.error("Error creating object store:", e);
                     initPromise = null; // エラー時はPromiseをリセット
                     // rejectはonsuccess/onerrorで処理されるためここでは不要かも
                     return;
                }
            }
            console.log("IndexedDB upgrade complete.");
            // onupgradeneeded の後は onsuccess が呼ばれるので、resolve はそちらで行う
        };

        // 接続がブロックされた場合の処理
        request.onblocked = () => {
            console.warn("IndexedDB connection blocked. Please close other tabs/windows using the database.");
            initPromise = null; // ブロックされたらリセット
            reject("IndexedDB connection blocked.");
        };
    });

    return initPromise;
}

/**
 * 利用可能なDBインスタンスを取得する。
 * まだ初期化されていない場合は初期化を試みる。
 */
async function getDbInstance() {
    if (!db) {
        console.log("DB instance not available. Initializing...");
        // initDBを呼び出して初期化完了を待つ
        try {
            await initDB();
            if (!db) {
                 throw new Error("DB initialization failed, instance still not available.");
            }
        } catch (error) {
             console.error("Error during DB initialization:", error);
             throw error; // エラーを再スロー
        }
    }
    // console.log("Returning DB instance:", db); // デバッグ用
    return db; // 既存の or 初期化後のインスタンスを返す
}

/**
 * 指定されたIDのカードデータを保存する。
 * @param {string} cardId カードID
 * @param {object} data 保存するカードデータ (idプロパティは上書きされる)
 */
function saveCardData(cardId, data) {
    return new Promise(async (resolve, reject) => {
        try {
            const currentDb = await getDbInstance(); // DBインスタンス取得保証
            const tx = currentDb.transaction([STORE_NAME], "readwrite");
            const store = tx.objectStore(STORE_NAME);
            // 保存するデータに必ず正しいIDが含まれるようにする
            const dataToSave = { ...data, id: cardId };
            const request = store.put(dataToSave);

            request.onsuccess = () => {
                resolve(); // 保存成功
            };
            request.onerror = (e) => {
                console.error(`Save error for ${cardId}:`, e.target.error);
                reject(e.target.error);
            };
            // トランザクション自体のエラーハンドリング (ほぼ不要かもしれないが一応)
            tx.onerror = (e) => {
                console.error(`Transaction error saving ${cardId}:`, e.target.error);
                // request.onerror で reject されているはず
            };
        } catch (error) {
            console.error(`Failed to start transaction or get DB for saving ${cardId}:`, error);
            reject(error);
        }
    });
}

/**
 * IndexedDBから全てのカードデータを読み込み、
 * IDをキーとするオブジェクト形式と最大ページ番号を返す。
 */
function loadAllCardDataFromDB() {
    return new Promise(async (resolve, reject) => {
        try {
            const currentDb = await getDbInstance(); // DBインスタンス取得保証
            const tx = currentDb.transaction([STORE_NAME], "readonly");
            const store = tx.objectStore(STORE_NAME);
            const request = store.getAll(); // 全データ取得

            request.onsuccess = (e) => {
                const allDataArray = e.target.result || []; // 結果がnullの場合空配列に
                // 配列から ID をキーとするオブジェクトに変換
                const loadedData = {};
                let maxPage = 0;
                allDataArray.forEach(item => {
                    // 必須プロパティの存在チェックとデフォルト値設定
                    if (item && typeof item.id === 'string') {
                        loadedData[item.id] = {
                            id: item.id,
                            page: parseInt(item.page, 10) || 1, // 数値に変換、デフォルト1
                            index: parseInt(item.index, 10) || 1, // 数値に変換、デフォルト1
                            image: item.image || null, // デフォルトnull
                            manufacturer: item.manufacturer !== undefined ? item.manufacturer : "", // デフォルト空文字
                            value: item.value !== undefined ? String(item.value) : "", // 文字列に変換、デフォルト空文字
                            part: item.part || "", // デフォルト空文字
                        };
                        // 最大ページ番号を更新
                        if (loadedData[item.id].page > maxPage) {
                            maxPage = loadedData[item.id].page;
                        }
                    } else {
                        console.warn("Skipping invalid item during load:", item);
                    }
                });

                console.log(`Loaded ${Object.keys(loadedData).length} card data entries from DB into object format.`);
                // データをオブジェクト形式で、最大ページ番号と共に返す
                resolve({ data: loadedData, maxPage: maxPage });
            };
            request.onerror = (e) => {
                console.error("Load all error:", e.target.error);
                reject(e.target.error);
            };
            tx.onerror = (e) => {
                console.error(`Transaction error loading all data:`, e.target.error);
            };
        } catch (error) {
            console.error("Failed to start transaction or get DB for loading all:", error);
            reject(error);
        }
    });
}

/**
 * IndexedDBのカードデータをすべて削除する。
 */
function clearAllDBData() {
    return new Promise(async (resolve, reject) => {
        try {
            const currentDb = await getDbInstance(); // DBインスタンス取得保証
            const transaction = currentDb.transaction([STORE_NAME], "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear(); // ストア内の全データを削除

            request.onsuccess = () => {
                console.log("IndexedDB data cleared successfully.");
                resolve(); // 削除成功
            };
            request.onerror = (event) => {
                console.error("Error clearing IndexedDB data:", event.target.error);
                reject(event.target.error);
            };
            transaction.onerror = (e) => {
                console.error(`Transaction error clearing data:`, e.target.error);
            };
        } catch (error) {
            console.error("Failed to start transaction or get DB for clearing:", error);
            reject(error);
        }
    });
}

// 注意: このファイルは他のJSファイルより先にHTMLで読み込む必要があります。
// 例: <script src="db.js"></script>
//     <script src="script.js"></script>
//     <script src="game.js"></script>

// グローバルスコープに関数を直接定義しているので、
// モジュール形式(export)を使わない場合はこれで他のスクリプトから参照可能です。