// js/main.js
import * as api from './api.js';
import * as ui from './ui.js';
import * as state from './state.js';
import {handleRouting, loadEventForEditing, handleLoginOrRegister, verifyAndLogin} from './router.js';
import {startAnimation, stopAnimation, prepareStepAnimation, resetAnimation, stepAnimation} from './animation.js';

/**
 * Tron風の背景アニメーション (CSSアニメーション制御FIX版)
 */

function initTronAnimation() {
  const gridCanvas = document.getElementById('grid-canvas');
  const gridCtx = gridCanvas.getContext('2d');
  const animationCanvas = document.getElementById('animation-canvas');
  const animationCtx = animationCanvas.getContext('2d');

  // --- 設定 ---
  const SCROLL_SPEED = 0.25;
  const CYCLE_COUNT = 5;
  const GRID_SIZE = 50;
  const TURN_CHANCE = 0.3;
  const CYCLE_SPEED = 8;
  const LINE_WIDTH = 1;
  const TAIL_LENGTH = 45; // 軌跡の長さ（フレーム数）

  const themes = {
    dark: {background: '#121212', cycleColorRGB: '13, 132, 255', gridColor: '#444'},
    light: {background: '#f4f7f6', cycleColorRGB: '255, 140, 0', gridColor: '#ddd'},
  };
  let currentTheme;
  let cycles = [];
  let scrollX = 0;
  let scrollY = 0;

  function resizeCanvases() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    gridCanvas.width = animationCanvas.width = width;
    gridCanvas.height = animationCanvas.height = height;
  }

  function drawGrid() {
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

    gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
    gridCtx.save();
    gridCtx.translate(scrollX % GRID_SIZE, scrollY % GRID_SIZE);
    drawGrid();
    gridCtx.restore();

    animationCtx.clearRect(0, 0, animationCanvas.width, animationCanvas.height);

    cycles.forEach((cycle) => {
      cycle.update();
      cycle.draw(scrollX, scrollY);
    });

    requestAnimationFrame(animate);
  }

  function setupTheme(isDarkMode) {
    currentTheme = isDarkMode ? themes.dark : themes.light;
    document.body.style.backgroundColor = currentTheme.background;
    if (cycles.length > 0) {
      cycles.forEach((c) => (c.colorRGB = currentTheme.cycleColorRGB));
    }
  }

  const darkModeMatcher = window.matchMedia('(prefers-color-scheme: dark)');
  darkModeMatcher.addEventListener('change', (e) => {
    setupTheme(e.matches);
  });

  window.addEventListener('resize', resizeCanvases);

  setupTheme(darkModeMatcher.matches);
  resizeCanvases();
  for (let i = 0; i < CYCLE_COUNT; i++) {
    cycles.push(new LightCycle());
  }
  animate();
}
async function navigateTo(path, pushState = true) {
  // asyncを追加
  if (pushState && window.location.pathname !== path) {
    history.pushState({path}, '', path);
  }
  const action = await handleRouting(); // 戻り値を受け取る
  if (action === 'loadAdminDashboard') {
    await loadAdminDashboard(); // データを読み込む
  }
}

const {elements} = ui;

// --- アプリケーションの初期化 ---
async function initializeApp() {
  // ui.init(); // この行を削除しました
  setupEventListeners();
  initTronAnimation();
  const initialData = {
    group: typeof initialGroupData !== 'undefined' ? initialGroupData : null,
    event: typeof initialEventData !== 'undefined' ? initialEventData : null,
  };

  const action = await handleRouting(initialData); // 戻り値を受け取る
  if (action === 'loadAdminDashboard') {
    await loadAdminDashboard(); // データを読み込む
  }

  // 初回ロード時のみ、URLが指定されていない場合にリダイレクト処理を行う
  if (state.currentUser && window.location.pathname === '/' && !initialData.group && !initialData.event) {
    await loadUserAndRedirect(state.currentUser.lastUsedGroupId);
  }
}

// --- データ読み込み & 表示 ---
async function loadUserAndRedirect(lastUsedGroupId) {
  try {
    const groups = await api.getGroups();
    state.setAllUserGroups(groups);
    ui.renderGroupList(groups);

    if (groups.length > 0) {
      let targetGroup = groups.find((g) => g.id === lastUsedGroupId) || groups[0];
      // URLを変更して、ルーターに画面表示を委ねる
      navigateTo(`/groups/${targetGroup.id}`);
    } else {
      ui.showView('groupDashboard');
    }
  } catch (error) {
    console.error(error);
    ui.showView('groupDashboard');
  }
}

async function loadAdminDashboard() {
  try {
    const [requests, groupAdmins, systemAdmins] = await Promise.all([api.getAdminRequests(), api.getGroupAdmins(), api.getSystemAdmins()]);
    ui.renderAdminLists(requests, groupAdmins, systemAdmins, {
      onApprove: handleApproveAdmin,
      onImpersonate: handleImpersonate,
      onDemote: handleDemoteAdmin,
    });
  } catch (error) {
    console.error('管理ダッシュボードの読み込みに失敗:', error);
  }
}

// --- イベントハンドラ ---
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
    await api.updateParticipants(groupId, state.groupParticipants);
    alert('設定を保存しました。');
    ui.closeSettingsModal();
    // データを再読み込みして表示を更新
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
    handleRouting(); // 画面を再描画
  } catch (error) {
    alert(`エラー: ${error.error}`);
  }
}

async function handleApproveAdmin(requestId) {
  if (!confirm('このユーザーの管理者権限を承認しますか？')) return;
  try {
    await api.approveAdminRequest(requestId);
    alert('申請を承認しました。');
    await loadAdminDashboard();
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
    await loadAdminDashboard();
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

function setupEventListeners() {
  if (elements.loginButton)
    elements.loginButton.addEventListener('click', () => {
      window.location.href = '/auth/google';
    });
  if (elements.logoutButton)
    elements.logoutButton.addEventListener('click', async () => {
      try {
        // APIを呼び出してサーバー側でログアウト処理を実行
        await api.logout();
        // 現在のページをリロードして表示を更新
        window.location.reload();
      } catch (error) {
        console.error('Logout failed:', error);
        alert('ログアウトに失敗しました。');
        // 失敗した場合もリロードを試みる
        window.location.reload();
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
      e.preventDefault(); // <a>タグのデフォルト動作をキャンセル
      navigateTo('/admin');
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
          const groupData = state.allUserGroups.find((g) => g.id === groupId);
          if (groupData) {
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
              onAddParticipant: () => {
                const name = elements.addParticipantNameInput.value.trim();
                if (!name) return;
                const newParticipant = {
                  id: `temp_${Date.now()}`,
                  name,
                  color: `#${Math.floor(Math.random() * 16777215)
                    .toString(16)
                    .padStart(6, '0')}`,
                };
                state.groupParticipants.push(newParticipant);
                ui.renderParticipantManagementList(handlers);
                elements.addParticipantNameInput.value = '';
              },
              onDeleteParticipant: (participantId) => {
                state.setGroupParticipants(state.groupParticipants.filter((p) => p.id !== participantId));
                ui.renderParticipantManagementList(handlers);
              },
              onChangeColor: (participantId, newColor) => {
                const participant = state.groupParticipants.find((p) => p.id === participantId);
                if (participant) participant.color = newColor;
              },
              onAddMaster: async () => {
                const name = elements.addMasterPrizeNameInput.value.trim();
                const file = elements.addMasterPrizeImageInput.files[0];
                if (!name || !file) return alert('賞品名と画像を選択してください');
                try {
                  elements.addMasterPrizeButton.disabled = true;
                  const {signedUrl, imageUrl} = await api.generatePrizeMasterUploadUrl(groupId, file.type);
                  await fetch(signedUrl, {method: 'PUT', headers: {'Content-Type': file.type}, body: file});
                  await api.addPrizeMaster(groupId, name, imageUrl);
                  alert('賞品マスターを追加しました。');
                  const masters = await api.getPrizeMasters(groupId);
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
                  await api.deletePrizeMaster(masterId, groupId);
                  alert('削除しました');
                  const masters = await api.getPrizeMasters(groupId);
                  ui.renderPrizeMasterList(masters, false);
                } catch (error) {
                  alert(error.error);
                }
              },
              onApproveReset: async (memberId, groupId, requestId) => {
                if (!confirm('このユーザーの合言葉を削除しますか？')) return;
                try {
                  await api.approvePasswordReset(memberId, groupId, requestId);
                  alert('合言葉を削除しました。');
                  const requests = await api.getPasswordRequests(groupId);
                  ui.renderPasswordRequests(requests);
                } catch (error) {
                  alert(error.error);
                }
              },
            };

            ui.openSettingsModal(groupData, handlers);
            await api.getPasswordRequests(groupId).then(ui.renderPasswordRequests);
            await api.getPrizeMasters(groupId).then((masters) => ui.renderPrizeMasterList(masters, false));
          }
        }
      } else {
        navigateTo(`/groups/${groupId}`);
      }
    });
  }

  if (elements.eventList) {
    elements.eventList.addEventListener('click', (e) => {
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
            .then(() => {
              alert('イベントを削除しました。');
              handleRouting();
            })
            .catch((err) => alert(err.error || 'イベントの削除に失敗しました。'));
        }
      } else if (button?.classList.contains('start-event-btn')) {
        navigateTo(`/event/${eventId}/broadcast`);
      } else if (button?.classList.contains('copy-event-btn')) {
        handleCopyEvent(eventId);
      } else {
        navigateTo(`/event/${eventId}/edit`);
      }
    });
  }

  if (elements.adminDashboard) {
    elements.adminDashboard.addEventListener('click', (e) => {
      const button = e.target.closest('button');
      if (!button) return;

      if (button.classList.contains('impersonate-btn')) {
        handleImpersonate(button.dataset.userId);
      } else if (button.classList.contains('approve-btn')) {
        handleApproveAdmin(button.dataset.requestId);
      } else if (button.classList.contains('demote-btn')) {
        handleDemoteAdmin(button.dataset.userId);
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
    elements.switcherGroupList.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') {
        const {groupId} = e.target.dataset;
        elements.groupDropdown.style.display = 'none';
        navigateTo(`/groups/${groupId}`);
      }
    });
  }

  if (elements.switcherCreateGroup) {
    elements.switcherCreateGroup.addEventListener('click', () => {
      elements.groupDropdown.style.display = 'none';
      ui.showView('groupDashboard');
      if (elements.groupNameInput) {
        elements.groupNameInput.focus();
      }
    });
  }

  if (elements.goToGroupSettingsButton) {
    elements.goToGroupSettingsButton.addEventListener('click', async () => {
      if (state.currentGroupId) {
        const currentGroup = state.allUserGroups.find((g) => g.id === state.currentGroupId);
        if (currentGroup) {
          // 修正箇所：直接設定モーダルを開く処理を呼び出す
          const settingsButtonInList = document.querySelector(`.item-list-item[data-group-id="${state.currentGroupId}"] button`);
          if (settingsButtonInList) settingsButtonInList.click();
        } else {
          alert('グループ情報が見つかりませんでした。');
        }
      }
    });
  }

  if (elements.closeSettingsModalButton) elements.closeSettingsModalButton.addEventListener('click', ui.closeSettingsModal);
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

  if (elements.goToCreateEventViewButton)
    elements.goToCreateEventViewButton.addEventListener('click', () => {
      navigateTo(`/group/${state.currentGroupId}/event/new`);
    });

  if (elements.backToGroupsButton) {
    elements.backToGroupsButton.addEventListener('click', () => {
      if (state.currentGroupId) {
        navigateTo(`/groups/${state.currentGroupId}`);
      } else {
        navigateTo('/');
      }
    });
  }

  if (elements.syncWithGroupButton) {
    elements.syncWithGroupButton.addEventListener('click', () => {
      const currentGroup = state.allUserGroups.find((g) => g.id === state.currentGroupId);
      if (currentGroup && currentGroup.participants) {
        elements.participantCountInput.value = currentGroup.participants.length;
      }
    });
  }

  if (elements.addPrizeButton) {
    elements.addPrizeButton.addEventListener('click', () => {
      const prizeName = elements.prizeInput.value.trim();
      if (prizeName) {
        state.prizes.push({name: prizeName, imageUrl: null});
        ui.renderPrizeList();
        elements.prizeInput.value = '';
      }
    });
  }

  if (elements.prizeList) {
    elements.prizeList.addEventListener('click', (event) => {
      if (event.target.classList.contains('delete-btn')) {
        const index = parseInt(event.target.dataset.index, 10);
        state.prizes.splice(index, 1);
        ui.renderPrizeList();
      }
    });
  }

  if (elements.selectFromMasterButton) {
    elements.selectFromMasterButton.addEventListener('click', async () => {
      try {
        const masters = await api.getPrizeMasters(state.currentGroupId);
        ui.openPrizeMasterSelectModal(masters, {
          onAddSelected: () => {
            elements.prizeMasterSelectList.querySelectorAll('li.selected').forEach((item) => {
              state.prizes.push({
                name: item.dataset.name,
                imageUrl: item.dataset.imageUrl,
              });
            });
            ui.renderPrizeList();
            ui.closePrizeMasterSelectModal();
          },
        });
      } catch (error) {
        alert(error.error);
      }
    });
  }

  if (elements.createEventButton)
    elements.createEventButton.addEventListener('click', async () => {
      const isUpdate = !!state.currentEventId;
      const participantCount = parseInt(elements.participantCountInput.value, 10);
      if (!participantCount || participantCount < 2) return alert('参加人数は2人以上で設定してください。');
      if (state.prizes.length !== participantCount) return alert('参加人数と景品の数は同じにしてください。');

      const eventData = {
        eventName: elements.eventNameInput.value.trim(),
        prizes: state.prizes,
        participantCount,
        displayMode: elements.displayModeSelect.value,
      };

      try {
        elements.createEventButton.disabled = true;
        elements.createEventButton.textContent = isUpdate ? '保存中...' : '作成中...';
        if (isUpdate) {
          await api.updateEvent(state.currentEventId, eventData);
          alert('イベントを更新しました！');
        } else {
          eventData.groupId = state.currentGroupId;
          await api.createEvent(eventData);
          alert(`イベントが作成されました！`);
        }
        navigateTo(`/groups/${state.currentGroupId}`);
      } catch (error) {
        alert(error.error);
      } finally {
        elements.createEventButton.disabled = false;
      }
    });

  if (elements.loadButton) elements.loadButton.addEventListener('click', () => loadEventForEditing(elements.eventIdInput.value.trim()));
  if (elements.backToDashboardButton)
    elements.backToDashboardButton.addEventListener('click', () => {
      if (state.currentGroupId) {
        navigateTo(`/groups/${state.currentGroupId}`);
      } else {
        navigateTo('/');
      }
    });
  if (elements.startEventButton)
    elements.startEventButton.addEventListener('click', async () => {
      if (!confirm('イベントを開始しますか？\n開始後は新規参加ができなくなります。')) return;
      try {
        await api.startEvent(state.currentEventId);
        alert('イベントを開始しました！');
        navigateTo(`/event/${state.currentEventId}/broadcast`);
      } catch (error) {
        alert(`エラー: ${error.error}`);
      }
    });
  if (elements.animateAllButton) elements.animateAllButton.addEventListener('click', resetAnimation);
  if (elements.nextStepButton) elements.nextStepButton.addEventListener('click', stepAnimation);
  if (elements.highlightUserButton)
    elements.highlightUserButton.addEventListener('click', async () => {
      if (elements.highlightUserSelect.value) {
        const ctx = elements.adminCanvas.getContext('2d');
        await startAnimation(ctx, [elements.highlightUserSelect.value]);
      }
    });
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
              if (hasPassword) {
                const password = prompt(`「${name}」さんの合言葉を入力してください:`);
                if (password) await verifyAndLogin(state.currentEventId, memberId, password);
              } else {
                await handleLoginOrRegister(state.currentEventId, name, memberId);
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
        await handleRouting({group: null, event: null});
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
      const eventData = await api.getPublicEventData(state.currentEventId);
      ui.showControlPanelView(eventData);
    });
  if (elements.backToControlPanelFromResultButton)
    elements.backToControlPanelFromResultButton.addEventListener('click', async () => {
      const eventData = await api.getPublicEventData(state.currentEventId);
      ui.hideParticipantSubViews();
      ui.showControlPanelView(eventData);
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
      const eventData = await api.getPublicEventData(state.currentEventId);
      ui.showControlPanelView(eventData);
    });
  }
  if (elements.participantLogoutButton)
    elements.participantLogoutButton.addEventListener('click', async () => {
      try {
        // サーバー側のグループ合言葉セッションをクリア
        await api.clearGroupVerification();
      } catch (error) {
        console.error('Failed to clear group verification session:', error);
      } finally {
        // サーバー側の処理成否に関わらず、フロント側の処理は実行
        state.clearParticipantState(); // ローカルストレージの参加者情報をクリア
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
        await ui.showWaitingView();
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

  window.addEventListener('popstate', (event) => {
    // URLはブラウザが既に変更済みなので、pushStateせずに画面更新のみ行う
    navigateTo(window.location.pathname, false);
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
  });
}

document.addEventListener('DOMContentLoaded', initializeApp);
