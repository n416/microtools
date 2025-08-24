// amidakuji-app/public/js/animation.js

import * as state from './state.js';

let animationFrameId;
let adminPanzoom = null;
let participantPanzoom = null;
let resizeDebounceTimer;

const animator = {
  tracers: [],
  icons: {},
  prizeImages: {},
  particles: [],
  running: false,
  onComplete: null,
  context: null,
  lastContainerWidth: 0,
  lastContainerHeight: 0,
};

function ensureResultsFormat(data) {
  if (!data.results || Object.keys(data.results).length === 0) {
    console.log('[Animation] No results found, calculating on client-side.');
    return calculateClientSideResults(data.participants, data.lines, data.prizes);
  }

  const firstResult = Object.values(data.results)[0];
  if (typeof firstResult.prizeIndex !== 'undefined') {
    console.log('[Animation] Results format is up-to-date.');
    return data.results;
  }

  console.warn('[Animation] Outdated results format detected. Recalculating on client-side to add prizeIndex.');
  return calculateClientSideResults(data.participants, data.lines, data.prizes);
}

function handleResize() {
  console.log('[Animation] Resize event detected.');
  if (isAnimationRunning()) {
    console.log('[Animation] Animation is running, resize will be handled by animationLoop.');
    return;
  }

  console.log('[Animation] Animation is NOT running, redrawing static canvas.');
  const adminCanvas = document.getElementById('adminCanvas');
  const participantCanvas = document.getElementById('participantCanvas');

  if (adminCanvas && adminCanvas.offsetParent !== null) {
    console.log('[Animation] Redrawing admin canvas for resize.');
    const hidePrizes = state.currentLotteryData?.displayMode === 'private';
    prepareStepAnimation(adminCanvas.getContext('2d'), hidePrizes, false, true);
  } else if (participantCanvas && participantCanvas.offsetParent !== null) {
    console.log('[Animation] Redrawing participant canvas for resize.');
    const hidePrizes = state.currentLotteryData?.displayMode === 'private' && state.currentLotteryData?.status !== 'started';
    prepareStepAnimation(participantCanvas.getContext('2d'), hidePrizes, false, true);
  }
}

window.addEventListener('resize', () => {
  clearTimeout(resizeDebounceTimer);
  resizeDebounceTimer = setTimeout(handleResize, 350);
});

function getTargetHeight(container) {
  if (container && container.classList.contains('fullscreen-mode')) {
    return window.innerHeight;
  }
  return 400;
}

function calculateClientSideResults(participants, lines, prizes) {
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

class Particle {
  constructor(x, y, color, type = 'trail') {
    this.x = x;
    this.y = y;
    this.color = color;
    this.type = type;
    this.size = Math.random() * 2 + 1;
    this.alpha = 1;
    if (type === 'spark') {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 1;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.life = 30;
    } else {
      this.vx = (Math.random() - 0.5) * 0.5;
      this.vy = (Math.random() - 0.5) * 0.5;
      this.life = 50;
    }
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
    if (this.life < 20) {
      this.alpha = this.life / 20;
    }
  }
  draw(ctx) {
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function createSparks(x, y, color) {
  for (let i = 0; i < 20; i++) {
    animator.particles.push(new Particle(x, y, color, 'spark'));
  }
}

function celebrate(originX, color) {
  const container = animator.context.canvas.closest('.canvas-panzoom-container');
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const x = (rect.left + originX) / window.innerWidth;
  // confetti({particleCount: 100, spread: 70, origin: {x: x, y: 0.8}, colors: [color, '#ffffff']});
}

export function isAnimationRunning() {
  return animator.running;
}

function initializePanzoom(canvasElement) {
  if (!canvasElement) return null;
  const panzoomElement = canvasElement.parentElement;
  if (canvasElement.id === 'adminCanvas' && adminPanzoom) {
    adminPanzoom.destroy();
    adminPanzoom = null;
  }
  if (canvasElement.id === 'participantCanvas' && participantPanzoom) {
    participantPanzoom.destroy();
    participantPanzoom = null;
  }
  const panzoom = Panzoom(panzoomElement, {maxScale: 10, minScale: 0.1, contain: 'outside'});
  const container = canvasElement.closest('.canvas-panzoom-container');
  if (container) {
    container.addEventListener('wheel', (event) => {
      if (!event.shiftKey) {
        panzoom.zoomWithWheel(event);
      }
    });
  }
  return panzoom;
}

export function stopAnimation() {
  console.trace('%c[Animation] Stop requested.', 'color: red');
  animator.running = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
}

function getVirtualWidth(numParticipants, containerWidth) {
  const minWidthPerParticipant = 80;
  const calculatedWidth = numParticipants * minWidthPerParticipant;
  return Math.max(containerWidth, calculatedWidth);
}

function calculatePath(startIdx, lines, numParticipants, containerWidth, containerHeight) {
  const VIRTUAL_WIDTH = getVirtualWidth(numParticipants, containerWidth);
  const path = [];
  const participantSpacing = VIRTUAL_WIDTH / (numParticipants + 1);
  const sortedLines = [...lines].sort((a, b) => a.y - b.y);
  let currentX = participantSpacing * (startIdx + 1);
  let currentY = containerHeight * 0.125;
  let currentPathIdx = startIdx;
  path.push({x: currentX, y: currentY});
  sortedLines.forEach((line) => {
    const lineY = containerHeight * (line.y / 400);
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
  path.push({x: currentX, y: containerHeight * 0.875});
  return path;
}

async function preloadIcons(participants) {
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

async function preloadPrizeImages(prizes) {
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

function drawRevealedPrizes(targetCtx) {
  const container = targetCtx.canvas.closest('.canvas-panzoom-container');
  if (!container) return;
  const numParticipants = state.currentLotteryData.participants.length;
  const VIRTUAL_HEIGHT = getTargetHeight(container);
  const VIRTUAL_WIDTH = getVirtualWidth(numParticipants, container.clientWidth);
  const participantSpacing = VIRTUAL_WIDTH / (numParticipants + 1);
  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  targetCtx.fillStyle = isDarkMode ? '#dcdcdc' : '#333';
  const prizeImageY = VIRTUAL_HEIGHT * 0.925;
  const prizeTextY = VIRTUAL_HEIGHT * 0.98;

  state.revealedPrizes.forEach((result) => {
    const prize = result.prize;
    const prizeName = typeof prize === 'object' ? prize.name : prize;
    const prizeImage = typeof prize === 'object' && prize.imageUrl ? animator.prizeImages[prize.imageUrl] : null;
    const x = participantSpacing * (result.prizeIndex + 1);
    const REVEAL_DURATION = 15;
    let scale = 1.0;
    if (result.revealProgress < REVEAL_DURATION) {
      result.revealProgress++;
      const t = result.revealProgress / REVEAL_DURATION;
      scale = 1.0 + 0.5 * Math.sin(t * Math.PI);
    }
    const imageSize = VIRTUAL_HEIGHT * 0.075 * scale;
    if (prizeImage && prizeImage.complete) {
      targetCtx.drawImage(prizeImage, x - imageSize / 2, prizeImageY - imageSize / 2, imageSize, imageSize);
    }
    targetCtx.fillText(prizeName, x, prizeTextY);
  });
}

function drawLotteryBase(targetCtx, data, lineColor = '#ccc', hidePrizes = false) {
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
  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const mainTextColor = isDarkMode ? '#e0e0e0' : '#000';
  const subTextColor = isDarkMode ? '#888' : '#888';
  const prizeTextColor = isDarkMode ? '#dcdcdc' : '#333';
  const nameY = VIRTUAL_HEIGHT * 0.075;
  const prizeImageY = VIRTUAL_HEIGHT * 0.925;
  const prizeTextY = VIRTUAL_HEIGHT * 0.98;
  const lineTopY = VIRTUAL_HEIGHT * 0.125;
  const lineBottomY = VIRTUAL_HEIGHT * 0.875;
  const prizeImageSize = VIRTUAL_HEIGHT * 0.075;

  participants.forEach((p, i) => {
    const x = participantSpacing * (i + 1);
    const displayName = p.name || `（参加枠 ${p.slot + 1}）`;
    targetCtx.fillStyle = p.name ? mainTextColor : subTextColor;
    targetCtx.fillText(displayName, x, nameY);
    const isRevealed = state.revealedPrizes.some((r) => r.prizeIndex === i);
    if (prizes && prizes[i] && !isRevealed) {
      const prize = prizes[i];
      const prizeName = hidePrizes ? '？？？' : typeof prize === 'object' ? prize.name : prize;
      const prizeImage = !hidePrizes && typeof prize === 'object' && prize.imageUrl ? animator.prizeImages[prize.imageUrl] : null;
      if (prizeImage && prizeImage.complete) {
        targetCtx.drawImage(prizeImage, x - prizeImageSize / 2, prizeImageY - prizeImageSize / 2, prizeImageSize, prizeImageSize);
      }
      targetCtx.fillStyle = prizeTextColor;
      targetCtx.fillText(prizeName, x, prizeTextY);
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
    lines.forEach((line) => {
      const startX = participantSpacing * (line.fromIndex + 1);
      const endX = participantSpacing * (line.toIndex + 1);
      const lineY = VIRTUAL_HEIGHT * (line.y / 400);
      targetCtx.beginPath();
      targetCtx.moveTo(startX, lineY);
      targetCtx.lineTo(endX, lineY);
      targetCtx.stroke();
    });
  }
}

function animationLoop() {
  if (!animator.running) {
    return;
  }
  const targetCtx = animator.context;
  if (!targetCtx || !targetCtx.canvas) {
    stopAnimation();
    return;
  }
  const container = targetCtx.canvas.closest('.canvas-panzoom-container');
  if (!container) {
    stopAnimation();
    return;
  }
  const currentContainerWidth = container.clientWidth;
  const currentContainerHeight = getTargetHeight(container);
  if (currentContainerWidth !== animator.lastContainerWidth || currentContainerHeight !== animator.lastContainerHeight) {
    console.log(`[Animation] Container resized. Recalculating paths.`);
    const numParticipants = state.currentLotteryData.participants.length;
    animator.tracers.forEach((tracer) => {
      const participant = state.currentLotteryData.participants.find((p) => p.name === tracer.name);
      if (!participant) return;
      const newPath = calculatePath(participant.slot, state.currentLotteryData.lines, numParticipants, currentContainerWidth, currentContainerHeight);
      tracer.path = newPath;
      if (tracer.isFinished) {
        const finalPoint = newPath[newPath.length - 1];
        tracer.x = finalPoint.x;
        tracer.y = finalPoint.y;
      }
    });
    animator.lastContainerWidth = currentContainerWidth;
    animator.lastContainerHeight = currentContainerHeight;
  }
  const numParticipants = state.currentLotteryData.participants.length;
  const baseSpeed = 4;
  const reductionFactor = Math.min(0.5, Math.floor(Math.max(0, numParticipants - 10) / 10) * 0.1);
  const dynamicSpeed = baseSpeed * (1 - reductionFactor);
  targetCtx.clearRect(0, 0, targetCtx.canvas.width, targetCtx.canvas.height);
  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const baseLineColor = isDarkMode ? '#444' : '#e0e0e0';

  const hidePrizes = state.currentLotteryData.displayMode === 'private';

  drawLotteryBase(targetCtx, state.currentLotteryData, baseLineColor, hidePrizes);
  drawRevealedPrizes(targetCtx);
  animator.particles = animator.particles.filter((p) => p.life > 0);
  animator.particles.forEach((p) => {
    p.update();
    p.draw(targetCtx);
  });

  let allTracersFinished = true;
  animator.tracers.forEach((tracer) => {
    if (tracer.isFinished) {
      drawTracerPath(targetCtx, tracer);
    } else {
      allTracersFinished = false;
      updateTracerPosition(tracer, dynamicSpeed);
      drawTracerPath(targetCtx, tracer);
      if (Math.random() > 0.5) {
        animator.particles.push(new Particle(tracer.x, tracer.y, tracer.color));
      }
    }
    drawTracerIcon(targetCtx, tracer);
  });

  // --- ▼▼▼ 修正箇所 ▼▼▼ ---
  const isRevealingPrizes = state.revealedPrizes.some((p) => p.revealProgress < 15);
  const particlesRemaining = animator.particles.length > 0;

  // 全トレーサー終了 & 全景品アニメーション終了 & 全パーティクル消滅でループ停止
  if (allTracersFinished && !isRevealingPrizes && !particlesRemaining) {
    animator.running = false;
    if (animator.onComplete) animator.onComplete();
  } else {
    animationFrameId = requestAnimationFrame(animationLoop);
  }
  // --- ▲▲▲ 修正ここまで ▲▲▲ ---
}

function updateTracerPosition(tracer, speed) {
  const revealPrize = () => {
    const targetCanvasId = animator.context.canvas.id;
    if (targetCanvasId === 'adminCanvas') {
      const resultExists = state.revealedPrizes.some((r) => r.participantName === tracer.name);
      if (!resultExists) {
        const result = state.currentLotteryData.results[tracer.name];
        if (result) {
          const prizeIndex = result.prizeIndex;
          const realPrize = state.currentLotteryData.prizes[prizeIndex];
          if (typeof prizeIndex !== 'undefined' && prizeIndex > -1 && realPrize) {
            console.log(`[Animation] Revealing prize for ${tracer.name}:`, realPrize);
            state.revealedPrizes.push({participantName: tracer.name, prize: realPrize, prizeIndex, revealProgress: 0});
          }
        }
      }
    } else if (targetCanvasId === 'participantCanvas' && state.revealedPrizes.length === 0) {
      const allResults = state.currentLotteryData.results;
      const allPrizes = state.currentLotteryData.prizes;
      const newRevealedPrizes = Object.keys(allResults)
        .map((participantName) => {
          const result = allResults[participantName];
          const prizeIndex = result.prizeIndex;
          const realPrize = allPrizes[prizeIndex];
          if (typeof prizeIndex !== 'undefined' && prizeIndex > -1 && realPrize) {
            return {participantName, prize: realPrize, prizeIndex, revealProgress: 0};
          }
          return null;
        })
        .filter(Boolean);
      if (newRevealedPrizes.length > 0) {
        state.setRevealedPrizes(newRevealedPrizes);
      }
    }
  };
  if (tracer.stopY && tracer.y >= tracer.stopY) {
    const start = tracer.path[tracer.pathIndex];
    const end = tracer.path[tracer.pathIndex + 1];
    if (end && start.y < tracer.stopY && end.y >= tracer.stopY) {
      const ratio = (tracer.stopY - start.y) / (end.y - start.y);
      tracer.x = start.x + (end.x - start.x) * ratio;
    }
    tracer.y = tracer.stopY;
    tracer.isFinished = true;
    delete tracer.stopY;
    return;
  }
  const start = tracer.path[tracer.pathIndex];
  const end = tracer.path[tracer.pathIndex + 1];
  if (!start || !end) {
    tracer.isFinished = true;
    if (!tracer.celebrated) {
      celebrate(tracer.x, tracer.color);
      tracer.celebrated = true;
      revealPrize();
    }
    return;
  }
  const dx = end.x - start.x,
    dy = end.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.max(1, distance / speed);
  if (tracer.progress < steps) {
    tracer.progress++;
    tracer.x = start.x + (dx * tracer.progress) / steps;
    tracer.y = start.y + (dy * tracer.progress) / steps;
  } else {
    if (dy === 0 && dx !== 0) {
      createSparks(tracer.x, tracer.y, tracer.color);
    }
    tracer.progress = 0;
    tracer.pathIndex++;
    if (tracer.pathIndex >= tracer.path.length - 1) {
      tracer.isFinished = true;
      const finalPoint = tracer.path[tracer.path.length - 1];
      tracer.x = finalPoint.x;
      tracer.y = finalPoint.y;
      if (!tracer.celebrated) {
        celebrate(tracer.x, tracer.color);
        tracer.celebrated = true;
        revealPrize();
      }
    }
  }
}

function drawTracerPath(targetCtx, tracer) {
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

function drawTracerIcon(targetCtx, tracer) {
  const container = targetCtx.canvas.closest('.canvas-panzoom-container');
  if (!container) return;
  const VIRTUAL_HEIGHT = getTargetHeight(container);
  const iconSize = VIRTUAL_HEIGHT * 0.06;
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

export async function startAnimation(targetCtx, userNames = [], onComplete = null, panToName = null) {
  if (!targetCtx || !state.currentLotteryData) {
    console.error('[Animation] Start failed: No context or lottery data.');
    return;
  }

  state.currentLotteryData.results = ensureResultsFormat(state.currentLotteryData);

  let currentPanzoom = initializePanzoom(targetCtx.canvas);
  if (targetCtx.canvas.id === 'adminCanvas') adminPanzoom = currentPanzoom;
  else participantPanzoom = currentPanzoom;
  if (!currentPanzoom) {
    console.error('[Animation] Panzoom initialization failed.');
    return;
  }

  const participantsToAnimate = state.currentLotteryData.participants.filter((p) => p && p.name && userNames.includes(p.name));
  await preloadPrizeImages(state.currentLotteryData.prizes);
  await preloadIcons(participantsToAnimate);
  const container = targetCtx.canvas.closest('.canvas-panzoom-container');
  if (!container) return;
  const VIRTUAL_HEIGHT = getTargetHeight(container);
  const numParticipants = state.currentLotteryData.participants.length;

  const finishedTracers = animator.tracers.filter((t) => t.isFinished);
  const newTracers = participantsToAnimate.map((p) => {
    const path = calculatePath(p.slot, state.currentLotteryData.lines, numParticipants, container.clientWidth, VIRTUAL_HEIGHT);
    return {name: p.name, color: p.color || '#333', path, pathIndex: 0, progress: 0, x: path[0].x, y: path[0].y, isFinished: false, celebrated: false};
  });
  const namesToAnimate = new Set(userNames);
  const uniqueFinishedTracers = finishedTracers.filter((t) => !namesToAnimate.has(t.name));
  animator.tracers = [...uniqueFinishedTracers, ...newTracers];

  animator.particles = [];
  animator.context = targetCtx;
  animator.onComplete = onComplete;
  animator.lastContainerWidth = container.clientWidth;
  animator.lastContainerHeight = VIRTUAL_HEIGHT;
  setTimeout(() => {
    const panzoomElement = targetCtx.canvas.parentElement;
    const canvasWidth = panzoomElement.offsetWidth;
    const containerWidth = container.clientWidth;
    const scale = currentPanzoom.getScale();
    const currentPan = currentPanzoom.getPan();
    let finalX = currentPan.x;
    if (panToName) {
      const participant = state.currentLotteryData.participants.find((p) => p.name === panToName);
      if (participant) {
        const VIRTUAL_WIDTH = getVirtualWidth(numParticipants, containerWidth);
        const participantSpacing = VIRTUAL_WIDTH / (numParticipants + 1);
        const targetXOnCanvas = participantSpacing * (participant.slot + 1);
        let desiredX = containerWidth / 2 - targetXOnCanvas * scale;
        const scaledCanvasWidth = canvasWidth * scale;
        if (scaledCanvasWidth > containerWidth) {
          const minX = containerWidth - scaledCanvasWidth;
          finalX = Math.max(minX, Math.min(0, desiredX));
        } else {
          finalX = (containerWidth - scaledCanvasWidth) / 2;
        }
      }
    }
    currentPanzoom.pan(finalX, currentPan.y, {animate: true, duration: 600});
  }, 100);
  animator.running = true;
  animationLoop();
}

export async function prepareStepAnimation(targetCtx, hidePrizes = false, showMask = true, isResize = false) {
  if (!targetCtx || !state.currentLotteryData) {
    console.error('[Animation] Prepare failed: No context or lottery data.');
    return;
  }
  const container = targetCtx.canvas.closest('.canvas-panzoom-container');
  if (!container) return;
  const mask = document.getElementById(targetCtx.canvas.id === 'adminCanvas' ? 'admin-loading-mask' : 'participant-loading-mask');
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

  animator.tracers = allParticipantsWithNames.map((p) => {
    const path = calculatePath(p.slot, state.currentLotteryData.lines, totalParticipants, container.clientWidth, VIRTUAL_HEIGHT);
    const isFinished = state.revealedPrizes.some((r) => r.participantName === p.name);
    const finalPoint = isFinished ? path[path.length - 1] : path[0];
    return {
      name: p.name,
      color: p.color || '#333',
      path,
      pathIndex: isFinished ? path.length - 1 : 0,
      progress: 0,
      x: finalPoint.x,
      y: finalPoint.y,
      isFinished,
      celebrated: isFinished,
    };
  });

  animator.context = targetCtx;
  targetCtx.clearRect(0, 0, targetCtx.canvas.width, targetCtx.canvas.height);
  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
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
  if (targetCtx.canvas.id === 'adminCanvas') adminPanzoom = currentPanzoom;
  else participantPanzoom = currentPanzoom;

  setTimeout(() => {
    if (container && currentPanzoom) {
      const panzoomElement = targetCtx.canvas.parentElement;
      const canvasWidth = panzoomElement.offsetWidth;
      const containerWidth = container.clientWidth;
      const scale = Math.min(containerWidth / canvasWidth, 1);
      console.log(`[Panzoom] Resetting zoom to ${scale}`);
      currentPanzoom.zoom(scale, {animate: false});
      const scaledCanvasWidth = canvasWidth * scale;
      const initialX = (containerWidth - scaledCanvasWidth) / 2;
      currentPanzoom.pan(initialX > 0 ? initialX : 0, 0, {animate: false});
    }
    if (mask && showMask) {
      mask.style.display = 'none';
    }
  }, 50);
}

export function advanceLineByLine() {
  if (animator.tracers.length === 0 || animator.running) return;
  animator.tracers.forEach((tracer) => {
    if (tracer.pathIndex < tracer.path.length - 1) {
      tracer.isFinished = false;
    }
  });
  let nextY = Infinity;
  animator.tracers.forEach((tracer) => {
    if (tracer.isFinished) return;
    for (let i = 0; i < tracer.path.length; i++) {
      if (tracer.path[i].y > tracer.y + 0.1 && tracer.path[i].y < nextY) {
        nextY = tracer.path[i].y;
      }
    }
  });
  if (nextY !== Infinity) {
    animator.tracers.forEach((tracer) => {
      if (!tracer.isFinished) tracer.stopY = nextY;
    });
    animator.running = true;
    animationLoop();
  }
}

export function resetAnimation() {
  if (isAnimationRunning()) return;
  state.setRevealedPrizes([]);
  const container = animator.context.canvas.closest('.canvas-panzoom-container');
  if (!container) return;

  const VIRTUAL_HEIGHT = getTargetHeight(container);
  const numParticipants = state.currentLotteryData.participants.length;
  const allParticipantsWithNames = state.currentLotteryData.participants.filter((p) => p.name);

  animator.tracers = allParticipantsWithNames.map((p) => {
    const path = calculatePath(p.slot, state.currentLotteryData.lines, numParticipants, container.clientWidth, VIRTUAL_HEIGHT);
    return {
      name: p.name,
      color: p.color || '#333',
      path,
      pathIndex: 0,
      progress: 0,
      x: path[0].x,
      y: path[0].y,
      isFinished: false,
      celebrated: false,
    };
  });

  animator.particles = [];
  animator.running = true;
  animationLoop();
}

export function redrawPrizes(targetCtx, hidePrizes) {
  if (!targetCtx || !state.currentLotteryData) return;
  const container = targetCtx.canvas.closest('.canvas-panzoom-container');
  if (!container) return;
  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const baseLineColor = isDarkMode ? '#444' : '#e0e0e0';

  drawLotteryBase(targetCtx, state.currentLotteryData, baseLineColor, hidePrizes);

  animator.tracers.forEach((tracer) => {
    if (tracer.isFinished) {
      drawTracerPath(targetCtx, tracer);
    }
    drawTracerIcon(targetCtx, tracer);
  });
  drawRevealedPrizes(targetCtx);
}
