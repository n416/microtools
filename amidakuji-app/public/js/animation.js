import * as state from './state.js'; // この行を追記
import {startAnimation, stopAnimation, isAnimationRunning, resetAnimation, advanceLineByLine, animator} from './animation/core.js';
import {drawLotteryBase, drawTracerPath, drawTracerIcon, drawRevealedPrizes, wrapText, showAllTracersInstantly} from './animation/drawing.js';
import {calculatePath, getVirtualWidth, getTargetHeight, calculatePrizeAreaHeight, getNameAreaHeight, calculateClientSideResults} from './animation/path.js';
import {prepareStepAnimation, initializePanzoom, preloadIcons, preloadPrizeImages, handleResize, adminPanzoom, participantPanzoom} from './animation/setup.js';
import {Particle, createSparks, celebrate} from './animation/effects.js';

let prizeFadeAnimationId;

// ★★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★★★ ここからが修正点 ★★★
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★
function drawPrizesOnly(targetCtx, hidePrizes) {
  if (!targetCtx || !targetCtx.canvas || !state.currentLotteryData) return;

  const {participants, prizes} = state.currentLotteryData;
  const container = targetCtx.canvas.closest('.canvas-panzoom-container');
  if (!container) return;
  const numParticipants = participants.length;
  const VIRTUAL_WIDTH = getVirtualWidth(numParticipants, container.clientWidth);
  const VIRTUAL_HEIGHT = getTargetHeight(container);
  const participantSpacing = VIRTUAL_WIDTH / (numParticipants + 1);
  const prizeAreaHeight = calculatePrizeAreaHeight(prizes);
  const lineBottomY = VIRTUAL_HEIGHT - prizeAreaHeight;
  const isDarkMode = document.body.classList.contains('dark-mode');
  const prizeTextColor = isDarkMode ? '#e0e0e0' : '#333';

  // Clear only the prize area
  targetCtx.clearRect(0, lineBottomY, VIRTUAL_WIDTH, prizeAreaHeight);

  // Redraw prizes
  prizes.forEach((prize, i) => {
    const isRevealed = state.revealedPrizes.some((r) => r.prizeIndex === i);
    if (!isRevealed) {
      const x = participantSpacing * (i + 1);
      const prizeName = hidePrizes ? '' : prize.name || '';
      const prizeImage = !hidePrizes && prize.imageUrl ? animator.prizeImages[prize.imageUrl] : null;

      const prizeImageHeight = 35;
      const prizeAreaTopMargin = 30;
      const imageTextGap = 15;
      let prizeTextY;

      if (prizeImage && prizeImage.complete) {
        const prizeImageY = lineBottomY + prizeAreaTopMargin + prizeImageHeight / 2;
        prizeTextY = prizeImageY + prizeImageHeight / 2 + imageTextGap;
        targetCtx.drawImage(prizeImage, x - prizeImageHeight / 2, prizeImageY - prizeImageHeight / 2, prizeImageHeight, prizeImageHeight);
      } else {
        prizeTextY = lineBottomY + prizeAreaTopMargin + 18;
      }
      targetCtx.fillStyle = prizeTextColor;
      wrapText(targetCtx, prizeName, x, prizeTextY, 5, 18);
    }
  });

  // Redraw any revealed prizes that might be in this area
  drawRevealedPrizes(targetCtx);
}

export function fadePrizes(targetCtx, show) {
  if (!targetCtx || !targetCtx.canvas) return;
  cancelAnimationFrame(prizeFadeAnimationId);

  const duration = 200;
  let start = null;

  function step(timestamp) {
    if (!start) start = timestamp;
    const progress = timestamp - start;
    const ratio = Math.min(progress / duration, 1);

    // Fade-in: 0 to 1, Fade-out: 1 to 0
    const alpha = show ? ratio : 1 - ratio;

    targetCtx.globalAlpha = alpha;
    drawPrizesOnly(targetCtx, false); // Always draw names when fading in/out
    targetCtx.globalAlpha = 1;

    if (progress < duration) {
      prizeFadeAnimationId = requestAnimationFrame(step);
    } else {
      // Ensure final state is drawn correctly
      if (!show) {
        drawPrizesOnly(targetCtx, true);
      }
    }
  }

  prizeFadeAnimationId = requestAnimationFrame(step);
}

export {startAnimation, stopAnimation, isAnimationRunning, resetAnimation, advanceLineByLine, prepareStepAnimation, showAllTracersInstantly, adminPanzoom, participantPanzoom};
