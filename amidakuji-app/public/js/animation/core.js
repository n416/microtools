import * as state from '../state.js';
import {calculatePath, getTargetHeight, getVirtualWidth, calculateClientSideResults} from './path.js';
import {drawLotteryBase, drawRevealedPrizes, drawTracerPath, drawTracerIcon} from './drawing.js';
import {initializePanzoom, preloadIcons, preloadPrizeImages} from './setup.js';
import {createSparks, celebrate, Particle} from './effects.js';

export const animator = {
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

let animationFrameId;

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

export function isAnimationRunning() {
  return animator.running;
}

export function stopAnimation() {
  console.trace('%c[Animation] Stop requested.', 'color: red');
  animator.running = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
}

function updateTracerPosition(tracer, speed) {
  const revealPrize = () => {
    const targetCanvasId = animator.context.canvas.id;

    // ■ 管理者画面('adminCanvas')の場合の処理
    if (targetCanvasId === 'adminCanvas') {
      const resultExists = state.revealedPrizes.some((r) => r.participantName === tracer.name);
      if (!resultExists) {
        // まだ表示されていなければ追加
        const result = state.currentLotteryData.results[tracer.name];
        if (result) {
          const prizeIndex = result.prizeIndex;
          const realPrize = state.currentLotteryData.prizes[prizeIndex];
          if (typeof prizeIndex !== 'undefined' && prizeIndex > -1 && realPrize) {
            state.revealedPrizes.push({participantName: tracer.name, prize: realPrize, prizeIndex, revealProgress: 0});
          }
        }
      }
    }
    // ■ 参加者・シェア画面('participantCanvas')の場合の処理
    else if (targetCanvasId === 'participantCanvas') {
      // まだ1つも景品が表示されていなければ、全結果を一度に表示する
      if (state.revealedPrizes.length === 0) {
        const allPrizes = state.currentLotteryData.prizes; // サーバーから受け取った「正しい全景品リスト」
        const allResults = state.currentLotteryData.results;

        // [修正点] 全景品リストを元に、当選者情報を付加して「公開済みリスト」を生成する
        const newRevealedPrizes = allPrizes.map((prize, index) => {
          // この景品(index)を獲得した参加者がいるか、allResultsから探す
          const winnerEntry = Object.entries(allResults).find(([name, result]) => result.prizeIndex === index);
          const winnerName = winnerEntry ? winnerEntry[0] : null;

          return {
            participantName: winnerName, // 当選者がいなければ null
            prize: prize, // 正しい景品情報
            prizeIndex: index,
            revealProgress: 0,
          };
        });

        if (newRevealedPrizes.length > 0) {
          state.setRevealedPrizes(newRevealedPrizes);
        }
      }
    }
  };

  if (tracer.stopY && tracer.y >= tracer.stopY) {
    tracer.y = tracer.stopY;
    tracer.isFinished = true;

    const finalY = tracer.path[tracer.path.length - 1].y;
    if (tracer.stopY >= finalY) {
      if (!tracer.celebrated) {
        tracer.x = tracer.path[tracer.path.length - 1].x;
        tracer.y = tracer.path[tracer.path.length - 1].y;
        celebrate(tracer.x, tracer.color);
        tracer.celebrated = true;
        revealPrize();
      }
    }

    delete tracer.stopY;
    return;
  }

  const target = tracer.path[tracer.pathIndex + 1];

  if (!target) {
    tracer.isFinished = true;
    if (!tracer.celebrated) {
      celebrate(tracer.x, tracer.color);
      tracer.celebrated = true;
      revealPrize();
    }
    return;
  }

  const dx = target.x - tracer.x;
  const dy = target.y - tracer.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < speed) {
    tracer.x = target.x;
    tracer.y = target.y;
    tracer.pathIndex++;
    if (tracer.path[tracer.pathIndex] && tracer.path[tracer.pathIndex - 1] && tracer.path[tracer.pathIndex].y === tracer.path[tracer.pathIndex - 1].y) {
      createSparks(tracer.x, tracer.y, tracer.color);
    }
  } else {
    tracer.x += (dx / distance) * speed;
    tracer.y += (dy / distance) * speed;
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
      const newPath = calculatePath(participant.slot, state.currentLotteryData.lines, numParticipants, currentContainerWidth, currentContainerHeight, container);
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
  const isDarkMode = document.body.classList.contains('dark-mode');
  const baseLineColor = isDarkMode ? '#dcdcdc' : '#333';

  const isParticipantView = animator.context.canvas.id === 'participantCanvas';
  // [修正点] 参加者画面では、景品が公開されるまで(revealedPrizesが空の間)は常に景品を隠します
  const hidePrizes = isParticipantView ? state.revealedPrizes.length === 0 : true;

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

  const isRevealingPrizes = state.revealedPrizes.some((p) => p.revealProgress < 15);
  const particlesRemaining = animator.particles.length > 0;

  if (allTracersFinished && !isRevealingPrizes && !particlesRemaining) {
    if (animator.running) {
      animator.running = false;
      if (animator.onComplete) {
        animator.onComplete();
        animator.onComplete = null;
      }
    }
  } else {
    animationFrameId = requestAnimationFrame(animationLoop);
  }
}

export async function startAnimation(targetCtx, userNames = [], onComplete = null, panToName = null) {
  if (!targetCtx || !state.currentLotteryData) {
    console.error('[Animation] Start failed: No context or lottery data.');
    return;
  }

  state.currentLotteryData.results = ensureResultsFormat(state.currentLotteryData);

  let currentPanzoom = initializePanzoom(targetCtx.canvas);

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
    const path = calculatePath(p.slot, state.currentLotteryData.lines, numParticipants, container.clientWidth, VIRTUAL_HEIGHT, container);
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

export function advanceLineByLine(onComplete = null) {
  if (animator.tracers.length === 0 || animator.running) return;

  const allAtTheEnd = animator.tracers.every((t) => t.pathIndex >= t.path.length - 1);

  if (allAtTheEnd) {
    state.setRevealedPrizes([]);
    animator.tracers.forEach((tracer) => {
      tracer.pathIndex = 0;
      tracer.x = tracer.path[0].x;
      tracer.y = tracer.path[0].y;
      tracer.isFinished = false;
      tracer.celebrated = false;
      delete tracer.stopY;
    });
  }

  animator.onComplete = onComplete;

  let animationShouldStart = false;

  animator.tracers.forEach((tracer) => {
    if (tracer.pathIndex >= tracer.path.length - 1) {
      tracer.isFinished = true;
      return;
    }

    tracer.isFinished = false;
    animationShouldStart = true;

    let nextYForThisTracer = Infinity;
    for (let i = tracer.pathIndex + 1; i < tracer.path.length; i++) {
      if (tracer.path[i].y > tracer.y + 0.1) {
        nextYForThisTracer = tracer.path[i].y;
        break;
      }
    }

    if (nextYForThisTracer !== Infinity) {
      tracer.stopY = nextYForThisTracer;
    } else {
      delete tracer.stopY;
    }
  });

  if (animationShouldStart) {
    animator.running = true;
    animationLoop();
  }
}

export async function resetAnimation(onComplete = null) {
  if (isAnimationRunning()) return;

  animator.onComplete = onComplete;

  state.setRevealedPrizes([]);
  const container = animator.context.canvas.closest('.canvas-panzoom-container');
  if (!container) return;

  const VIRTUAL_HEIGHT = getTargetHeight(container);
  const numParticipants = state.currentLotteryData.participants.length;
  const allParticipantsWithNames = state.currentLotteryData.participants.filter((p) => p.name);

  await preloadIcons(allParticipantsWithNames);

  animator.tracers = allParticipantsWithNames.map((p) => {
    const path = calculatePath(p.slot, state.currentLotteryData.lines, numParticipants, container.clientWidth, VIRTUAL_HEIGHT, container);
    return {
      name: p.name,
      color: p.color || '#333',
      path,
      pathIndex: 0,
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
