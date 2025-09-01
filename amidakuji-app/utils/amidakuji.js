// amidakuji-app/utils/amidakuji.js

function generateLines(numParticipants, existingLines = []) { // ★ 修正点: 第2引数 existingLines を追加
  const lines = [];
  const horizontalLines = Math.floor(numParticipants * 2.5);
  const topMargin = 70;
  const bottomMargin = 330;
  const drawableHeight = bottomMargin - topMargin;

  let attempts = 0;
  const maxAttempts = horizontalLines * 20; // 試行回数を十分に確保

  while (lines.length < horizontalLines && attempts < maxAttempts) {
    attempts++;
    const startNode = Math.floor(Math.random() * (numParticipants - 1));
    const endNode = startNode + 1;
    const y = Math.floor(Math.random() * drawableHeight) + topMargin;
    // ▼▼▼ ここから修正 ▼▼▼
    // チェック対象に、既に生成済みの線と、引数で渡された既存の線（落書き）の両方を含める
    const allCurrentLines = [...lines, ...existingLines];

    const isTooClose = allCurrentLines.some((line) => {
      // 同じ、または隣接する縦線区間かをチェック
      if (line.fromIndex === startNode || line.toIndex === startNode || line.fromIndex === endNode) {
        // Y座標が近すぎないかチェック
        if (Math.abs(line.y - y) < 15) {
          return true;
        }
      }
      return false;
    });

    if (!isTooClose) {
      lines.push({fromIndex: startNode, toIndex: endNode, y: y});
    }
    // ▲▲▲ ここまで修正 ▲▲▲
  }
  return lines;
}

function calculateResults(participants, lines, prizes, doodles = []) {
  const results = {};
  const allLines = [...(lines || []), ...(doodles || [])]; // システム線と落書き線を結合

  for (let i = 0; i < participants.length; i++) {
    let currentPath = i;
    const sortedLines = [...allLines].sort((a, b) => a.y - b.y); // 結合した線でソート

    sortedLines.forEach((line) => {
      if (line.fromIndex === currentPath) {
        currentPath = line.toIndex;
      } else if (line.toIndex === currentPath) {
        currentPath = line.fromIndex;
      }
    });
    const participant = participants.find((p) => p.slot === i);
    if (participant && participant.name) {
      results[participant.name] = {
        prize: prizes[currentPath],
        prizeIndex: currentPath,
        color: participant.color,
      };
    }
  }
  return results;
}

module.exports = {
  generateLines,
  calculateResults,
};
