// ===============================================
// db-setup.js : データベース準備スクリプト (診断版 v3)
// ===============================================

/**
 * 強化データTSVをパースする
 * @param {string} tsvText - TSVファイルの内容
 * @returns {Array<Object>} パースされた強化データの配列
 */
function parseEnhancementTsv(tsvText) {
  if (!tsvText) return [];
  const lines = tsvText.trim().split(/\r\n|\n/);
  // ヘッダー行が見つからないか、データ行がなければ空配列を返す
  if (lines.length < 2) return [];

  const headerLine = lines[0].split('\t');
  const dataLines = lines.slice(1);

  // '強化+1' の列が何番目から始まるかを見つける
  const firstBonusIndex = headerLine.findIndex(h => h.trim() === '強化+1');
  if (firstBonusIndex === -1) {
    console.warn("TSVファイルに「強化+1」ヘッダーが見つかりません。このファイルのパースをスキップします。");
    return [];
  }

  return dataLines.map(line => {
    if (!line.trim()) return null;
    const values = line.split('\t').map(v => v.trim());
    // 最低でも カテゴリ, タイプ, 上昇ステータス の3列は必要
    if (values.length < 3) return null;

    const bonuses = [];
    // +1から+12までの12段階のボーナス値を取得
    for (let i = 0; i < 12; i++) {
      const val = values[firstBonusIndex + i];
      // 値が存在すれば数値に変換、なければ0とする
      bonuses.push(val ? parseInt(val, 10) : 0);
    }

    return {
      category: values[0],
      type: values[1],
      stat: values[2],
      bonuses: bonuses
    };
  }).filter(item => item !== null);
}

async function setupDatabase() {
  console.log('[setupDatabase] 関数を開始します。');
  const DB_NAME = 'GameEquipmentDB';
  const DB_VERSION = 11;
  const STORE_NAME = 'equipment';
  const TSV_FILE_PATH = './itemdata.tsv';
  const ENHANCEMENT_STORE_NAME = 'enhancementData';
  const RANKS = ['一般', '希少', '英雄', '古代', '伝説'];

  const EXPECTED_HEADERS = [
    '画像URL', '名称', 'ランク', 'タイプ', 'ソーステキスト', '評価数値', '基本攻撃力', '攻撃力増幅', 'クリティカルダメージ増幅', '一般攻撃力', 'スキルダメージ増幅', '近距離攻撃力', '防御力', '武力', 'ガード貫通', '一般ダメージ増幅', '気絶的中', '気絶抵抗', '絶対回避', 'クリティカル発生率', '状態異常抵抗', 'MP回復', '防御貫通', '状態異常的中', 'PvP攻撃力', 'PvPクリティカル発生率', '治癒量増加', '硬直', '近距離クリティカル発生率', '魔法クリティカル発生率', '活力', '忍耐', '聡明', '硬直耐性', '武器攻撃力', '命中', 'ガード', 'クリティカル抵抗', 'クリティカルダメージ耐性', 'HP回復', '最大HP', 'ポーション回復量', 'スキルダメージ耐性', '一般ダメージ耐性', '水属性追加ダメージ', '風属性追加ダメージ', '土属性追加ダメージ', '火属性追加ダメージ', '詠唱速度', '武器攻撃力増幅', '追加ダメージ', '遠距離攻撃力', 'PvE攻撃力', '最大MP', '治癒量増幅', '魔法攻撃力', '攻撃力耐性', '武器ブロック', '追加ダメージ減少', '凍結抵抗', '鈍化抵抗', '失明抵抗', '武器攻撃力耐性', '麻痺抵抗', '沈黙抵抗', '受ける治癒量増加', 'カバン最大重量', 'HP絶対回復', 'PvE防御力', 'PvEクリティカル抵抗', '受ける治癒量増幅', 'PvPクリティカル抵抗', 'MP絶対回復', '遠距離クリティカル発生率', 'PvP防御力', '一般防御力'
  ];

  try {
    console.log('[setupDatabase] TSVファイルのfetchを開始します。');
    const [itemTsvResult, ...enhancementTsvResults] = await Promise.allSettled([
      // アイテムデータのfetch
      fetch(TSV_FILE_PATH).then(res => {
        if (!res.ok) throw new Error(`Fetch failed with status ${res.status} for ${TSV_FILE_PATH}`);
        return res.text();
      }),
      // ランクごとの強化データのfetch
      ...RANKS.map(rank =>
        fetch(`./enhancement_${rank}.tsv`).then(res => {
          if (!res.ok) {
            console.log(`enhancement_${rank}.tsv が見つかりませんでした。スキップします。`);
            return ""; // ファイルが見つからない場合は空文字を返す
          }
          return res.text();
        })
      )
    ]);

    if (itemTsvResult.status === 'rejected') {
      // itemdata.tsvの読み込みは必須なので、失敗したらエラーを投げる
      throw itemTsvResult.reason;
    }
    const itemTsvData = itemTsvResult.value;
    console.log('[setupDatabase] itemdata.tsvのfetchが完了しました。');

    console.log('[setupDatabase] parseTsvを開始します。');
    const equipmentData = parseTsv(itemTsvData, EXPECTED_HEADERS);
    console.log(`[setupDatabase] parseTsvが完了しました。${equipmentData.length}件のデータを解析しました。`);

    const enhancementData = {};
    enhancementTsvResults.forEach((result, index) => {
        const rank = RANKS[index];
        if (result.status === 'fulfilled' && result.value) {
            enhancementData[rank] = parseEnhancementTsv(result.value);
        } else {
            enhancementData[rank] = []; // 失敗または空の場合は空配列
            if(result.status === 'rejected') {
                console.error(`enhancement_${rank}.tsv の処理中にエラーが発生しました:`, result.reason);
            }
        }
    });
    console.log('[setupDatabase] 強化データのパースが完了しました。');

    console.log('[setupDatabase] saveDataToDBを待機します。');
    await saveDataToDB(equipmentData, enhancementData, { DB_NAME, DB_VERSION, STORE_NAME, ENHANCEMENT_STORE_NAME });
    
    console.log('[setupDatabase] saveDataToDBが完了しました。');
    console.log('[setupDatabase] 関数が正常に終了します。');
  } catch (error) {
    console.error('[setupDatabase] try-catchブロックでエラーを捕捉しました:', error);
    throw error;
  }
}

function parseTsv(tsvText, headers) {
  const lines = tsvText.trim().split(/\r\n|\n/);
  const dataLines = lines.slice(2);
  return dataLines.map(line => {
    if (!line.trim()) return null;
    const values = line.split('\t').map(v => v.trim());
    const equipment = {};
    headers.forEach((header, index) => {
      if (header) equipment[header] = values[index] || '';
    });
    return equipment['名称'] ? equipment : null;
  }).filter(item => item !== null);
}

function saveDataToDB(itemData, enhancementData, config) {
  console.log('[saveDataToDB] Promiseを生成し、処理を開始します。');
  return new Promise((resolve, reject) => {
    console.log(`[saveDataToDB] indexedDB.open('${config.DB_NAME}', ${config.DB_VERSION}) を実行します。`);
    const request = indexedDB.open(config.DB_NAME, config.DB_VERSION);

    request.onerror = (event) => {
      console.error('[saveDataToDB] request.onerrorイベントが発生しました。', event.target.error);
      reject(`データベースのエラー: ${event.target.error}`);
    };

    request.onblocked = (event) => {
      console.warn('[saveDataToDB] request.onblockedイベントが発生しました。', event);
      reject('データベースへの接続がブロックされました。他のタブでページが開いている可能性があります。');
    };

    request.onupgradeneeded = (event) => {
      console.log('[saveDataToDB] request.onupgradeneededイベントが発生しました。');
      const db = event.target.result;
      if (db.objectStoreNames.contains(config.STORE_NAME)) {
        console.log(`[saveDataToDB] 既存のストア'${config.STORE_NAME}'を削除します。`);
        db.deleteObjectStore(config.STORE_NAME);
      }
      console.log(`[saveDataToDB] 新しいストア'${config.STORE_NAME}'を作成します。keyPath: '名称'`);
      const objectStore = db.createObjectStore(config.STORE_NAME, { keyPath: '名称' });
      console.log('[saveDataToDB] インデックスを作成します。');
      objectStore.createIndex('ランク', 'ランク', { unique: false });
      objectStore.createIndex('タイプ', 'タイプ', { unique: false });

      // enhancementDataストアを作成
      if (db.objectStoreNames.contains(config.ENHANCEMENT_STORE_NAME)) {
        console.log(`[saveDataToDB] 既存のストア'${config.ENHANCEMENT_STORE_NAME}'を削除します。`);
        db.deleteObjectStore(config.ENHANCEMENT_STORE_NAME);
      }
      console.log(`[saveDataToDB] 新しいストア'${config.ENHANCEMENT_STORE_NAME}'を作成します。keyPath: 'rank'`);
      db.createObjectStore(config.ENHANCEMENT_STORE_NAME, { keyPath: 'rank' });

      console.log('[saveDataToDB] request.onupgradeneededイベントを完了します。');
    };

    request.onsuccess = (event) => {
      console.log('[saveDataToDB] request.onsuccessイベントが発生しました。');
      const db = event.target.result;
      const transaction = db.transaction([config.STORE_NAME, config.ENHANCEMENT_STORE_NAME], 'readwrite');

      transaction.onabort = (event) => {
        console.error('[saveDataToDB] transaction.onabortイベントが発生しました。', event.target.error);
        reject(`トランザクションが中断されました: ${event.target.error}`);
      };
      transaction.onerror = (event) => {
        console.error('[saveDataToDB] transaction.onerrorイベントが発生しました。', event.target.error);
        reject(`トランザクションエラー: ${event.target.error}`);
      };
      transaction.oncomplete = () => {
        console.log('[saveDataToDB] transaction.oncompleteイベントが発生しました。Promiseをresolveします。');
        db.close();
        resolve();
      };

      // --- アイテムデータの保存 ---
      const itemObjectStore = transaction.objectStore(config.STORE_NAME);
      console.log(`[saveDataToDB] ${config.STORE_NAME}.clear() を実行します。`);
      itemObjectStore.clear();
      console.log(`[saveDataToDB] ${itemData.length}件のアイテムデータを追加します。`);
      itemData.forEach(item => {
        itemObjectStore.add(item);
      });
      
      // --- 強化データの保存 ---
      const enhancementObjectStore = transaction.objectStore(config.ENHANCEMENT_STORE_NAME);
      console.log(`[saveDataToDB] ${config.ENHANCEMENT_STORE_NAME}.clear() を実行します。`);
      enhancementObjectStore.clear();
      console.log('[saveDataToDB] 強化データを追加します。');
      for (const rank in enhancementData) {
          // hasOwnPropertyチェックでプロトタイプチェーン上のプロパティを除外
          if (Object.prototype.hasOwnProperty.call(enhancementData, rank)) {
              enhancementObjectStore.put({ rank: rank, data: enhancementData[rank] });
          }
      }

      console.log('[saveDataToDB] 全てのデータ保存リクエストを発行しました。');
    };
  });
}