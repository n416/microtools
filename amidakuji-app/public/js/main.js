// amidakuji-app/public/js/main.js

import * as api from './api.js';
import * as ui from './ui.js';
import * as state from './state.js';
import * as router from './router.js';
import {startAnimation, stopAnimation, prepareStepAnimation, resetAnimation, advanceLineByLine, isAnimationRunning, redrawPrizes} from './animation.js';

const settings = {
  animation: true,
  theme: 'auto', // 'auto', 'light', 'dark'
};

const darkModeMatcher = window.matchMedia('(prefers-color-scheme: dark)');
let tronAnimationAPI = null; // Tron AnimationのAPIを保持する変数

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
        // auto
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

  setupEventListeners();
  setupHamburgerMenu();
  if (settings.animation) {
    tronAnimationAPI = initTronAnimation();
  }

  setupDraggableControls();
  const initialData = {
    group: typeof initialGroupData !== 'undefined' ? initialGroupData : null,
    event: typeof initialEventData !== 'undefined' ? initialEventData : null,
  };

  await router.navigateTo(window.location.pathname, false);

  if (state.currentUser && window.location.pathname === '/' && !initialData.group && !initialData.event) {
    await loadUserAndRedirect(state.currentUser.lastUsedGroupId);
  }
}

async function loadUserAndRedirect(lastUsedGroupId) {
  try {
    const groups = await api.getGroups();
    state.setAllUserGroups(groups);
    ui.renderGroupList(groups);

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

async function openGroupSettingsFor(groupId) {
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
    ui.renderGroupList(groups);
  } catch (error) {
    alert(error.error || '設定の保存に失敗しました。');
  } finally {
    elements.saveGroupSettingsButton.disabled = false;
  }
}

async function handleCopyEvent(eventId) {
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
    await router.navigateTo('/admin/dashboard', false); // Refresh admin dashboard
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
    await router.navigateTo('/admin/dashboard', false); // Refresh admin dashboard
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

  if (elements.createGroupButton)
    elements.createGroupButton.addEventListener('click', async () => {
      const name = elements.groupNameInput.value.trim();
      if (!name) return alert('グループ名を入力してください。');
      try {
        await api.createGroup(name);
        elements.groupNameInput.value = '';
        await loadUserAndRedirect();
      } catch (error) {
        alert(error.error);
      }
    });

  if (elements.groupList) {
    elements.groupList.addEventListener('click', async (e) => {
      const groupItem = e.target.closest('.item-list-item');
      if (!groupItem) return;
      const {groupId, groupName} = groupItem.dataset;
      const button = e.target.closest('button');

      if (button) {
        e.stopPropagation();
        if (button.classList.contains('delete-group-btn')) {
          if (confirm(`グループ「${groupName}」を削除しますか？\n関連するすべてのイベントも削除され、元に戻せません。`)) {
            try {
              await api.deleteGroup(groupId);
              alert('グループを削除しました。');
              await loadUserAndRedirect();
            } catch (error) {
              alert(error.error || 'グループの削除に失敗しました。');
            }
          }
        } else {
          state.setCurrentGroupId(groupId);
          await openGroupSettingsFor(groupId);
        }
      } else {
        await router.navigateTo(`/admin/groups/${groupId}`);
      }
    });
  }

  if (elements.eventList) {
    elements.eventList.addEventListener('click', async (e) => {
      const button = e.target.closest('button');
      const item = e.target.closest('.item-list-item');
      if (!item) return;

      const eventId = (button || item.querySelector('.edit-event-btn'))?.dataset.eventId;
      if (!eventId) return;

      e.stopPropagation();

      if (button?.classList.contains('delete-event-btn')) {
        if (confirm('このイベントを削除しますか？元に戻せません。')) {
          api
            .deleteEvent(eventId)
            .then(async () => {
              alert('イベントを削除しました。');
              await router.navigateTo(window.location.pathname, false);
            })
            .catch((err) => alert(err.error || 'イベントの削除に失敗しました。'));
        }
      } else if (button?.classList.contains('start-event-btn')) {
        await router.navigateTo(`/admin/event/${eventId}/broadcast`);
      } else if (button?.classList.contains('copy-event-btn')) {
        await handleCopyEvent(eventId);
      } else {
        await router.navigateTo(`/admin/event/${eventId}/edit`);
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

  if (elements.dashboardView) {
    elements.dashboardView.addEventListener('click', async (e) => {
      if (e.target.id === 'goToGroupSettingsButton') {
        if (state.currentGroupId) {
          await openGroupSettingsFor(state.currentGroupId);
        }
      }
      if (e.target.id === 'goToPrizeMasterButton') {
        if (state.currentGroupId) {
          const handlers = {
            onAddMaster: async () => {
              const name = elements.addMasterPrizeNameInput.value.trim();
              const file = elements.addMasterPrizeImageInput.files[0];
              if (!name || !file) return alert('賞品名と画像を選択してください');
              try {
                elements.addMasterPrizeButton.disabled = true;
                const {signedUrl, imageUrl} = await api.generatePrizeMasterUploadUrl(state.currentGroupId, file.type);
                await fetch(signedUrl, {method: 'PUT', headers: {'Content-Type': file.type}, body: file});
                await api.addPrizeMaster(state.currentGroupId, name, imageUrl);
                alert('賞品マスターを追加しました。');
                const masters = await api.getPrizeMasters(state.currentGroupId);
                ui.renderPrizeMasterList(masters, false);
                elements.addMasterPrizeNameInput.value = '';
                elements.addMasterPrizeImageInput.value = '';
              } catch (error) {
                alert(error.error);
              } finally {
                elements.addMasterPrizeButton.disabled = false;
              }
            },
            onDeleteMaster: async (masterId) => {
              if (!confirm('この賞品マスターを削除しますか？')) return;
              try {
                await api.deletePrizeMaster(masterId, state.currentGroupId);
                alert('削除しました');
                const masters = await api.getPrizeMasters(state.currentGroupId);
                ui.renderPrizeMasterList(masters, false);
              } catch (error) {
                alert(error.error);
              }
            },
          };
          ui.openPrizeMasterModal(handlers);
          const masters = await api.getPrizeMasters(state.currentGroupId);
          ui.renderPrizeMasterList(masters, false);
        }
      }
      if (e.target.id === 'goToMemberManagementButton') {
        if (state.currentGroupId) {
          router.navigateTo(`/admin/groups/${state.currentGroupId}/members`);
        }
      }
      if (e.target.id === 'showPasswordResetRequestsButton') {
        if (state.currentGroupId) {
          const requests = await api.getPasswordRequests(state.currentGroupId);
          const handlers = {
            onApproveReset: async (memberId, groupId, requestId) => {
              if (!confirm('このユーザーの合言葉を削除しますか？')) return;
              try {
                await api.approvePasswordReset(memberId, groupId, requestId);
                alert('合言葉を削除しました。');
                const updatedRequests = await api.getPasswordRequests(groupId);
                ui.renderPasswordRequests(updatedRequests);
                ui.showPasswordResetNotification(updatedRequests);
                if (updatedRequests.length === 0) {
                  ui.closePasswordResetRequestModal();
                }
              } catch (error) {
                alert(error.error);
              }
            },
          };
          ui.openPasswordResetRequestModal(requests, handlers);
        }
      }
    });
  }

  if (elements.memberManagementView) {
    elements.backToDashboardFromMembersButton.addEventListener('click', () => {
      if (state.currentGroupId) {
        router.navigateTo(`/admin/groups/${state.currentGroupId}`);
      }
    });

    elements.addNewMemberButton.addEventListener('click', async () => {
      const name = prompt('追加するメンバーの名前を入力してください:');
      if (name && name.trim()) {
        try {
          await api.addMember(state.currentGroupId, name.trim());
          const members = await api.getMembers(state.currentGroupId);
          ui.renderMemberList(members);
        } catch (error) {
          alert(error.error || 'メンバーの追加に失敗しました。');
        }
      }
    });

    elements.memberSearchInput.addEventListener('input', async () => {
      const members = await api.getMembers(state.currentGroupId);
      ui.renderMemberList(members);
    });

    elements.memberList.addEventListener('click', async (e) => {
      const memberItem = e.target.closest('.member-list-item');
      if (!memberItem) return;

      const memberId = memberItem.dataset.memberId;
      const members = await api.getMembers(state.currentGroupId);
      const member = members.find((m) => m.id === memberId);

      if (e.target.classList.contains('delete-member-btn')) {
        if (confirm(`メンバー「${member.name}」を削除しますか？`)) {
          try {
            await api.deleteMember(state.currentGroupId, memberId);
            const updatedMembers = await api.getMembers(state.currentGroupId);
            ui.renderMemberList(updatedMembers);
          } catch (error) {
            alert(error.error || 'メンバーの削除に失敗しました。');
          }
        }
      } else if (e.target.classList.contains('edit-member-btn')) {
        ui.openMemberEditModal(member, {
          onSave: async () => {
            const newName = elements.memberNameEditInput.value.trim();
            const newColor = elements.memberColorInput.value;
            if (!newName) return alert('名前は必須です。');

            try {
              await api.updateMember(state.currentGroupId, memberId, {name: newName, color: newColor});
              ui.closeMemberEditModal();
              const updatedMembers = await api.getMembers(state.currentGroupId);
              ui.renderMemberList(updatedMembers);
            } catch (error) {
              alert(error.error || '更新に失敗しました。');
            }
          },
        });
      }
    });

    elements.memberManagementView.addEventListener('click', (e) => {
      if (e.target.id === 'bulkRegisterButton') {
        ui.openBulkRegisterModal();
      }
    });
  }

  if (elements.closeSettingsModalButton) elements.closeSettingsModalButton.addEventListener('click', ui.closeSettingsModal);
  if (elements.closePrizeMasterModalButton) elements.closePrizeMasterModalButton.addEventListener('click', ui.closePrizeMasterModal);
  if (elements.closePasswordResetRequestModalButton) elements.closePasswordResetRequestModalButton.addEventListener('click', ui.closePasswordResetRequestModal);
  if (elements.closeMemberEditModalButton) elements.closeMemberEditModalButton.addEventListener('click', ui.closeMemberEditModal);
  if (elements.closeBulkRegisterModalButton) {
    elements.closeBulkRegisterModalButton.addEventListener('click', ui.closeBulkRegisterModal);
  }

  if (elements.analyzeBulkButton) {
    elements.analyzeBulkButton.addEventListener('click', async () => {
      const namesText = elements.bulkNamesTextarea.value;
      if (!namesText.trim()) return alert('名前を入力してください。');

      elements.analyzeBulkButton.disabled = true;
      elements.analyzeBulkButton.textContent = '分析中...';
      try {
        const result = await api.analyzeBulkMembers(state.currentGroupId, namesText);
        ui.renderBulkAnalysisPreview(result.analysisResults);
      } catch (error) {
        alert(error.error || '分析に失敗しました。');
        elements.analyzeBulkButton.disabled = false;
        elements.analyzeBulkButton.textContent = '確認する';
      }
    });
  }

  if (elements.finalizeBulkButton) {
    elements.finalizeBulkButton.addEventListener('click', async () => {
      elements.finalizeBulkButton.disabled = true;
      elements.finalizeBulkButton.textContent = '登録処理中...';

      const resolutions = [];
      document.querySelectorAll('#newRegistrationTab li').forEach((li) => {
        resolutions.push({inputName: li.textContent.match(/"(.*?)"/)[1], action: 'create'});
      });
      document.querySelectorAll('#potentialMatchTab li').forEach((li) => {
        const inputName = li.dataset.inputName;
        const action = li.querySelector('input[type="radio"]:checked').value;
        resolutions.push({inputName, action});
      });

      try {
        const result = await api.finalizeBulkMembers(state.currentGroupId, resolutions);
        alert(`${result.createdCount}名のメンバーを新しく登録しました。`);
        ui.closeBulkRegisterModal();
        const members = await api.getMembers(state.currentGroupId);
        ui.renderMemberList(members);
      } catch (error) {
        alert(error.error || '登録に失敗しました。');
      } finally {
        elements.finalizeBulkButton.disabled = false;
        elements.finalizeBulkButton.textContent = 'この内容で登録を実行する';
      }
    });
  }

  if (elements.closePasswordSetModal)
    elements.closePasswordSetModal.addEventListener('click', () => {
      if (elements.passwordSetModal) elements.passwordSetModal.style.display = 'none';
    });
  if (elements.closeProfileModalButton) elements.closeProfileModalButton.addEventListener('click', ui.closeProfileEditModal);
  if (elements.closePrizeMasterSelectModal) elements.closePrizeMasterSelectModal.addEventListener('click', ui.closePrizeMasterSelectModal);
  if (elements.closeGroupPasswordModalButton) elements.closeGroupPasswordModalButton.addEventListener('click', ui.closeGroupPasswordModal);
  if (elements.closePrizeBulkAddModalButton) elements.closePrizeBulkAddModalButton.addEventListener('click', ui.closePrizeBulkAddModal);
  if (elements.cancelBulkAddButton) elements.cancelBulkAddButton.addEventListener('click', ui.closePrizeBulkAddModal);

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

  if (elements.goToCreateEventViewButton)
    elements.goToCreateEventViewButton.addEventListener('click', async () => {
      await router.navigateTo(`/admin/group/${state.currentGroupId}/event/new`);
    });

  if (elements.backToGroupsButton) {
    elements.backToGroupsButton.addEventListener('click', async () => {
      if (state.currentGroupId) {
        await router.navigateTo(`/admin/groups/${state.currentGroupId}`);
      } else {
        await router.navigateTo('/');
      }
    });
  }

  if (elements.prizeList) {
    elements.prizeList.addEventListener('click', (event) => {
      const target = event.target;
      if (target.classList.contains('delete-btn')) {
        const index = parseInt(target.dataset.index, 10);
        state.prizes.splice(index, 1);
        ui.renderPrizeList();
      }
      if (target.classList.contains('duplicate-btn')) {
        event.preventDefault();
        const sourceIndex = parseInt(target.dataset.index, 10);
        const prizeToDuplicate = JSON.parse(JSON.stringify(state.prizes[sourceIndex]));
        if (state.prizes[sourceIndex].newImageFile) {
          prizeToDuplicate.newImageFile = state.prizes[sourceIndex].newImageFile;
        }
        state.prizes.splice(sourceIndex + 1, 0, prizeToDuplicate);
        ui.renderPrizeList();
      }
    });
  }

  if (elements.bulkAddPrizesButton) {
    elements.bulkAddPrizesButton.addEventListener('click', () => {
      ui.openPrizeBulkAddModal();
    });
  }

  if (elements.clearBulkPrizesButton) {
    elements.clearBulkPrizesButton.addEventListener('click', () => {
      elements.prizeBulkTextarea.value = '';
    });
  }

  if (elements.updatePrizesFromTextButton) {
    elements.updatePrizesFromTextButton.addEventListener('click', async () => {
      const text = elements.prizeBulkTextarea.value;
      const prizeNames = text
        .split('\n')
        .map((name) => name.trim())
        .filter((name) => name);

      const newPrizes = await buildNewPrizesWithDataPreservation(prizeNames);
      state.setPrizes(newPrizes);
      ui.renderPrizeList();
      ui.closePrizeBulkAddModal();
    });
  }

  if (elements.createEventButton) {
    elements.createEventButton.addEventListener('click', async () => {
      const isUpdate = !!state.currentEventId;
      const participantCount = state.prizes.length;
      if (participantCount < 2) return alert('景品は2つ以上設定してください。');

      elements.createEventButton.disabled = true;
      let originalButtonText = elements.createEventButton.textContent;

      try {
        let eventId = state.currentEventId;

        if (!isUpdate) {
          elements.createEventButton.textContent = 'イベント作成中...';
          const initialEventData = {
            eventName: elements.eventNameInput.value.trim(),
            prizes: state.prizes.map((p) => ({name: p.name, imageUrl: p.imageUrl || null})),
            groupId: state.currentGroupId,
            displayMode: elements.displayModeSelect.value,
          };
          const newEvent = await api.createEvent(initialEventData);
          eventId = newEvent.id;
          state.setCurrentEventId(eventId);
        }

        const prizesWithNewImages = state.prizes.filter((p) => p.newImageFile);
        if (prizesWithNewImages.length > 0) {
          elements.createEventButton.textContent = '画像をアップロード中...';

          const uploadPromises = state.prizes.map(async (prize) => {
            if (prize.newImageFile) {
              const {signedUrl, imageUrl} = await api.generateEventPrizeUploadUrl(eventId, prize.newImageFile.type);
              await fetch(signedUrl, {
                method: 'PUT',
                headers: {'Content-Type': prize.newImageFile.type},
                body: prize.newImageFile,
              });
              prize.imageUrl = imageUrl;
              delete prize.newImageFile;
            }
            return prize;
          });
          await Promise.all(uploadPromises);
        }

        elements.createEventButton.textContent = '最終保存中...';
        const finalEventData = {
          eventName: elements.eventNameInput.value.trim(),
          prizes: state.prizes,
          participantCount: state.prizes.length,
          displayMode: elements.displayModeSelect.value,
        };

        await api.updateEvent(eventId, finalEventData);

        alert('イベントを保存しました！');
        await router.navigateTo(`/admin/groups/${state.currentGroupId}`);
      } catch (error) {
        alert(error.error || 'イベントの保存に失敗しました。');
        elements.createEventButton.disabled = false;
        elements.createEventButton.textContent = originalButtonText;
      } finally {
        elements.createEventButton.disabled = false;
        elements.createEventButton.textContent = originalButtonText;
      }
    });
  }

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
  if (elements.animateAllButton) elements.animateAllButton.addEventListener('click', resetAnimation);
  if (elements.advanceLineByLineButton) {
    elements.advanceLineByLineButton.addEventListener('click', advanceLineByLine);
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
      await startAnimation(ctx, [randomParticipant.name], null, randomParticipant.name);
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
    });

    if (elements.toggleFullscreenButton) {
      elements.toggleFullscreenButton.addEventListener('click', () => {
        const container = elements.adminCanvas.closest('.canvas-panzoom-container');
        if (container) {
          const isFullscreen = container.classList.toggle('fullscreen-mode');
          elements.toggleFullscreenButton.textContent = isFullscreen ? '元のサイズに戻す' : '表示エリアを最大化';
          setTimeout(() => {
            const hidePrizes = state.currentLotteryData?.displayMode === 'private';
            prepareStepAnimation(elements.adminCanvas.getContext('2d'), hidePrizes, false, true);
          }, 300);
        }
      });
    }
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
        await startAnimation(ctx, [elements.highlightUserSelect.value], null, elements.highlightUserSelect.value);
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

  if (elements.openAddPrizeModalButton) {
    elements.openAddPrizeModalButton.addEventListener('click', ui.openAddPrizeModal);
  }

  if (elements.addPrizeModal) {
    elements.addPrizeModal.querySelector('.close-button').addEventListener('click', ui.closeAddPrizeModal);
  }

  if (elements.addPrizeOkButton) {
    elements.addPrizeOkButton.addEventListener('click', () => {
      const name = elements.newPrizeNameInput.value.trim();
      const file = elements.newPrizeImageInput.files[0];
      if (!name) return alert('景品名を入力してください。');

      const newPrize = {
        name,
        imageUrl: null,
        newImageFile: file || null,
      };

      state.prizes.push(newPrize);
      ui.renderPrizeList();
      ui.closeAddPrizeModal();
    });
  }

  if (elements.callMasterButton) {
    elements.callMasterButton.addEventListener('click', async () => {
      try {
        const masters = await api.getPrizeMasters(state.currentGroupId);
        ui.openPrizeMasterSelectModal(masters, {
          onAddSelected: () => {
            const selected = elements.prizeMasterSelectList.querySelector('li.selected');
            if (selected) {
              elements.newPrizeNameInput.value = selected.dataset.name;
              elements.newPrizeImagePreview.src = selected.dataset.imageUrl;
              elements.newPrizeImagePreview.style.display = 'block';
            }
            ui.closePrizeMasterSelectModal();
          },
        });
      } catch (error) {
        alert(error.error);
      }
    });
  }

  if (elements.showSummaryButton) {
    elements.showSummaryButton.addEventListener('click', () => {
      const breakdown = state.prizes.reduce((acc, prize) => {
        const name = prize.name;
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {});
      const summary = {
        total: state.prizes.length,
        breakdown,
      };
      ui.openSummaryModal(summary);
    });
  }

  if (elements.summaryModal) {
    elements.summaryModal.querySelector('.close-button').addEventListener('click', ui.closeSummaryModal);
  }

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
    if (elements.prizeBulkAddModal && event.target == elements.prizeBulkAddModal) ui.closePrizeBulkAddModal();
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

function setupDraggableControls() {
  const wrapper = document.getElementById('controls-draggable-wrapper');
  const header = wrapper.querySelector('.controls-header');
  const toggleBtn = document.getElementById('toggleControlsButton');

  if (!wrapper || !header || !toggleBtn) return;

  let pos = {top: 0, left: 0, x: 0, y: 0};

  const savedPos = localStorage.getItem('controlsPosition');
  if (savedPos) {
    const {x, y} = JSON.parse(savedPos);
    if (x > window.innerWidth || y > window.innerHeight || x < -wrapper.offsetWidth || y < -wrapper.offsetHeight) {
      localStorage.removeItem('controlsPosition');
    } else {
      wrapper.style.left = `${x}px`;
      wrapper.style.top = `${y}px`;
      wrapper.style.bottom = 'auto';
      wrapper.style.transform = 'none';
    }
  }

  const isMinimized = localStorage.getItem('controlsMinimized') === 'true';
  if (isMinimized) {
    wrapper.classList.add('minimized');
    toggleBtn.textContent = '+';
  }

  toggleBtn.addEventListener('click', () => {
    const minimized = wrapper.classList.toggle('minimized');
    toggleBtn.textContent = minimized ? '+' : '-';
    localStorage.setItem('controlsMinimized', minimized);
  });

  const mouseDownHandler = (e) => {
    if (e.target === toggleBtn) return;

    const rect = wrapper.getBoundingClientRect();
    wrapper.style.left = `${rect.left}px`;
    wrapper.style.top = `${rect.top}px`;
    wrapper.style.bottom = 'auto';
    wrapper.style.transform = 'none';

    pos = {
      left: wrapper.offsetLeft,
      top: wrapper.offsetTop,
      x: e.clientX,
      y: e.clientY,
    };

    wrapper.classList.add('dragging');

    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseup', mouseUpHandler);
  };

  const mouseMoveHandler = (e) => {
    const dx = e.clientX - pos.x;
    const dy = e.clientY - pos.y;

    let newX = pos.left + dx;
    let newY = pos.top + dy;

    const rect = wrapper.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;

    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));

    wrapper.style.top = `${newY}px`;
    wrapper.style.left = `${newX}px`;
  };

  const mouseUpHandler = () => {
    wrapper.classList.remove('dragging');
    document.removeEventListener('mousemove', mouseMoveHandler);
    document.removeEventListener('mouseup', mouseUpHandler);

    const rect = wrapper.getBoundingClientRect();
    localStorage.setItem('controlsPosition', JSON.stringify({x: rect.left, y: rect.top}));
  };

  header.addEventListener('mousedown', mouseDownHandler);
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

function applyTheme(theme) {
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
  });

  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && !fab.contains(e.target)) {
      panel.classList.remove('visible');
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
      settings.theme = radio.value;
      saveSettings();
      applySettings();
    });
  });
}
