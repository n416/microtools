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

  console.group(`[Amida Path Debug] Collision Resolution Calculation`);

  // 1. 各参加者の基本経路（どの水平線をいつ通過するか）を計算
  const basePaths = participants.map((p, index) => {
    let currentPathIdx = index;
    const checkpoints = [];
    let currentTime = 70;

    sortedLines.forEach((line) => {
      if (line.fromIndex === currentPathIdx || line.toIndex === currentPathIdx) {
        const prevY = checkpoints.length > 0 ? checkpoints[checkpoints.length - 1].y : 70;
        currentTime += Math.abs(line.y - prevY);

        checkpoints.push({y: line.y, arrivalTime: currentTime, line});

        currentTime += participantSpacing;
        currentPathIdx = line.fromIndex === currentPathIdx ? line.toIndex : line.fromIndex;
      }
    });
    return checkpoints;
  });

  // 2. 各水平線ごとに通過情報を集約
  const crossingsByLine = {};
  basePaths.forEach((checkpoints, pIndex) => {
    checkpoints.forEach((cp) => {
      const lineY = cp.line.y;
      if (!crossingsByLine[lineY]) {
        crossingsByLine[lineY] = [];
      }
      crossingsByLine[lineY].push({
        participantIndex: pIndex,
        arrivalTime: cp.arrivalTime,
        name: participants.find((p) => p.slot === pIndex)?.name,
      });
    });
  });

  // 3. 各水平線ごとにオフセットを計算
  const offsets = {}; // { participantIndex: { y_coord: y_offset } }
  const OFFSET_Y = 3;

  console.log('Crossings grouped by horizontal line:', crossingsByLine);

  for (const y in crossingsByLine) {
    const crossings = crossingsByLine[y];
    crossings.sort((a, b) => a.arrivalTime - b.arrivalTime);

    console.group(`Line at Y=${y}`);
    console.log('Sorted Crossings:', crossings);

    let offsetCounter = 0;
    crossings.forEach((crossing) => {
      if (!offsets[crossing.participantIndex]) {
        offsets[crossing.participantIndex] = {};
      }
      const sign = offsetCounter % 2 === 0 ? 1 : -1;
      const magnitude = Math.ceil(offsetCounter / 2);
      const yOffset = offsetCounter === 0 ? 0 : magnitude * OFFSET_Y * sign;
      offsets[crossing.participantIndex][y] = yOffset;

      console.log(` -> [${crossing.name}] gets Y-Offset: ${yOffset}px`);
      offsetCounter++;
    });
    console.groupEnd();
  }

  console.log('Final Calculated Offsets:', offsets);
  console.groupEnd();

  // 4. 最終的な描画パスを生成
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
