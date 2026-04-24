import crypto from 'node:crypto';

// 形容詞リスト
const adjectives = [
  '赤い', '青い', '緑の', '黄色い', '黒い', '白い', '明るい', '暗い', '静かなる', '賑やかな',
  '速い', '遅い', '高い', '低い', '大きい', '小さい', '新しい', '古い', '美しい', '不思議な',
  '輝く', 'そよぐ', '眠れる', '歌う', '踊る', '隠れたる', '忘れられた', '伝説の', '永遠の', '一瞬の'
];

// 名詞リスト
const nouns = [
  '川', '山', '空', '海', '星', '月', '太陽', '花', '木', '石',
  '風', '雨', '雪', '雲', '光', '影', '夢', '幻', '旅人', '賢者',
  '戦士', '魔法使い', '森', '砂漠', '都市', '遺跡', '宝物', '剣', '盾', '夕日'
];

export function generateAnonymousName(userId: string): string {
  if (!userId) {
    return '名無しの存在';
  }

  const hash = crypto.createHash('sha256').update(userId).digest();
  
  const adjIndex = hash.readUInt16BE(0) % adjectives.length;
  const nounIndex = hash.readUInt16BE(2) % nouns.length;

  return `${adjectives[adjIndex]}${nouns[nounIndex]}`;
}
