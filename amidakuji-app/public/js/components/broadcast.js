import * as api from '../api.js';
import * as state from '../state.js';
import * as router from '../router.js';
import {prepareStepAnimation, resetAnimation, advanceLineByLine, isAnimationRunning, startAnimation, fadePrizes} from '../animation.js';
import * as ui from '../ui.js';

const elements = {
  broadcastView: document.getElementById('broadcastView'),
  adminControls: document.getElementById('adminControls'),
  startEventButton: document.getElementById('startEventButton'),
  adminCanvas: document.getElementById('adminCanvas'),
  animateAllButton: document.getElementById('animateAllButton'),
  advanceLineByLineButton: document.getElementById('advanceLineByLineButton'),
  revealRandomButton: document.getElementById('revealRandomButton'),
  glimpseButton: document.getElementById('glimpseButton'),
  highlightUserSelect: document.getElementById('highlightUserSelect'),
  highlightUserButton: document.getElementById('highlightUserButton'),
  toggleFullscreenButton: document.getElementById('toggleFullscreenButton'),
  openSidebarButton: document.getElementById('openSidebarButton'),
  broadcastSidebar: document.getElementById('broadcastSidebar'),
  closeSidebarButton: document.getElementById('closeSidebarButton'),
};

function setBroadcastControlsDisabled(disabled) {
  const controls = document.querySelectorAll('#broadcastSidebar button, #broadcastSidebar select');
  controls.forEach((control) => {
    control.disabled = disabled;
  });
}

export function initBroadcast() {
  if (elements.startEventButton)
    elements.startEventButton.addEventListener('click', async () => {
      if (!confirm('イベントを開始しますか？\n開始後は新規参加ができなくなります。')) return;
      try {
        await api.startEvent(state.currentEventId);
        alert('イベントを開始しました！');
        await router.loadEventForEditing(state.currentEventId, 'broadcastView');
      } catch (error) {
        alert(`エラー: ${error.error}`);
      }
    });

  if (elements.animateAllButton) {
    elements.animateAllButton.addEventListener('click', async () => {
      setBroadcastControlsDisabled(true);
      await resetAnimation(() => {
        setBroadcastControlsDisabled(false);
      });
    });
  }

  if (elements.advanceLineByLineButton) {
    elements.advanceLineByLineButton.addEventListener('click', () => {
      setBroadcastControlsDisabled(true);
      advanceLineByLine(() => {
        setBroadcastControlsDisabled(false);
      });
    });
  }

  if (elements.revealRandomButton) {
    elements.revealRandomButton.addEventListener('click', async () => {
      if (isAnimationRunning()) return;
      const allParticipants = state.currentLotteryData.participants.filter((p) => p.name);
      const revealedNames = new Set(state.revealedPrizes.map((p) => p.participantName));
      const remainingParticipants = allParticipants.filter((p) => !revealedNames.has(p.name));

      if (remainingParticipants.length === 0) return;

      const randomParticipant = remainingParticipants[Math.floor(Math.random() * remainingParticipants.length)];
      const ctx = elements.adminCanvas.getContext('2d');
      elements.highlightUserSelect.value = randomParticipant.name;
      setBroadcastControlsDisabled(true);
      await startAnimation(
        ctx,
        [randomParticipant.name],
        () => {
          setBroadcastControlsDisabled(false);
        },
        randomParticipant.name
      );
    });
  }

  if (elements.glimpseButton) {
    const canvas = elements.adminCanvas;
    const ctx = canvas.getContext('2d');
    let isGlimpsing = false;

    const showPrizes = () => {
      if (isGlimpsing) return;
      isGlimpsing = true;
      fadePrizes(ctx, true);
    };

    const hidePrizes = () => {
      if (!isGlimpsing) return;
      isGlimpsing = false;
      fadePrizes(ctx, false);
    };

    // マウス操作
    elements.glimpseButton.addEventListener('mousedown', showPrizes);
    elements.glimpseButton.addEventListener('mouseup', hidePrizes);
    elements.glimpseButton.addEventListener('mouseleave', hidePrizes);

    // タッチ操作
    elements.glimpseButton.addEventListener('touchstart', (e) => {
      e.preventDefault();
      showPrizes();
    });
    elements.glimpseButton.addEventListener('touchend', (e) => {
      e.preventDefault();
      hidePrizes();
    });
  }

  if (elements.highlightUserButton)
    elements.highlightUserButton.addEventListener('click', async () => {
      if (isAnimationRunning()) return;
      if (elements.highlightUserSelect.value) {
        const ctx = elements.adminCanvas.getContext('2d');
        setBroadcastControlsDisabled(true);
        await startAnimation(
          ctx,
          [elements.highlightUserSelect.value],
          () => {
            setBroadcastControlsDisabled(false);
          },
          elements.highlightUserSelect.value
        );
      }
    });

  if (elements.openSidebarButton && elements.broadcastSidebar) {
    const overlay = document.createElement('div');
    overlay.className = 'broadcast-sidebar-overlay';
    document.body.appendChild(overlay);

    const closeSidebar = () => {
      elements.broadcastSidebar.classList.remove('is-open');
      overlay.classList.remove('is-visible');
    };
    const openSidebar = () => {
      elements.broadcastSidebar.classList.add('is-open');
      overlay.classList.add('is-visible');
    };

    elements.openSidebarButton.addEventListener('click', openSidebar);
    elements.closeSidebarButton.addEventListener('click', closeSidebar);
    overlay.addEventListener('click', closeSidebar);
  }

  if (elements.toggleFullscreenButton) {
    elements.toggleFullscreenButton.addEventListener('click', () => {
      const container = elements.adminCanvas.closest('.canvas-panzoom-container');
      if (container) {
        const isMaximized = container.classList.toggle('fullscreen-mode');
        elements.broadcastView.classList.toggle('fullscreen-active', isMaximized);

        elements.toggleFullscreenButton.textContent = isMaximized ? '元のサイズに戻す' : '表示エリアを最大化';

        setTimeout(() => {
          const hidePrizes = state.currentLotteryData?.displayMode === 'private';
          prepareStepAnimation(elements.adminCanvas.getContext('2d'), hidePrizes, false, true);
        }, 300);
      }
    });
  }
}
