// ===============================================
// db-setup.js : データベース準備スクリプト (診断用)
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
  if (firstBonusIndex === -1) return [];
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
    return { category: values[0], type: values[1], stat: values[2], bonuses: bonuses };
  }).filter(item => item !== null);
}

function parseSetBonusTsv(tsvText) {
  if (!tsvText) return [];
  const lines = tsvText.trim().split(/\r\n|\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split('\t');
  const dataRows = lines.slice(1);
  const allSetsData = [];

  for (const line of dataRows) {
    if (!line.trim()) continue;
    const columns = line.split('\t');

    const rawSetName = columns[0] ? columns[0].trim() : '';
    if (!rawSetName) continue;

    let cleanedSetName = rawSetName.replace('セット装備:', '').replace(/[\[\]]/g, '');
    if (cleanedSetName.endsWith('装備')) {
      cleanedSetName = cleanedSetName.slice(0, -2);
    }

    const currentSet = {
      setName: cleanedSetName,
      bonuses: []
    };

    for (let i = 1; i < headers.length; i++) {
      const statsString = columns[i] ? columns[i].trim() : '';
      if (!statsString) continue;

      const headerText = headers[i];

      // 全角数字と半角数字の両方にマッチするよう正規表現を修正します
      const countMatch = headerText.match(/[0-9０-９]+/);
      if (!countMatch) continue;

      //const count = parseInt(countMatch[0], 10);
      const count = parseInt(countMatch[0].normalize("NFKC"), 10);
      const stats = {};

      const statPairs = statsString.split(';');
      for (const pair of statPairs) {
        const parts = pair.split(':');
        if (parts.length === 2) {
          const key = parts[0].trim();
          const valueStr = parts[1].trim();
          let valueNum;

          if (valueStr.includes('%')) {
            valueNum = parseFloat(valueStr) / 100.0;
          } else {
            valueNum = parseFloat(valueStr);
          }

          if (!isNaN(valueNum)) {
            stats[key] = valueNum;
          }
        }
      }

      if (Object.keys(stats).length > 0) {
        currentSet.bonuses.push({
          count: count,
          stats: stats
        });
      }
    }
    allSetsData.push(currentSet);
  }
  return allSetsData;
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
    if (equipment['セット装備'] && equipment['セット装備'] !== '-') {
      let cleanedSetName = equipment['セット装備'].replace('セット装備:', '').replace(/[\[\]]/g, '');
      if (cleanedSetName.endsWith('装備')) {
        cleanedSetName = cleanedSetName.slice(0, -2);
      }
      equipment['セット名'] = cleanedSetName;
    }
    return equipment['名称'] ? equipment : null;
  }).filter(item => item !== null);
}

async function setupDatabase() {
  const DB_NAME = 'GameEquipmentDB';
  const DB_VERSION = 12;
  const STORE_NAME = 'equipment';
  const ENHANCEMENT_STORE_NAME = 'enhancementData';
  const SET_BONUS_STORE_NAME = 'setBonuses';
  const TSV_FILE_PATH = './itemdata.tsv';
  const SET_BONUS_TSV_PATH = './itemdata_set.tsv';
  const RANKS = ['一般', '希少', '英雄', '古代', '伝説'];
  const EXPECTED_HEADERS = ['画像URL', '名称', 'ランク', 'タイプ', 'ソーステキスト', 'セット装備', '評価数値', '基本攻撃力', '攻撃力増幅', 'クリティカルダメージ増幅', '一般攻撃力', 'スキルダメージ増幅', '近距離攻撃力', '防御力', '武力', 'ガード貫通', '一般ダメージ増幅', '気絶的中', '気絶抵抗', '絶対回避', 'クリティカル発生率', '状態異常抵抗', 'MP回復', '防御貫通', '状態異常的中', 'PvP攻撃力', 'PvPクリティカル発生率', '治癒量増加', '硬直', '近距離クリティカル発生率', '魔法クリティカル発生率', '活力', '忍耐', '聡明', '硬直耐性', '武器攻撃力', '命中', 'ガード', 'クリティカル抵抗', 'クリティカルダメージ耐性', 'HP回復', '最大HP', 'ポーション回復量', 'スキルダメージ耐性', '一般ダメージ耐性', '水属性追加ダメージ', '風属性追加ダメージ', '土属性追加ダメージ', '火属性追加ダメージ', '詠唱速度', '武器攻撃力増幅', '追加ダメージ', '遠距離攻撃力', 'PvE攻撃力', '最大MP', '治癒量増幅', '魔法攻撃力', '攻撃力耐性', '武器ブロック', '追加ダメージ減少', '凍結抵抗', '鈍化抵抗', '失明抵抗', '武器攻撃力耐性', '麻痺抵抗', '沈黙抵抗', '受ける治癒量増加', 'カバン最大重量', 'HP絶対回復', 'PvE防御力', 'PvEクリティカル抵抗', '受ける治癒量増幅', 'PvPクリティカル抵抗', 'MP絶対回復', '遠距離クリティカル発生率', 'PvP防御力', '一般防御力'];

  try {
    const results = await Promise.allSettled([
      fetch(TSV_FILE_PATH).then(res => res.ok ? res.text() : Promise.reject(new Error(`${TSV_FILE_PATH} not found`))),
      fetch(SET_BONUS_TSV_PATH).then(res => res.ok ? res.text() : Promise.reject(new Error(`${SET_BONUS_TSV_PATH} not found`))),
      ...RANKS.map(rank => fetch(`./enhancement_${rank}.tsv`).then(res => res.ok ? res.text() : ""))
    ]);

    const [itemTsvResult, setBonusTsvResult, ...enhancementTsvResults] = results;

    if (itemTsvResult.status === 'rejected') throw itemTsvResult.reason;
    if (setBonusTsvResult.status === 'rejected') throw setBonusTsvResult.reason;

    const equipmentData = parseTsv(itemTsvResult.value, EXPECTED_HEADERS);
    const setBonusData = parseSetBonusTsv(setBonusTsvResult.value);
    const enhancementData = {};
    enhancementTsvResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        enhancementData[RANKS[index]] = parseEnhancementTsv(result.value);
      }
    });
    await saveDataToDB(equipmentData, enhancementData, setBonusData, { DB_NAME, DB_VERSION, STORE_NAME, ENHANCEMENT_STORE_NAME, SET_BONUS_STORE_NAME });

  } catch (error) {
    throw error;
  }
}

function saveDataToDB(itemData, enhancementData, setBonusData, config) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(config.DB_NAME, config.DB_VERSION);

    request.onerror = (event) => {
      reject(`DBオープンエラー: ${event.target.error}`);
    };
    request.onblocked = (event) => {
      reject('データベースへの接続がブロックされました。');
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const storeNames = [config.STORE_NAME, config.ENHANCEMENT_STORE_NAME, config.SET_BONUS_STORE_NAME];
      storeNames.forEach(name => {
        if (db.objectStoreNames.contains(name)) db.deleteObjectStore(name);
      }
      );
      db.createObjectStore(config.STORE_NAME, { keyPath: '名称' });
      db.createObjectStore(config.ENHANCEMENT_STORE_NAME, { keyPath: 'rank' });
      db.createObjectStore(config.SET_BONUS_STORE_NAME, { keyPath: 'setName' });
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction([config.STORE_NAME, config.ENHANCEMENT_STORE_NAME, config.SET_BONUS_STORE_NAME], 'readwrite');

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = (event) => {
        reject(`トランザクションエラー: ${event.target.error}`);
      };

      try {
        transaction.objectStore(config.STORE_NAME).clear();
        itemData.forEach(item => transaction.objectStore(config.STORE_NAME).put(item));

        transaction.objectStore(config.ENHANCEMENT_STORE_NAME).clear();
        for (const rank in enhancementData) {
          if (Object.prototype.hasOwnProperty.call(enhancementData, rank)) {
            transaction.objectStore(config.ENHANCEMENT_STORE_NAME).put({ rank: rank, data: enhancementData[rank] });
          }
        }
        transaction.objectStore(config.SET_BONUS_STORE_NAME).clear();
        setBonusData.forEach(item => transaction.objectStore(config.SET_BONUS_STORE_NAME).put(item));

      } catch (e) {
        transaction.abort();
      }
    };
  });
}