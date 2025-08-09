document.addEventListener('DOMContentLoaded', () => {
  // --- UI要素の取得 ---
  const loginButton = document.getElementById('loginButton');
  const logoutButton = document.getElementById('logoutButton');
  const deleteAccountButton = document.getElementById('deleteAccountButton');
  const authStatus = document.getElementById('authStatus');
  const adminDashboardButton = document.getElementById('adminDashboardButton');
  const stopImpersonatingButton = document.getElementById('stopImpersonatingButton');

  // View Containers
  const groupDashboard = document.getElementById('groupDashboard');
  const dashboardView = document.getElementById('dashboardView');
  const eventEditView = document.getElementById('eventEditView');
  const broadcastView = document.getElementById('broadcastView');
  const participantView = document.getElementById('participantView');
  const adminDashboard = document.getElementById('adminDashboard');

  // Group Dashboard Elements
  const groupNameInput = document.getElementById('groupNameInput');
  const createGroupButton = document.getElementById('createGroupButton');
  const groupList = document.getElementById('groupList');
  const requestAdminButton = document.getElementById('requestAdminButton');

  // Group Settings Modal Elements
  const groupSettingsModal = document.getElementById('groupSettingsModal');
  const settingsGroupId = document.getElementById('settingsGroupId');
  const customUrlInput = document.getElementById('customUrlInput');
  const groupPasswordInput = document.getElementById('groupPasswordInput');
  const noIndexCheckbox = document.getElementById('noIndexCheckbox');
  const saveGroupSettingsButton = document.getElementById('saveGroupSettingsButton');
  const closeModalButton = groupSettingsModal.querySelector('.close-button');
  const customUrlPreview = document.getElementById('customUrlPreview');
  const participantManagementList = document.getElementById('participantManagementList');
  const addParticipantButton = document.getElementById('addParticipantButton');
  const addParticipantNameInput = document.getElementById('addParticipantNameInput');
  const passwordResetRequestList = document.getElementById('passwordResetRequestList');
  const prizeMasterList = document.getElementById('prizeMasterList');
  const addMasterPrizeNameInput = document.getElementById('addMasterPrizeNameInput');
  const addMasterPrizeImageInput = document.getElementById('addMasterPrizeImageInput');
  const addMasterPrizeButton = document.getElementById('addMasterPrizeButton');

  // Event View Elements (管理者用)
  const eventGroupName = document.getElementById('eventGroupName');
  const backToGroupsButton = document.getElementById('backToGroupsButton');
  const participantCountInput = document.getElementById('participantCountInput');
  const prizeInput = document.getElementById('prizeInput');
  const addPrizeButton = document.getElementById('addPrizeButton');
  const prizeList = document.getElementById('prizeList');
  const displayModeSelect = document.getElementById('displayModeSelect');
  const eventPasswordInput = document.getElementById('eventPasswordInput');
  const goToCreateEventViewButton = document.getElementById('goToCreateEventViewButton');
  const createEventButton = document.getElementById('createEventButton');
  const loadButton = document.getElementById('loadButton');
  const eventIdInput = document.getElementById('eventIdInput');
  const currentEventUrl = document.getElementById('currentEventUrl');
  const eventList = document.getElementById('eventList');
  const adminControls = document.getElementById('adminControls');
  const startEventButton = document.getElementById('startEventButton');
  const startBroadcastButton = document.getElementById('startBroadcastButton');

  // ★ 2つのキャンバスとコンテキストを取得
  const adminCanvas = document.getElementById('adminCanvas');
  const ctxAdmin = adminCanvas ? adminCanvas.getContext('2d') : null;
  const participantCanvas = document.getElementById('participantCanvas');
  const ctxParticipant = participantCanvas ? participantCanvas.getContext('2d') : null;

  const broadcastControls = document.querySelector('.broadcast-controls');
  const animateAllButton = document.getElementById('animateAllButton');
  const nextStepButton = document.getElementById('nextStepButton');
  const highlightUserSelect = document.getElementById('highlightUserSelect');
  const highlightUserButton = document.getElementById('highlightUserButton');

  const syncWithGroupButton = document.getElementById('syncWithGroupButton');
  const selectFromMasterButton = document.getElementById('selectFromMasterButton');
  const prizeMasterSelectModal = document.getElementById('prizeMasterSelectModal');
  const prizeMasterSelectList = document.getElementById('prizeMasterSelectList');
  const addSelectedPrizesButton = document.getElementById('addSelectedPrizesButton');
  const closePrizeMasterSelectModal = prizeMasterSelectModal.querySelector('.close-button');

  // Participant View Elements (参加者用)
  const participantEventName = document.getElementById('participantEventName');
  const prizeDisplay = document.getElementById('prizeDisplay');
  const nameEntrySection = document.getElementById('nameEntrySection');
  const nameInput = document.getElementById('nameInput');
  const confirmNameButton = document.getElementById('confirmNameButton');
  const suggestionList = document.getElementById('suggestionList');
  const participantControlPanel = document.getElementById('participantControlPanel');
  const welcomeName = document.getElementById('welcomeName');
  const goToAmidaButton = document.getElementById('goToAmidaButton');
  const setPasswordButton = document.getElementById('setPasswordButton');
  const participantLogoutButton = document.getElementById('participantLogoutButton');
  const deleteMyAccountButton = document.getElementById('deleteMyAccountButton');
  const joinSection = document.getElementById('joinSection');
  const backToControlPanelButton = document.getElementById('backToControlPanelButton');
  const slotList = document.getElementById('slotList');
  const joinButton = document.getElementById('joinButton');
  const waitingMessage = document.getElementById('waitingMessage');
  const deleteParticipantWaitingButton = document.getElementById('deleteParticipantWaitingButton');
  const resultSection = document.getElementById('resultSection');
  const myResult = document.getElementById('myResult');
  const allResultsContainer = document.getElementById('allResultsContainer');
  const shareButton = document.getElementById('shareButton');
  const editProfileButton = document.getElementById('editProfileButton');
  const backToControlPanelFromResultButton = document.getElementById('backToControlPanelFromResultButton');
  const passwordSetModal = document.getElementById('passwordSetModal');
  const closePasswordSetModal = passwordSetModal.querySelector('.close-button');
  const newPasswordInput = document.getElementById('newPasswordInput');
  const savePasswordButton = document.getElementById('savePasswordButton');

  // Admin Dashboard Elements
  const adminUserList = document.getElementById('adminUserList');
  const pendingRequestsList = document.getElementById('pendingRequestsList');
  const systemAdminList = document.getElementById('systemAdminList');

  // Profile Edit Modal Elements
  const profileEditModal = document.getElementById('profileEditModal');
  const closeProfileModalButton = profileEditModal.querySelector('.close-button');
  const profileIconPreview = document.getElementById('profileIconPreview');
  const profileIconInput = document.getElementById('profileIconInput');
  const profileColorInput = document.getElementById('profileColorInput');
  const saveProfileButton = document.getElementById('saveProfileButton');

  // --- UI要素の取得 ---
  const groupSwitcher = document.getElementById('groupSwitcher');
  const currentGroupName = document.getElementById('currentGroupName');
  const groupDropdown = document.getElementById('groupDropdown');
  const switcherGroupList = document.getElementById('switcherGroupList');
  const switcherCreateGroup = document.getElementById('switcherCreateGroup');
  const backToDashboardButton = document.getElementById('backToDashboardButton');
  const goToGroupSettingsButton = document.getElementById('goToGroupSettingsButton');

  // --- データ管理 ---
  let allUserGroups = []; // ユーザーが管理する全グループを保持

  // --- データ管理 ---
  let prizes = [];
  let currentLotteryData = null;
  let currentUser = null;
  let currentGroupId = null;
  let currentEventId = null;
  let selectedSlot = null;
  let groupParticipants = [];
  let currentParticipantToken = null;
  let currentParticipantId = null;
  let currentParticipantName = null;
  let debounceTimer;

  // --- アニメーション管理 ---
  let animationFrameId;
  const animator = {
    tracers: [],
    icons: {},
    running: false,
    speed: 4,
    onComplete: null,
    context: null,
    step: 0,
  };

  const ALL_VIEWS = ['groupDashboard', 'dashboardView', 'eventEditView', 'broadcastView', 'participantView', 'adminDashboard'];

  /**
   * ヘッダーの実際の高さに応じてbodyのpadding-topを動的に調整する関数
   */
  function adjustBodyPadding() {
    const header = document.querySelector('.main-header');
    const impersonationBanner = document.querySelector('.impersonation-banner');
    let totalOffset = 0;

    if (header) {
      totalOffset += header.offsetHeight;
    }
    // 成り代わりバナーが表示されている場合は、その高さも加算する
    if (impersonationBanner && getComputedStyle(impersonationBanner).display !== 'none') {
      totalOffset += impersonationBanner.offsetHeight;
    }

    document.body.style.paddingTop = `${totalOffset}px`;
  }

  // ----- 画面表示ロジック -----

  function showView(viewToShowId) {
    ALL_VIEWS.forEach((viewId) => {
      const el = document.getElementById(viewId);
      if (el) {
        el.style.display = viewId === viewToShowId ? 'block' : 'none';
      }
    });
    stopAnimation();
    // ビューが切り替わるたびに、必ずヘッダーの高さを再計算して適用する
    adjustBodyPadding();
  }

  function hideParticipantSubViews() {
    if (nameEntrySection) nameEntrySection.style.display = 'none';
    if (participantControlPanel) participantControlPanel.style.display = 'none';
    if (joinSection) joinSection.style.display = 'none';
    if (waitingMessage) waitingMessage.style.display = 'none';
    if (resultSection) resultSection.style.display = 'none';
  }

  async function showGroupDashboard() {
    showView('groupDashboard');
    currentGroupId = null;
    if (groupNameInput) {
      groupNameInput.value = ''; // 入力フィールドをクリア
    }
    await loadGroups();
  }

  async function showAdminDashboard() {
    showView('adminDashboard');
    await loadAdminDashboard();
  }

  function showDashboardView(groupId, groupName) {
    showView('dashboardView');
    currentGroupId = groupId;
    if (eventGroupName) eventGroupName.textContent = `グループ: ${groupName}`;
    resetEventCreationForm();
    loadEventsForGroup(groupId);
    updateGroupSwitcher(); // ★ 追加
  }

  if (backToDashboardButton) {
    backToDashboardButton.addEventListener('click', () => {
      const currentGroup = allUserGroups.find((g) => g.id === currentGroupId);
      if (currentGroup) {
        showDashboardView(currentGroup.id, currentGroup.name);
      } else {
        showGroupDashboard();
      }
    });
  }
  // ----- URLルーティングと初期化 -----

  // 修正後
  async function handleRouting() {
    stopAnimation();
    const path = window.location.pathname;
    const eventIdMatch = path.match(/\/events\/([a-zA-Z0-9]+)/);
    const customUrlMatch = path.match(/\/g\/([a-zA-Z0-9-_]+)/);
    const shareMatch = path.match(/\/share\/([a-zA-Z0-9]+)\/(.+)/);
    const adminMatch = path.match(/\/admin/);
    const adminRequestMatch = path.match(/\/admin-request/);

    const isParticipantView = eventIdMatch || customUrlMatch || shareMatch;

    // 最初に認証状態を確認し、ログインユーザー情報を取得完了させる
    const loggedInUser = await checkGoogleAuthState();

    // 参加者用ページへのアクセスの場合
    if (isParticipantView) {
      document.querySelector('.main-header').style.display = 'none';
      showView('participantView');
      const eventId = eventIdMatch ? eventIdMatch[1] : shareMatch ? shareMatch[1] : null;
      const customUrl = customUrlMatch ? customUrlMatch[1] : null;
      const participantName = shareMatch ? decodeURIComponent(shareMatch[2]) : null;
      const isShare = !!shareMatch;
      await initializeParticipantView(eventId, isShare, participantName, customUrl);
      return; // 参加者ビューの処理が完了したら、以降の処理は不要
    }

    // 管理者用ページへのアクセスの場合
    document.querySelector('.main-header').style.display = 'flex';
    adjustBodyPadding(); // ヘッダー表示後にpaddingを調整

    if (loggedInUser) {
      // ログインしている場合
      if (adminMatch && loggedInUser.role === 'system_admin' && !loggedInUser.isImpersonating) {
        showAdminDashboard();
      } else {
        // lastUsedGroupIdに基づいてリダイレクト、なければ最初のグループへ
        await loadUserGroupsAndRedirect(loggedInUser.lastUsedGroupId);
      }
    } else {
      // ログインしていない場合
      ALL_VIEWS.forEach((viewId) => {
        const el = document.getElementById(viewId);
        if (el) el.style.display = 'none';
      });
      if (authStatus) authStatus.textContent = 'イベント管理はログインが必要です。';
      if (loginButton) loginButton.style.display = 'block';
    }
  }

  // 修正後
  async function checkGoogleAuthState() {
    try {
      const res = await fetch('/api/user/me');
      if (!res.ok) throw new Error('Failed to fetch auth state');
      const user = await res.json();
      currentUser = user;
      const impersonationBanner = document.querySelector('.impersonation-banner');

      if (user && user.id) {
        let displayName = user.name;
        if (user.isImpersonating) {
          displayName = `${user.originalUser.name} (成り代わり中: ${user.name})`;
          if (impersonationBanner) impersonationBanner.style.display = 'block';
        } else {
          if (impersonationBanner) impersonationBanner.style.display = 'none';
        }
        if (authStatus) authStatus.textContent = `ようこそ、${displayName}さん`;
        if (loginButton) loginButton.style.display = 'none';
        if (logoutButton) logoutButton.style.display = 'block';
        if (deleteAccountButton) deleteAccountButton.style.display = 'block';

        const isSystemAdmin = user.role === 'system_admin' && !user.isImpersonating;
        if (adminDashboardButton) adminDashboardButton.style.display = isSystemAdmin ? 'block' : 'none';

        if (requestAdminButton) {
          if (user.role === 'user') {
            if (user.adminRequestStatus === 'pending') {
              requestAdminButton.textContent = '申請中';
              requestAdminButton.disabled = true;
            } else {
              requestAdminButton.textContent = '管理者権限を申請する';
              requestAdminButton.disabled = false;
            }
            requestAdminButton.style.display = 'block';
          } else {
            requestAdminButton.style.display = 'none';
          }
        }
        return user; // ★取得したユーザー情報を返す
      } else {
        if (authStatus) authStatus.textContent = '';
        if (loginButton) loginButton.style.display = 'block';
        if (logoutButton) logoutButton.style.display = 'none';
        if (deleteAccountButton) deleteAccountButton.style.display = 'none';
        if (adminDashboardButton) adminDashboardButton.style.display = 'none';
        if (requestAdminButton) requestAdminButton.style.display = 'none';
        if (impersonationBanner) impersonationBanner.style.display = 'none';
        return null; // ★ログインしていない場合はnullを返す
      }
    } catch (e) {
      console.error('Auth check failed', e);
      return null; // ★エラー時もnullを返す
    } finally {
      adjustBodyPadding(); // 最後に必ずpaddingを調整
    }
  }

  async function loadUserGroupsAndRedirect(lastUsedGroupId) {
    try {
      const res = await fetch('/api/groups');
      if (!res.ok) throw new Error('グループの読み込みに失敗');
      allUserGroups = await res.json();
      updateGroupSwitcher(); // ★ スイッチャーUIを更新

      if (allUserGroups.length > 0) {
        let targetGroup = allUserGroups.find((g) => g.id === lastUsedGroupId);
        if (!targetGroup) {
          targetGroup = allUserGroups[0]; // lastUsedGroupId が無効なら最初のグループへ
        }
        showDashboardView(targetGroup.id, targetGroup.name);
      } else {
        showGroupDashboard(); // グループが一つもなければグループ作成画面へ
      }
    } catch (error) {
      console.error(error);
      showGroupDashboard(); // エラー時もグループ作成画面へ
    }
  }

  function resetEventCreationForm() {
    prizes = [];
    renderPrizeList();
    if (participantCountInput) participantCountInput.value = '';
    if (displayModeSelect) displayModeSelect.value = 'public';
    if (eventPasswordInput) eventPasswordInput.value = '';
    if (ctxAdmin) ctxAdmin.clearRect(0, 0, adminCanvas.width, adminCanvas.height);
    if (adminCanvas) adminCanvas.style.display = 'none';
    if (currentEventUrl) {
      currentEventUrl.textContent = '（イベント作成後に表示されます）';
      currentEventUrl.href = '#';
    }
    if (eventIdInput) eventIdInput.value = '';
    currentEventId = null;
    currentLotteryData = null;
    if (createEventButton) createEventButton.textContent = 'この内容でイベントを作成'; // ボタンテキストを元に戻す
    if (adminControls) adminControls.style.display = 'none';
    if (broadcastControls) broadcastControls.style.display = 'none';
  }

  // ----- UI更新 (管理者) -----
  function renderPrizeList() {
    if (!prizeList) return;
    prizeList.innerHTML = '';
    prizes.forEach((p, index) => {
      const li = document.createElement('li');
      li.className = 'prize-list-item';

      const prizeName = typeof p === 'object' ? p.name : p;
      const prizeImageUrl = typeof p === 'object' ? p.imageUrl : null;

      if (prizeImageUrl) {
        const img = document.createElement('img');
        img.src = prizeImageUrl;
        img.alt = prizeName;
        img.className = 'prize-list-image';
        li.appendChild(img);
      }

      const nameSpan = document.createElement('span');
      nameSpan.textContent = prizeName;
      li.appendChild(nameSpan);

      li.appendChild(createDeleteButton(index));
      prizeList.appendChild(li);
    });
  }

  function createDeleteButton(index) {
    const btn = document.createElement('button');
    btn.textContent = '削除';
    btn.className = 'delete-btn';
    btn.dataset.index = index;
    return btn;
  }

  function createParticipantDeleteButton(participantId) {
    const btn = document.createElement('button');
    btn.textContent = '削除';
    btn.className = 'delete-btn';
    btn.dataset.participantId = participantId;
    btn.addEventListener('click', () => {
      groupParticipants = groupParticipants.filter((p) => p.id !== participantId);
      renderParticipantManagementList();
    });
    return btn;
  }

  function renderParticipantManagementList() {
    if (!participantManagementList) return;
    participantManagementList.innerHTML = '';
    groupParticipants.forEach((p) => {
      const li = document.createElement('li');
      const colorSwatch = document.createElement('input');
      colorSwatch.type = 'color';
      colorSwatch.value = p.color;
      colorSwatch.className = 'color-swatch';
      colorSwatch.dataset.participantId = p.id;

      const nameSpan = document.createElement('span');
      nameSpan.textContent = p.name;

      li.appendChild(colorSwatch);
      li.appendChild(nameSpan);
      li.appendChild(createParticipantDeleteButton(p.id));
      participantManagementList.appendChild(li);
    });
  }

  // ----- アニメーション & 描画ロジック -----
  /**
   * キャンバスの解像度を表示サイズに合わせる関数
   * @param {HTMLCanvasElement} canvas 対象のキャンバス
   */
  function resizeCanvasToDisplaySize(canvas) {
    if (!canvas) return;
    const {width, height} = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // 解像度が異なっていたら再設定
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr); // 高解像度ディスプレイに対応
      return true; // サイズが変更された
    }
    return false; // サイズ変更なし
  }
  function stopAnimation() {
    animator.running = false;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
  }

  function calculatePath(startIdx, lines, numParticipants) {
    const VIRTUAL_WIDTH = 800; // 基準となる幅
    const VIRTUAL_HEIGHT = 400; // 基準となる高さ
    const path = [];
    const participantSpacing = VIRTUAL_WIDTH / (numParticipants + 1);
    const sortedLines = [...lines].sort((a, b) => a.y - b.y);

    let currentPathIdx = startIdx;

    // 始点を追加
    path.push({x: participantSpacing * (currentPathIdx + 1), y: 30});

    // 全ての横線を順番に確認
    sortedLines.forEach((line) => {
      // ★ 修正：現在の自分の経路に横線が関係ある場合のみ、点を追加する
      if (line.fromIndex === currentPathIdx || line.toIndex === currentPathIdx) {
        // 横線のある高さまで垂直に移動した点を追加
        path.push({x: participantSpacing * (currentPathIdx + 1), y: line.y});

        // 横線を渡ってインデックスを更新
        if (line.fromIndex === currentPathIdx) {
          currentPathIdx = line.toIndex;
        } else {
          currentPathIdx = line.fromIndex;
        }

        // 横線を渡りきった後の点を追加
        path.push({x: participantSpacing * (currentPathIdx + 1), y: line.y});
      }
    });

    // 最終的なゴール地点を追加
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
        img.onload = () => {
          animator.icons[p.name] = img;
          resolve();
        };
        img.onerror = () => {
          console.warn(`Failed to load image: ${iconUrl}. Using fallback.`);
          animator.icons[p.name] = null;
          resolve();
        };
        img.src = iconUrl;
      });
    });
    await Promise.all(promises);
  }

  function animationLoop() {
    if (!animator.running) return;

    const targetCtx = animator.context;
    if (!targetCtx || !targetCtx.canvas) {
      stopAnimation();
      return;
    }

    targetCtx.clearRect(0, 0, targetCtx.canvas.width, targetCtx.canvas.height);
    drawLotteryBase(targetCtx, currentLotteryData, '#e0e0e0');

    let allFinished = true;
    animator.tracers.forEach((tracer) => {
      drawTracerPath(targetCtx, tracer);
    });
    animator.tracers.forEach((tracer) => {
      if (!tracer.isFinished) {
        allFinished = false;
        updateTracerPosition(tracer);
      }
      drawTracerIcon(targetCtx, tracer);
    });

    if (allFinished) {
      animator.running = false;
      if (animator.onComplete) {
        animator.onComplete();
      }
    } else {
      animationFrameId = requestAnimationFrame(animationLoop);
    }
  }

  function updateTracerPosition(tracer) {
    // ★ ステップ実行用の停止ロジックを追加
    if (tracer.stopY && tracer.y >= tracer.stopY) {
      // 停止Y座標に到達したら、正確な位置に補正して停止
      const start = tracer.path[tracer.pathIndex];
      const end = tracer.path[tracer.pathIndex + 1];
      if (end && start.y < tracer.stopY && end.y >= tracer.stopY) {
        const ratio = (tracer.stopY - start.y) / (end.y - start.y);
        // 停止Y座標ピッタリのX座標を計算
        const stopX = start.x + (end.x - start.x) * ratio;
        if (!isNaN(stopX)) tracer.x = stopX;
      }
      tracer.y = tracer.stopY;
      tracer.isFinished = true;
      delete tracer.stopY; // 停止位置指定をクリア
      return;
    }

    const start = tracer.path[tracer.pathIndex];
    const end = tracer.path[tracer.pathIndex + 1];

    if (!start || !end) {
      tracer.isFinished = true;
      return;
    }

    const dx = end.x - start.x;
    const dy = end.y - start.y;
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
      } else {
        tracer.x = tracer.path[tracer.pathIndex].x;
        tracer.y = tracer.path[tracer.pathIndex].y;
      }
    }
  }
  function updateGroupSwitcher() {
    if (!groupSwitcher || !currentGroupName || !switcherGroupList) return;

    groupSwitcher.style.display = 'block';

    const currentGroup = allUserGroups.find((g) => g.id === currentGroupId);
    if (currentGroup) {
      currentGroupName.textContent = currentGroup.name;
    }

    switcherGroupList.innerHTML = '';
    allUserGroups.forEach((group) => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.textContent = group.name;
      button.dataset.groupId = group.id;
      button.dataset.groupName = group.name;
      if (group.id === currentGroupId) {
        button.classList.add('active');
      }
      li.appendChild(button);
      switcherGroupList.appendChild(li);
    });
  }

  // グループスイッチャーの表示切替
  if (currentGroupName) {
    currentGroupName.addEventListener('click', (e) => {
      e.stopPropagation();
      groupDropdown.style.display = groupDropdown.style.display === 'block' ? 'none' : 'block';
    });
  }

  // ドロップダウンからグループを選択
  if (switcherGroupList) {
    switcherGroupList.addEventListener('click', async (e) => {
      if (e.target.tagName === 'BUTTON') {
        const {groupId, groupName} = e.target.dataset;
        showDashboardView(groupId, groupName);
        groupDropdown.style.display = 'none';
        // 最後に使ったグループIDをサーバーに保存
        await fetch('/api/user/me/last-group', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({groupId}),
        });
        updateGroupSwitcher();
      }
    });
  }

  // グローバルクリックでドロップダウンを閉じる
  window.addEventListener('click', () => {
    if (groupDropdown && groupDropdown.style.display === 'block') {
      groupDropdown.style.display = 'none';
    }
  });

  function drawLotteryBase(targetCtx, data, lineColor = '#ccc') {
    if (!targetCtx || !targetCtx.canvas || !data || !data.participants || data.participants.length === 0) return;

    // ★ 描画サイズと倍率を計算
    const rect = targetCtx.canvas.getBoundingClientRect();
    targetCtx.canvas.width = rect.width * devicePixelRatio;
    targetCtx.canvas.height = rect.height * devicePixelRatio;
    targetCtx.scale(devicePixelRatio, devicePixelRatio);
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

  function drawTracerPath(targetCtx, tracer) {
    const rect = targetCtx.canvas.getBoundingClientRect();
    const scaleX = rect.width / 800;
    const scaleY = rect.height / 400;

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
    const scaleX = rect.width / 800;
    const scaleY = rect.height / 400;

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

  async function startAnimation(targetCtx, userNames = [], onComplete = null) {
    stopAnimation();
    if (!targetCtx || !currentLotteryData) return;

    const participantsToAnimate = currentLotteryData.participants.filter((p) => p && p.name && userNames.includes(p.name));

    await preloadIcons(participantsToAnimate);

    animator.tracers = participantsToAnimate.map((p) => {
      const startIdx = p.slot;
      // ★ 修正：サイズ引数を削除
      const path = calculatePath(startIdx, currentLotteryData.lines, currentLotteryData.participants.length);
      return {
        name: p.name,
        color: p.color || '#333',
        path: path,
        pathIndex: 0,
        progress: 0,
        x: path[0].x,
        y: path[0].y,
        isFinished: false,
      };
    });

    animator.context = targetCtx;
    animator.onComplete = onComplete;
    animator.running = true;
    animationLoop();
  }

  async function startStepAnimation(targetCtx) {
    stopAnimation();
    if (!targetCtx || !currentLotteryData) return;

    const allParticipants = currentLotteryData.participants.filter((p) => p.name);
    await preloadIcons(allParticipants);

    const sortedLines = [...currentLotteryData.lines].sort((a, b) => a.y - b.y);
    const linesForStep = sortedLines.slice(0, animator.step);

    animator.tracers = allParticipants.map((p) => {
      const startIdx = p.slot;
      // ★ 修正：サイズ引数を削除
      const path = calculatePath(startIdx, linesForStep, currentLotteryData.participants.length);

      return {
        name: p.name,
        color: p.color || '#333',
        path: path,
        pathIndex: 0,
        progress: 0,
        x: path[0].x,
        y: path[0].y,
        isFinished: false,
      };
    });

    animator.context = targetCtx;
    animator.onComplete = null;
    animator.running = true;
    animationLoop();
  }

  async function startStepAnimation(targetCtx) {
    stopAnimation();
    if (!targetCtx || !currentLotteryData) return;

    resizeCanvasToDisplaySize(targetCtx.canvas);

    const allParticipants = currentLotteryData.participants.filter((p) => p.name);
    await preloadIcons(allParticipants);

    const sortedLines = [...currentLotteryData.lines].sort((a, b) => a.y - b.y);
    const linesForStep = sortedLines.slice(0, animator.step);

    animator.tracers = allParticipants.map((p) => {
      const startIdx = p.slot;
      const path = calculatePath(startIdx, linesForStep, currentLotteryData.participants.length, targetCtx.canvas.width, targetCtx.canvas.height);

      return {
        name: p.name,
        color: p.color || '#333',
        path: path,
        pathIndex: 0,
        progress: 0,
        x: path[0].x,
        y: path[0].y,
        isFinished: false,
      };
    });

    animator.context = targetCtx;
    animator.onComplete = null;
    animator.running = true;
    animationLoop();
  }

  // ----- API通信 (管理者) -----

  async function loadGroups() {
    if (!groupList) return;
    try {
      const res = await fetch('/api/groups');
      if (!res.ok) throw new Error('グループの読み込みに失敗');
      const groups = await res.json();
      groupList.innerHTML = '';
      groups.forEach((group) => {
        const li = document.createElement('li');
        li.className = 'item-list-item';
        li.dataset.groupId = group.id;
        li.dataset.groupName = group.name;

        const groupInfo = document.createElement('span');
        const date = group.createdAt && group.createdAt.seconds ? new Date(group.createdAt.seconds * 1000) : new Date();
        groupInfo.textContent = `${group.name} (${date.toLocaleDateString()})`;
        li.appendChild(groupInfo);

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'item-buttons';

        const settingsBtn = document.createElement('button');
        settingsBtn.textContent = '設定';
        settingsBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openSettingsModal(group);
        });
        buttonContainer.appendChild(settingsBtn);
        li.appendChild(buttonContainer);
        groupList.appendChild(li);
      });
    } catch (error) {
      console.error(error);
      if (groupList) groupList.innerHTML = `<li class="error-message">${error.message}</li>`;
    }
  }

  async function openSettingsModal(group) {
    if (!groupSettingsModal) return;
    settingsGroupId.value = group.id;
    currentGroupId = group.id;
    customUrlInput.value = group.customUrl || '';
    if (customUrlPreview) customUrlPreview.textContent = group.customUrl || '';
    groupPasswordInput.value = '';
    groupPasswordInput.placeholder = '変更する場合のみ入力';
    noIndexCheckbox.checked = group.noIndex || false;
    groupParticipants = group.participants ? [...group.participants] : [];
    renderParticipantManagementList();
    await loadPasswordRequests(group.id);
    await loadPrizeMasters();
    groupSettingsModal.style.display = 'block';
  }

  function closeSettingsModal() {
    if (groupSettingsModal) groupSettingsModal.style.display = 'none';
  }

  async function saveGroupSettings() {
    const groupId = settingsGroupId.value;
    const customUrl = customUrlInput.value.trim();
    const password = groupPasswordInput.value;
    const noIndex = noIndexCheckbox.checked;

    try {
      saveGroupSettingsButton.disabled = true;
      const settingsRes = await fetch(`/api/groups/${groupId}/settings`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({customUrl, password: password || null, noIndex}),
      });
      if (!settingsRes.ok) throw new Error((await settingsRes.json()).error);

      const participantsRes = await fetch(`/api/groups/${groupId}/participants`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({participants: groupParticipants}),
      });
      if (!participantsRes.ok) throw new Error((await participantsRes.json()).error);

      alert('設定を保存しました。');
      closeSettingsModal();
      await loadGroups();
    } catch (error) {
      console.error('Settings save failed:', error);
      alert(error.message);
    } finally {
      saveGroupSettingsButton.disabled = false;
    }
  }

  async function addParticipantToGroup() {
    const name = addParticipantNameInput.value.trim();
    if (!name) return;

    const newParticipant = {
      id: `temp_${Date.now()}`,
      name: name,
      color: `#${Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, '0')}`,
    };

    groupParticipants.push(newParticipant);
    renderParticipantManagementList();
    addParticipantNameInput.value = '';
  }

  async function handleColorChange(e) {
    const participantId = e.target.dataset.participantId;
    const newColor = e.target.value;

    const participant = groupParticipants.find((p) => p.id === participantId);
    if (participant) {
      participant.color = newColor;
    }
  }

  async function createGroup() {
    const name = groupNameInput.value.trim();
    if (!name) return alert('グループ名を入力してください。');

    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({groupName: name, participants: []}),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'グループ作成に失敗');
      groupNameInput.value = '';
      await loadGroups();
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  }

  async function loadEventsForGroup(groupId) {
    if (!eventList) return;
    try {
      const res = await fetch(`/api/groups/${groupId}/events`);
      if (!res.ok) throw new Error('イベント一覧の読み込みに失敗');
      const events = await res.json();
      eventList.innerHTML = '';
      events.forEach((event) => {
        const li = document.createElement('li');
        const filledSlots = event.participants.filter((p) => p.name).length;
        const date = event.createdAt.seconds ? new Date(event.createdAt.seconds * 1000) : new Date(event.createdAt);
        li.innerHTML = `
          <span class="event-info">
            <span class="event-date">${date.toLocaleString()}</span>
            <span>${event.status === 'started' ? '実施済み' : '受付中'}</span>
            <span class="event-status">${filledSlots} / ${event.participantCount} 名参加</span>
          </span>
          <div class="item-buttons">
              <button class="edit-event-btn" data-event-id="${event.id}">編集</button>
              <button class="start-event-btn" data-event-id="${event.id}">実施</button>
              <button class="copy-event-btn" data-event-id="${event.id}">コピー</button>
          </div>
      `;
        li.className = 'item-list-item';

        // イベントリスナーをボタンに直接追加
        li.querySelector('.edit-event-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          loadEvent(event.id, 'eventEditView');
        });
        li.querySelector('.start-event-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          loadEvent(event.id, 'broadcastView');
        });
        li.querySelector('.copy-event-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          copyEvent(event.id);
        });

        eventList.appendChild(li);
      });
    } catch (error) {
      console.error(error);
      if (eventList) eventList.innerHTML = `<li class="error-message">${error.message}</li>`;
    }
  }

  async function copyEvent(eventId) {
    if (!confirm('このイベントをコピーしますか？')) return;
    try {
      const res = await fetch(`/api/events/${eventId}/copy`, {
        method: 'POST',
      });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || 'イベントのコピーに失敗しました。');
      }
      alert('イベントをコピーしました。');
      await loadEventsForGroup(currentGroupId);
    } catch (error) {
      console.error('Failed to copy event:', error);
      alert(`エラー: ${error.message}`);
    }
  }

  async function createEvent() {
    if (!currentGroupId) return alert('グループが選択されていません。');
    const participantCount = parseInt(participantCountInput.value, 10);
    if (!participantCount || participantCount < 2) return alert('参加人数は2人以上で設定してください。');
    if (prizes.length === 0) return alert('景品を1つ以上設定してください。');
    if (participantCount !== prizes.length) return alert('参加人数と景品の数は同じにしてください。');

    const eventData = {
      prizes,
      groupId: currentGroupId,
      participantCount,
      displayMode: displayModeSelect.value,
      eventPassword: eventPasswordInput.value,
    };

    try {
      createEventButton.disabled = true;
      createEventButton.textContent = '作成中...';
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(eventData),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'イベント作成に失敗');

      alert(`イベントが作成されました！ ID: ${result.id}`);
      showView('dashboardView');
      await loadEventsForGroup(currentGroupId);
    } catch (error) {
      console.error('Create failed:', error);
      alert(error.message);
    } finally {
      createEventButton.disabled = false;
      createEventButton.textContent = 'この内容でイベントを作成';
    }
  }

  async function updateEvent() {
    if (!currentEventId) return alert('更新対象のイベントIDがありません。');
    const participantCount = parseInt(participantCountInput.value, 10);
    if (participantCount !== prizes.length) return alert('参加人数と景品の数は同じにしてください。');

    const eventData = {
      prizes,
      participantCount,
      displayMode: displayModeSelect.value,
      eventPassword: eventPasswordInput.value,
    };

    try {
      createEventButton.disabled = true;
      createEventButton.textContent = '保存中...';
      const res = await fetch(`/api/events/${currentEventId}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(eventData),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'イベント更新に失敗');

      alert(`イベントが更新されました！`);
      const currentGroup = allUserGroups.find((g) => g.id === currentGroupId);
      showDashboardView(currentGroup.id, currentGroup.name);
    } catch (error) {
      console.error('Update failed:', error);
      alert(error.message);
    } finally {
      createEventButton.disabled = false;
    }
  }

  async function loadEvent(eventId, viewToShow = 'eventEditView') {
    if (!eventId) return;
    currentEventId = eventId;

    try {
      const res = await fetch(`/api/events/${eventId}`);
      if (!res.ok) throw new Error((await res.json()).error || '読み込みに失敗');
      const data = await res.json();
      currentLotteryData = data;

      // --- 共通のデータ更新 ---
      const url = `${window.location.origin}/events/${eventId}`;
      if (currentEventUrl) {
        currentEventUrl.textContent = url;
        currentEventUrl.href = url;
      }
      if (eventIdInput) eventIdInput.value = eventId;

      // --- 表示するビューに応じた準備処理 ---
      showView(viewToShow); // 先にコンテナを表示

      if (viewToShow === 'eventEditView') {
        prizes = data.prizes || [];
        if (participantCountInput) participantCountInput.value = data.participantCount;
        if (displayModeSelect) displayModeSelect.value = data.displayMode;
        if (eventPasswordInput) {
          eventPasswordInput.value = '';
          eventPasswordInput.placeholder = data.eventPassword ? '（パスワード設定済み）' : '（任意）';
        }
        if (createEventButton) {
          createEventButton.textContent = 'この内容でイベントを保存'; // ボタンテキストを変更
        }
        renderPrizeList();
      } else if (viewToShow === 'broadcastView') {
        // broadcastViewの内部状態を管理
        if (data.status === 'pending') {
          if (adminControls) adminControls.style.display = 'block';
          if (startEventButton) startEventButton.style.display = 'inline-block';
          if (startBroadcastButton) startBroadcastButton.style.display = 'none';
          if (broadcastControls) broadcastControls.style.display = 'none';
          if (adminCanvas) adminCanvas.style.display = 'none';
        } else if (data.status === 'started') {
          if (adminControls) adminControls.style.display = 'none';
          if (broadcastControls) broadcastControls.style.display = 'flex';
          if (adminCanvas) adminCanvas.style.display = 'block';

          // --- Animation Setup ---
          const allParticipants = currentLotteryData.participants.filter((p) => p.name);
          await preloadIcons(allParticipants);

          if (highlightUserSelect) {
            highlightUserSelect.innerHTML = '';
            allParticipants.forEach((p) => {
              const option = document.createElement('option');
              option.value = p.name;
              option.textContent = p.name;
              highlightUserSelect.appendChild(option);
            });
          }

          animator.tracers = allParticipants.map((p) => {
            const startIdx = p.slot;
            const path = calculatePath(startIdx, currentLotteryData.lines, currentLotteryData.participants.length);
            return {
              name: p.name,
              color: p.color || '#333',
              path: path,
              pathIndex: 0,
              progress: 0,
              x: path[0].x,
              y: path[0].y,
              isFinished: true,
            };
          });

          resizeCanvasToDisplaySize(adminCanvas);
          drawLotteryBase(ctxAdmin, currentLotteryData, '#333');
          animator.context = ctxAdmin;
          animator.tracers.forEach((tracer) => drawTracerIcon(animator.context, tracer));
        }
      }
    } catch (error) {
      console.error('Load failed:', error);
      alert(error.message);
    }
  }

  async function startEvent() {
    if (!currentEventId) return alert('イベントが選択されていません。');
    if (!confirm('イベントを開始しますか？\n開始後は新規参加ができなくなります。')) return;

    try {
      const res = await fetch(`/api/events/${currentEventId}/start`, {method: 'POST'});
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      alert('イベントを開始しました！');
      // broadcastViewを再読み込みしてアニメーション準備を行う
      await loadEvent(currentEventId, 'broadcastView');
    } catch (error) {
      console.error('Failed to start event:', error);
      alert(`エラー: ${error.message}`);
    }
  }

  async function syncParticipantCount() {
    if (!currentGroupId) return;
    try {
      const res = await fetch(`/api/groups`);
      if (!res.ok) throw new Error('グループ情報の取得に失敗');
      const groups = await res.json();
      const currentGroup = groups.find((g) => g.id === currentGroupId);
      if (currentGroup && currentGroup.participants) {
        participantCountInput.value = currentGroup.participants.length;
      }
    } catch (e) {
      alert(e.message);
    }
  }

  // --- System Admin Functions ---
  async function loadAdminDashboard() {
    await loadPendingRequests();
    await loadGroupAdmins();
    await loadSystemAdmins();
  }

  async function loadPendingRequests() {
    if (!pendingRequestsList) return;
    try {
      const res = await fetch('/api/admin/requests');
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '申請一覧の読み込みに失敗しました。');
      }
      const requests = await res.json();

      pendingRequestsList.innerHTML = '';
      if (requests.length === 0) {
        pendingRequestsList.innerHTML = '<li>現在、承認待ちの申請はありません。</li>';
        return;
      }
      requests.forEach((req) => {
        const li = document.createElement('li');
        li.className = 'item-list-item';
        li.innerHTML = `
                    <span>${req.name} (${req.email})</span>
                    <div class="item-buttons">
                        <button class="approve-btn" data-request-id="${req.id}">承認</button>
                    </div>
                `;
        pendingRequestsList.appendChild(li);
      });
    } catch (error) {
      console.error(error);
      pendingRequestsList.innerHTML = `<li class="error-message">${error.message}</li>`;
    }
  }

  async function loadGroupAdmins() {
    if (!adminUserList) return;
    try {
      const res = await fetch('/api/admin/group-admins');
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'グループ管理者一覧の読み込みに失敗しました。');
      }
      const users = await res.json();

      adminUserList.innerHTML = '';
      users.forEach((user) => {
        const li = document.createElement('li');
        li.className = 'item-list-item';
        li.innerHTML = `
                    <span>${user.name} (${user.email})</span>
                    <div class="item-buttons">
                        <button class="impersonate-btn" data-user-id="${user.id}">成り代わり</button>
                    </div>
                `;
        adminUserList.appendChild(li);
      });
    } catch (error) {
      console.error(error);
      adminUserList.innerHTML = `<li class="error-message">${error.message}</li>`;
    }
  }

  async function loadSystemAdmins() {
    if (!systemAdminList) return;
    try {
      const res = await fetch('/api/admin/system-admins');
      if (!res.ok) throw new Error((await res.json()).error);
      const admins = await res.json();

      systemAdminList.innerHTML = '';
      admins.forEach((admin) => {
        const li = document.createElement('li');
        li.className = 'item-list-item';
        const isCurrentUser = admin.id === (currentUser.isImpersonating ? currentUser.originalUser.id : currentUser.id);

        let buttons = '';
        if (!isCurrentUser) {
          buttons = `
                        <div class="item-buttons">
                            <button class="demote-btn delete-btn" data-user-id="${admin.id}">権限剥奪</button>
                        </div>`;
        }

        li.innerHTML = `<span>${admin.name} (${admin.email})</span> ${buttons}`;
        systemAdminList.appendChild(li);
      });
    } catch (error) {
      console.error(error);
      systemAdminList.innerHTML = `<li class="error-message">${error.message}</li>`;
    }
  }

  async function loadPasswordRequests(groupId) {
    if (!passwordResetRequestList) return;
    try {
      const res = await fetch(`/api/admin/groups/${groupId}/password-requests`);
      if (!res.ok) throw new Error((await res.json()).error || '依頼の読み込みに失敗');
      const requests = await res.json();

      passwordResetRequestList.innerHTML = '';
      if (requests.length === 0) {
        passwordResetRequestList.innerHTML = '<li>現在、リセット依頼はありません。</li>';
        return;
      }
      requests.forEach((req) => {
        const li = document.createElement('li');
        li.className = 'item-list-item';
        li.innerHTML = `
                    <span>${req.memberName}</span>
                    <div class="item-buttons">
                        <button class="approve-btn reset-password-btn" data-group-id="${req.groupId}" data-member-id="${req.memberId}" data-request-id="${req.id}">合言葉を削除</button>
                    </div>
                `;
        passwordResetRequestList.appendChild(li);
      });
    } catch (error) {
      console.error(error);
      passwordResetRequestList.innerHTML = `<li class="error-message">${error.message}</li>`;
    }
  }

  async function approvePasswordReset(groupId, memberId, requestId) {
    if (!confirm('このユーザーの合言葉を削除しますか？ユーザーは新しい合言葉を再設定する必要があります。')) return;
    try {
      const res = await fetch(`/api/admin/members/${memberId}/delete-password`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({groupId, requestId}),
      });
      if (!res.ok) throw new Error((await res.json()).error || '削除に失敗しました。');
      alert('合言葉を削除しました。');
      await loadPasswordRequests(groupId);
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  }

  async function approveRequest(requestId) {
    if (!confirm('このユーザーの管理者権限を承認しますか？')) return;
    try {
      const res = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({requestId}),
      });
      if (!res.ok) throw new Error((await res.json()).error || '承認に失敗しました。');
      alert('申請を承認しました。');
      await loadAdminDashboard();
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  }

  async function demoteAdmin(userId) {
    if (!confirm('本当にこのシステム管理者を通常ユーザーに戻しますか？')) return;
    try {
      const res = await fetch('/api/admin/demote', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({userId}),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      alert('ユーザーを降格させました。');
      await loadAdminDashboard();
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  }

  async function impersonateUser(targetUserId) {
    if (!confirm('このユーザーとしてログインしますか？現在のセッションは上書きされます。')) return;
    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({targetUserId}),
      });
      if (!res.ok) throw new Error((await res.json()).error || '成り代わりに失敗しました。');
      alert('成り代わりました。ページをリロードします。');
      window.location.href = '/';
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  }

  async function stopImpersonating() {
    try {
      const res = await fetch('/api/admin/stop-impersonating', {
        method: 'POST',
      });
      if (!res.ok) throw new Error((await res.json()).error || '成り代わり解除に失敗しました。');
      alert('成り代わりを解除しました。ページをリロードします。');
      window.location.href = '/admin';
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  }

  async function requestAdminAccess() {
    if (!confirm('システム管理者権限を申請しますか？')) return;
    try {
      const res = await fetch('/api/admin/request', {method: 'POST'});
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      alert(result.message);
      requestAdminButton.textContent = '申請中';
      requestAdminButton.disabled = true;
    } catch (error) {
      console.error(error);
      alert(`エラー: ${error.message}`);
    }
  }

  async function deleteAccount() {
    if (!confirm('本当にアカウントを削除しますか？\n関連する全てのデータ（グループ、イベント、ユーザー情報）が完全に削除され、元に戻すことはできません。')) {
      return;
    }
    try {
      const res = await fetch('/api/user/me', {method: 'DELETE'});
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || '削除に失敗しました。');
      }
      alert('アカウントを削除しました。');
      window.location.href = '/';
    } catch (error) {
      alert(`エラー: ${error.message}`);
    }
  }

  // ========== 参加者モードのロジック (新) ==========

  async function initializeParticipantView(eventId, isShare, sharedParticipantName, customUrl = null) {
    hideParticipantSubViews();
    try {
      let finalEventId = eventId;
      if (customUrl) {
        console.warn('Custom URL to Event ID resolution is not implemented.');
      }

      if (!finalEventId) throw new Error('イベント情報が見つかりません。');

      currentEventId = finalEventId;
      const res = await fetch(`/api/events/${currentEventId}/public`);
      if (!res.ok) throw new Error((await res.json()).error || 'イベントの読み込みに失敗');
      const eventData = await res.json();
      currentLotteryData = eventData;
      currentGroupId = eventData.groupId;

      if (participantEventName) participantEventName.textContent = eventData.eventName || 'あみだくじイベント';

      loadParticipantState();

      if (isShare) {
        await showResultsView(eventData, sharedParticipantName, true);
      } else if (currentParticipantToken && currentParticipantId) {
        if (eventData.status === 'started') {
          await showResultsView(eventData, currentParticipantName, false);
        } else {
          showControlPanelView(eventData);
        }
      } else {
        showNameEntryView();
      }
    } catch (error) {
      console.error('Error in initializeParticipantView:', error);
      if (participantView) participantView.innerHTML = `<div class="view-container"><p class="error-message">${error.message}</p></div>`;
    }
  }

  function loadParticipantState() {
    currentParticipantToken = localStorage.getItem(`token-group-${currentGroupId}`);
    currentParticipantId = localStorage.getItem(`memberId-group-${currentGroupId}`);
    currentParticipantName = localStorage.getItem(`memberName-group-${currentGroupId}`);
  }

  function saveParticipantState(token, memberId, name) {
    localStorage.setItem(`token-group-${currentGroupId}`, token);
    localStorage.setItem(`memberId-group-${currentGroupId}`, memberId);
    localStorage.setItem(`memberName-group-${currentGroupId}`, name);
    loadParticipantState();
  }

  function clearParticipantState() {
    localStorage.removeItem(`token-group-${currentGroupId}`);
    localStorage.removeItem(`memberId-group-${currentGroupId}`);
    localStorage.removeItem(`memberName-group-${currentGroupId}`);
    loadParticipantState();
  }

  function logoutParticipant() {
    clearParticipantState();
    window.location.reload();
  }

  function showNameEntryView() {
    hideParticipantSubViews();
    if (nameEntrySection) nameEntrySection.style.display = 'block';
    if (nameInput) nameInput.value = '';
    if (suggestionList) suggestionList.innerHTML = '';
  }

  function showControlPanelView(eventData) {
    hideParticipantSubViews();
    if (participantControlPanel) participantControlPanel.style.display = 'block';
    if (welcomeName) welcomeName.textContent = currentParticipantName;

    const myParticipation = eventData.participants.find((p) => p.memberId === currentParticipantId);

    if (eventData.status === 'started') {
      goToAmidaButton.textContent = '結果を見る';
    } else if (myParticipation && myParticipation.name) {
      goToAmidaButton.textContent = '参加状況を確認する';
    } else {
      goToAmidaButton.textContent = 'あみだくじに参加する';
    }

    if (editProfileButton) editProfileButton.style.display = 'block';
  }

  function showJoinView(eventData) {
    hideParticipantSubViews();
    if (joinSection) joinSection.style.display = 'block';
    renderSlots(eventData.participants);
    renderPrizesForParticipant(eventData.prizes, eventData.displayMode);
  }

  async function showWaitingView() {
    hideParticipantSubViews();
    if (waitingMessage) waitingMessage.style.display = 'block';
  }

  async function showResultsView(eventData, targetName, isShareView) {
    hideParticipantSubViews();
    if (resultSection) resultSection.style.display = 'block';

    const onAnimationComplete = () => {
      const result = eventData.results ? eventData.results[targetName] : null;
      if (result) {
        const prizeName = typeof result.prize === 'object' ? result.prize.name : result.prize;
        if (myResult) myResult.innerHTML = `<b>${targetName}さんの結果は…「${prizeName}」でした！</b>`;
      } else {
        if (myResult) myResult.textContent = 'まだ結果は発表されていません。';
      }

      if (!isShareView) {
        if (shareButton) shareButton.style.display = 'block';
        if (backToControlPanelFromResultButton) backToControlPanelFromResultButton.style.display = 'block';
      }

      if (allResultsContainer && eventData.results && Object.keys(eventData.results).length > 0) {
        let html = '<h3>みんなの結果</h3><ul class="item-list">';
        for (const name in eventData.results) {
          const prizeName = typeof eventData.results[name].prize === 'object' ? eventData.results[name].prize.name : eventData.results[name].prize;
          html += `<li class="item-list-item">${name} → ${prizeName}</li>`;
        }
        html += '</ul>';
        allResultsContainer.innerHTML = html;
      }
    };

    if (myResult) myResult.innerHTML = `<b>${targetName}さんの結果をアニメーションで確認中...</b>`;
    // ★★★★★ 修正 ★★★★★
    await startAnimation(ctxParticipant, [targetName], onAnimationComplete);
  }

  async function handleNameInput() {
    clearTimeout(debounceTimer);
    const query = nameInput.value.trim();
    if (query.length === 0) {
      if (suggestionList) suggestionList.innerHTML = '';
      return;
    }
    debounceTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/groups/${currentGroupId}/member-suggestions?q=${encodeURIComponent(query)}`);
        const suggestions = await res.json();
        if (suggestionList) suggestionList.innerHTML = '';
        suggestions.forEach((s) => {
          const button = document.createElement('button');
          button.textContent = s.name;
          button.dataset.name = s.name;
          button.dataset.memberId = s.id;
          button.dataset.hasPassword = s.hasPassword;
          button.className = 'suggestion-button';
          if (suggestionList) suggestionList.appendChild(button);
        });
      } catch (e) {
        console.error('Suggestion fetch failed', e);
      }
    }, 300);
  }

  async function handleSuggestionClick(e) {
    if (!e.target.classList.contains('suggestion-button')) return;

    const {name, memberId, hasPassword} = e.target.dataset;
    nameInput.value = name;
    if (suggestionList) suggestionList.innerHTML = '';

    if (hasPassword === 'true') {
      const password = prompt(`「${name}」さんの合言葉を入力してください:`);
      if (password) {
        await verifyPasswordAndLogin(memberId, password);
      }
    } else {
      await loginOrRegister(name, memberId);
    }
  }

  async function loginOrRegister(name, memberId = null) {
    try {
      const res = await fetch(`/api/events/${currentEventId}/join`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name, memberId}),
      });
      const result = await res.json();

      if (res.status === 401 && result.requiresPassword) {
        const password = prompt(`「${result.name}」さんの合言葉を入力してください:`);
        if (password) {
          await verifyPasswordAndLogin(result.memberId, password);
        } else {
          const forgot = confirm('合言葉を忘れましたか？管理者にリセットを依頼します。');
          if (forgot) {
            await requestPasswordReset(result.memberId);
          }
        }
      } else if (!res.ok) {
        throw new Error(result.error);
      } else {
        saveParticipantState(result.token, result.memberId, result.name);
        await initializeParticipantView(currentEventId, false, null);
      }
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  }

  async function verifyPasswordAndLogin(memberId, password, slot = null) {
    try {
      const res = await fetch(`/api/events/${currentEventId}/verify-password`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({memberId, password, slot}),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      saveParticipantState(result.token, result.memberId, result.name);

      if (slot !== null) {
        await showWaitingView();
      } else {
        await initializeParticipantView(currentEventId, false, null);
      }
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  }

  async function requestPasswordReset(memberId) {
    if (!memberId) return alert('ユーザーが特定できません。');
    try {
      const res = await fetch(`/api/members/${memberId}/request-password-deletion`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({groupId: currentGroupId}),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      alert('管理者に合言葉の削除を依頼しました。承認されると、合言葉なしでログインできるようになります。');
    } catch (error) {
      console.error(error);
      alert(`依頼エラー: ${error.message}`);
    }
  }

  function renderSlots(participants) {
    if (!slotList) return;
    slotList.innerHTML = '';
    participants.forEach((p) => {
      const slotEl = document.createElement('div');
      slotEl.className = 'slot';
      slotEl.dataset.slot = p.slot;

      if (p.name) {
        slotEl.classList.add('taken');
        slotEl.textContent = p.name;
        if (p.memberId === currentParticipantId) {
          slotEl.classList.add('my-slot');
        }
      } else {
        slotEl.classList.add('available');
        slotEl.textContent = `参加枠 ${p.slot + 1}`;
      }
      slotList.appendChild(slotEl);
    });
  }

  function renderPrizesForParticipant(prizes, displayMode) {
    if (!prizeDisplay) return;
    prizeDisplay.innerHTML = '<h3>景品一覧</h3>';
    const ul = document.createElement('ul');
    prizes.forEach((prize) => {
      const li = document.createElement('li');
      const prizeName = typeof prize === 'object' ? prize.name : prize;
      li.textContent = displayMode === 'private' ? '???' : prizeName;
      ul.appendChild(li);
    });
    prizeDisplay.appendChild(ul);
  }

  function handleSlotSelection(event) {
    const target = event.target.closest('.slot.available');
    if (!target) return;
    document.querySelectorAll('.slot.selected').forEach((el) => el.classList.remove('selected'));
    target.classList.add('selected');
    selectedSlot = parseInt(target.dataset.slot, 10);
    if (joinButton) joinButton.disabled = false;
  }

  async function joinEventWithSlot() {
    if (selectedSlot === null) return alert('参加枠を選択してください。');
    if (!currentParticipantId || !currentParticipantToken) return alert('ログイン情報が見つかりません。');

    joinButton.disabled = true;
    joinButton.textContent = '参加中...';

    try {
      const res = await fetch(`/api/events/${currentEventId}/join-slot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': currentParticipantToken,
        },
        body: JSON.stringify({
          memberId: currentParticipantId,
          slot: selectedSlot,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || '参加に失敗しました。');
      }
      await showWaitingView();
    } catch (error) {
      alert(error.message);
      joinButton.disabled = false;
      joinButton.textContent = 'この枠で参加する';
    }
  }

  async function deleteParticipant() {
    if (!confirm('このイベントへの参加を取り消しますか？')) return;
    if (!currentParticipantToken) return alert('削除に必要な情報が見つかりません。');

    try {
      const res = await fetch(`/api/events/${currentEventId}/participants`, {
        method: 'DELETE',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({deleteToken: currentParticipantToken}),
      });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || '参加の取り消しに失敗しました。');
      }
      alert('参加を取り消しました。');
      window.location.reload();
    } catch (error) {
      alert(error.message);
    }
  }

  async function deleteMyAccountCompletely() {
    if (!confirm('本当にこのグループからあなたのアカウントを削除しますか？\nこの操作は元に戻せません。')) return;

    try {
      const res = await fetch(`/api/members/${currentParticipantId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': currentParticipantToken,
        },
        body: JSON.stringify({groupId: currentGroupId}),
      });
      if (!res.ok) throw new Error((await res.json()).error);

      alert('アカウントを削除しました。');
      clearParticipantState();
      window.location.reload();
    } catch (error) {
      console.error(error);
      alert(`削除エラー: ${error.message}`);
    }
  }

  function shareResult() {
    if (!currentEventId || !currentParticipantName) return;
    const shareUrl = `${window.location.origin}/share/${currentEventId}/${encodeURIComponent(currentParticipantName)}`;
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        alert('クリップボードにシェア用URLをコピーしました！');
      })
      .catch((err) => {
        prompt('このURLをコピーしてシェアしてください:', shareUrl);
      });
  }

  // ----- プロフィール・合言葉編集関連 -----
  function openPasswordSetModal() {
    if (!passwordSetModal) return;
    if (newPasswordInput) newPasswordInput.value = '';
    passwordSetModal.style.display = 'block';
  }

  async function savePassword() {
    const password = newPasswordInput.value;
    try {
      const res = await fetch(`/api/members/${currentParticipantId}/set-password`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'x-auth-token': currentParticipantToken},
        body: JSON.stringify({password, groupId: currentGroupId}),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || '合言葉の設定に失敗しました。');
      alert('合言葉を設定しました。');
      passwordSetModal.style.display = 'none';
    } catch (error) {
      console.error('Password set failed:', error);
      alert(error.message);
    }
  }

  async function openProfileEditModal() {
    if (!currentParticipantId || !currentGroupId) {
      return alert('プロフィールの読み込みに失敗しました。');
    }
    try {
      const res = await fetch(`/api/members/${currentParticipantId}?groupId=${currentGroupId}`);
      if (!res.ok) throw new Error('メンバー情報の取得に失敗しました。');
      const memberData = await res.json();

      profileIconPreview.src = memberData.iconUrl || `/api/avatar-proxy?name=${encodeURIComponent(currentParticipantName)}`;
      profileColorInput.value = memberData.color || '#cccccc';
      profileEditModal.style.display = 'block';
    } catch (error) {
      console.error('Error opening profile modal:', error);
      alert(error.message);
    }
  }

  function closeProfileEditModal() {
    if (profileEditModal) profileEditModal.style.display = 'none';
  }

  async function saveProfile() {
    if (!currentParticipantId) return;

    saveProfileButton.disabled = true;
    saveProfileButton.textContent = '保存中...';

    try {
      let newIconUrl = null;
      const file = profileIconInput.files[0];
      const token = currentParticipantToken;

      if (!token) throw new Error('認証トークンが見つかりません。再読み込みしてください。');

      if (file) {
        const urlRes = await fetch(`/api/members/${currentParticipantId}/generate-upload-url`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': token,
          },
          body: JSON.stringify({fileType: file.type, groupId: currentGroupId}),
        });
        if (!urlRes.ok) throw new Error(`アップロードURLの取得に失敗: ${(await urlRes.json()).error}`);
        const {signedUrl, iconUrl} = await urlRes.json();

        const uploadRes = await fetch(signedUrl, {
          method: 'PUT',
          headers: {'Content-Type': file.type},
          body: file,
        });
        if (!uploadRes.ok) throw new Error('アイコンのアップロードに失敗しました。');
        newIconUrl = iconUrl;
      }

      const profileData = {
        color: profileColorInput.value,
        groupId: currentGroupId,
      };
      if (newIconUrl) {
        profileData.iconUrl = newIconUrl;
      }

      const profileRes = await fetch(`/api/members/${currentParticipantId}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token,
        },
        body: JSON.stringify(profileData),
      });

      if (!profileRes.ok) throw new Error(`プロフィールの保存に失敗: ${(await profileRes.json()).error}`);

      alert('プロフィールを保存しました。');
      closeProfileEditModal();
      window.location.reload();
    } catch (error) {
      console.error('Profile save failed:', error);
      alert(error.message);
    } finally {
      saveProfileButton.disabled = false;
      saveProfileButton.textContent = '保存する';
    }
  }

  // --- 賞品マスター関連の関数 ---

  async function loadPrizeMasters() {
    if (!prizeMasterList || !currentGroupId) return;
    try {
      const res = await fetch(`/api/groups/${currentGroupId}/prize-masters`);
      if (!res.ok) throw new Error('賞品マスターの読み込みに失敗');
      const masters = await res.json();
      renderPrizeMasterList(masters);
    } catch (error) {
      console.error(error);
      prizeMasterList.innerHTML = `<li class="error-message">${error.message}</li>`;
    }
  }

  function renderPrizeMasterList(masters) {
    prizeMasterList.innerHTML = '';
    masters.forEach((master) => {
      const li = document.createElement('li');
      li.className = 'item-list-item prize-master-item';
      li.dataset.masterId = master.id;

      const img = document.createElement('img');
      img.src = master.imageUrl;
      img.alt = master.name;
      img.className = 'prize-master-image';
      li.appendChild(img);

      const nameSpan = document.createElement('span');
      nameSpan.textContent = master.name;
      li.appendChild(nameSpan);

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '削除';
      deleteBtn.className = 'delete-btn';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deletePrizeMaster(master.id);
      });
      li.appendChild(deleteBtn);

      prizeMasterList.appendChild(li);
    });
  }

  async function addPrizeMaster() {
    const name = addMasterPrizeNameInput.value.trim();
    const file = addMasterPrizeImageInput.files[0];

    if (!name) return alert('賞品名を入力してください。');
    if (!file) return alert('画像ファイルを選択してください。');

    addMasterPrizeButton.disabled = true;
    addMasterPrizeButton.textContent = '追加中...';

    try {
      const urlRes = await fetch(`/api/groups/${currentGroupId}/prize-masters/generate-upload-url`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({fileType: file.type}),
      });
      if (!urlRes.ok) throw new Error(`アップロードURLの取得失敗: ${(await urlRes.json()).error}`);
      const {signedUrl, imageUrl} = await urlRes.json();

      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: {'Content-Type': file.type},
        body: file,
      });
      if (!uploadRes.ok) throw new Error('画像アップロード失敗');

      const addRes = await fetch(`/api/groups/${currentGroupId}/prize-masters`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name, imageUrl}),
      });
      if (!addRes.ok) throw new Error(`マスター追加失敗: ${(await addRes.json()).error}`);

      alert('賞品マスターを追加しました。');
      addMasterPrizeNameInput.value = '';
      addMasterPrizeImageInput.value = '';
      await loadPrizeMasters();
    } catch (error) {
      console.error('Failed to add prize master:', error);
      alert(`エラー: ${error.message}`);
    } finally {
      addMasterPrizeButton.disabled = false;
      addMasterPrizeButton.textContent = 'マスターに追加';
    }
  }

  async function deletePrizeMaster(masterId) {
    if (!confirm('この賞品マスターを削除しますか？\n(作成済みのイベントには影響しません)')) return;

    try {
      const res = await fetch(`/api/prize-masters/${masterId}`, {
        method: 'DELETE',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({groupId: currentGroupId}),
      });
      if (!res.ok) throw new Error((await res.json()).error || '削除に失敗しました。');
      alert('賞品マスターを削除しました。');
      await loadPrizeMasters();
    } catch (error) {
      console.error('Failed to delete prize master:', error);
      alert(`エラー: ${error.message}`);
    }
  }

  async function openPrizeMasterSelectModal() {
    if (!prizeMasterSelectList || !currentGroupId) return;
    try {
      const res = await fetch(`/api/groups/${currentGroupId}/prize-masters`);
      if (!res.ok) throw new Error('賞品マスターの読み込みに失敗');
      const masters = await res.json();

      prizeMasterSelectList.innerHTML = '';
      masters.forEach((master) => {
        const li = document.createElement('li');
        li.className = 'item-list-item prize-master-item selectable';
        li.dataset.name = master.name;
        li.dataset.imageUrl = master.imageUrl;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        li.appendChild(checkbox);

        const img = document.createElement('img');
        img.src = master.imageUrl;
        img.alt = master.name;
        img.className = 'prize-master-image';
        li.appendChild(img);

        const nameSpan = document.createElement('span');
        nameSpan.textContent = master.name;
        li.appendChild(nameSpan);
        prizeMasterSelectList.appendChild(li);
      });
      prizeMasterSelectModal.style.display = 'block';
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  }

  function addSelectedPrizesFromMaster() {
    const selectedItems = prizeMasterSelectList.querySelectorAll('li.selected');
    selectedItems.forEach((item) => {
      prizes.push({
        name: item.dataset.name,
        imageUrl: item.dataset.imageUrl,
      });
    });
    renderPrizeList();
    prizeMasterSelectModal.style.display = 'none';
  }

  // ----- イベントリスナー -----
  if (goToGroupSettingsButton) {
    goToGroupSettingsButton.addEventListener('click', () => {
      if (currentGroupId) {
        // ユーザーが管理するグループリストから現在のグループ情報を検索
        const currentGroup = allUserGroups.find((g) => g.id === currentGroupId);
        if (currentGroup) {
          openSettingsModal(currentGroup); // 設定モーダルを開く
        } else {
          alert('グループ情報が見つかりませんでした。');
        }
      }
    });
  }
  if (switcherCreateGroup) {
    switcherCreateGroup.addEventListener('click', () => {
      groupDropdown.style.display = 'none'; // ドロップダウンを閉じる
      showGroupDashboard(); // グループ作成画面を表示
      if (groupNameInput) {
        groupNameInput.focus(); // 入力フィールドにフォーカス
      }
    });
  }
  if (stopImpersonatingButton) stopImpersonatingButton.addEventListener('click', stopImpersonating);
  if (loginButton) loginButton.addEventListener('click', () => (window.location.href = '/auth/google'));
  if (logoutButton)
    logoutButton.addEventListener('click', () => {
      clearParticipantState();
      window.location.href = '/logout';
    });
  if (deleteAccountButton) deleteAccountButton.addEventListener('click', deleteAccount);
  if (requestAdminButton) requestAdminButton.addEventListener('click', requestAdminAccess);
  if (createGroupButton) createGroupButton.addEventListener('click', createGroup);
  if (groupList) {
    groupList.addEventListener('click', (event) => {
      const item = event.target.closest('.item-list-item');
      if (!item || event.target.closest('.item-buttons')) return;
      const {groupId, groupName} = item.dataset;
      if (groupId && groupName) showDashboardView(groupId, groupName);
    });
  }

  if (saveGroupSettingsButton) saveGroupSettingsButton.addEventListener('click', saveGroupSettings);
  if (closeModalButton) closeModalButton.addEventListener('click', closeSettingsModal);
  if (customUrlInput)
    customUrlInput.addEventListener('keyup', () => {
      if (customUrlPreview) customUrlPreview.textContent = customUrlInput.value.trim();
    });
  if (addParticipantButton) addParticipantButton.addEventListener('click', addParticipantToGroup);
  if (participantManagementList)
    participantManagementList.addEventListener('change', (e) => {
      if (e.target.type === 'color') handleColorChange(e);
    });
  if (backToGroupsButton) backToGroupsButton.addEventListener('click', () => showView('dashboardView'));

  if (goToCreateEventViewButton) {
    goToCreateEventViewButton.addEventListener('click', () => {
      resetEventCreationForm();
      showView('eventEditView');
    });
  }

  if (addPrizeButton)
    addPrizeButton.addEventListener('click', () => {
      if (!prizeInput) return;
      const prizeName = prizeInput.value.trim();
      if (prizeName) {
        prizes.push({name: prizeName, imageUrl: null});
        renderPrizeList();
        prizeInput.value = '';
      }
    });

  if (prizeList)
    prizeList.addEventListener('click', (event) => {
      if (event.target.classList.contains('delete-btn')) {
        const {index} = event.target.dataset;
        prizes.splice(index, 1);
        renderPrizeList();
      }
    });
  if (createEventButton) {
    createEventButton.addEventListener('click', () => {
      if (currentEventId) {
        updateEvent(); // 編集モードなら更新処理
      } else {
        createEvent(); // 新規作成モードなら作成処理
      }
    });
  }
  if (loadButton)
    loadButton.addEventListener('click', () => {
      if (eventIdInput) loadEvent(eventIdInput.value.trim());
    });
  if (startEventButton) startEventButton.addEventListener('click', startEvent);
  if (syncWithGroupButton) syncWithGroupButton.addEventListener('click', syncParticipantCount);

  if (eventList) {
    eventList.addEventListener('click', (event) => {
      const item = event.target.closest('.item-list-item');
      if (!item) return;

      if (event.target.classList.contains('copy-event-btn')) {
        event.stopPropagation();
        const eventIdToCopy = event.target.dataset.eventId;
        copyEvent(eventIdToCopy);
        return;
      }
      if (event.target.classList.contains('edit-event-btn')) {
        event.stopPropagation();
        loadEvent(item.dataset.eventId);
        return;
      }
      if (event.target.classList.contains('start-event-btn')) {
        event.stopPropagation();
        loadEvent(item.dataset.eventId).then(() => {
          showView('broadcastView');
        });
        return;
      }

      loadEvent(item.dataset.eventId);
    });
  }

  // --- 配信モード用イベントリスナー ---
  if (startBroadcastButton)
    startBroadcastButton.addEventListener('click', async () => {
      // このボタンは現在直接使用されないが、念のためロジックをloadEventに統合
      if (currentEventId) {
        await loadEvent(currentEventId, 'broadcastView');
      }
    });

  if (animateAllButton)
    animateAllButton.addEventListener('click', () => {
      if (animator.tracers.length === 0 || animator.running) return;

      // 全トレーサーの状態を完全に初期化し、未完了状態にする
      animator.tracers.forEach((tracer) => {
        tracer.isFinished = false;
        tracer.pathIndex = 0;
        tracer.progress = 0;
        if (tracer.path && tracer.path.length > 0) {
          tracer.x = tracer.path[0].x;
          tracer.y = tracer.path[0].y;
        }
        delete tracer.stopY; // ステップ実行の停止点をクリア
      });

      animator.context = ctxAdmin;
      animator.running = true;
      animationLoop();
    });

  if (nextStepButton)
    nextStepButton.addEventListener('click', () => {
      if (animator.tracers.length === 0 || animator.running) return;

      let isAnyTracerMoving = false;

      animator.tracers.forEach((tracer) => {
        // 既にゴールしているトレーサーは無視
        if (tracer.pathIndex >= tracer.path.length - 1) {
          tracer.isFinished = true;
          return;
        }

        tracer.isFinished = false; // アニメーションを許可
        delete tracer.stopY; // 前回のstopYをクリア

        // 現在位置から次の分岐点を探す
        for (let i = tracer.pathIndex; i < tracer.path.length - 1; i++) {
          const p1 = tracer.path[i];
          const p2 = tracer.path[i + 1];
          // 水平移動（分岐）かチェック
          if (p1.y === p2.y && p1.x !== p2.x) {
            // 現在のY座標より下にある最初の分岐点を見つける
            if (p1.y > tracer.y + 0.1) {
              tracer.stopY = p1.y; // その分岐点のY座標で停止
              break;
            }
          }
        }
        isAnyTracerMoving = true;
      });

      if (isAnyTracerMoving) {
        animator.context = ctxAdmin;
        animator.running = true;
        animationLoop();
      }
    });

  if (highlightUserButton)
    highlightUserButton.addEventListener('click', () => {
      if (highlightUserSelect.value) {
        startAnimation(ctxAdmin, [highlightUserSelect.value]);
      }
    });

  // Participant listeners
  if (nameInput) nameInput.addEventListener('keyup', handleNameInput);
  if (suggestionList) suggestionList.addEventListener('click', handleSuggestionClick);
  if (confirmNameButton) confirmNameButton.addEventListener('click', () => loginOrRegister(nameInput.value.trim()));
  if (goToAmidaButton)
    goToAmidaButton.addEventListener('click', async () => {
      const res = await fetch(`/api/events/${currentEventId}/public`);
      const eventData = await res.json();
      currentLotteryData = eventData;
      if (eventData.status === 'started') {
        await showResultsView(eventData, currentParticipantName, false);
        return;
      }
      const myParticipation = eventData.participants.find((p) => p.memberId === currentParticipantId);
      if (myParticipation && myParticipation.name) {
        await showWaitingView();
      } else {
        showJoinView(eventData);
      }
    });
  if (backToControlPanelButton)
    backToControlPanelButton.addEventListener('click', async () => {
      const res = await fetch(`/api/events/${currentEventId}/public`);
      const eventData = await res.json();
      showControlPanelView(eventData);
    });
  if (backToControlPanelFromResultButton)
    backToControlPanelFromResultButton.addEventListener('click', async () => {
      const res = await fetch(`/api/events/${currentEventId}/public`);
      const eventData = await res.json();
      hideParticipantSubViews();
      showControlPanelView(eventData);
    });
  if (setPasswordButton) setPasswordButton.addEventListener('click', openPasswordSetModal);
  if (participantLogoutButton) participantLogoutButton.addEventListener('click', logoutParticipant);
  if (deleteMyAccountButton) deleteMyAccountButton.addEventListener('click', deleteMyAccountCompletely);
  if (slotList) slotList.addEventListener('click', handleSlotSelection);
  if (joinButton) joinButton.addEventListener('click', joinEventWithSlot);
  if (shareButton) shareButton.addEventListener('click', shareResult);
  if (deleteParticipantWaitingButton) deleteParticipantWaitingButton.addEventListener('click', deleteParticipant);
  if (closePasswordSetModal) closePasswordSetModal.addEventListener('click', () => (passwordSetModal.style.display = 'none'));
  if (savePasswordButton) savePasswordButton.addEventListener('click', savePassword);

  // Profile Edit Listeners
  if (editProfileButton) editProfileButton.addEventListener('click', openProfileEditModal);
  if (closeProfileModalButton) closeProfileModalButton.addEventListener('click', closeProfileEditModal);
  if (saveProfileButton) saveProfileButton.addEventListener('click', saveProfile);
  if (profileIconInput) {
    profileIconInput.addEventListener('change', () => {
      const file = profileIconInput.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (profileIconPreview) profileIconPreview.src = e.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Admin listeners
  if (adminDashboard) {
    adminDashboard.addEventListener('click', (e) => {
      if (e.target.classList.contains('impersonate-btn')) impersonateUser(e.target.dataset.userId);
      if (e.target.classList.contains('approve-btn')) approveRequest(e.target.dataset.requestId);
      if (e.target.classList.contains('demote-btn')) demoteAdmin(e.target.dataset.userId);
    });
  }
  if (passwordResetRequestList) {
    passwordResetRequestList.addEventListener('click', (e) => {
      if (e.target.classList.contains('reset-password-btn')) {
        const {groupId, memberId, requestId} = e.target.dataset;
        approvePasswordReset(groupId, memberId, requestId);
      }
    });
  }

  // --- 賞品マスター用リスナー ---
  if (addMasterPrizeButton) addMasterPrizeButton.addEventListener('click', addPrizeMaster);
  if (selectFromMasterButton) selectFromMasterButton.addEventListener('click', openPrizeMasterSelectModal);
  if (closePrizeMasterSelectModal) closePrizeMasterSelectModal.addEventListener('click', () => (prizeMasterSelectModal.style.display = 'none'));
  if (addSelectedPrizesButton) addSelectedPrizesButton.addEventListener('click', addSelectedPrizesFromMaster);
  if (prizeMasterSelectList) {
    prizeMasterSelectList.addEventListener('click', (e) => {
      const item = e.target.closest('li');
      if (item) {
        item.classList.toggle('selected');
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox) {
          checkbox.checked = item.classList.contains('selected');
        }
      }
    });
  }

  window.addEventListener('click', (event) => {
    if (event.target == groupSettingsModal) closeSettingsModal();
    if (event.target == profileEditModal) closeProfileEditModal();
    if (event.target == passwordSetModal) passwordSetModal.style.display = 'none';
    if (event.target == prizeMasterSelectModal) prizeMasterSelectModal.style.display = 'none';
  });

  // ----- 初期化処理 -----
  handleRouting();

  // ページ読み込み時とウィンドウリサイズ時にpaddingを調整
  adjustBodyPadding();
  window.addEventListener('resize', adjustBodyPadding);
});
