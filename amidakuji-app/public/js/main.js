import * as api from './api.js';
import * as ui from './ui.js';
import * as state from './state.js';
import {startAnimation, stopAnimation, prepareStepAnimation, resetAnimation, advanceLineByLine, isAnimationRunning, redrawPrizes, showAllTracersInstantly, adminPanzoom, participantPanzoom} from './animation.js';
import { initGroupDashboard, renderGroupList } from './components/groupDashboard.js';
import { initEventDashboard } from './components/eventDashboard.js';
import { initMemberManagement } from './components/memberManagement.js';
import { initEventEdit } from './components/eventEdit.js';
import * as router from './router.js';


const settings = {
  animation: true,
  theme: 'auto',
};

const darkModeMatcher = window.matchMedia('(prefers-color-scheme: dark)');
let tronAnimationAPI = null;

document.addEventListener('DOMContentLoaded', initializeApp);

function initTronAnimation() {
  if (tronAnimationAPI) return tronAnimationAPI;

  const gridCanvas = document.getElementById('grid-canvas');
  const gridCtx = gridCanvas.getContext('2d');
  const animationCanvas = document.getElementById('animation-canvas');
  const animationCtx = animationCanvas.getContext('2d');

  const SCROLL_SPEED = 0.25;
  const CYCLE_COUNT = 5;
  const GRID_SIZE = 50;
  const TURN_CHANCE = 0.3;
  const CYCLE_SPEED = 8;
  const LINE_WIDTH = 1;
  const TAIL_LENGTH = 45;

  const themes = {
    dark: {background: '#121212', cycleColorRGB: '13, 132, 255', gridColor: '#444'},
    light: {background: '#f4f7f6', cycleColorRGB: '255, 140, 0', gridColor: '#ddd'},
  };
  let currentTheme;
  let cycles = [];
  let scrollX = 0;
  let scrollY = 0;
  let animationInitialized = false;

  function setupTheme(isDarkMode) {
    currentTheme = isDarkMode ? themes.dark : themes.light;
    if (cycles.length > 0) {
      cycles.forEach((c) => (c.colorRGB = currentTheme.cycleColorRGB));
    }
    drawGrid();
  }

  function resizeCanvases() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    gridCanvas.width = animationCanvas.width = width;
    gridCanvas.height = animationCanvas.height = height;
    drawGrid();
  }

  function drawGrid() {
    if (!currentTheme) return;
    gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
    gridCtx.save();
    gridCtx.translate(scrollX % GRID_SIZE, scrollY % GRID_SIZE);
    gridCtx.strokeStyle = currentTheme.gridColor;
    gridCtx.lineWidth = 1;
    gridCtx.beginPath();
    for (let x = -GRID_SIZE; x < gridCanvas.width + GRID_SIZE; x += GRID_SIZE) {
      gridCtx.moveTo(x, -GRID_SIZE);
      gridCtx.lineTo(x, gridCanvas.height + GRID_SIZE);
    }
    for (let y = -GRID_SIZE; y < gridCanvas.height + GRID_SIZE; y += GRID_SIZE) {
      gridCtx.moveTo(-GRID_SIZE, y);
      gridCtx.lineTo(gridCanvas.width + GRID_SIZE, y);
    }
    gridCtx.stroke();
    gridCtx.restore();
  }

  class LightCycle {
    constructor() {
      this.speed = CYCLE_SPEED;
      this.colorRGB = currentTheme.cycleColorRGB;
      this.tail = [];
      this.reset();
    }
    reset() {
      this.tail = [];
      const edge = Math.floor(Math.random() * 4);
      let startX, startY;
      const viewWidth = animationCanvas.width;
      const viewHeight = animationCanvas.height;
      if (edge === 0) {
        startX = -scrollX + Math.random() * viewWidth;
        startY = -scrollY;
      } else if (edge === 1) {
        startX = -scrollX + viewWidth;
        startY = -scrollY + Math.random() * viewHeight;
      } else if (edge === 2) {
        startX = -scrollX + Math.random() * viewWidth;
        startY = -scrollY + viewHeight;
      } else {
        startX = -scrollX;
        startY = -scrollY + Math.random() * viewHeight;
      }
      this.x = Math.round(startX / GRID_SIZE) * GRID_SIZE;
      this.y = Math.round(startY / GRID_SIZE) * GRID_SIZE;
      this.targetX = this.x;
      this.targetY = this.y;
      if (edge === 0) {
        this.dx = 0;
        this.dy = 1;
      } else if (edge === 1) {
        this.dx = -1;
        this.dy = 0;
      } else if (edge === 2) {
        this.dx = 0;
        this.dy = -1;
      } else {
        this.dx = 1;
        this.dy = 0;
      }
    }
    update() {
      if (this.x === this.targetX && this.y === this.targetY) {
        if (Math.random() < TURN_CHANCE) {
          const isHorizontal = this.dx !== 0;
          if (isHorizontal) {
            this.dx = 0;
            this.dy = Math.random() < 0.5 ? 1 : -1;
          } else {
            this.dx = Math.random() < 0.5 ? 1 : -1;
            this.dy = 0;
          }
        }
        this.targetX += this.dx * GRID_SIZE;
        this.targetY += this.dy * GRID_SIZE;
      }
      this.x += this.dx * this.speed;
      this.y += this.dy * this.speed;
      if (this.dx > 0) this.x = Math.min(this.x, this.targetX);
      if (this.dx < 0) this.x = Math.max(this.x, this.targetX);
      if (this.dy > 0) this.y = Math.min(this.y, this.targetY);
      if (this.dy < 0) this.y = Math.max(this.y, this.targetY);

      this.tail.unshift({x: this.x, y: this.y});
      if (this.tail.length > TAIL_LENGTH) {
        this.tail.pop();
      }

      const margin = GRID_SIZE * 2;
      const viewLeft = -scrollX - margin;
      const viewRight = -scrollX + animationCanvas.width + margin;
      const viewTop = -scrollY - margin;
      const viewBottom = -scrollY + animationCanvas.height + margin;
      if (this.x < viewLeft || this.x > viewRight || this.y < viewTop || this.y > viewBottom) {
        this.reset();
      }
    }
    draw(currentScrollX, currentScrollY) {
      for (let i = 0; i < this.tail.length - 1; i++) {
        const p1 = this.tail[i];
        const p2 = this.tail[i + 1];
        const alpha = 1.0 - i / this.tail.length;

        animationCtx.strokeStyle = `rgba(${this.colorRGB}, ${alpha})`;
        animationCtx.lineWidth = LINE_WIDTH;
        animationCtx.shadowColor = `rgba(${this.colorRGB}, ${alpha})`;
        animationCtx.shadowBlur = 15;
        animationCtx.lineCap = 'round';

        animationCtx.beginPath();
        animationCtx.moveTo(p1.x + currentScrollX, p1.y + currentScrollY);
        animationCtx.lineTo(p2.x + currentScrollX, p2.y + currentScrollY);
        animationCtx.stroke();
      }
    }
  }

  function animate() {
    scrollX -= SCROLL_SPEED;
    scrollY -= SCROLL_SPEED;

    drawGrid();

    animationCtx.clearRect(0, 0, animationCanvas.width, animationCanvas.height);

    cycles.forEach((cycle) => {
      cycle.update();
      cycle.draw(scrollX, scrollY);
    });

    requestAnimationFrame(animate);
  }

  if (!animationInitialized) {
    animationInitialized = true;
    setupTheme(settings.theme === 'dark' || (settings.theme === 'auto' && darkModeMatcher.matches));
    resizeCanvases();
    for (let i = 0; i < CYCLE_COUNT; i++) {
      cycles.push(new LightCycle());
    }
    animate();
    window.addEventListener('resize', resizeCanvases);
  }

  tronAnimationAPI = {
    setTheme: (theme) => {
      if (theme === 'dark') {
        setupTheme(true);
      } else if (theme === 'light') {
        setupTheme(false);
      } else {
        setupTheme(darkModeMatcher.matches);
      }
    },
  };

  return tronAnimationAPI;
}

const {elements} = ui;

async function initializeApp() {
  loadSettings();
  applySettings();
  setupSettingsControls();

  initGroupDashboard();
  initEventDashboard();
  initMemberManagement();
  initEventEdit();

  setupEventListeners();
  setupHamburgerMenu();
  if (settings.animation) {
    tronAnimationAPI = initTronAnimation();
  }

  const initialData = {
    group: typeof initialGroupData !== 'undefined' ? initialGroupData : null,
    event: typeof initialEventData !== 'undefined' ? initialEventData : null,
  };

  await router.navigateTo(window.location.pathname, false);

  if (state.currentUser && window.location.pathname === '/' && !initialData.group && !initialData.event) {
    await loadUserAndRedirect(state.currentUser.lastUsedGroupId);
  }
  lucide.createIcons();
}

export async function loadUserAndRedirect(lastUsedGroupId) {
  try {
    const groups = await api.getGroups();
    state.setAllUserGroups(groups);
    renderGroupList(groups);

    if (groups.length > 0) {
      let targetGroup = groups.find((g) => g.id === lastUsedGroupId) || groups[0];
      await router.navigateTo(`/admin/groups/${targetGroup.id}`);
    } else {
      ui.showView('groupDashboard');
    }
  } catch (error) {
    console.error(error);
    ui.showView('groupDashboard');
  }
}

export async function openGroupSettingsFor(groupId) {
  const groupData = state.allUserGroups.find((g) => g.id === groupId);
  if (!groupData) {
    alert('グループ情報が見つかりませんでした。');
    return;
  }

  groupData.hasPassword = !!groupData.password;

  const handlers = {
    onSave: handleSaveSettings,
    onDeletePassword: async () => {
      if (!confirm('本当にこのグループの合言葉を削除しますか？')) return;
      try {
        await api.deleteGroupPassword(groupId);
        alert('合言葉を削除しました。');
        if (elements.deletePasswordButton) {
          elements.deletePasswordButton.style.display = 'none';
        }
        const groupInState = state.allUserGroups.find((g) => g.id === groupId);
        if (groupInState) delete groupInState.password;
      } catch (error) {
        alert(error.error);
      }
    },
  };

  ui.openSettingsModal(groupData, handlers);
}

async function handleSaveSettings() {
  const groupId = elements.settingsGroupId.value;
  const settingsPayload = {
    groupName: elements.groupNameEditInput.value.trim(),
    customUrl: elements.customUrlInput.value.trim(),
    noIndex: elements.noIndexCheckbox.checked,
  };
  if (elements.groupPasswordInput.value) {
    settingsPayload.password = elements.groupPasswordInput.value;
  }

  elements.saveGroupSettingsButton.disabled = true;
  try {
    await api.updateGroupSettings(groupId, settingsPayload);
    alert('設定を保存しました。');
    ui.closeSettingsModal();
    const groups = await api.getGroups();
    state.setAllUserGroups(groups);
    renderGroupList(groups);
  } catch (error) {
    alert(error.error || '設定の保存に失敗しました。');
  } finally {
    elements.saveGroupSettingsButton.disabled = false;
  }
}

export async function handleCopyEvent(eventId) {
  if (!confirm('このイベントをコピーしますか？')) return;
  try {
    await api.copyEvent(eventId);
    alert('イベントをコピーしました。');
    await router.navigateTo(window.location.pathname, false);
  } catch (error) {
    alert(`エラー: ${error.error}`);
  }
}

async function handleApproveAdmin(requestId) {
  if (!confirm('このユーザーの管理者権限を承認しますか？')) return;
  try {
    await api.approveAdminRequest(requestId);
    alert('申請を承認しました。');
    await router.navigateTo('/admin/dashboard', false);
  } catch (error) {
    alert(error.error);
  }
}

async function handleImpersonate(userId) {
  if (!confirm('このユーザーとしてログインしますか？')) return;
  try {
    await api.impersonateUser(userId);
    alert('成り代わりました。ページをリロードします。');
    window.location.href = '/';
  } catch (error) {
    alert(error.error);
  }
}

async function handleDemoteAdmin(userId) {
  if (!confirm('本当にこのシステム管理者を通常ユーザーに戻しますか？')) return;
  try {
    await api.demoteAdmin(userId);
    alert('ユーザーを降格させました。');
    await router.navigateTo('/admin/dashboard', false);
  } catch (error) {
    alert(error.error);
  }
}

function handleShareResult() {
  if (!state.currentEventId || !state.currentParticipantName) return;
  const shareUrl = `${window.location.origin}/share/${state.currentEventId}/${encodeURIComponent(state.currentParticipantName)}`;
  navigator.clipboard
    .writeText(shareUrl)
    .then(() => {
      alert('クリップボードにシェア用URLをコピーしました！');
    })
    .catch((err) => {
      prompt('このURLをコピーしてシェアしてください:', shareUrl);
    });
}

async function buildNewPrizesWithDataPreservation(newNames) {
  const oldPrizes = [...state.prizes];
  const prizeMasters = await api.getPrizeMasters(state.currentGroupId).catch(() => []);
  const oldPrizesMap = new Map(oldPrizes.map((p) => [p.name, p]));
  const prizeMastersMap = new Map(prizeMasters.map((p) => [p.name, p.imageUrl]));

  const newPrizes = newNames.map((name) => {
    if (oldPrizesMap.has(name)) {
      return {...oldPrizesMap.get(name)};
    }
    if (prizeMastersMap.has(name)) {
      return {name, imageUrl: prizeMastersMap.get(name), newImageFile: null};
    }
    return {name, imageUrl: null, newImageFile: null};
  });
  return newPrizes;
}

function setupEventListeners() {
  const {elements} = ui;

  window.addEventListener('popstate', (e) => {
    router.navigateTo(window.location.pathname, false);
  });

  if (elements.loginButton)
    elements.loginButton.addEventListener('click', () => {
      window.location.href = '/auth/google';
    });
  if (elements.landingLoginButton)
    elements.landingLoginButton.addEventListener('click', () => {
      window.location.href = '/auth/google';
    });
  if (elements.logoutButton)
    elements.logoutButton.addEventListener('click', async () => {
      const isAdminPage = window.location.pathname.startsWith('/admin') || window.location.pathname === '/';

      if (isAdminPage) {
        window.location.href = '/auth/logout';
      } else {
        const currentPath = window.location.pathname;
        window.location.href = `/auth/logout?redirect_to=${encodeURIComponent(currentPath)}`;
      }
    });
  if (elements.deleteAccountButton)
    elements.deleteAccountButton.addEventListener('click', async () => {
      if (!confirm('本当にアカウントを削除しますか？関連する全てのデータが完全に削除され、元に戻すことはできません。')) return;
      try {
        await api.deleteUserAccount();
        alert('アカウントを削除しました。');
        window.location.href = '/';
      } catch (error) {
        alert(error.error);
      }
    });
  if (elements.requestAdminButton)
    elements.requestAdminButton.addEventListener('click', async () => {
      if (!confirm('システム管理者権限を申請しますか？')) return;
      try {
        const result = await api.requestAdminAccess();
        alert(result.message);
        elements.requestAdminButton.textContent = '申請中';
        elements.requestAdminButton.disabled = true;
      } catch (error) {
        alert(`エラー: ${error.error}`);
      }
    });
  if (elements.stopImpersonatingButton)
    elements.stopImpersonatingButton.addEventListener('click', async () => {
      try {
        await api.stopImpersonating();
        alert('成り代わりを解除しました。ページをリロードします。');
        window.location.href = '/admin';
      } catch (error) {
        alert(error.error);
      }
    });
  if (elements.adminDashboardButton) {
    elements.adminDashboardButton.addEventListener('click', (e) => {
      router.navigateTo('/admin/dashboard');
    });
  }

  if (elements.backToDashboardFromEventListButton) {
    elements.backToDashboardFromEventListButton.addEventListener('click', async (e) => {
      const button = e.currentTarget;
      const role = button.dataset.role;
      const groupId = button.dataset.groupId;

      if (!groupId) {
        console.error('No groupId found on dashboard button, cannot switch view.');
        await router.navigateTo('/');
        return;
      }

      if (role === 'admin') {
        await router.navigateTo(`/admin/groups/${groupId}`);
      } else {
        try {
          const group = await api.getGroup(groupId);
          if (group && group.customUrl) {
            await router.navigateTo(`/g/${group.customUrl}/dashboard`);
          } else {
            await router.navigateTo(`/groups/${groupId}`);
          }
        } catch (error) {
          console.error('Failed to get group info for navigation:', error);
          await router.navigateTo('/');
        }
      }
    });
  }

  if (elements.adminDashboard) {
    elements.adminDashboard.addEventListener('click', async (e) => {
      const button = e.target.closest('button');
      if (!button) return;

      if (button.classList.contains('impersonate-btn')) {
        await handleImpersonate(button.dataset.userId);
      } else if (button.classList.contains('approve-btn')) {
        await handleApproveAdmin(button.dataset.requestId);
      } else if (button.classList.contains('demote-btn')) {
        await handleDemoteAdmin(button.dataset.userId);
      }
    });
  }

  if (elements.currentGroupName) {
    elements.currentGroupName.addEventListener('click', (e) => {
      e.stopPropagation();
      elements.groupDropdown.style.display = elements.groupDropdown.style.display === 'block' ? 'none' : 'block';
    });
  }

  if (elements.switcherGroupList) {
    elements.switcherGroupList.addEventListener('click', async (e) => {
      if (e.target.tagName === 'BUTTON') {
        const {groupId} = e.target.dataset;
        elements.groupDropdown.style.display = 'none';
        await router.navigateTo(`/admin/groups/${groupId}`);
      }
    });
  }

  if (elements.switcherCreateGroup) {
    elements.switcherCreateGroup.addEventListener('click', async () => {
      elements.groupDropdown.style.display = 'none';
      await router.navigateTo('/');
    });
  }
  
  if (elements.closeSettingsModalButton) elements.closeSettingsModalButton.addEventListener('click', ui.closeSettingsModal);
  if (elements.closePrizeMasterModalButton) elements.closePrizeMasterModalButton.addEventListener('click', ui.closePrizeMasterModal);
  
  if (elements.closePasswordSetModal)
    elements.closePasswordSetModal.addEventListener('click', () => {
      if (elements.passwordSetModal) elements.passwordSetModal.style.display = 'none';
    });
  if (elements.closeProfileModalButton) elements.closeProfileModalButton.addEventListener('click', ui.closeProfileEditModal);
  if (elements.closePrizeMasterSelectModal) elements.closePrizeMasterSelectModal.addEventListener('click', ui.closePrizeMasterSelectModal);
  if (elements.closeGroupPasswordModalButton) elements.closeGroupPasswordModalButton.addEventListener('click', ui.closeGroupPasswordModal);
  
  if (elements.verifyPasswordButton)
    elements.verifyPasswordButton.addEventListener('click', async () => {
      const groupId = elements.verificationTargetGroupId.value;
      const password = elements.groupPasswordVerifyInput.value;
      if (!password) return alert('合言葉を入力してください。');
      try {
        const result = await api.verifyGroupPassword(groupId, password);
        if (result.success) {
          alert('認証しました！');
          ui.closeGroupPasswordModal();
          if (state.lastFailedAction) {
            await state.lastFailedAction();
            state.setLastFailedAction(null);
          }
        }
      } catch (error) {
        alert(`エラー: ${error.error}`);
      }
    });

  if (elements.customUrlInput)
    elements.customUrlInput.addEventListener('keyup', () => {
      if (elements.customUrlPreview) elements.customUrlPreview.textContent = elements.customUrlInput.value.trim();
    });
    
  if (elements.backToDashboardButton)
    elements.backToDashboardButton.addEventListener('click', async () => {
      if (state.currentGroupId) {
        await router.navigateTo(`/admin/groups/${state.currentGroupId}`);
      } else {
        await router.navigateTo('/');
      }
    });
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
      ui.setBroadcastControlsDisabled(true);
      await resetAnimation(() => {
        ui.setBroadcastControlsDisabled(false);
      });
    });
  }

  if (elements.advanceLineByLineButton) {
    elements.advanceLineByLineButton.addEventListener('click', () => {
      ui.setBroadcastControlsDisabled(true);
      advanceLineByLine(() => {
        ui.setBroadcastControlsDisabled(false);
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
      ui.setBroadcastControlsDisabled(true);
      await startAnimation(
        ctx,
        [randomParticipant.name],
        () => {
          ui.setBroadcastControlsDisabled(false);
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

          const hide = state.currentLotteryData.displayMode === 'private';
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
          const hide = state.currentLotteryData.displayMode === 'private';
          await prepareStepAnimation(ctx, hide);

          alert('景品をシャッフルし、結果を保存しました。');
        } catch (error) {
          alert(`エラー: ${error.error || '景品のシャッフルに失敗しました。'}`);
        }
      }
    });
  }

  if (elements.glimpseButton) {
    const canvas = elements.adminCanvas;
    const ctx = canvas.getContext('2d');
    const transitionDuration = 150;
    let isGlimpsing = false;

    const showPrizes = async () => {
      if (isGlimpsing) return;
      isGlimpsing = true;
      canvas.style.transition = `opacity ${transitionDuration}ms`;
      canvas.style.opacity = '0';
      await new Promise((r) => setTimeout(r, transitionDuration));
      redrawPrizes(ctx, false);
      canvas.style.opacity = '1';
    };

    const hidePrizes = async () => {
      if (!isGlimpsing) return;
      isGlimpsing = false;
      canvas.style.opacity = '0';
      await new Promise((r) => setTimeout(r, transitionDuration));
      redrawPrizes(ctx, true);
      canvas.style.opacity = '1';
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

  if (elements.highlightUserButton)
    elements.highlightUserButton.addEventListener('click', async () => {
      if (isAnimationRunning()) return;
      if (elements.highlightUserSelect.value) {
        const ctx = elements.adminCanvas.getContext('2d');
        ui.setBroadcastControlsDisabled(true);
        await startAnimation(
          ctx,
          [elements.highlightUserSelect.value],
          () => {
            ui.setBroadcastControlsDisabled(false);
          },
          elements.highlightUserSelect.value
        );
      }
    });

  if (elements.confirmNameButton) {
    elements.confirmNameButton.addEventListener('click', async () => {
      const name = elements.nameInput.value.trim();
      if (state.currentEventId) {
        await router.handleLoginOrRegister(state.currentEventId, name);
      } else if (state.currentGroupId) {
        await router.handleParticipantLogin(state.currentGroupId, name);
      }
    });
  }

  if (elements.nameInput)
    elements.nameInput.addEventListener('keyup', () => {
      clearTimeout(state.debounceTimer);
      const query = elements.nameInput.value.trim();
      if (query.length === 0) {
        if (elements.suggestionList) elements.suggestionList.innerHTML = '';
        return;
      }
      state.setDebounceTimer(
        setTimeout(async () => {
          try {
            const suggestions = await api.getMemberSuggestions(state.currentGroupId, query);
            ui.renderSuggestions(suggestions, async (name, memberId, hasPassword) => {
              elements.nameInput.value = name;
              elements.suggestionList.innerHTML = '';
              const contextGroupId = state.currentGroupId;
              if (state.currentEventId) {
                if (hasPassword) {
                  const password = prompt(`「${name}」さんの合言葉を入力してください:`);
                  if (password) await router.verifyAndLogin(state.currentEventId, memberId, password);
                } else {
                  await router.handleLoginOrRegister(state.currentEventId, name, memberId);
                }
              } else if (contextGroupId) {
                await router.handleParticipantLogin(contextGroupId, name, memberId);
              }
            });
          } catch (e) {
            console.error('Suggestion fetch failed', e);
          }
        }, 300)
      );
    });

  if (elements.goToAmidaButton)
    elements.goToAmidaButton.addEventListener('click', async () => {
      const eventData = await api.getPublicEventData(state.currentEventId);
      state.setCurrentLotteryData(eventData);
      if (eventData.status === 'started') {
        await router.navigateTo(window.location.pathname, false);
      } else {
        const myParticipation = eventData.participants.find((p) => p.memberId === state.currentParticipantId);
        if (myParticipation && myParticipation.name) {
          ui.showWaitingView();
        } else {
          ui.showJoinView(eventData);
        }
      }
    });

  if (elements.backToControlPanelButton)
    elements.backToControlPanelButton.addEventListener('click', async () => {
      try {
        const group = await api.getGroup(state.currentGroupId);
        if (group && group.customUrl) {
          await router.navigateTo(`/g/${group.customUrl}/dashboard`);
        } else {
          await router.navigateTo('/');
        }
      } catch (error) {
        console.error('Failed to get group info for navigation:', error);
        await router.navigateTo('/');
      }
    });

  if (elements.backToControlPanelFromResultButton)
    elements.backToControlPanelFromResultButton.addEventListener('click', async () => {
      try {
        const group = await api.getGroup(state.currentGroupId);
        if (group && group.customUrl) {
          await router.navigateTo(`/g/${group.customUrl}/dashboard`);
        } else {
          await router.navigateTo('/');
        }
      } catch (error) {
        console.error('Failed to get group info for navigation:', error);
        await router.navigateTo('/');
      }
    });

  if (elements.setPasswordButton)
    elements.setPasswordButton.addEventListener('click', async () => {
      try {
        const memberData = await api.getMemberDetails(state.currentGroupId, state.currentParticipantId);
        ui.openPasswordSetModal(
          {
            onSave: async () => {
              const password = elements.newPasswordInput.value;
              try {
                await api.setPassword(state.currentParticipantId, password, state.currentGroupId, state.currentParticipantToken);
                alert('合言葉を設定しました。');
                elements.passwordSetModal.style.display = 'none';
              } catch (error) {
                alert(error.error);
              }
            },
          },
          !!memberData.password
        );
      } catch (error) {
        alert('ユーザー情報の取得に失敗しました。');
      }
    });

  if (elements.deleteUserPasswordButton) {
    elements.deleteUserPasswordButton.addEventListener('click', async () => {
      if (confirm('合言葉を削除しますか？')) {
        try {
          await api.setPassword(state.currentParticipantId, null, state.currentGroupId, state.currentParticipantToken);
          alert('合言葉を削除しました。');
          elements.passwordSetModal.style.display = 'none';
        } catch (error) {
          alert(error.error || '合言葉の削除に失敗しました。');
        }
      }
    });
  }

  if (elements.backToDashboardFromWaitingButton) {
    elements.backToDashboardFromWaitingButton.addEventListener('click', async () => {
      try {
        const group = await api.getGroup(state.currentGroupId);
        if (group && group.customUrl) {
          await router.navigateTo(`/g/${group.customUrl}/dashboard`);
        } else {
          await router.navigateTo(`/groups/${state.currentGroupId}`);
        }
      } catch (error) {
        console.error('Failed to get group info for navigation:', error);
        await router.navigateTo('/');
      }
    });
  }
  if (elements.participantLogoutButton)
    elements.participantLogoutButton.addEventListener('click', async () => {
      try {
        await api.clearGroupVerification();
      } catch (error) {
        console.error('Failed to clear group verification session:', error);
      } finally {
        state.clearParticipantState();
        window.location.reload();
      }
    });
  if (elements.deleteMyAccountButton)
    elements.deleteMyAccountButton.addEventListener('click', async () => {
      if (!confirm('本当にこのグループからあなたのアカウントを削除しますか？\nこの操作は元に戻せません。')) return;
      try {
        await api.deleteMemberAccount(state.currentGroupId, state.currentParticipantId, state.currentParticipantToken);
        alert('アカウントを削除しました。');
        state.clearParticipantState();
        window.location.reload();
      } catch (error) {
        alert(`削除エラー: ${error.error}`);
      }
    });
  if (elements.slotList)
    elements.slotList.addEventListener('click', (e) => {
      const target = e.target.closest('.slot.available');
      if (!target) return;
      document.querySelectorAll('.slot.selected').forEach((el) => el.classList.remove('selected'));
      target.classList.add('selected');
      state.setSelectedSlot(parseInt(target.dataset.slot, 10));
      if (elements.joinButton) elements.joinButton.disabled = false;
    });
  if (elements.joinButton)
    elements.joinButton.addEventListener('click', async () => {
      if (state.selectedSlot === null) return alert('参加枠を選択してください。');
      elements.joinButton.disabled = true;
      try {
        await api.joinSlot(state.currentEventId, state.currentParticipantId, state.currentParticipantToken, state.selectedSlot);
        await router.navigateTo(window.location.pathname, false);
      } catch (error) {
        alert(error.error);
      } finally {
        elements.joinButton.disabled = false;
      }
    });
  if (elements.shareButton) elements.shareButton.addEventListener('click', handleShareResult);
  if (elements.deleteParticipantWaitingButton)
    elements.deleteParticipantWaitingButton.addEventListener('click', async () => {
      if (!confirm('このイベントへの参加を取り消しますか？')) return;
      try {
        await api.deleteParticipant(state.currentEventId, state.currentParticipantToken);
        alert('参加を取り消しました。');
        window.location.reload();
      } catch (error) {
        alert(error.error);
      }
    });

  if (elements.editProfileButton)
    elements.editProfileButton.addEventListener('click', async () => {
      try {
        const memberData = await api.getMemberDetails(state.currentGroupId, state.currentParticipantId);
        ui.openProfileEditModal(memberData, {
          onSave: async () => {
            elements.saveProfileButton.disabled = true;
            try {
              let newIconUrl = null;
              const file = elements.profileIconInput.files[0];
              if (file) {
                const {signedUrl, iconUrl} = await api.generateUploadUrl(state.currentParticipantId, file.type, state.currentGroupId, state.currentParticipantToken);
                await fetch(signedUrl, {method: 'PUT', headers: {'Content-Type': file.type}, body: file});
                newIconUrl = iconUrl;
              }
              const profileData = {color: elements.profileColorInput.value};
              if (newIconUrl) profileData.iconUrl = newIconUrl;

              await api.updateProfile(state.currentParticipantId, profileData, state.currentGroupId, state.currentParticipantToken);
              alert('プロフィールを保存しました。');
              ui.closeProfileEditModal();
            } catch (error) {
              alert(error.error);
            } finally {
              elements.saveProfileButton.disabled = false;
            }
          },
        });
      } catch (error) {
        alert(error.error);
      }
    });
  if (elements.profileIconInput)
    elements.profileIconInput.addEventListener('change', () => {
      const file = elements.profileIconInput.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (elements.profileIconPreview) elements.profileIconPreview.src = e.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  if (elements.prizeMasterSelectList)
    elements.prizeMasterSelectList.addEventListener('click', (e) => {
      const item = e.target.closest('li');
      if (item) {
        item.classList.toggle('selected');
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.checked = item.classList.contains('selected');
      }
    });
    
  window.addEventListener('resize', ui.adjustBodyPadding);
  window.addEventListener('click', (event) => {
    if (elements.groupSettingsModal && event.target == elements.groupSettingsModal) ui.closeSettingsModal();
    if (elements.profileEditModal && event.target == elements.profileEditModal) ui.closeProfileEditModal();
    if (elements.passwordSetModal && event.target == elements.passwordSetModal) elements.passwordSetModal.style.display = 'none';
    if (elements.prizeMasterSelectModal && event.target == elements.prizeMasterSelectModal) ui.closePrizeMasterSelectModal();
    if (elements.groupDropdown && elements.groupDropdown.style.display === 'block' && !elements.groupSwitcher.contains(event.target)) {
      elements.groupDropdown.style.display = 'none';
    }
    if (elements.prizeMasterModal && event.target == elements.prizeMasterModal) ui.closePrizeMasterModal();
    if (elements.passwordResetRequestModal && event.target == elements.passwordResetRequestModal) ui.closePasswordResetRequestModal();
    if (elements.memberEditModal && event.target == elements.memberEditModal) ui.closeMemberEditModal();
    if (elements.bulkRegisterModal && event.target == elements.bulkRegisterModal) ui.closeBulkRegisterModal();
    if (elements.addPrizeModal && event.target == elements.addPrizeModal) ui.closeAddPrizeModal();
    if (elements.summaryModal && event.target == elements.summaryModal) ui.closeSummaryModal();
    const link = event.target.closest('a');
    if (link && link.href && link.target !== '_blank') {
      const url = new URL(link.href);
      if (url.origin === window.location.origin) {
        event.preventDefault();
        router.navigateTo(url.pathname);
      }
    }
  });

  const showAcknowledgedEventsCheckbox = document.getElementById('showAcknowledgedEvents');
  if (showAcknowledgedEventsCheckbox) {
    showAcknowledgedEventsCheckbox.addEventListener('change', () => {
      localStorage.setItem('showAcknowledgedEvents', showAcknowledgedEventsCheckbox.checked);

      if (state.participantEventList && state.currentGroupData) {
        ui.renderOtherEvents(state.participantEventList, state.currentGroupData.customUrl);
      }
    });
  }

  const acknowledgeButton = document.getElementById('acknowledgeButton');
  if (acknowledgeButton) {
    acknowledgeButton.addEventListener('click', async () => {
      try {
        await api.acknowledgeResult(state.currentEventId, state.currentParticipantId, state.currentParticipantToken);
        acknowledgeButton.style.display = 'none';
        const participant = state.currentLotteryData.participants.find((p) => p.memberId === state.currentParticipantId);
        if (participant) {
          participant.acknowledgedResult = true;
        }
        alert('結果を受け取りました！');
      } catch (error) {
        alert(`エラー: ${error.error || '処理に失敗しました。'}`);
      }
    });
  }
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
  if (elements.allResultsContainer) {
    elements.allResultsContainer.addEventListener('click', (e) => {
      if (e.target.id === 'showAllTracersButton') {
        if (isAnimationRunning()) {
          return;
        }
        showAllTracersInstantly();
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
        broadcastView.classList.toggle('fullscreen-active', isMaximized);

        elements.toggleFullscreenButton.textContent = isMaximized ? '元のサイズに戻す' : '表示エリアを最大化';

        setTimeout(() => {
          const hidePrizes = state.currentLotteryData?.displayMode === 'private';
          prepareStepAnimation(elements.adminCanvas.getContext('2d'), hidePrizes, false, true);
        }, 300);
      }
    });
  }
}

function setupHamburgerMenu() {
  if (elements.hamburgerButton && elements.navMenu) {
    elements.hamburgerButton.addEventListener('click', () => {
      const isOpened = elements.hamburgerButton.classList.toggle('active');
      elements.navMenu.classList.toggle('active');
      elements.hamburgerButton.setAttribute('aria-expanded', isOpened);
    });

    elements.navMenu.addEventListener('click', (e) => {
      const target = e.target.closest('button, a');
      if (target) {
        elements.hamburgerButton.classList.remove('active');
        elements.navMenu.classList.remove('active');
        elements.hamburgerButton.setAttribute('aria-expanded', 'false');
      }
    });
  }
}

function loadSettings() {
  const savedSettings = JSON.parse(localStorage.getItem('userSettings'));
  if (savedSettings) {
    settings.animation = typeof savedSettings.animation !== 'undefined' ? savedSettings.animation : true;
    settings.theme = savedSettings.theme || 'auto';
  }
}

function saveSettings() {
  localStorage.setItem('userSettings', JSON.stringify(settings));
}

async function applyTheme(theme, storedState) {
  document.body.classList.remove('light-mode', 'dark-mode');
  if (theme === 'light') {
    document.body.classList.add('light-mode');
  } else if (theme === 'dark') {
    document.body.classList.add('dark-mode');
  } else {
    if (darkModeMatcher.matches) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.add('light-mode');
    }
  }
  if (settings.animation && tronAnimationAPI) {
    tronAnimationAPI.setTheme(theme);
  }

  if (isAnimationRunning()) return;

  const adminCanvas = document.getElementById('adminCanvas');
  const participantCanvas = document.getElementById('participantCanvas');
  let targetCanvas = null;

  if (adminCanvas && adminCanvas.offsetParent !== null) {
    targetCanvas = adminCanvas;
  } else if (participantCanvas && participantCanvas.offsetParent !== null) {
    targetCanvas = participantCanvas;
  }

  if (targetCanvas && state.currentLotteryData) {
    const hidePrizes = state.currentLotteryData.displayMode === 'private' && state.currentLotteryData.status !== 'started';
    await prepareStepAnimation(targetCanvas.getContext('2d'), hidePrizes, false, true, storedState);
  }
}

function handleSystemThemeChange(e) {
  if (settings.theme === 'auto') {
    applyTheme('auto');
  }
}

function applySettings() {
  const canvasContainer = document.getElementById('canvas-container');
  if (canvasContainer) {
    canvasContainer.style.display = settings.animation ? 'block' : 'none';
  }

  applyTheme(settings.theme);
  darkModeMatcher.removeEventListener('change', handleSystemThemeChange);
  if (settings.theme === 'auto') {
    darkModeMatcher.addEventListener('change', handleSystemThemeChange);
  }

  const animationToggle = document.getElementById('animationToggle');
  if (animationToggle) {
    animationToggle.checked = settings.animation;
  }
  const themeRadio = document.querySelector(`input[name="theme"][value="${settings.theme}"]`);
  if (themeRadio) {
    themeRadio.checked = true;
  }
}
function setupSettingsControls() {
  const fab = document.getElementById('settingsFab');
  const panel = document.getElementById('settingsPanel');
  const animationToggle = document.getElementById('animationToggle');
  const themeRadios = document.querySelectorAll('input[name="theme"]');

  if (!fab || !panel) return;

  fab.addEventListener('click', () => {
    panel.classList.toggle('visible');
    fab.classList.toggle('active');
  });

  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && !fab.contains(e.target)) {
      panel.classList.remove('visible');
      fab.classList.remove('active');
    }
  });

  if (animationToggle) {
    animationToggle.addEventListener('change', () => {
      settings.animation = animationToggle.checked;
      saveSettings();
      const canvasContainer = document.getElementById('canvas-container');
      if (settings.animation) {
        canvasContainer.style.display = 'block';
        tronAnimationAPI = initTronAnimation();
        tronAnimationAPI.setTheme(settings.theme);
      } else {
        canvasContainer.style.display = 'none';
      }
    });
  }

  themeRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      let storedState = null;
      let panzoomInstance = null;
      const adminCanvas = document.getElementById('adminCanvas');
      const participantCanvas = document.getElementById('participantCanvas');

      if (adminCanvas && adminCanvas.offsetParent !== null) {
        panzoomInstance = adminPanzoom;
      } else if (participantCanvas && participantCanvas.offsetParent !== null) {
        panzoomInstance = participantPanzoom;
      }

      if (panzoomInstance) {
        storedState = {
          pan: panzoomInstance.getPan(),
          scale: panzoomInstance.getScale(),
        };
      }
      settings.theme = radio.value;
      saveSettings();
      applyTheme(settings.theme, storedState);
    });
  });
}