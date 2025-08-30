import * as api from './api.js';
import * as ui from './ui.js';
import * as state from './state.js';
import {startAnimation, stopAnimation, prepareStepAnimation, isAnimationRunning, adminPanzoom, participantPanzoom} from './animation.js';
import {initGroupDashboard} from './components/groupDashboard.js';
import {initEventDashboard} from './components/eventDashboard.js';
import {initMemberManagement} from './components/memberManagement.js';
import {initEventEdit} from './components/eventEdit.js';
import {initAdminDashboard} from './components/adminDashboard.js';
import * as router from './router.js';
import {initParticipantView} from './components/participantView.js';
import {initBroadcast} from './components/broadcast.js';

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

async function initializeApp() {
  ui.initUI();
  
  loadSettings();
  applySettings();
  setupSettingsControls();

  initGroupDashboard();
  initEventDashboard();
  initMemberManagement();
  initEventEdit();
  initAdminDashboard();
  initParticipantView();

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
    await router.loadUserAndRedirect(state.currentUser.lastUsedGroupId);
  }
  lucide.createIcons();
}

function setupEventListeners() {
  initBroadcast();

  window.addEventListener('popstate', (e) => {
    router.navigateTo(window.location.pathname, false);
  });

  if (ui.elements.loginButton)
    ui.elements.loginButton.addEventListener('click', () => {
      window.location.href = '/auth/google';
    });
  if (ui.elements.landingLoginButton)
    ui.elements.landingLoginButton.addEventListener('click', () => {
      window.location.href = '/auth/google';
    });
  if (ui.elements.logoutButton)
    ui.elements.logoutButton.addEventListener('click', async () => {
      const isAdminPage = window.location.pathname.startsWith('/admin') || window.location.pathname === '/';

      if (isAdminPage) {
        window.location.href = '/auth/logout';
      } else {
        const currentPath = window.location.pathname;
        window.location.href = `/auth/logout?redirect_to=${encodeURIComponent(currentPath)}`;
      }
    });
  if (ui.elements.deleteAccountButton)
    ui.elements.deleteAccountButton.addEventListener('click', async () => {
      if (!confirm('本当にアカウントを削除しますか？関連する全てのデータが完全に削除され、元に戻すことはできません。')) return;
      try {
        await api.deleteUserAccount();
        alert('アカウントを削除しました。');
        window.location.href = '/';
      } catch (error) {
        alert(error.error);
      }
    });
  if (ui.elements.requestAdminButton)
    ui.elements.requestAdminButton.addEventListener('click', async () => {
      if (!confirm('システム管理者権限を申請しますか？')) return;
      try {
        const result = await api.requestAdminAccess();
        alert(result.message);
        ui.elements.requestAdminButton.textContent = '申請中';
        ui.elements.requestAdminButton.disabled = true;
      } catch (error) {
        alert(`エラー: ${error.error}`);
      }
    });
  if (ui.elements.stopImpersonatingButton)
    ui.elements.stopImpersonatingButton.addEventListener('click', async () => {
      try {
        await api.stopImpersonating();
        alert('成り代わりを解除しました。ページをリロードします。');
        window.location.href = '/admin';
      } catch (error) {
        alert(error.error);
      }
    });
  if (ui.elements.adminDashboardButton) {
    ui.elements.adminDashboardButton.addEventListener('click', (e) => {
      router.navigateTo('/admin/dashboard');
    });
  }

  if (ui.elements.backToDashboardFromEventListButton) {
    ui.elements.backToDashboardFromEventListButton.addEventListener('click', async (e) => {
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

  if (ui.elements.currentGroupName) {
    ui.elements.currentGroupName.addEventListener('click', (e) => {
      e.stopPropagation();
      ui.elements.groupDropdown.style.display = ui.elements.groupDropdown.style.display === 'block' ? 'none' : 'block';
    });
  }

  if (ui.elements.switcherGroupList) {
    ui.elements.switcherGroupList.addEventListener('click', async (e) => {
      if (e.target.tagName === 'BUTTON') {
        const {groupId} = e.target.dataset;
        ui.elements.groupDropdown.style.display = 'none';
        await router.navigateTo(`/admin/groups/${groupId}`);
      }
    });
  }

  if (ui.elements.switcherCreateGroup) {
    ui.elements.switcherCreateGroup.addEventListener('click', async () => {
      ui.elements.groupDropdown.style.display = 'none';
      await router.navigateTo('/');
    });
  }

  if (ui.elements.closeSettingsModalButton) ui.elements.closeSettingsModalButton.addEventListener('click', ui.closeSettingsModal);
  if (ui.elements.closePrizeMasterModalButton) ui.elements.closePrizeMasterModalButton.addEventListener('click', ui.closePrizeMasterModal);

  if (ui.elements.closePasswordSetModal)
    ui.elements.closePasswordSetModal.addEventListener('click', () => {
      if (ui.elements.passwordSetModal) ui.elements.passwordSetModal.style.display = 'none';
    });
  if (ui.elements.closeProfileModalButton) ui.elements.closeProfileModalButton.addEventListener('click', ui.closeProfileEditModal);
  if (ui.elements.closePrizeMasterSelectModal) ui.elements.closePrizeMasterSelectModal.addEventListener('click', ui.closePrizeMasterSelectModal);
  if (ui.elements.closeGroupPasswordModalButton) ui.elements.closeGroupPasswordModalButton.addEventListener('click', ui.closeGroupPasswordModal);

  if (ui.elements.verifyPasswordButton)
    ui.elements.verifyPasswordButton.addEventListener('click', async () => {
      const groupId = ui.elements.verificationTargetGroupId.value;
      const password = ui.elements.groupPasswordVerifyInput.value;
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

  if (ui.elements.customUrlInput)
    ui.elements.customUrlInput.addEventListener('keyup', () => {
      if (ui.elements.customUrlPreview) ui.elements.customUrlPreview.textContent = ui.elements.customUrlInput.value.trim();
    });

  if (ui.elements.backToDashboardButton)
    ui.elements.backToDashboardButton.addEventListener('click', async () => {
      if (state.currentGroupId) {
        await router.navigateTo(`/admin/groups/${state.currentGroupId}`);
      } else {
        await router.navigateTo('/');
      }
    });

  if (ui.elements.prizeMasterSelectList)
    ui.elements.prizeMasterSelectList.addEventListener('click', (e) => {
      const item = e.target.closest('li');
      if (item) {
        item.classList.toggle('selected');
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.checked = item.classList.contains('selected');
      }
    });

  window.addEventListener('resize', ui.adjustBodyPadding);
  window.addEventListener('click', (event) => {
    if (ui.elements.groupSettingsModal && event.target == ui.elements.groupSettingsModal) ui.closeSettingsModal();
    if (ui.elements.profileEditModal && event.target == ui.elements.profileEditModal) ui.closeProfileEditModal();
    if (ui.elements.passwordSetModal && event.target == ui.elements.passwordSetModal) ui.elements.passwordSetModal.style.display = 'none';
    if (ui.elements.prizeMasterSelectModal && event.target == ui.elements.prizeMasterSelectModal) ui.closePrizeMasterSelectModal();
    if (ui.elements.groupDropdown && ui.elements.groupDropdown.style.display === 'block' && !ui.elements.groupSwitcher.contains(event.target)) {
      ui.elements.groupDropdown.style.display = 'none';
    }
    if (ui.elements.prizeMasterModal && event.target == ui.elements.prizeMasterModal) ui.closePrizeMasterModal();
    if (ui.elements.passwordResetRequestModal && event.target == ui.elements.passwordResetRequestModal) ui.closePasswordResetRequestModal();
    if (ui.elements.memberEditModal && event.target == ui.elements.memberEditModal) ui.closeMemberEditModal();
    if (ui.elements.bulkRegisterModal && event.target == ui.elements.bulkRegisterModal) ui.closeBulkRegisterModal();
    if (ui.elements.addPrizeModal && event.target == ui.elements.addPrizeModal) ui.closeAddPrizeModal();
    if (ui.elements.summaryModal && event.target == ui.elements.summaryModal) ui.closeSummaryModal();
    const link = event.target.closest('a');
    if (link && link.href && link.target !== '_blank') {
      const url = new URL(link.href);
      if (url.origin === window.location.origin) {
        event.preventDefault();
        router.navigateTo(url.pathname);
      }
    }
  });
}

// ★★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★★★ ここからが修正点 ★★★
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★
function setupHamburgerMenu() {
  if (ui.elements.hamburgerButton && ui.elements.navMenu) {
    ui.elements.hamburgerButton.addEventListener('click', () => {
      const isOpened = ui.elements.hamburgerButton.classList.toggle('active');
      ui.elements.navMenu.classList.toggle('active');
      ui.elements.hamburgerButton.setAttribute('aria-expanded', isOpened);
    });

    ui.elements.navMenu.addEventListener('click', (e) => {
      const target = e.target.closest('button, a');
      if (target) {
        ui.elements.hamburgerButton.classList.remove('active');
        ui.elements.navMenu.classList.remove('active');
        ui.elements.hamburgerButton.setAttribute('aria-expanded', 'false');
      }
    });
  }
}
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★★★ 修正はここまで ★★★
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★

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