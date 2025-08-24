// amidakuji-app/utils/amidakuji.js

function generateLines(numParticipants) {
  const lines = [];
  const horizontalLines = Math.floor(numParticipants * 2.5);
  const topMargin = 700;
  const bottomMargin = 930;
  const drawableHeight = bottomMargin - topMargin;

  let attempts = 0;
  const maxAttempts = horizontalLines * 10; // 試行回数を増やして生成されやすさを担保

  while (lines.length < horizontalLines && attempts < maxAttempts) {
    attempts++;
    const startNode = Math.floor(Math.random() * (numParticipants - 1));
    const endNode = startNode + 1;
    const y = Math.floor(Math.random() * drawableHeight) + topMargin;

    // --- ▼▼▼ 核心の修正箇所 ▼▼▼ ---
    // 新しい線が、既存の線と近すぎないかをチェック
    const isTooClose = lines.some((line) => {
      // Y座標が5px以内の線だけをチェック対象にする
      if (Math.abs(line.y - y) < 5) {
        // 新しい線の左右の縦線に、近すぎる線が既に接続されていないかチェック
        // (例: 新しい線が5-6間の場合、4-5間、5-6間、6-7間の線をチェック)
        if (line.toIndex === startNode || line.fromIndex === startNode || line.fromIndex === endNode) {
          return true;
        }
      }
      return false;
    });
    // --- ▲▲▲ 修正ここまで ▲▲▲ ---

    if (!isTooClose) {
      lines.push({fromIndex: startNode, toIndex: endNode, y: y});
    }
  }
  return lines;
}

function calculateResults(participants, lines, prizes) {
  const results = {};
  for (let i = 0; i < participants.length; i++) {
    let currentPath = i;
    const sortedLines = [...lines].sort((a, b) => a.y - b.y);

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
