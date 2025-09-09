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
    return 80;
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
    return 160;
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
  return nameAreaHeight + minAmidaHeight + prizeAreaHeight;
}

export function getVirtualWidth(numParticipants, containerWidth) {
  const minWidthPerParticipant = 80;
  const calculatedWidth = numParticipants * minWidthPerParticipant;
  return Math.max(containerWidth, calculatedWidth);
}

export function calculatePath(startIdx, allLines, numParticipants, containerWidth, containerHeight, container) {
  const VIRTUAL_WIDTH = getVirtualWidth(numParticipants, containerWidth);
  const path = [];
  const participantSpacing = VIRTUAL_WIDTH / (numParticipants + 1);
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
    if (lineY >= currentY) {
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

export function calculateAllPaths(participants, allLines, containerWidth, containerHeight, container) {
  const numParticipants = participants.length;
  const VIRTUAL_WIDTH = getVirtualWidth(numParticipants, containerWidth);
  const participantSpacing = VIRTUAL_WIDTH / (numParticipants + 1);
  const sortedLines = [...allLines].sort((a, b) => a.y - b.y);


  // 1. 各参加者の理想経路（Ideal Path）を計算
  const idealPaths = participants.map((p, index) => {
    const path = [];
    let currentPathIdx = index;
    sortedLines.forEach((line) => {
      if (line.fromIndex === currentPathIdx || line.toIndex === currentPathIdx) {
        path.push({y: line.y, line});
        currentPathIdx = line.fromIndex === currentPathIdx ? line.toIndex : line.fromIndex;
      }
    });
    return {participantIndex: index, slot: p.slot, name: p.name, idealPath: path};
  });

  // 2. 各水平線ごとに通過する参加者を特定し、オフセットを計算
  const offsets = {}; // { participantIndex: { y_coord: y_offset } }
  const OFFSET_Y = 5; // 5pxずらす

  sortedLines.forEach((line) => {
    const crossingParticipants = idealPaths.filter((p) => p.idealPath.some((step) => step.line === line)).sort((a, b) => a.slot - b.slot); // slot番号でソート

    crossingParticipants.forEach((p, orderIndex) => {
      if (!offsets[p.participantIndex]) {
        offsets[p.participantIndex] = {};
      }
      const sign = orderIndex % 2 === 0 ? -1 : 1;
      const magnitude = Math.ceil(orderIndex / 2);
      const yOffset = orderIndex === 0 ? 0 : magnitude * OFFSET_Y * sign;
      offsets[p.participantIndex][line.y] = yOffset;
    });
  });
  console.groupEnd();

  // 3. 最終的な描画パスを生成
  const finalPaths = {};
  participants.forEach((p, index) => {
    if (!p.name) return;

    const nameAreaHeight = getNameAreaHeight(container);
    const prizeAreaHeight = calculatePrizeAreaHeight(state.currentLotteryData?.prizes);
    const lineTopY = nameAreaHeight;
    const lineBottomY = containerHeight - prizeAreaHeight;
    const amidaDrawableHeight = lineBottomY - lineTopY;
    const sourceLineRange = 330 - 70;

    const finalPath = [];
    let currentPathIdx = index;
    let currentY = lineTopY;

    finalPath.push({x: participantSpacing * (currentPathIdx + 1), y: currentY});

    sortedLines.forEach((line) => {
      const lineYOnCanvas = lineTopY + ((line.y - 70) / sourceLineRange) * amidaDrawableHeight;
      if (line.fromIndex === currentPathIdx || line.toIndex === currentPathIdx) {
        // 1. 水平線まで垂直に移動
        finalPath.push({x: participantSpacing * (currentPathIdx + 1), y: lineYOnCanvas});

        // 2. オフセットを適用して水平移動
        const yOffset = offsets[index]?.[line.y] || 0;
        const nextPathIdx = line.fromIndex === currentPathIdx ? line.toIndex : line.fromIndex;
        const startX = participantSpacing * (currentPathIdx + 1);
        const endX = participantSpacing * (nextPathIdx + 1);
        finalPath.push({x: startX, y: lineYOnCanvas + yOffset});
        finalPath.push({x: endX, y: lineYOnCanvas + yOffset});

        // 3. 本来のY座標に戻る
        finalPath.push({x: endX, y: lineYOnCanvas});

        currentPathIdx = nextPathIdx;
      }
    });

    finalPath.push({x: participantSpacing * (currentPathIdx + 1), y: lineBottomY});
    finalPaths[p.name] = finalPath;
  });

  console.groupEnd();

  return finalPaths;
}

export function calculateClientSideResults(participants, lines, prizes, doodles = []) {
  const results = {};
  if (!participants || !prizes) return results;
  const numParticipants = participants.length;
  const allLines = [...(lines || []), ...(doodles || [])];
  for (let i = 0; i < numParticipants; i++) {
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
      results[participant.name] = {
        prize: prizes[currentPath],
        prizeIndex: currentPath,
        color: participant.color,
      };
    }
  }
  return results;
}
