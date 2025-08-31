// amidakuji-app/utils/amidakuji.js

function generateLines(numParticipants) {
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

    // 新しい線が、既存の線と「垂直方向」または「水平方向」に近すぎないかをチェック
    const isTooClose = lines.some((line) => {
      // 1. 垂直方向のチェック：同じ区間、または隣接する区間に近すぎる線がないか
      if (line.fromIndex === startNode || line.toIndex === startNode || line.fromIndex === endNode) {
        if (Math.abs(line.y - y) < 15) {
          // 垂直マージンを少し広めに確保
          return true;
        }
      }

      return false;
    });

    if (!isTooClose) {
      lines.push({fromIndex: startNode, toIndex: endNode, y: y});
    }
  }
  return lines;
}

function calculateResults(participants, lines, prizes, doodles = []) { // doodles引数を追加
  const results = {};
  const allLines = [...(lines || []), ...(doodles || [])]; // システム線と落書き線を結合

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
