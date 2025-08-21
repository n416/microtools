// amidakuji-app/public/js/animation.js

import * as state from './state.js';

let animationFrameId;
let adminPanzoom, participantPanzoom;
const animator = {
  tracers: [],
  icons: {},
  prizeImages: {},
  particles: [],
  running: false,
  onComplete: null,
  context: null,
};

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

  draw(ctx, scaleX, scaleY) {
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x * scaleX, this.y * scaleY, this.size, 0, Math.PI * 2);
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
  confetti({
    particleCount: 100,
    spread: 70,
    origin: {x: originX, y: 0.8},
    colors: [color, '#ffffff'],
  });
}

function initializePanzoom(canvasElement) {
  if (!canvasElement) return null;
  const panzoom = Panzoom(canvasElement, {
    maxScale: 5,
    minScale: 0.5,
    contain: 'outside',
  });
  canvasElement.parentElement.addEventListener('wheel', (event) => {
    if (!event.shiftKey) {
      panzoom.zoomWithWheel(event);
    }
  });
  return panzoom;
}

export function stopAnimation() {
  animator.running = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  if (adminPanzoom) {
    adminPanzoom.destroy();
    adminPanzoom = null;
  }
  if (participantPanzoom) {
    participantPanzoom.destroy();
    participantPanzoom = null;
  }
}

function getVirtualWidth(numParticipants) {
  const minWidthPerParticipant = 80;
  const defaultWidth = 800;
  const calculatedWidth = numParticipants * minWidthPerParticipant;
  return Math.max(defaultWidth, calculatedWidth);
}

function calculatePath(startIdx, lines, numParticipants) {
  const VIRTUAL_WIDTH = getVirtualWidth(numParticipants);
  const VIRTUAL_HEIGHT = 400;
  const path = [];
  const participantSpacing = VIRTUAL_WIDTH / (numParticipants + 1);
  const sortedLines = [...lines].sort((a, b) => a.y - b.y);
  let currentPathIdx = startIdx;
  path.push({x: participantSpacing * (currentPathIdx + 1), y: 50});
  sortedLines.forEach((line) => {
    if (line.fromIndex === currentPathIdx || line.toIndex === currentPathIdx) {
      path.push({x: participantSpacing * (currentPathIdx + 1), y: line.y});
      currentPathIdx = line.fromIndex === currentPathIdx ? line.toIndex : line.fromIndex;
      path.push({x: participantSpacing * (currentPathIdx + 1), y: line.y});
    }
  });
  path.push({x: participantSpacing * (currentPathIdx + 1), y: VIRTUAL_HEIGHT - 50});
  return path;
}

async function preloadIcons(participants) {
  animator.icons = {};
  const promises = participants.map((p) => {
    if (!p || !p.name) return Promise.resolve();
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
  animator.prizeImages = {};
  if (!prizes) return Promise.resolve();
  const promises = prizes.map((p) => {
    if (!p || typeof p !== 'object' || !p.imageUrl) return Promise.resolve();
    if (animator.prizeImages[p.imageUrl]) return Promise.resolve();

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

function drawLotteryBase(targetCtx, data, lineColor = '#ccc', hidePrizes = false) {
  if (!targetCtx || !targetCtx.canvas || !data || !data.participants || data.participants.length === 0) return;

  const {participants, prizes, lines} = data;
  const numParticipants = participants.length;

  const VIRTUAL_WIDTH = getVirtualWidth(numParticipants);
  targetCtx.canvas.width = VIRTUAL_WIDTH;
  targetCtx.canvas.style.width = `${VIRTUAL_WIDTH}px`;

  const rect = targetCtx.canvas.getBoundingClientRect();
  const scaleY = rect.height / 400;
  const participantSpacing = VIRTUAL_WIDTH / (numParticipants + 1);

  targetCtx.font = '14px Arial';
  targetCtx.textAlign = 'center';

  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const mainTextColor = isDarkMode ? '#e0e0e0' : '#000';
  const subTextColor = isDarkMode ? '#888' : '#888';
  const prizeTextColor = isDarkMode ? '#dcdcdc' : '#333';

  participants.forEach((p, i) => {
    const x = participantSpacing * (i + 1);
    const displayName = p.name || `（参加枠 ${p.slot + 1}）`;
    targetCtx.fillStyle = p.name ? mainTextColor : subTextColor;
    targetCtx.fillText(displayName, x, 30 * scaleY);

    if (prizes && prizes[i]) {
      const prize = prizes[i];
      const prizeName = hidePrizes ? '？？？' : (typeof prize === 'object' ? prize.name : prize);
      const prizeImage = !hidePrizes && typeof prize === 'object' && prize.imageUrl ? animator.prizeImages[prize.imageUrl] : null;

      const prizeTextY = 395;
      const prizeImageCenterY = 370;
      const imageSize = 30;

      if (prizeImage && prizeImage.complete) {
        targetCtx.drawImage(prizeImage, x - imageSize / 2, (prizeImageCenterY - imageSize / 2) * scaleY, imageSize, imageSize);
      }
      targetCtx.fillStyle = prizeTextColor;
      targetCtx.fillText(prizeName, x, prizeTextY * scaleY);
    }
  });

  targetCtx.strokeStyle = lineColor;
  targetCtx.lineWidth = 1.5;

  for (let i = 0; i < numParticipants; i++) {
    const x = participantSpacing * (i + 1);
    targetCtx.beginPath();
    targetCtx.moveTo(x, 50 * scaleY);
    targetCtx.lineTo(x, (400 - 50) * scaleY);
    targetCtx.stroke();
  }

  if (lines) {
    lines.forEach((line) => {
      const startX = participantSpacing * (line.fromIndex + 1);
      const endX = participantSpacing * (line.toIndex + 1);
      targetCtx.beginPath();
      targetCtx.moveTo(startX, line.y * scaleY);
      targetCtx.lineTo(endX, line.y * scaleY);
      targetCtx.stroke();
    });
  }
}

function animationLoop() {
  if (!animator.running) return;
  const targetCtx = animator.context;
  if (!targetCtx || !targetCtx.canvas) {
    stopAnimation();
    return;
  }
  const numParticipants = state.currentLotteryData.participants.length;
  const baseSpeed = 4;
  const reductionFactor = Math.min(0.5, Math.floor(Math.max(0, numParticipants - 10) / 10) * 0.1);
  const dynamicSpeed = baseSpeed * (1 - reductionFactor);

  const VIRTUAL_WIDTH = getVirtualWidth(numParticipants);
  const scaleX = targetCtx.canvas.width / VIRTUAL_WIDTH;
  const scaleY = targetCtx.canvas.height / 400;

  targetCtx.clearRect(0, 0, targetCtx.canvas.width, targetCtx.canvas.height);

  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const baseLineColor = isDarkMode ? '#444' : '#e0e0e0';
  drawLotteryBase(targetCtx, state.currentLotteryData, baseLineColor);

  animator.particles = animator.particles.filter((p) => p.life > 0);
  animator.particles.forEach((p) => {
    p.update();
    p.draw(targetCtx, scaleX, scaleY);
  });

  let allFinished = true;
  animator.tracers.forEach((tracer) => {
    drawTracerPath(targetCtx, tracer);
    if (!tracer.isFinished) {
      allFinished = false;
      updateTracerPosition(tracer, dynamicSpeed);
      if (Math.random() > 0.5) {
        animator.particles.push(new Particle(tracer.x, tracer.y, tracer.color));
      }
    }
    drawTracerIcon(targetCtx, tracer);
  });

  if (allFinished) {
    animator.running = false;
    if (animator.onComplete) animator.onComplete();
  } else {
    animationFrameId = requestAnimationFrame(animationLoop);
  }
}

function updateTracerPosition(tracer, speed) {
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
      const VIRTUAL_WIDTH = getVirtualWidth(state.currentLotteryData.participants.length);
      const rect = animator.context.canvas.getBoundingClientRect();
      const scaleX = rect.width / VIRTUAL_WIDTH;
      celebrate((tracer.x * scaleX) / rect.width, tracer.color);
      tracer.celebrated = true;
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
        const VIRTUAL_WIDTH = getVirtualWidth(state.currentLotteryData.participants.length);
        const rect = animator.context.canvas.getBoundingClientRect();
        const scaleX = rect.width / VIRTUAL_WIDTH;
        celebrate((tracer.x * scaleX) / rect.width, tracer.color);
        tracer.celebrated = true;
      }
    }
  }
}

function drawTracerPath(targetCtx, tracer) {
  const numParticipants = state.currentLotteryData.participants.length;
  const VIRTUAL_WIDTH = getVirtualWidth(numParticipants);
  const scaleX = targetCtx.canvas.width / VIRTUAL_WIDTH;
  const scaleY = targetCtx.canvas.height / 400;

  targetCtx.strokeStyle = tracer.color;
  targetCtx.lineWidth = 4;
  targetCtx.lineCap = 'round';
  targetCtx.shadowColor = tracer.color;
  targetCtx.shadowBlur = 15;

  targetCtx.beginPath();
  targetCtx.moveTo(tracer.path[0].x * scaleX, tracer.path[0].y * scaleY);
  for (let i = 1; i <= tracer.pathIndex; i++) {
    targetCtx.lineTo(tracer.path[i].x * scaleX, tracer.path[i].y * scaleY);
  }
  targetCtx.lineTo(tracer.x * scaleX, tracer.y * scaleY);
  targetCtx.stroke();

  targetCtx.shadowColor = 'transparent';
  targetCtx.shadowBlur = 0;
}

function drawTracerIcon(targetCtx, tracer) {
  const numParticipants = state.currentLotteryData.participants.length;
  const VIRTUAL_WIDTH = getVirtualWidth(numParticipants);
  const scaleX = targetCtx.canvas.width / VIRTUAL_WIDTH;
  const scaleY = targetCtx.canvas.height / 400;
  const iconSize = 24;
  const icon = animator.icons[tracer.name];
  const drawX = tracer.x * scaleX;
  const drawY = tracer.y * scaleY;

  targetCtx.save();
  targetCtx.beginPath();
  targetCtx.arc(drawX, drawY, iconSize / 2 + 2, 0, Math.PI * 2, true);
  targetCtx.fillStyle = 'white';
  targetCtx.fill();
  targetCtx.lineWidth = 2;
  targetCtx.strokeStyle = tracer.color;
  targetCtx.stroke();
  targetCtx.clip();

  if (icon) {
    targetCtx.drawImage(icon, drawX - iconSize / 2, drawY - iconSize / 2, iconSize, iconSize);
  } else {
    targetCtx.beginPath();
    targetCtx.arc(drawX, drawY, iconSize / 2, 0, Math.PI * 2, true);
    targetCtx.fillStyle = tracer.color;
    targetCtx.fill();
  }
  targetCtx.restore();
}

export async function startAnimation(targetCtx, userNames = [], onComplete = null) {
  stopAnimation();
  if (!targetCtx || !state.currentLotteryData) return;

  if (targetCtx.canvas.id === 'adminCanvas' && !adminPanzoom) {
    adminPanzoom = initializePanzoom(targetCtx.canvas);
  } else if (targetCtx.canvas.id === 'participantCanvas' && !participantPanzoom) {
    participantPanzoom = initializePanzoom(targetCtx.canvas);
  }

  const participantsToAnimate = state.currentLotteryData.participants.filter((p) => p && p.name && userNames.includes(p.name));
  await preloadPrizeImages(state.currentLotteryData.prizes);
  await preloadIcons(participantsToAnimate);

  animator.tracers = participantsToAnimate.map((p) => {
    const path = calculatePath(p.slot, state.currentLotteryData.lines, state.currentLotteryData.participants.length);
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

  animator.context = targetCtx;
  animator.onComplete = onComplete;
  animator.running = true;
  animationLoop();
}

export async function prepareStepAnimation(targetCtx, hidePrizes = false) {
  stopAnimation();
  if (!targetCtx || !state.currentLotteryData) return;

  if (targetCtx.canvas.id === 'adminCanvas' && !adminPanzoom) {
    adminPanzoom = initializePanzoom(targetCtx.canvas);
  }

  const allParticipants = state.currentLotteryData.participants.filter((p) => p.name);
  await preloadPrizeImages(state.currentLotteryData.prizes);
  await preloadIcons(allParticipants);

  animator.tracers = allParticipants.map((p) => {
    const path = calculatePath(p.slot, state.currentLotteryData.lines, state.currentLotteryData.participants.length);
    return {
      name: p.name,
      color: p.color || '#333',
      path,
      pathIndex: 0,
      progress: 0,
      x: path[0].x,
      y: path[0].y,
      isFinished: true,
      celebrated: false,
    };
  });

  animator.context = targetCtx;
  targetCtx.clearRect(0, 0, targetCtx.canvas.width, targetCtx.canvas.height);

  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const baseLineColor = isDarkMode ? '#dcdcdc' : '#333';
  drawLotteryBase(targetCtx, state.currentLotteryData, baseLineColor, hidePrizes);
  animator.tracers.forEach((tracer) => drawTracerIcon(targetCtx, tracer));
}

export function resetAnimation() {
  if (animator.tracers.length === 0 || animator.running) return;

  animator.tracers.forEach((tracer) => {
    tracer.isFinished = false;
    tracer.pathIndex = 0;
    tracer.progress = 0;
    if (tracer.path && tracer.path.length > 0) {
      tracer.x = tracer.path[0].x;
      tracer.y = tracer.path[0].y;
    }
    delete tracer.stopY;
    tracer.celebrated = false;
  });
  animator.particles = [];
  animator.running = true;
  animationLoop();
}

export function stepAnimation() {
  if (animator.tracers.length === 0 || animator.running) return;

  let isAnyTracerMoving = false;
  animator.tracers.forEach((tracer) => {
    if (tracer.pathIndex >= tracer.path.length - 1) {
      tracer.isFinished = true;
      return;
    }
    tracer.isFinished = false;
    delete tracer.stopY;
    for (let i = tracer.pathIndex; i < tracer.path.length - 1; i++) {
      const p1 = tracer.path[i];
      const p2 = tracer.path[i + 1];
      if (p1.y === p2.y && p1.x !== p2.x) {
        if (p1.y > tracer.y + 0.1) {
          tracer.stopY = p1.y;
          break;
        }
      }
    }
    isAnyTracerMoving = true;
  });
  if (isAnyTracerMoving) {
    animator.running = true;
    animationLoop();
  }
}