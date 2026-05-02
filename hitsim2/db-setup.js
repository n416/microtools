// ===============================================
// db-setup.js : データベース準備スクリプト (診断用)
// ===============================================

// parseEnhancementTsv has been removed.

// parseSetBonusTsv has been removed.

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

function parseHitsimJson(jsonData, headers, statRates = []) {
  console.log('[db-setup] parseHitsimJson called with', jsonData.length, 'items');
  return jsonData.map(item => {
    const equipment = {};
    headers.forEach(h => equipment[h] = '');

    equipment['名称'] = item.Name || '';
    equipment['ランク'] = item.Grade || '';
    
    const rawType = item.WeaponType || item.EquipmentType || '';
    if (rawType === 'MAX' || item.WeaponType === 'MAX' || item.EquipmentType === 'MAX') {
      return null;
    }
    if (rawType === 'ペナント' || item.WeaponType === 'ペナント' || item.EquipmentType === 'ペナント') {
      return null;
    }
    
    // WeaponTypeがnull かつ Statsが空({})のアイテムを除外
    if (item.WeaponType === null && (!item.Stats || Object.keys(item.Stats).length === 0)) {
      return null;
    }

    // ハードコア系の特定のアクセサリを除外（文字化け対策としてItemIdで判定）
    const excludedHardcoreItemIds = [
      'Equip_Accessory_Ring_SPECIAL_002_UnTrade_Hardcore_TW34', // ハードコア守護のリング
      'Equip_Accessory_Insignia_SPECIAL_001_CharacterBinging_Hardcore_TW34', // ハードコア封印された魔力の勲章
      'Equip_Accessory_Ring_SPECIAL_001_UnTrade_Hardcore_TW34' // ハードコア闘争のリング
    ];
    if (item.ItemId && excludedHardcoreItemIds.includes(item.ItemId)) {
      return null;
    }


    equipment['タイプ'] = rawType;
    equipment['EnhanceGroupId'] = item.EnhanceGroupId || '';
    
    equipment['画像URL'] = item.Icon ? `./Icons/${item.Icon}.png` : '';
    
    if (item.SetName) {
      let cleanedSetName = item.SetName.replace('セット装備:', '').replace(/[\[\]]/g, '');
      if (cleanedSetName.endsWith('装備')) {
        cleanedSetName = cleanedSetName.slice(0, -2);
      }
      equipment['セット名'] = cleanedSetName;
    }
    
    if (item.Skill) {
      equipment['ソーステキスト'] = item.Skill;
    }

    if (item.Stats) {
      for (const [key, val] of Object.entries(item.Stats)) {
        if (headers.includes(key) && val != null) {
          let legacyVal = val;
          const isPercentage = statRates.includes(key);
          // If it's a percentage stat, convert 10000 scale to decimal (e.g. 1900 -> 0.19)
          if (isPercentage && typeof val === 'number') {
            legacyVal = val / 10000;
          }
          equipment[key] = String(legacyVal);
        }
      }
    }

    // --- ここから評価数値の自動計算 ---
    const getStat = (key) => parseFloat(equipment[key]) || 0;
    
    // 基礎攻撃力
    const baseAttack = 700 + 
      getStat('基本攻撃力') + 
      getStat('遠距離攻撃力') + 
      getStat('近距離攻撃力') + 
      getStat('一般攻撃力') + 
      (getStat('武器攻撃力') / 2) * (1 + getStat('武器攻撃力増幅'));

    // 増幅系
    const atkAmp = getStat('攻撃力増幅');
    const critDmgAmp = getStat('クリティカルダメージ増幅');

    // ①スキルダメージ評価
    const skillHit = (
      baseAttack * (1 + atkAmp) + 
      200 * (1 + getStat('スキルダメージ増幅'))
    ) * (1 + critDmgAmp);

    // ②一般ダメージ評価
    const normalHit = (
      baseAttack * (1 + atkAmp) + 
      80 * (1 + getStat('一般ダメージ増幅'))
    ) * (1 + critDmgAmp);

    // ③貫通・追加ダメージ評価を含めて合算
    const score = skillHit + normalHit + 
      getStat('防御貫通') * 10 + 
      getStat('ガード貫通') * 10 + 
      getStat('追加ダメージ');

    // 小数点第1位で丸める（または整数）
    equipment['評価数値'] = Math.round(score).toString();
    // --- 計算ここまで ---

    return equipment['名称'] ? equipment : null;
  }).filter(item => item !== null);
}

export const DB_NAME = 'GameEquipmentDB';
export const DB_VERSION = 18;
export const STORE_NAME = 'equipment';
export const ENHANCEMENT_STORE_NAME = 'enhancementData';
export const SET_BONUS_STORE_NAME = 'setBonuses';

async function setupDatabase() {
  console.log('[db-setup] setupDatabase started');
  const JSON_FILE_PATH = './itemdata.json';
  const SET_BONUS_JSON_PATH = './setdata.json';
  const STAT_RATES_JSON_PATH = './stat_rates.json';
  const ENHANCEMENT_JSON_PATH = './enhancement_data.json';
  const EXPECTED_HEADERS = ['画像URL', '名称', 'ランク', 'タイプ', 'ソーステキスト', 'セット装備', '評価数値', '基本攻撃力', '攻撃力増幅', 'クリティカルダメージ増幅', '一般攻撃力', 'スキルダメージ増幅', '近距離攻撃力', '防御力', '武力', 'ガード貫通', '一般ダメージ増幅', '気絶的中', '気絶抵抗', '絶対回避', 'クリティカル発生率', '状態異常抵抗', 'MP回復', '防御貫通', '状態異常的中', 'PvP攻撃力', 'PvPクリティカル発生率', '治癒量増加', '硬直', '近距離クリティカル発生率', '魔法クリティカル発生率', '活力', '忍耐', '聡明', '硬直耐性', '武器攻撃力', '命中', 'ガード', 'クリティカル抵抗', 'クリティカルダメージ耐性', 'HP回復', '最大HP', 'ポーション回復量', 'スキルダメージ耐性', '一般ダメージ耐性', '水属性追加ダメージ', '風属性追加ダメージ', '土属性追加ダメージ', '火属性追加ダメージ', '詠唱速度', '武器攻撃力増幅', '追加ダメージ', '遠距離攻撃力', 'PvE攻撃力', '最大MP', '治癒量増幅', '魔法攻撃力', '攻撃力耐性', '武器ブロック', '追加ダメージ減少', '凍結抵抗', '鈍化抵抗', '失明抵抗', '武器攻撃力耐性', '麻痺抵抗', '沈黙抵抗', '受ける治癒量増加', 'カバン最大重量', 'HP絶対回復', 'PvE防御力', 'PvEクリティカル抵抗', '受ける治癒量増幅', 'PvPクリティカル抵抗', 'MP絶対回復', '遠距離クリティカル発生率', 'PvP防御力', '一般防御力', 'EnhanceGroupId'];

  try {
    console.log('[db-setup] Fetching data files...');
    const results = await Promise.allSettled([
      fetch(JSON_FILE_PATH).then(res => { console.log('[db-setup] JSON fetch status:', res.status); return res.ok ? res.json() : Promise.reject(new Error(`${JSON_FILE_PATH} not found`)) }),
      fetch(SET_BONUS_JSON_PATH).then(res => { console.log('[db-setup] SetBonus JSON fetch status:', res.status); return res.ok ? res.json() : Promise.reject(new Error(`${SET_BONUS_JSON_PATH} not found`)) }),
      fetch(STAT_RATES_JSON_PATH).then(res => { console.log('[db-setup] StatRates JSON fetch status:', res.status); return res.ok ? res.json() : Promise.reject(new Error(`${STAT_RATES_JSON_PATH} not found`)) }),
      fetch(ENHANCEMENT_JSON_PATH).then(res => { console.log('[db-setup] Enhancement JSON fetch status:', res.status); return res.ok ? res.json() : Promise.reject(new Error(`${ENHANCEMENT_JSON_PATH} not found`)) })
    ]);

    const [itemJsonResult, setBonusJsonResult, statRatesJsonResult, enhancementJsonResult] = results;

    if (itemJsonResult.status === 'rejected') {
      console.error('[db-setup] JSON fetch failed', itemJsonResult.reason);
      throw itemJsonResult.reason;
    }
    if (setBonusJsonResult.status === 'rejected') {
      console.error('[db-setup] SetBonus JSON fetch failed', setBonusJsonResult.reason);
      throw setBonusJsonResult.reason;
    }

    const statRates = statRatesJsonResult.status === 'fulfilled' ? statRatesJsonResult.value : [];
    const rawEnhancementData = enhancementJsonResult.status === 'fulfilled' ? enhancementJsonResult.value : {};

    // 強化データのパーセント変換処理
    const enhancementData = {};
    for (const [groupName, levels] of Object.entries(rawEnhancementData)) {
      enhancementData[groupName] = {};
      for (const [level, stats] of Object.entries(levels)) {
        enhancementData[groupName][level] = {};
        for (const [statName, val] of Object.entries(stats)) {
          let convertedVal = val;
          if (statRates.includes(statName) && typeof val === 'number') {
            convertedVal = val / 10000;
          }
          enhancementData[groupName][level][statName] = convertedVal;
        }
      }
    }

    console.log('[db-setup] Fetch complete. Parsing JSON...');
    const equipmentData = parseHitsimJson(itemJsonResult.value, EXPECTED_HEADERS, statRates);
    console.log(`[db-setup] Parsed ${equipmentData.length} items from JSON`);
    
    const setBonusData = setBonusJsonResult.value;
    for (const set of setBonusData) {
      for (const bonus of set.bonuses) {
        for (const [key, val] of Object.entries(bonus.stats)) {
          const isPercentage = statRates.includes(key);
          if (isPercentage && typeof val === 'number') {
            bonus.stats[key] = val / 10000;
          }
        }
      }
    }
    console.log(`[db-setup] Parsed ${setBonusData.length} set bonuses`);
    
    console.log('[db-setup] Saving data to IndexedDB...');
    await saveDataToDB(equipmentData, enhancementData, setBonusData);
    console.log('[db-setup] Data saved successfully to IndexedDB');

  } catch (error) {
    console.error('[db-setup] setupDatabase encountered an error:', error);
    throw error;
  }
}

function saveDataToDB(itemData, enhancementData, setBonusData) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('[db-setup] DB open error:', event.target.error);
      reject(`DBオープンエラー: ${event.target.error}`);
    };
    request.onblocked = (event) => {
      console.warn('[db-setup] DB open blocked!');
      reject('データベースへの接続がブロックされました。');
    };

    request.onupgradeneeded = (event) => {
      console.log('[db-setup] onupgradeneeded triggered');
      const db = event.target.result;
      const storeNames = [STORE_NAME, ENHANCEMENT_STORE_NAME, SET_BONUS_STORE_NAME];
      storeNames.forEach(name => {
        if (db.objectStoreNames.contains(name)) {
          db.deleteObjectStore(name);
        }
      });
      db.createObjectStore(STORE_NAME, { keyPath: '名称' });
      db.createObjectStore(ENHANCEMENT_STORE_NAME, { keyPath: 'groupId' });
      db.createObjectStore(SET_BONUS_STORE_NAME, { keyPath: 'setName' });
      console.log('[db-setup] object stores recreated');
    };

    request.onsuccess = (event) => {
      console.log('[db-setup] indexedDB open success');
      const db = event.target.result;
      const transaction = db.transaction([STORE_NAME, ENHANCEMENT_STORE_NAME, SET_BONUS_STORE_NAME], 'readwrite');

      transaction.oncomplete = () => {
        console.log('[db-setup] transaction oncomplete');
        db.close();
        resolve();
      };
      transaction.onerror = (event) => {
        console.error('[db-setup] transaction onerror:', event.target.error);
        reject(`トランザクションエラー: ${event.target.error}`);
      };
      transaction.onabort = (event) => {
        console.error('[db-setup] transaction onabort:', event.target.error);
        reject(`トランザクションアボート: ${event.target.error}`);
      };

      try {
        console.log('[db-setup] clearing stores and putting items...');
        transaction.objectStore(STORE_NAME).clear();
        itemData.forEach(item => {
          try {
            const req = transaction.objectStore(STORE_NAME).put(item);
            req.onerror = (e) => {
              if (e.target.error && e.target.error.name !== 'AbortError') {
                console.error('[db-setup] Async Error putting into STORE_NAME. item:', item, e.target.error);
              }
            };
          } catch(e) {
            console.error('[db-setup] Sync Error putting into STORE_NAME. item:', item, e);
            throw e;
          }
        });

        transaction.objectStore(ENHANCEMENT_STORE_NAME).clear();
        for (const groupId in enhancementData) {
          if (Object.prototype.hasOwnProperty.call(enhancementData, groupId)) {
            try {
              const req = transaction.objectStore(ENHANCEMENT_STORE_NAME).put({ groupId: groupId, data: enhancementData[groupId] });
              req.onerror = (e) => {
                if (e.target.error && e.target.error.name !== 'AbortError') {
                  console.error('[db-setup] Async Error putting into ENHANCEMENT_STORE_NAME. groupId:', groupId, e.target.error);
                }
              };
            } catch(e) {
              console.error('[db-setup] Sync Error putting into ENHANCEMENT_STORE_NAME. groupId:', groupId, e);
              throw e;
            }
          }
        }
        transaction.objectStore(SET_BONUS_STORE_NAME).clear();
        setBonusData.forEach(item => {
          try {
            const req = transaction.objectStore(SET_BONUS_STORE_NAME).put(item);
            req.onerror = (e) => {
              if (e.target.error && e.target.error.name !== 'AbortError') {
                console.error('[db-setup] Async Error putting into SET_BONUS_STORE_NAME. item:', item, e.target.error);
              }
            };
          } catch(e) {
            console.error('[db-setup] Sync Error putting into SET_BONUS_STORE_NAME. item:', item, e);
            throw e;
          }
        });

      } catch (e) {
        console.error('[db-setup] Caught error during IndexedDB put:', e);
        transaction.abort();
        reject(e);
      }
    };
  });
}

window.setupDatabase = setupDatabase;