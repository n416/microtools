function generateLines(numParticipants) {
  const lines = [];
  const horizontalLines = Math.floor(numParticipants * 2.5);
  const canvasHeight = 400;

  for (let i = 0; i < horizontalLines; i++) {
    const startNode = Math.floor(Math.random() * (numParticipants - 1));
    const endNode = startNode + 1;
    const y = Math.floor(Math.random() * (canvasHeight - 80)) + 40;

    const isTooClose = lines.some((line) => line.fromIndex === startNode && Math.abs(line.y - y) < 20);

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
      results[participant.name] = {prize: prizes[currentPath], color: participant.color};
    }
  }
  return results;
}

module.exports = {
  generateLines,
  calculateResults,
};
