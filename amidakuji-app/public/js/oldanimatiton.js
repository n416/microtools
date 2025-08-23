// amidakuji-app/public/js/animation.js (この内容でファイルを置き換えてください)

import * as state from './state.js';

let animationFrameId;
let adminPanzoom = null;
let participantPanzoom = null;

const animator = {
  tracers: [],
  icons: {},
  prizeImages: {},
  particles: [],
  running: false,
  onComplete: null,
  context: null,
};

// ブラウザ側でプレビュー用の結果を計算する関数
function calculateClientSideResults(participants, lines, prizes) {
  const results = {};
  if (!participants || !lines || !prizes) return results;
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
  confetti({particleCount: 100, spread: 70, origin: {x: x, y: 0.8}, colors: [color, '#ffffff']});
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
  animator.running = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
}

function getVirtualWidth(numParticipants) {
  const minWidthPerParticipant = 80;
  const defaultWidth = 800;
  const calculatedWidth = numParticipants * minWidthPerParticipant;
  return Math.max(defaultWidth, calculatedWidth);
}

// ★★★ 根本原因だったバグを修正した、正しい経路計算ロジック ★★★
function calculatePath(startIdx, lines, numParticipants) {
  const VIRTUAL_WIDTH = getVirtualWidth(numParticipants);
  const VIRTUAL_HEIGHT = 400;
  const path = [];
  const participantSpacing = VIRTUAL_WIDTH / (numParticipants + 1);
  const sortedLines = [...lines].sort((a, b) => a.y - b.y);

  let currentX = participantSpacing * (startIdx + 1);
  let currentY = 50;
  let currentPathIdx = startIdx;

  path.push({x: currentX, y: currentY});

  sortedLines.forEach((line) => {
    if (line.y > currentY) {
      if (line.fromIndex === currentPathIdx) {
        path.push({x: currentX, y: line.y});
        currentPathIdx = line.toIndex;
        currentX = participantSpacing * (currentPathIdx + 1);
        path.push({x: currentX, y: line.y});
        currentY = line.y;
      } else if (line.toIndex === currentPathIdx) {
        path.push({x: currentX, y: line.y});
        currentPathIdx = line.fromIndex;
        currentX = participantSpacing * (currentPathIdx + 1);
        path.push({x: currentX, y: line.y});
        currentY = line.y;
      }
    }
  });

  path.push({x: currentX, y: VIRTUAL_HEIGHT - 50});
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

function drawRevealedPrizes(targetCtx) {
  const VIRTUAL_WIDTH = getVirtualWidth(state.currentLotteryData.participants.length);
  const participantSpacing = VIRTUAL_WIDTH / (state.currentLotteryData.participants.length + 1);
  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const prizeTextColor = isDarkMode ? '#dcdcdc' : '#333';
  targetCtx.fillStyle = prizeTextColor;

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
    const imageSize = 30 * scale;
    if (prizeImage && prizeImage.complete) {
      targetCtx.drawImage(prizeImage, x - imageSize / 2, 370 - imageSize / 2, imageSize, imageSize);
    }
    targetCtx.fillText(prizeName, x, 395);
  });
}

function drawLotteryBase(targetCtx, data, lineColor = '#ccc', hidePrizes = false) {
  if (!targetCtx || !targetCtx.canvas || !data || !data.participants || data.participants.length === 0) return;
  const panzoomElement = targetCtx.canvas.parentElement;
  const {participants, prizes, lines} = data;
  const numParticipants = participants.length;
  const VIRTUAL_WIDTH = getVirtualWidth(numParticipants);
  const VIRTUAL_HEIGHT = 400;
  targetCtx.canvas.width = VIRTUAL_WIDTH;
  targetCtx.canvas.height = VIRTUAL_HEIGHT;
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
  participants.forEach((p, i) => {
    const x = participantSpacing * (i + 1);
    const displayName = p.name || `（参加枠 ${p.slot + 1}）`;
    targetCtx.fillStyle = p.name ? mainTextColor : subTextColor;
    targetCtx.fillText(displayName, x, 30);
    const isRevealed = state.revealedPrizes.some((r) => r.prizeIndex === i);
    if (prizes && prizes[i] && !isRevealed) {
      const prize = prizes[i];
      const prizeName = hidePrizes ? '？？？' : typeof prize === 'object' ? prize.name : prize;
      const prizeImage = !hidePrizes && typeof prize === 'object' && prize.imageUrl ? animator.prizeImages[prize.imageUrl] : null;
      if (prizeImage && prizeImage.complete) {
        targetCtx.drawImage(prizeImage, x - 15, 370 - 15, 30, 30);
      }
      targetCtx.fillStyle = prizeTextColor;
      targetCtx.fillText(prizeName, x, 395);
    }
  });
  targetCtx.strokeStyle = lineColor;
  targetCtx.lineWidth = 1.5;
  for (let i = 0; i < numParticipants; i++) {
    const x = participantSpacing * (i + 1);
    targetCtx.beginPath();
    targetCtx.moveTo(x, 50);
    targetCtx.lineTo(x, VIRTUAL_HEIGHT - 50);
    targetCtx.stroke();
  }
  if (lines) {
    lines.forEach((line) => {
      const startX = participantSpacing * (line.fromIndex + 1);
      const endX = participantSpacing * (line.toIndex + 1);
      targetCtx.beginPath();
      targetCtx.moveTo(startX, line.y);
      targetCtx.lineTo(endX, line.y);
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
  targetCtx.clearRect(0, 0, targetCtx.canvas.width, targetCtx.canvas.height);
  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const baseLineColor = isDarkMode ? '#444' : '#e0e0e0';

  // ▼▼▼ 修正箇所 ▼▼▼
  // 景品を隠す条件を明確化: イベントが未開始、または景品非公開設定の場合
  const hidePrizes = state.currentLotteryData.status === 'pending' || state.currentLotteryData.displayMode === 'private';
  drawLotteryBase(targetCtx, state.currentLotteryData, baseLineColor, hidePrizes);
  // ▲▲▲ 修正ここまで ▲▲▲

  drawRevealedPrizes(targetCtx);
  animator.particles = animator.particles.filter((p) => p.life > 0);
  animator.particles.forEach((p) => {
    p.update();
    p.draw(targetCtx);
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
  const revealPrize = () => {
    console.log('到達');
    const resultExists = state.revealedPrizes.some((r) => r.participantName === tracer.name);
    if (!resultExists) {
      const result = state.currentLotteryData.results[tracer.name];
      console.log('Result object from state:', result);

      if (result) {
        const prizeIndex = result.prizeIndex;
        // ▼▼▼ 修正箇所 ▼▼▼
        console.log('書き換える景品index:', prizeIndex); // どのインデックスを書き換えようとしているかログ出力
        // ▲▲▲ 修正ここまで ▲▲▲
        const realPrize = state.currentLotteryData.prizes[prizeIndex];

        if (typeof prizeIndex !== 'undefined' && prizeIndex > -1 && realPrize) {
          console.log('Revealing prize:', realPrize);
          state.revealedPrizes.push({participantName: tracer.name, prize: realPrize, prizeIndex, revealProgress: 0});
        }
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
  const iconSize = 24;
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
  if (!targetCtx || !state.currentLotteryData) return;

  // ▼▼▼ 修正箇所 ▼▼▼
  // 結果データが存在するか、または存在してもprizeIndexが含まれていない古い形式でないかを確認
  const results = state.currentLotteryData.results;
  const isOutdated = results && Object.values(results).length > 0 && typeof Object.values(results)[0].prizeIndex === 'undefined';

  if (!results || isOutdated) {
    console.log('結果データが存在しないか古い形式のため、クライアントサイドで再計算します。');
    const {participants, lines, prizes} = state.currentLotteryData;
    // クライアントサイドで結果を再計算して、最新の形式（prizeIndexを含む）にする
    state.currentLotteryData.results = calculateClientSideResults(participants, lines, prizes);
  }
  // ▲▲▲ 修正ここまで ▲▲▲

  let currentPanzoom;
  if (targetCtx.canvas.id === 'adminCanvas') {
    adminPanzoom = initializePanzoom(targetCtx.canvas);
    currentPanzoom = adminPanzoom;
  } else {
    participantPanzoom = initializePanzoom(targetCtx.canvas);
    currentPanzoom = participantPanzoom;
  }
  if (!currentPanzoom) return;
  const participantsToAnimate = state.currentLotteryData.participants.filter((p) => p && p.name && userNames.includes(p.name));
  await preloadPrizeImages(state.currentLotteryData.prizes);
  await preloadIcons(participantsToAnimate);
  animator.tracers = participantsToAnimate.map((p) => {
    const path = calculatePath(p.slot, state.currentLotteryData.lines, state.currentLotteryData.participants.length);
    return {name: p.name, color: p.color || '#333', path, pathIndex: 0, progress: 0, x: path[0].x, y: path[0].y, isFinished: false, celebrated: false};
  });
  animator.particles = [];
  animator.context = targetCtx;
  animator.onComplete = onComplete;
  setTimeout(() => {
    const container = targetCtx.canvas.closest('.canvas-panzoom-container');
    if (!container) return;
    const panzoomElement = targetCtx.canvas.parentElement;
    const canvasWidth = panzoomElement.offsetWidth;
    const containerWidth = container.clientWidth;
    const scale = currentPanzoom.getScale();
    const currentPan = currentPanzoom.getPan();
    let finalX = currentPan.x;
    if (panToName) {
      const participant = state.currentLotteryData.participants.find((p) => p.name === panToName);
      if (participant) {
        const VIRTUAL_WIDTH = getVirtualWidth(state.currentLotteryData.participants.length);
        const participantSpacing = VIRTUAL_WIDTH / (state.currentLotteryData.participants.length + 1);
        const targetXOnCanvas = participantSpacing * (participant.slot + 1);
        let desiredX = containerWidth / 2 - targetXOnCanvas * scale;
        const scaledCanvasWidth = canvasWidth * scale;
        if (scaledCanvasWidth > containerWidth) {
          const minX = containerWidth - scaledCanvasWidth;
          const maxX = 0;
          finalX = Math.max(minX, Math.min(maxX, desiredX));
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

export async function prepareStepAnimation(targetCtx, hidePrizes = false) {
  if (!targetCtx || !state.currentLotteryData) return;
  let currentPanzoom;
  if (targetCtx.canvas.id === 'adminCanvas') {
    adminPanzoom = initializePanzoom(targetCtx.canvas);
    currentPanzoom = adminPanzoom;
  } else {
    participantPanzoom = initializePanzoom(targetCtx.canvas);
    currentPanzoom = participantPanzoom;
  }
  if (!currentPanzoom) return;
  state.setRevealedPrizes([]);
  const mask = document.getElementById(targetCtx.canvas.id === 'adminCanvas' ? 'admin-loading-mask' : 'participant-loading-mask');
  if (mask) mask.style.display = 'flex';
  const allParticipants = state.currentLotteryData.participants.filter((p) => p.name);
  await preloadPrizeImages(state.currentLotteryData.prizes);
  await preloadIcons(allParticipants);
  animator.tracers = allParticipants.map((p) => {
    const path = calculatePath(p.slot, state.currentLotteryData.lines, state.currentLotteryData.participants.length);
    return {name: p.name, color: p.color || '#333', path, pathIndex: 0, progress: 0, x: path[0].x, y: path[0].y, isFinished: true, celebrated: false};
  });
  animator.context = targetCtx;
  targetCtx.clearRect(0, 0, targetCtx.canvas.width, targetCtx.canvas.height);
  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const baseLineColor = isDarkMode ? '#dcdcdc' : '#333';
  drawLotteryBase(targetCtx, state.currentLotteryData, baseLineColor, hidePrizes);
  animator.tracers.forEach((tracer) => drawTracerIcon(targetCtx, tracer));
  setTimeout(() => {
    const container = targetCtx.canvas.closest('.canvas-panzoom-container');
    if (container) {
      const panzoomElement = targetCtx.canvas.parentElement;
      const canvasWidth = panzoomElement.offsetWidth;
      const containerWidth = container.clientWidth;
      const scale = Math.min(containerWidth / canvasWidth, 1);
      currentPanzoom.zoom(scale, {animate: false});
      const scaledCanvasWidth = canvasWidth * scale;
      const initialX = (containerWidth - scaledCanvasWidth) / 2;
      currentPanzoom.pan(initialX > 0 ? initialX : 0, 0, {animate: false});
    }
    if (mask) {
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
  if (animator.tracers.length === 0 || animator.running) return;
  state.setRevealedPrizes([]);
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

export function redrawPrizes(targetCtx, hidePrizes) {
  if (!targetCtx || !state.currentLotteryData) return;
  const { participants, prizes } = state.currentLotteryData;
  if (!participants || participants.length === 0) return;

  const numParticipants = participants.length;
  const VIRTUAL_WIDTH = getVirtualWidth(numParticipants);
  const participantSpacing = VIRTUAL_WIDTH / (numParticipants + 1);

  // 景品が描画されているエリアのみをクリアする
  targetCtx.clearRect(0, 360, VIRTUAL_WIDTH, 40);

  // 以下はdrawLotteryBaseから持ってきた景品描画専用のロジック
  targetCtx.font = '14px Arial';
  targetCtx.textAlign = 'center';
  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const prizeTextColor = isDarkMode ? '#dcdcdc' : '#333';

  participants.forEach((p, i) => {
    const isRevealed = state.revealedPrizes.some((r) => r.prizeIndex === i);
    if (prizes && prizes[i] && !isRevealed) {
      const x = participantSpacing * (i + 1);
      const prize = prizes[i];
      const prizeName = hidePrizes ? '？？？' : typeof prize === 'object' ? prize.name : prize;
      const prizeImage = !hidePrizes && typeof prize === 'object' && prize.imageUrl ? animator.prizeImages[prize.imageUrl] : null;

      if (prizeImage && prizeImage.complete) {
        targetCtx.drawImage(prizeImage, x - 15, 370 - 15, 30, 30);
      }
      targetCtx.fillStyle = prizeTextColor;
      targetCtx.fillText(prizeName, x, 395);
    }
  });

  // すでに結果が明らかになっている景品も再描画する
  drawRevealedPrizes(targetCtx);
}