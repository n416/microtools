export function generateLines(numParticipants: number, existingLines: any[] = []) {
  const lines: any[] = [];
  const horizontalLines = Math.floor(numParticipants * 1.8);
  const topMargin = 70;
  const bottomMargin = 330;
  const padding = 20;
  const drawableHeight = bottomMargin - topMargin - padding * 2;

  let attempts = 0;
  const maxAttempts = horizontalLines * 20;

  while (lines.length < horizontalLines && attempts < maxAttempts) {
    attempts++;
    const startNode = Math.floor(Math.random() * (numParticipants - 1));
    const endNode = startNode + 1;
    const y = Math.floor(Math.random() * drawableHeight) + topMargin + padding;
    
    const allCurrentLines = [...lines, ...existingLines];

    const isTooClose = allCurrentLines.some((line) => {
      if (line.fromIndex === startNode || line.toIndex === startNode || line.fromIndex === endNode) {
        if (Math.abs(line.y - y) < 15) {
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

export function calculateResults(participants: any[], lines: any[], prizes: any[], doodles: any[] = []) {
  const results: any = {};
  const allLines = [...(lines || []), ...(doodles || [])];

  for (let i = 0; i < participants.length; i++) {
    let currentPath = i;
    const sortedLines = [...allLines].sort((a, b) => a.y - b.y);

    sortedLines.forEach((line) => {
      if (line.fromIndex === currentPath) {
        currentPath = line.toIndex;
      } else if (line.toIndex === currentPath) {
        currentPath = line.fromIndex;
      }
    });
    const participant = participants.find((p) => p.slot === i);
    if (participant && participant.name) {
      const prize = prizes[currentPath];
      results[participant.name] = {
        prize: {...prize, rank: prize.rank || 'uncommon'},
        prizeIndex: currentPath,
        color: participant.color,
      };
    }
  }
  return results;
}
