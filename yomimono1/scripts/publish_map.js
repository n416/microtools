import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mapFilePath = path.resolve(__dirname, '../publish_map.json');

// マップファイルの読み込み
export function loadMap() {
  if (fs.existsSync(mapFilePath)) {
    try {
      const data = fs.readFileSync(mapFilePath, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      console.error('[publish_map] Error reading map file, returning empty map.', e);
      return {};
    }
  }
  return {};
}

// マップの保存
export function saveMap(mapData) {
  try {
    fs.writeFileSync(mapFilePath, JSON.stringify(mapData, null, 2), 'utf-8');
  } catch (e) {
    console.error('[publish_map] Error writing map file.', e);
  }
}

// fileName に紐づくID群を取得
export function getEpisodeIds(fileName) {
  const mapData = loadMap();
  return mapData[fileName] || {};
}

// fileName とプラットフォーム (narou, kakuyomu) にIDを保存
export function saveEpisodeId(fileName, platform, id) {
  const mapData = loadMap();
  if (!mapData[fileName]) {
    mapData[fileName] = {};
  }
  mapData[fileName][platform] = String(id);
  saveMap(mapData);
}
