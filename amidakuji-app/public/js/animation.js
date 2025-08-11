// js/animation.js
import * as state from './state.js';

let animationFrameId;
const animator = {
  tracers: [],
  icons: {},
  running: false,
  speed: 4,
  onComplete: null,
  context: null,
};

function resizeCanvasToDisplaySize(canvas) {
    if (!canvas) return;
    const {width, height} = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      return true;
    }
    return false;
}

export function stopAnimation() {
    animator.running = false;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
}

function calculatePath(startIdx, lines, numParticipants) {
    const VIRTUAL_WIDTH = 800;
    const VIRTUAL_HEIGHT = 400;
    const path = [];
    const participantSpacing = VIRTUAL_WIDTH / (numParticipants + 1);
    const sortedLines = [...lines].sort((a, b) => a.y - b.y);
    let currentPathIdx = startIdx;
    path.push({x: participantSpacing * (currentPathIdx + 1), y: 30});
    sortedLines.forEach((line) => {
      if (line.fromIndex === currentPathIdx || line.toIndex === currentPathIdx) {
        path.push({x: participantSpacing * (currentPathIdx + 1), y: line.y});
        currentPathIdx = (line.fromIndex === currentPathIdx) ? line.toIndex : line.fromIndex;
        path.push({x: participantSpacing * (currentPathIdx + 1), y: line.y});
      }
    });
    path.push({x: participantSpacing * (currentPathIdx + 1), y: VIRTUAL_HEIGHT - 30});
    return path;
}

async function preloadIcons(participants) {
    animator.icons = {};
    const promises = participants.map((p) => {
      if (!p || !p.name) return Promise.resolve();
      return new Promise((resolve) => {
        const iconUrl = p.iconUrl || `/api/avatar-proxy?name=${encodeURIComponent(p.name)}`;
        const img = new Image();
        img.onload = () => { animator.icons[p.name] = img; resolve(); };
        img.onerror = () => { animator.icons[p.name] = null; resolve(); };
        img.src = iconUrl;
      });
    });
    await Promise.all(promises);
}

function drawLotteryBase(targetCtx, data, lineColor = '#ccc') {
    if (!targetCtx || !targetCtx.canvas || !data || !data.participants || data.participants.length === 0) return;

    resizeCanvasToDisplaySize(targetCtx.canvas);
    const rect = targetCtx.canvas.getBoundingClientRect();
    const scaleX = rect.width / 800;
    const scaleY = rect.height / 400;

    const {participants, prizes, lines} = data;
    const numParticipants = participants.length;
    const participantSpacing = 800 / (numParticipants + 1);

    targetCtx.font = '14px Arial';
    targetCtx.textAlign = 'center';

    participants.forEach((p, i) => {
      const x = participantSpacing * (i + 1) * scaleX;
      const displayName = p.name || `（参加枠 ${p.slot + 1}）`;
      targetCtx.fillStyle = p.name ? '#000' : '#888';
      targetCtx.fillText(displayName, x, 20 * scaleY);

      if (prizes && prizes[i]) {
        const prizeName = typeof prizes[i] === 'object' ? prizes[i].name : prizes[i];
        targetCtx.fillStyle = '#333';
        targetCtx.fillText(prizeName, x, (400 - 10) * scaleY);
      }
    });

    targetCtx.strokeStyle = lineColor;
    targetCtx.lineWidth = 1.5;

    for (let i = 0; i < numParticipants; i++) {
      const x = participantSpacing * (i + 1) * scaleX;
      targetCtx.beginPath();
      targetCtx.moveTo(x, 30 * scaleY);
      targetCtx.lineTo(x, (400 - 30) * scaleY);
      targetCtx.stroke();
    }

    if (lines) {
      lines.forEach((line) => {
        const startX = participantSpacing * (line.fromIndex + 1) * scaleX;
        const endX = participantSpacing * (line.toIndex + 1) * scaleX;
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
    if (!targetCtx || !targetCtx.canvas) { stopAnimation(); return; }

    targetCtx.clearRect(0, 0, targetCtx.canvas.width, targetCtx.canvas.height);
    drawLotteryBase(targetCtx, state.currentLotteryData, '#e0e0e0');

    let allFinished = true;
    animator.tracers.forEach(tracer => {
        drawTracerPath(targetCtx, tracer);
        if (!tracer.isFinished) {
            allFinished = false;
            updateTracerPosition(tracer);
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

function updateTracerPosition(tracer) {
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
    if (!start || !end) { tracer.isFinished = true; return; }

    const dx = end.x - start.x, dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(1, distance / animator.speed);

    if (tracer.progress < steps) {
        tracer.progress++;
        tracer.x = start.x + (dx * tracer.progress) / steps;
        tracer.y = start.y + (dy * tracer.progress) / steps;
    } else {
        tracer.progress = 0;
        tracer.pathIndex++;
        if (tracer.pathIndex >= tracer.path.length - 1) {
            tracer.isFinished = true;
            const finalPoint = tracer.path[tracer.path.length - 1];
            tracer.x = finalPoint.x;
            tracer.y = finalPoint.y;
        }
    }
}

function drawTracerPath(targetCtx, tracer) {
    const rect = targetCtx.canvas.getBoundingClientRect();
    const scaleX = rect.width / 800, scaleY = rect.height / 400;
    targetCtx.strokeStyle = tracer.color;
    targetCtx.lineWidth = 4;
    targetCtx.lineCap = 'round';
    targetCtx.beginPath();
    targetCtx.moveTo(tracer.path[0].x * scaleX, tracer.path[0].y * scaleY);
    for (let i = 1; i <= tracer.pathIndex; i++) {
      targetCtx.lineTo(tracer.path[i].x * scaleX, tracer.path[i].y * scaleY);
    }
    targetCtx.lineTo(tracer.x * scaleX, tracer.y * scaleY);
    targetCtx.stroke();
}

function drawTracerIcon(targetCtx, tracer) {
    const rect = targetCtx.canvas.getBoundingClientRect();
    const scaleX = rect.width / 800, scaleY = rect.height / 400;
    const iconSize = 24;
    const icon = animator.icons[tracer.name];
    const drawX = tracer.x * scaleX, drawY = tracer.y * scaleY;

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

    const participantsToAnimate = state.currentLotteryData.participants.filter(p => p && p.name && userNames.includes(p.name));
    await preloadIcons(participantsToAnimate);

    animator.tracers = participantsToAnimate.map(p => {
        const path = calculatePath(p.slot, state.currentLotteryData.lines, state.currentLotteryData.participants.length);
        return {
            name: p.name, color: p.color || '#333', path, pathIndex: 0, progress: 0, 
            x: path[0].x, y: path[0].y, isFinished: false,
        };
    });

    animator.context = targetCtx;
    animator.onComplete = onComplete;
    animator.running = true;
    animationLoop();
}

export async function prepareStepAnimation(targetCtx) {
    stopAnimation();
    if (!targetCtx || !state.currentLotteryData) return;

    const allParticipants = state.currentLotteryData.participants.filter((p) => p.name);
    await preloadIcons(allParticipants);
    
    animator.tracers = allParticipants.map((p) => {
        const path = calculatePath(p.slot, state.currentLotteryData.lines, state.currentLotteryData.participants.length);
        return {
            name: p.name, color: p.color || '#333', path, pathIndex: 0, progress: 0, 
            x: path[0].x, y: path[0].y, isFinished: true,
        };
    });

    animator.context = targetCtx;
    targetCtx.clearRect(0,0,targetCtx.canvas.width, targetCtx.canvas.height);
    drawLotteryBase(targetCtx, state.currentLotteryData, '#333');
    animator.tracers.forEach(tracer => drawTracerIcon(targetCtx, tracer));
}

export function resetAnimation() {
    if (animator.tracers.length === 0 || animator.running) return;

    animator.tracers.forEach(tracer => {
        tracer.isFinished = false;
        tracer.pathIndex = 0;
        tracer.progress = 0;
        if (tracer.path && tracer.path.length > 0) {
            tracer.x = tracer.path[0].x;
            tracer.y = tracer.path[0].y;
        }
        delete tracer.stopY;
    });
    animator.running = true;
    animationLoop();
}

export function stepAnimation() {
    if (animator.tracers.length === 0 || animator.running) return;

    let isAnyTracerMoving = false;
    animator.tracers.forEach(tracer => {
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