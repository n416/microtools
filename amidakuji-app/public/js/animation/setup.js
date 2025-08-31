import * as state from '../state.js';
import {animator, isAnimationRunning} from './core.js';
import {calculatePath, getTargetHeight, calculatePrizeAreaHeight} from './path.js';
import {drawLotteryBase, drawTracerPath, drawTracerIcon, drawRevealedPrizes} from './drawing.js';

export let adminPanzoom = null;
export let participantPanzoom = null;
let resizeDebounceTimer;

export function initializePanzoom(canvasElement) {
  if (!canvasElement) return null;

  // ▼▼▼ ここから修正 ▼▼▼
  if (canvasElement.id === 'participantCanvasStatic' && participantPanzoom) {
    return participantPanzoom;
  }
  // ▲▲▲ ここまで修正 ▲▲▲

  const panzoomElement = canvasElement.parentElement;

  const panzoom = Panzoom(panzoomElement, {
    maxScale: 10,
    minScale: 0.1,
    contain: 'outside',
  });

  const container = canvasElement.closest('.canvas-panzoom-container');

  const wheelListener = (event) => {
    if (!event.shiftKey) {
      panzoom.zoomWithWheel(event);
    }
  };

  if (container) {
    if (container._wheelListener) {
      container.removeEventListener('wheel', container._wheelListener);
    }
    container.addEventListener('wheel', wheelListener);
    container._wheelListener = wheelListener;
  }

  if (canvasElement.id === 'adminCanvas') {
    adminPanzoom = panzoom;
  } else if (canvasElement.id === 'participantCanvas' || canvasElement.id === 'participantCanvasStatic') {
    participantPanzoom = panzoom;
  }

  return panzoom;
}

export async function preloadIcons(participants) {
  const newIcons = participants.filter((p) => p && p.name && !animator.icons[p.name]);
  if (newIcons.length === 0) return;
  const promises = newIcons.map((p) => {
    return new Promise((resolve) => {
      const iconUrl = p.iconUrl || `/api/avatar-proxy?name=${encodeURIComponent(p.name)}`;
      const img = new Image();
      img.onload = () => {
        animator.icons[p.name] = img;
        resolve();
      };
      img.onerror = () => {
        animator.icons[p.name] = null;
        resolve();
      };
      img.src = iconUrl;
    });
  });
  await Promise.all(promises);
}

export async function preloadPrizeImages(prizes) {
  if (!prizes) return Promise.resolve();
  const newImages = prizes.filter((p) => p && typeof p === 'object' && p.imageUrl && !animator.prizeImages[p.imageUrl]);
  if (newImages.length === 0) return;
  const promises = newImages.map((p) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        animator.prizeImages[p.imageUrl] = img;
        resolve();
      };
      img.onerror = () => {
        animator.prizeImages[p.imageUrl] = null;
        resolve();
      };
      img.src = p.imageUrl;
    });
  });
  await Promise.all(promises);
}

export function handleResize() {
  console.log('[Animation] Resize event detected.');
  if (isAnimationRunning()) {
    console.log('[Animation] Animation is running, resize will be handled by animationLoop.');
    return;
  }

  console.log('[Animation] Animation is NOT running, redrawing static canvas.');
  const adminCanvas = document.getElementById('adminCanvas');
  const participantCanvas = document.getElementById('participantCanvas');
  const participantCanvasStatic = document.getElementById('participantCanvasStatic');

  if (adminCanvas && adminCanvas.offsetParent !== null) {
    console.log('[Animation] Redrawing admin canvas for resize.');
    const hidePrizes = state.currentLotteryData?.displayMode === 'private';
    prepareStepAnimation(adminCanvas.getContext('2d'), hidePrizes, false, true);
  } else if (participantCanvas && participantCanvas.offsetParent !== null) {
    console.log('[Animation] Redrawing participant canvas for resize.');
    const hidePrizes = state.currentLotteryData?.displayMode === 'private' && state.currentLotteryData?.status !== 'started';
    prepareStepAnimation(participantCanvas.getContext('2d'), hidePrizes, false, true);
  } else if (participantCanvasStatic && participantCanvasStatic.offsetParent !== null) {
    console.log('[Animation] Redrawing static participant canvas for resize.');
    prepareStepAnimation(participantCanvasStatic.getContext('2d'), true, false, true);
  }
}

window.addEventListener('resize', () => {
  clearTimeout(resizeDebounceTimer);
  resizeDebounceTimer = setTimeout(handleResize, 350);
});

export async function prepareStepAnimation(targetCtx, hidePrizes = false, showMask = true, isResize = false, storedState = null) {
  if (!targetCtx || !state.currentLotteryData) {
    console.error('[Animation] Prepare failed: No context or lottery data.');
    return;
  }
  const container = targetCtx.canvas.closest('.canvas-panzoom-container');
  if (!container) return;
  const maskId = targetCtx.canvas.id === 'adminCanvas' ? 'admin-loading-mask' : targetCtx.canvas.id === 'participantCanvas' ? 'participant-loading-mask' : 'participant-loading-mask-static';
  const mask = document.getElementById(maskId);

  if (mask && showMask) mask.style.display = 'flex';
  if (!isResize) {
    state.setRevealedPrizes([]);
    animator.tracers = [];
    animator.icons = {};
    animator.prizeImages = {};
  }
  const allParticipantsWithNames = state.currentLotteryData.participants.filter((p) => p.name);
  const totalParticipants = state.currentLotteryData.participants.length;
  await preloadPrizeImages(state.currentLotteryData.prizes);
  await preloadIcons(allParticipantsWithNames);
  const VIRTUAL_HEIGHT = getTargetHeight(container);

  // ▼▼▼ ここからが修正点 ▼▼▼
  const allLines = [...(state.currentLotteryData.lines || []), ...(state.currentLotteryData.doodles || [])];

  animator.tracers = allParticipantsWithNames.map((p) => {
    // calculatePathに allLines を渡す
    const path = calculatePath(p.slot, allLines, totalParticipants, container.clientWidth, VIRTUAL_HEIGHT, container);
    const isFinished = state.revealedPrizes.some((r) => r.participantName === p.name);
    const finalPoint = isFinished ? path[path.length - 1] : path[0];
    return {
      name: p.name,
      color: p.color || '#333',
      path,
      pathIndex: isFinished ? path.length - 1 : 0,
      x: finalPoint.x,
      y: finalPoint.y,
      isFinished,
      celebrated: isFinished,
    };
  });
  // ▲▲▲ ここまで ▲▲▲
  
  animator.context = targetCtx;
  targetCtx.clearRect(0, 0, targetCtx.canvas.width, targetCtx.canvas.height);
  const isDarkMode = document.body.classList.contains('dark-mode');
  const baseLineColor = isDarkMode ? '#dcdcdc' : '#333';
  drawLotteryBase(targetCtx, state.currentLotteryData, baseLineColor, hidePrizes);

  animator.tracers.forEach((tracer) => {
    if (tracer.isFinished) {
      drawTracerPath(targetCtx, tracer);
    }
    drawTracerIcon(targetCtx, tracer);
  });
  if (state.revealedPrizes.length > 0) {
    drawRevealedPrizes(targetCtx);
  }

  let currentPanzoom = initializePanzoom(targetCtx.canvas);

  if (storedState && currentPanzoom) {
    currentPanzoom.pan(storedState.pan.x, storedState.pan.y, {animate: false});
    currentPanzoom.zoom(storedState.scale, {animate: false});
  } else if (isResize) {
    setTimeout(() => {
      if (container && currentPanzoom) {
        const panzoomElement = targetCtx.canvas.parentElement;
        const canvasWidth = panzoomElement.offsetWidth;
        const containerWidth = container.clientWidth;
        const scale = Math.min(containerWidth / canvasWidth, 1);
        currentPanzoom.zoom(scale, {animate: false});
        const scaledCanvasWidth = canvasWidth * scale;
        const initialX = (containerWidth - scaledCanvasWidth) / 2;
        currentPanzoom.pan(initialX > 0 ? initialX : 0, 0, {animate: false});
      }
    }, 50);
  }

  if (mask && showMask) {
    setTimeout(() => {
      mask.style.display = 'none';
    }, 50);
  }
}
