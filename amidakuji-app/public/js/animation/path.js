import * as state from '../state.js';

function calculateMaxPrizeLines(prizes = []) {
  if (!prizes || prizes.length === 0) return 1;
  const maxLineLength = 5;
  return prizes.reduce((maxLines, prize) => {
    const lines = Math.ceil((prize.name || '').length / maxLineLength);
    return Math.max(maxLines, lines || 1);
  }, 1);
}

export function calculatePrizeAreaHeight(prizes = []) {
  if (!prizes || prizes.length === 0) {
    return 80; // A default minimum height
  }

  return prizes.reduce((maxHeight, prize) => {
    const lines = calculateMaxPrizeLines([prize]);
    const prizeImageHeight = 35;
    const textLineHeight = 18;
    const topMargin = 30;
    const bottomMargin = 20;
    const imageTextGap = 15;
    const hasImage = prize.imageUrl || prize.newImageFile;

    const height = topMargin + bottomMargin + lines * textLineHeight + (hasImage ? prizeImageHeight + imageTextGap : 0);
    return Math.max(maxHeight, height);
  }, 0);
}

export function getNameAreaHeight(container) {
  if (container && container.classList.contains('fullscreen-mode')) {
    return 160; // Use a larger top margin in fullscreen mode
  }
  return 80;
}

export function getTargetHeight(container) {
  const nameAreaHeight = getNameAreaHeight(container);
  const prizeAreaHeight = calculatePrizeAreaHeight(state.currentLotteryData?.prizes);
  const minAmidaHeight = 300;

  if (container && container.classList.contains('fullscreen-mode')) {
    return window.innerHeight;
  }
  // In normal view, calculate a reasonable height
  return nameAreaHeight + minAmidaHeight + prizeAreaHeight;
}

export function getVirtualWidth(numParticipants, containerWidth) {
  const minWidthPerParticipant = 80;
  const calculatedWidth = numParticipants * minWidthPerParticipant;
  return Math.max(containerWidth, calculatedWidth);
}

// ▼▼▼ lines引数を allLines にリネーム ▼▼▼
export function calculatePath(startIdx, allLines, numParticipants, containerWidth, containerHeight, container) {
  const VIRTUAL_WIDTH = getVirtualWidth(numParticipants, containerWidth);
  const path = [];
  const participantSpacing = VIRTUAL_WIDTH / (numParticipants + 1);
  // ▼▼▼ allLines を使うように修正 ▼▼▼
  const sortedLines = [...allLines].sort((a, b) => a.y - b.y);
  const nameAreaHeight = getNameAreaHeight(container);
  const prizeAreaHeight = calculatePrizeAreaHeight(state.currentLotteryData?.prizes);
  const lineTopY = nameAreaHeight;
  const lineBottomY = containerHeight - prizeAreaHeight;
  const amidaDrawableHeight = lineBottomY - lineTopY;

  let currentX = participantSpacing * (startIdx + 1);
  let currentY = lineTopY;
  let currentPathIdx = startIdx;
  path.push({x: currentX, y: currentY});

  const sourceLineRange = 330 - 70;

  sortedLines.forEach((line) => {
    if (sourceLineRange <= 0) return;
    const lineY = lineTopY + ((line.y - 70) / sourceLineRange) * amidaDrawableHeight;
    if (lineY > currentY) {
      if (line.fromIndex === currentPathIdx) {
        path.push({x: currentX, y: lineY});
        currentPathIdx = line.toIndex;
        currentX = participantSpacing * (currentPathIdx + 1);
        path.push({x: currentX, y: lineY});
        currentY = lineY;
      } else if (line.toIndex === currentPathIdx) {
        path.push({x: currentX, y: lineY});
        currentPathIdx = line.fromIndex;
        currentX = participantSpacing * (currentPathIdx + 1);
        path.push({x: currentX, y: lineY});
        currentY = lineY;
      }
    }
  });
  path.push({x: currentX, y: lineBottomY});
  return path;
}

export function calculateClientSideResults(participants, lines, prizes) {
  const results = {};
  if (!participants || !lines || !prizes) return results;
  const numParticipants = participants.length;
  for (let i = 0; i < numParticipants; i++) {
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
