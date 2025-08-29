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
  regenerateLinesButton: document.getElementById('regenerateLinesButton'),
  shufflePrizesBroadcastButton: document.getElementById('shufflePrizesBroadcastButton'),
  glimpseButton: document.getElementById('glimpseButton'),
  highlightUserSelect: document.getElementById('highlightUserSelect'),
  highlightUserButton: document.getElementById('highlightUserButton'),
  toggleFullscreenButton: document.getElementById('toggleFullscreenButton'),
  openSidebarButton: document.getElementById('openSidebarButton'),
  broadcastSidebar: document.getElementById('broadcastSidebar'),
  closeSidebarButton: document.getElementById('closeSidebarButton'),
  showFillSlotsModalButton: document.getElementById('showFillSlotsModalButton'),
  fillSlotsModal: document.getElementById('fillSlotsModal'),
  unjoinedMemberList: document.getElementById('unjoinedMemberList'),
  emptySlotCount: document.getElementById('emptySlotCount'),
  selectMembersButton: document.getElementById('selectMembersButton'),
  selectedMemberList: document.getElementById('selectedMemberList'),
  confirmFillSlotsButton: document.getElementById('confirmFillSlotsButton'),
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
        await router.navigateTo(`/admin/event/${state.currentEventId}/broadcast`);
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

  if (elements.broadcastView) {
    elements.broadcastView.addEventListener('click', async (e) => {
      if (e.target.id === 'regenerateLinesButton') {
        if (!confirm('あみだくじのパターンを再生成しますか？')) return;
        try {
          const result = await api.regenerateLines(state.currentEventId);
          state.currentLotteryData.lines = result.lines;
          state.currentLotteryData.results = result.results;

          const ctx = elements.adminCanvas.getContext('2d');

          if (elements.advanceLineByLineButton) elements.advanceLineByLineButton.disabled = false;
          if (elements.revealRandomButton) elements.revealRandomButton.disabled = false;
          if (elements.highlightUserButton) elements.highlightUserButton.disabled = false;
          if (elements.animateAllButton) elements.animateAllButton.disabled = false;

          const hide = true;
          await prepareStepAnimation(ctx, hide);
          alert('あみだくじを再生成しました。');
        } catch (error) {
          alert(`エラー: ${error.error || '再生成に失敗しました。'}`);
        }
      }
      if (e.target.id === 'shufflePrizesBroadcastButton') {
        if (!confirm('景品の並び順をランダムに入れ替えますか？\nこの操作はデータベースに保存され、元に戻せません。')) return;

        try {
          const shuffledPrizes = [...state.currentLotteryData.prizes];
          for (let i = shuffledPrizes.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledPrizes[i], shuffledPrizes[j]] = [shuffledPrizes[j], shuffledPrizes[i]];
          }

          const result = await api.shufflePrizes(state.currentEventId, shuffledPrizes);

          state.currentLotteryData.prizes = result.prizes;
          state.currentLotteryData.results = result.results;

          const ctx = elements.adminCanvas.getContext('2d');
          const hide = true;
          await prepareStepAnimation(ctx, hide);

          alert('景品をシャッフルし、結果を保存しました。');
        } catch (error) {
          alert(`エラー: ${error.error || '景品のシャッフルに失敗しました。'}`);
        }
      }
    });
  }

  // ★★★★★★★★★★★★★★★★★★★★★★★★★★★
  // ★★★ ここからが修正点 ★★★
  // ★★★★★★★★★★★★★★★★★★★★★★★★★★★
  if (elements.glimpseButton) {
    const canvas = elements.adminCanvas;
    const ctx = canvas.getContext('2d');
    let isGlimpsing = false; // Flag to track button press state

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

    elements.glimpseButton.addEventListener('mousedown', showPrizes);
    elements.glimpseButton.addEventListener('mouseup', hidePrizes);
    elements.glimpseButton.addEventListener('mouseleave', hidePrizes);

    elements.glimpseButton.addEventListener('touchstart', (e) => {
      e.preventDefault();
      showPrizes();
    });
    elements.glimpseButton.addEventListener('touchend', (e) => {
      e.preventDefault();
      hidePrizes();
    });
  }
  // ★★★★★★★★★★★★★★★★★★★★★★★★★★★
  // ★★★ 修正はここまで ★★★
  // ★★★★★★★★★★★★★★★★★★★★★★★★★★★

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

  let selectedAssignments = [];

  if (elements.showFillSlotsModalButton) {
    elements.showFillSlotsModalButton.addEventListener('click', async () => {
      elements.fillSlotsModal.style.display = 'block';
      document.getElementById('fillSlotsStep1').style.display = 'block';
      document.getElementById('fillSlotsStep2').style.display = 'none';
      elements.unjoinedMemberList.innerHTML = '<li>読み込み中...</li>';

      try {
        const unjoinedMembers = await api.getUnjoinedMembers(state.currentGroupId, state.currentEventId);
        const emptySlots = state.currentLotteryData.participants.filter((p) => p.name === null).length;
        elements.emptySlotCount.textContent = emptySlots;

        if (unjoinedMembers.length > 0) {
          elements.unjoinedMemberList.innerHTML = unjoinedMembers.map((m) => `<li class="item-list-item">${m.name}</li>`).join('');
          elements.selectMembersButton.disabled = false;
        } else {
          elements.unjoinedMemberList.innerHTML = '<li>対象メンバーがいません。</li>';
          elements.selectMembersButton.disabled = true;
        }
      } catch (error) {
        elements.unjoinedMemberList.innerHTML = `<li class="error-message">${error.error}</li>`;
      }
    });
  }

  if (elements.fillSlotsModal) {
    elements.fillSlotsModal.querySelector('.close-button').addEventListener('click', () => {
      elements.fillSlotsModal.style.display = 'none';
    });
  }

  if (elements.selectMembersButton) {
    elements.selectMembersButton.addEventListener('click', async () => {
      const unjoinedMembers = await api.getUnjoinedMembers(state.currentGroupId, state.currentEventId);
      const emptySlots = state.currentLotteryData.participants.filter((p) => p.name === null).length;

      if (unjoinedMembers.length < emptySlots) {
        alert('空き枠数に対して、未参加のアクティブメンバーが不足しています。');
        selectedAssignments = [...unjoinedMembers];
      } else {
        const shuffled = unjoinedMembers.sort(() => 0.5 - Math.random());
        selectedAssignments = shuffled.slice(0, emptySlots);
      }

      elements.selectedMemberList.innerHTML = selectedAssignments.map((m) => `<li class="item-list-item">${m.name}</li>`).join('');
      document.getElementById('fillSlotsStep1').style.display = 'none';
      document.getElementById('fillSlotsStep2').style.display = 'block';
    });
  }

  if (elements.confirmFillSlotsButton) {
    elements.confirmFillSlotsButton.addEventListener('click', async () => {
      try {
        await api.fillSlots(
          state.currentEventId,
          selectedAssignments.map((m) => ({id: m.id, name: m.name}))
        );
        elements.fillSlotsModal.style.display = 'none';
        alert('参加枠を更新しました。');
        await router.loadEventForEditing(state.currentEventId, 'broadcastView');
      } catch (error) {
        alert(`エラー: ${error.error}`);
      }
    });
  }

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
