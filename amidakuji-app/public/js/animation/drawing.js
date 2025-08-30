import * as state from '../state.js';
import {animator, isAnimationRunning, stopAnimation} from './core.js';
import {getTargetHeight, getVirtualWidth, getNameAreaHeight, calculatePrizeAreaHeight, calculatePath} from './path.js';
import {preloadIcons} from './setup.js';

export function wrapText(context, text, x, y, lineLength, lineHeight) {
  let currentY = y;
  for (let i = 0; i < text.length; i += lineLength) {
    const line = text.substring(i, i + lineLength);
    context.fillText(line, x, currentY);
    currentY += lineHeight;
  }
}

export function drawLotteryBase(targetCtx, data, lineColor = '#ccc', hidePrizes = false) {
  if (!targetCtx || !targetCtx.canvas || !data || !data.participants || data.participants.length === 0) return;
  const container = targetCtx.canvas.closest('.canvas-panzoom-container');
  if (!container) return;
  const panzoomElement = targetCtx.canvas.parentElement;
  const {participants, prizes, lines} = data;
  const numParticipants = participants.length;
  const containerWidth = container.clientWidth || 800;
  const VIRTUAL_WIDTH = getVirtualWidth(numParticipants, containerWidth);
  const VIRTUAL_HEIGHT = getTargetHeight(container);
  const canvas = targetCtx.canvas;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = VIRTUAL_WIDTH * dpr;
  canvas.height = VIRTUAL_HEIGHT * dpr;
  canvas.style.width = `${VIRTUAL_WIDTH}px`;
  canvas.style.height = `${VIRTUAL_HEIGHT}px`;
  targetCtx.scale(dpr, dpr);
  if (panzoomElement) {
    panzoomElement.style.width = `${VIRTUAL_WIDTH}px`;
    panzoomElement.style.height = `${VIRTUAL_HEIGHT}px`;
  }
  const participantSpacing = VIRTUAL_WIDTH / (numParticipants + 1);
  targetCtx.font = '14px Arial';
  targetCtx.textAlign = 'center';

  const isDarkMode = document.body.classList.contains('dark-mode');
  const mainTextColor = isDarkMode ? '#e0e0e0' : '#000';
  const subTextColor = isDarkMode ? '#888' : '#888';
  const prizeTextColor = isDarkMode ? '#e0e0e0' : '#333';

  const nameAreaHeight = getNameAreaHeight(container);
  const prizeAreaHeight = calculatePrizeAreaHeight(prizes);
  const lineTopY = nameAreaHeight;
  const lineBottomY = VIRTUAL_HEIGHT - prizeAreaHeight;
  const nameY = lineTopY / 2;

  participants.forEach((p, i) => {
    const x = participantSpacing * (i + 1);

    const isAdminView = targetCtx.canvas.id === 'adminCanvas';
    const displayName = p.name || `（参加枠 ${p.slot + 1}）`;

    targetCtx.fillStyle = p.name ? mainTextColor : subTextColor;
    targetCtx.fillText(displayName, x, nameY);
    const isRevealed = state.revealedPrizes.some((r) => r.prizeIndex === i);
    if (prizes && prizes[i] && !isRevealed) {
      const prize = prizes[i];
      const prizeName = hidePrizes ? '？？？' : prize.name || '';
      const prizeImage = !hidePrizes && (prize.imageUrl || prize.newImageFile) ? animator.prizeImages[prize.imageUrl] : null;

      const prizeImageHeight = 35;
      const prizeAreaTopMargin = 30;
      const imageTextGap = 15;
      let prizeTextY;

      if (prizeImage && prizeImage.complete) {
        const prizeImageY = lineBottomY + prizeAreaTopMargin + prizeImageHeight / 2;
        prizeTextY = prizeImageY + prizeImageHeight / 2 + imageTextGap;
        targetCtx.drawImage(prizeImage, x - prizeImageHeight / 2, prizeImageY - prizeImageHeight / 2, prizeImageHeight, prizeImageHeight);
      } else {
        prizeTextY = lineBottomY + prizeAreaTopMargin + 18; // Adjust Y for text-only prizes
      }
      targetCtx.fillStyle = prizeTextColor;
      const lineHeight = 18;
      const maxLineLength = 5;
      wrapText(targetCtx, prizeName, x, prizeTextY, maxLineLength, lineHeight);
    }
  });

  targetCtx.strokeStyle = lineColor;
  targetCtx.lineWidth = 1.5;
  for (let i = 0; i < numParticipants; i++) {
    const x = participantSpacing * (i + 1);
    targetCtx.beginPath();
    targetCtx.moveTo(x, lineTopY);
    targetCtx.lineTo(x, lineBottomY);
    targetCtx.stroke();
  }
  if (lines) {
    const amidaDrawableHeight = lineBottomY - lineTopY;
    const sourceLineRange = 330 - 70;
    lines.forEach((line) => {
      if (sourceLineRange <= 0) return;
      const startX = participantSpacing * (line.fromIndex + 1);
      const endX = participantSpacing * (line.toIndex + 1);
      const lineY = lineTopY + ((line.y - 70) / sourceLineRange) * amidaDrawableHeight;
      targetCtx.beginPath();
      targetCtx.moveTo(startX, lineY);
      targetCtx.lineTo(endX, lineY);
      targetCtx.stroke();
    });
  }
}

export function drawTracerPath(targetCtx, tracer) {
  targetCtx.strokeStyle = tracer.color;
  targetCtx.lineWidth = 4;
  targetCtx.lineCap = 'round';
  targetCtx.shadowColor = tracer.color;
  targetCtx.shadowBlur = 15;
  targetCtx.beginPath();
  targetCtx.moveTo(tracer.path[0].x, tracer.path[0].y);
  for (let i = 1; i <= tracer.pathIndex; i++) {
    targetCtx.lineTo(tracer.path[i].x, tracer.path[i].y);
  }
  targetCtx.lineTo(tracer.x, tracer.y);
  targetCtx.stroke();
  targetCtx.shadowColor = 'transparent';
  targetCtx.shadowBlur = 0;
}

export function drawTracerIcon(targetCtx, tracer) {
  const container = targetCtx.canvas.closest('.canvas-panzoom-container');
  if (!container) return;
  const VIRTUAL_HEIGHT = getTargetHeight(container);
  const iconSize = Math.min(VIRTUAL_HEIGHT * 0.06, 30);
  const icon = animator.icons[tracer.name];
  targetCtx.save();
  targetCtx.beginPath();
  targetCtx.arc(tracer.x, tracer.y, iconSize / 2 + 2, 0, Math.PI * 2, true);
  targetCtx.fillStyle = 'white';
  targetCtx.fill();
  targetCtx.lineWidth = 2;
  targetCtx.strokeStyle = tracer.color;
  targetCtx.stroke();
  targetCtx.clip();
  if (icon) {
    targetCtx.drawImage(icon, tracer.x - iconSize / 2, tracer.y - iconSize / 2, iconSize, iconSize);
  } else {
    targetCtx.beginPath();
    targetCtx.arc(tracer.x, tracer.y, iconSize / 2, 0, Math.PI * 2, true);
    targetCtx.fillStyle = tracer.color;
    targetCtx.fill();
  }
  targetCtx.restore();
}

export function drawRevealedPrizes(targetCtx) {
  const container = targetCtx.canvas.closest('.canvas-panzoom-container');
  if (!container) return;
  const VIRTUAL_HEIGHT = getTargetHeight(container);
  const numParticipants = state.currentLotteryData.participants.length;
  const VIRTUAL_WIDTH = getVirtualWidth(numParticipants, container.clientWidth);
  const participantSpacing = VIRTUAL_WIDTH / (numParticipants + 1);
  const isDarkMode = document.body.classList.contains('dark-mode');
  targetCtx.fillStyle = isDarkMode ? '#e0e0e0' : '#333';

  const prizeAreaHeight = calculatePrizeAreaHeight(state.currentLotteryData?.prizes);
  const lineBottomY = VIRTUAL_HEIGHT - prizeAreaHeight;

  state.revealedPrizes.forEach((result) => {
    const prize = result.prize;
    const prizeName = typeof prize === 'object' ? prize.name : prize;
    const prizeImage = typeof prize === 'object' && prize.imageUrl ? animator.prizeImages[prize.imageUrl] : null;
    const x = participantSpacing * (result.prizeIndex + 1);

    const prizeImageHeight = 35;
    const prizeAreaTopMargin = 30;
    const imageTextGap = 15;
    let prizeTextY;

    // This block handles the prize reveal animation (scaling effect)
    const REVEAL_DURATION = 15;
    let scale = 1.0;
    if (result.revealProgress < REVEAL_DURATION) {
      result.revealProgress++;
      const t = result.revealProgress / REVEAL_DURATION;
      scale = 1.0 + 0.5 * Math.sin(t * Math.PI);
    }
    const imageSize = prizeImageHeight * scale;

    if (prizeImage && prizeImage.complete) {
      const prizeImageY = lineBottomY + prizeAreaTopMargin + prizeImageHeight / 2;
      prizeTextY = prizeImageY + prizeImageHeight / 2 + imageTextGap;
      targetCtx.drawImage(prizeImage, x - imageSize / 2, prizeImageY - imageSize / 2, imageSize, imageSize);
    } else {
      prizeTextY = lineBottomY + prizeAreaTopMargin + 18; // Adjust Y for text-only prizes
    }
    wrapText(targetCtx, prizeName, x, prizeTextY, 5, 18);
  });
}

export async function showAllTracersInstantly() {
  if (isAnimationRunning()) stopAnimation();

  const targetCtx = animator.context;
  if (!targetCtx || !state.currentLotteryData) return;

  const container = targetCtx.canvas.closest('.canvas-panzoom-container');
  if (!container) return;

  const allParticipantsWithNames = state.currentLotteryData.participants.filter((p) => p.name);

  await preloadIcons(allParticipantsWithNames);

  const VIRTUAL_HEIGHT = getTargetHeight(container);
  const numParticipants = state.currentLotteryData.participants.length;

  const allResults = state.currentLotteryData.results;
  const allPrizes = state.currentLotteryData.prizes;
  if (allResults && allPrizes) {
    const allRevealedPrizes = Object.keys(allResults)
      .map((participantName) => {
        const result = allResults[participantName];
        if (!result) return null;
        const prizeIndex = result.prizeIndex;
        const realPrize = allPrizes[prizeIndex];
        if (typeof prizeIndex !== 'undefined' && prizeIndex > -1 && realPrize) {
          return {
            participantName,
            prize: realPrize,
            prizeIndex,
            revealProgress: 15,
          }; // 15 is max
        }
        return null;
      })
      .filter(Boolean);
    state.setRevealedPrizes(allRevealedPrizes);
  }

  animator.tracers = allParticipantsWithNames.map((p) => {
    const path = calculatePath(p.slot, state.currentLotteryData.lines, numParticipants, container.clientWidth, VIRTUAL_HEIGHT, container);
    const finalPoint = path[path.length - 1];
    return {
      name: p.name,
      color: p.color || '#333',
      path,
      pathIndex: path.length - 1,
      x: finalPoint.x,
      y: finalPoint.y,
      isFinished: true,
      celebrated: true,
    };
  });

  targetCtx.clearRect(0, 0, targetCtx.canvas.width, targetCtx.canvas.height);
  const isDarkMode = document.body.classList.contains('dark-mode');
  const baseLineColor = isDarkMode ? '#dcdcdc' : '#333';
  const hidePrizes = state.currentLotteryData.displayMode === 'private' && state.currentLotteryData.status !== 'started';

  drawLotteryBase(targetCtx, state.currentLotteryData, baseLineColor, hidePrizes);

  animator.tracers.forEach((tracer) => {
    drawTracerPath(targetCtx, tracer);
    drawTracerIcon(targetCtx, tracer);
  });

  drawRevealedPrizes(targetCtx);
}
