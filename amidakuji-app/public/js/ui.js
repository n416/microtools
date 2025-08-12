// js/ui.js
import * as state from './state.js';
import {stopAnimation} from './animation.js';

export const elements = {
  loginButton: document.getElementById('loginButton'),
  logoutButton: document.getElementById('logoutButton'),
  deleteAccountButton: document.getElementById('deleteAccountButton'),
  authStatus: document.getElementById('authStatus'),
  adminDashboardButton: document.getElementById('adminDashboardButton'),
  impersonationBanner: document.querySelector('.impersonation-banner'),
  stopImpersonatingButton: document.getElementById('stopImpersonatingButton'),
  mainHeader: document.querySelector('.main-header'),
  groupDashboard: document.getElementById('groupDashboard'),
  dashboardView: document.getElementById('dashboardView'),
  eventEditView: document.getElementById('eventEditView'),
  broadcastView: document.getElementById('broadcastView'),
  participantView: document.getElementById('participantView'),
  adminDashboard: document.getElementById('adminDashboard'),
  groupEventListView: document.getElementById('groupEventListView'),
  groupNameInput: document.getElementById('groupNameInput'),
  createGroupButton: document.getElementById('createGroupButton'),
  groupList: document.getElementById('groupList'),
  requestAdminButton: document.getElementById('requestAdminButton'),
  groupSettingsModal: document.getElementById('groupSettingsModal'),
  settingsGroupId: document.getElementById('settingsGroupId'),
  groupNameEditInput: document.getElementById('groupNameEditInput'),
  customUrlInput: document.getElementById('customUrlInput'),
  groupPasswordInput: document.getElementById('groupPasswordInput'),
  noIndexCheckbox: document.getElementById('noIndexCheckbox'),
  saveGroupSettingsButton: document.getElementById('saveGroupSettingsButton'),
  closeSettingsModalButton: document.querySelector('#groupSettingsModal .close-button'),
  customUrlPreview: document.getElementById('customUrlPreview'),
  participantManagementList: document.getElementById('participantManagementList'),
  addParticipantButton: document.getElementById('addParticipantButton'),
  addParticipantNameInput: document.getElementById('addParticipantNameInput'),
  passwordResetRequestList: document.getElementById('passwordResetRequestList'),
  prizeMasterList: document.getElementById('prizeMasterList'),
  addMasterPrizeNameInput: document.getElementById('addMasterPrizeNameInput'),
  addMasterPrizeImageInput: document.getElementById('addMasterPrizeImageInput'),
  addMasterPrizeButton: document.getElementById('addMasterPrizeButton'),
  deletePasswordButton: document.getElementById('deletePasswordButton'),
  eventGroupName: document.getElementById('eventGroupName'),
  backToGroupsButton: document.getElementById('backToGroupsButton'),
  participantCountInput: document.getElementById('participantCountInput'),
  prizeInput: document.getElementById('prizeInput'),
  addPrizeButton: document.getElementById('addPrizeButton'),
  prizeList: document.getElementById('prizeList'),
  displayModeSelect: document.getElementById('displayModeSelect'),
  eventNameInput: document.getElementById('eventNameInput'),
  syncWithGroupButton: document.getElementById('syncWithGroupButton'),
  selectFromMasterButton: document.getElementById('selectFromMasterButton'),
  createEventButton: document.getElementById('createEventButton'),
  loadButton: document.getElementById('loadButton'),
  eventIdInput: document.getElementById('eventIdInput'),
  currentEventUrl: document.getElementById('currentEventUrl'),
  eventList: document.getElementById('eventList'),
  goToCreateEventViewButton: document.getElementById('goToCreateEventViewButton'),
  adminControls: document.getElementById('adminControls'),
  startEventButton: document.getElementById('startEventButton'),
  startBroadcastButton: document.getElementById('startBroadcastButton'),
  adminCanvas: document.getElementById('adminCanvas'),
  broadcastControls: document.querySelector('.broadcast-controls'),
  animateAllButton: document.getElementById('animateAllButton'),
  nextStepButton: document.getElementById('nextStepButton'),
  highlightUserSelect: document.getElementById('highlightUserSelect'),
  highlightUserButton: document.getElementById('highlightUserButton'),
  backToDashboardButton: document.getElementById('backToDashboardButton'),
  participantEventName: document.getElementById('participantEventName'),
  prizeDisplay: document.getElementById('prizeDisplay'),
  nameEntrySection: document.getElementById('nameEntrySection'),
  nameInput: document.getElementById('nameInput'),
  confirmNameButton: document.getElementById('confirmNameButton'),
  suggestionList: document.getElementById('suggestionList'),
  participantControlPanel: document.getElementById('participantControlPanel'),
  welcomeName: document.getElementById('welcomeName'),
  goToAmidaButton: document.getElementById('goToAmidaButton'),
  setPasswordButton: document.getElementById('setPasswordButton'),
  participantLogoutButton: document.getElementById('participantLogoutButton'),
  deleteMyAccountButton: document.getElementById('deleteMyAccountButton'),
  joinSection: document.getElementById('joinSection'),
  backToControlPanelButton: document.getElementById('backToControlPanelButton'),
  slotList: document.getElementById('slotList'),
  joinButton: document.getElementById('joinButton'),
  waitingMessage: document.getElementById('waitingMessage'),
  deleteParticipantWaitingButton: document.getElementById('deleteParticipantWaitingButton'),
  backToDashboardFromWaitingButton: document.getElementById('backToDashboardFromWaitingButton'),
  resultSection: document.getElementById('resultSection'),
  myResult: document.getElementById('myResult'),
  allResultsContainer: document.getElementById('allResultsContainer'),
  shareButton: document.getElementById('shareButton'),
  editProfileButton: document.getElementById('editProfileButton'),
  backToControlPanelFromResultButton: document.getElementById('backToControlPanelFromResultButton'),
  participantCanvas: document.getElementById('participantCanvas'),
  passwordSetModal: document.getElementById('passwordSetModal'),
  closePasswordSetModal: document.querySelector('#passwordSetModal .close-button'),
  newPasswordInput: document.getElementById('newPasswordInput'),
  savePasswordButton: document.getElementById('savePasswordButton'),
  deleteUserPasswordButton: document.getElementById('deleteUserPasswordButton'),
  profileEditModal: document.getElementById('profileEditModal'),
  closeProfileModalButton: document.querySelector('#profileEditModal .close-button'),
  profileIconPreview: document.getElementById('profileIconPreview'),
  profileIconInput: document.getElementById('profileIconInput'),
  profileColorInput: document.getElementById('profileColorInput'),
  saveProfileButton: document.getElementById('saveProfileButton'),
  prizeMasterSelectModal: document.getElementById('prizeMasterSelectModal'),
  prizeMasterSelectList: document.getElementById('prizeMasterSelectList'),
  addSelectedPrizesButton: document.getElementById('addSelectedPrizesButton'),
  closePrizeMasterSelectModal: document.querySelector('#prizeMasterSelectModal .close-button'),
  groupPasswordModal: document.getElementById('groupPasswordModal'),
  closeGroupPasswordModalButton: document.querySelector('#groupPasswordModal .close-button'),
  verifyPasswordButton: document.getElementById('verifyPasswordButton'),
  groupPasswordVerifyInput: document.getElementById('groupPasswordVerifyInput'),
  verificationTargetGroupId: document.getElementById('verificationTargetGroupId'),
  verificationTargetGroupName: document.getElementById('verificationTargetGroupName'),
  groupSwitcher: document.getElementById('groupSwitcher'),
  currentGroupName: document.getElementById('currentGroupName'),
  groupDropdown: document.getElementById('groupDropdown'),
  switcherGroupList: document.getElementById('switcherGroupList'),
  switcherCreateGroup: document.getElementById('switcherCreateGroup'),
  goToGroupSettingsButton: document.getElementById('goToGroupSettingsButton'),
  groupEventListContainer: document.getElementById('groupEventList'),
  groupNameTitle: document.getElementById('groupEventListName'),
  adminUserList: document.getElementById('adminUserList'),
  pendingRequestsList: document.getElementById('pendingRequestsList'),
  systemAdminList: document.getElementById('systemAdminList'),
  otherEventsSection: document.getElementById('otherEventsSection'), // <<< この行を追加
  otherEventsList: document.getElementById('otherEventsList'), // <<< この行を追加
};

const ALL_VIEWS = ['groupDashboard', 'dashboardView', 'eventEditView', 'broadcastView', 'participantView', 'adminDashboard', 'groupEventListView'];

export function adjustBodyPadding() {
  let totalOffset = 0;
  if (elements.mainHeader && getComputedStyle(elements.mainHeader).display !== 'none') {
    totalOffset += elements.mainHeader.offsetHeight;
  }
  if (elements.impersonationBanner && getComputedStyle(elements.impersonationBanner).display !== 'none') {
    totalOffset += elements.impersonationBanner.offsetHeight;
  }
  document.body.style.paddingTop = `${totalOffset}px`;
}

export function showView(viewToShowId) {
  ALL_VIEWS.forEach((viewId) => {
    const el = document.getElementById(viewId);
    if (el) {
      el.style.display = viewId === viewToShowId ? 'block' : 'none';
    }
  });
  stopAnimation();
  adjustBodyPadding();
}

export function updateAuthUI(user) {
  if (user && user.id) {
    let displayName = user.name;
    if (user.isImpersonating) {
      displayName = `${user.originalUser.name} (成り代わり中: ${user.name})`;
      if (elements.impersonationBanner) elements.impersonationBanner.style.display = 'block';
    } else {
      if (elements.impersonationBanner) elements.impersonationBanner.style.display = 'none';
    }

    if (elements.authStatus) elements.authStatus.textContent = `ようこそ、${displayName}さん`;
    if (elements.loginButton) elements.loginButton.style.display = 'none';
    if (elements.logoutButton) elements.logoutButton.style.display = 'block';
    if (elements.deleteAccountButton) elements.deleteAccountButton.style.display = 'block';

    const isSystemAdmin = user.role === 'system_admin' && !user.isImpersonating;
    if (elements.adminDashboardButton) elements.adminDashboardButton.style.display = isSystemAdmin ? 'block' : 'none';

    if (elements.requestAdminButton) {
      if (user.role === 'user') {
        if (user.adminRequestStatus === 'pending') {
          elements.requestAdminButton.textContent = '申請中';
          elements.requestAdminButton.disabled = true;
        } else {
          elements.requestAdminButton.textContent = '管理者権限を申請する';
          elements.requestAdminButton.disabled = false;
        }
        elements.requestAdminButton.style.display = 'block';
      } else {
        elements.requestAdminButton.style.display = 'none';
      }
    }
  } else {
    if (elements.authStatus) elements.authStatus.textContent = 'イベント管理はログインが必要です。';
    if (elements.loginButton) elements.loginButton.style.display = 'block';
    if (elements.logoutButton) elements.logoutButton.style.display = 'none';
    if (elements.deleteAccountButton) elements.deleteAccountButton.style.display = 'none';
    if (elements.adminDashboardButton) elements.adminDashboardButton.style.display = 'none';
    if (elements.requestAdminButton) elements.requestAdminButton.style.display = 'none';
    if (elements.impersonationBanner) elements.impersonationBanner.style.display = 'none';
  }
  adjustBodyPadding();
}

export function updateGroupSwitcher() {
  if (!elements.groupSwitcher || !elements.currentGroupName || !elements.switcherGroupList) return;

  if (state.allUserGroups.length > 0) {
    elements.groupSwitcher.style.display = 'block';
  } else {
    elements.groupSwitcher.style.display = 'none';
  }

  const currentGroup = state.allUserGroups.find((g) => g.id === state.currentGroupId);
  if (currentGroup) {
    elements.currentGroupName.textContent = currentGroup.name;
  } else {
    elements.currentGroupName.textContent = 'グループを選択';
  }

  elements.switcherGroupList.innerHTML = '';
  state.allUserGroups.forEach((group) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.textContent = group.name;
    button.dataset.groupId = group.id;
    button.dataset.groupName = group.name;
    if (group.id === state.currentGroupId) {
      button.classList.add('active');
    }
    li.appendChild(button);
    elements.switcherGroupList.appendChild(li);
  });
}

export function openSettingsModal(group, handlers) {
  if (!elements.groupSettingsModal) return;
  elements.settingsGroupId.value = group.id;
  elements.groupNameEditInput.value = group.name || '';
  elements.customUrlInput.value = group.customUrl || '';
  if (elements.customUrlPreview) elements.customUrlPreview.textContent = group.customUrl || '';
  elements.groupPasswordInput.value = '';
  elements.groupPasswordInput.placeholder = '変更する場合のみ入力';
  if (elements.deletePasswordButton) elements.deletePasswordButton.style.display = group.hasPassword ? 'inline-block' : 'none';
  elements.noIndexCheckbox.checked = group.noIndex || false;
  state.setGroupParticipants(group.participants ? [...group.participants] : []);

  renderParticipantManagementList(handlers);

  elements.saveGroupSettingsButton.onclick = handlers.onSave;
  elements.addParticipantButton.onclick = handlers.onAddParticipant;
  elements.deletePasswordButton.onclick = handlers.onDeletePassword;
  elements.addMasterPrizeButton.onclick = handlers.onAddMaster;
  elements.prizeMasterList.onclick = (e) => {
    const button = e.target.closest('button.delete-btn');
    if (button) {
      handlers.onDeleteMaster(button.dataset.masterId);
    }
  };
  elements.passwordResetRequestList.onclick = (e) => {
    const button = e.target.closest('button.approve-btn');
    if (button) {
      const {groupId, memberId, requestId} = button.dataset;
      handlers.onApproveReset(memberId, groupId, requestId);
    }
  };

  elements.groupSettingsModal.style.display = 'block';
}

export function closeSettingsModal() {
  if (elements.groupSettingsModal) elements.groupSettingsModal.style.display = 'none';
}

export function openPasswordSetModal(handlers, showDeleteButton) {
  if (elements.passwordSetModal) {
    elements.newPasswordInput.value = '';
    elements.savePasswordButton.onclick = handlers.onSave;
    elements.deleteUserPasswordButton.style.display = showDeleteButton ? 'inline-block' : 'none';
    elements.passwordSetModal.style.display = 'block';
  }
}

export function openProfileEditModal(memberData, handlers) {
  if (elements.profileIconPreview) elements.profileIconPreview.src = memberData.iconUrl || `/api/avatar-proxy?name=${encodeURIComponent(state.currentParticipantName)}`;
  if (elements.profileColorInput) elements.profileColorInput.value = memberData.color || '#cccccc';
  if (elements.saveProfileButton) elements.saveProfileButton.onclick = handlers.onSave;
  if (elements.profileEditModal) elements.profileEditModal.style.display = 'block';
}

export function closeProfileEditModal() {
  if (elements.profileEditModal) elements.profileEditModal.style.display = 'none';
}

export function openPrizeMasterSelectModal(masters, handlers) {
  renderPrizeMasterList(masters, true);
  if (elements.addSelectedPrizesButton) elements.addSelectedPrizesButton.onclick = handlers.onAddSelected;
  if (elements.prizeMasterSelectModal) elements.prizeMasterSelectModal.style.display = 'block';
}

export function closePrizeMasterSelectModal() {
  if (elements.prizeMasterSelectModal) elements.prizeMasterSelectModal.style.display = 'none';
}

export function showGroupPasswordModal(groupId, groupName) {
  if (!elements.groupPasswordModal) return;
  elements.verificationTargetGroupId.value = groupId;
  elements.verificationTargetGroupName.textContent = groupName;
  elements.groupPasswordVerifyInput.value = '';
  elements.groupPasswordModal.style.display = 'block';
  elements.groupPasswordVerifyInput.focus();
}

export function closeGroupPasswordModal() {
  if (elements.groupPasswordModal) elements.groupPasswordModal.style.display = 'none';
}

// ▼▼▼▼▼ ここからが今回の修正箇所です ▼▼▼▼▼
export function renderGroupList(groups) {
  if (!elements.groupList) return;
  elements.groupList.innerHTML = '';
  groups.forEach((group) => {
    const li = document.createElement('li');
    li.className = 'item-list-item';
    li.dataset.groupId = group.id;
    li.dataset.groupName = group.name;

    const groupInfo = document.createElement('span');
    const date = new Date((group.createdAt._seconds || group.createdAt.seconds) * 1000);
    groupInfo.textContent = `${group.name} (${date.toLocaleDateString()})`;
    groupInfo.style.cursor = 'pointer';

    const settingsBtn = document.createElement('button');
    settingsBtn.textContent = '設定';

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '削除';
    deleteBtn.className = 'delete-btn delete-group-btn';

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'item-buttons';
    buttonContainer.appendChild(settingsBtn);
    buttonContainer.appendChild(deleteBtn);
    li.appendChild(groupInfo);
    li.appendChild(buttonContainer);
    elements.groupList.appendChild(li);
  });
}
// ▲▲▲▲▲ 修正はここまで ▲▲▲▲▲

export function renderEventList(events, handlers) {
  if (!elements.eventList) return;
  elements.eventList.innerHTML = '';
  events.forEach((event) => {
    const li = document.createElement('li');
    const date = new Date((event.createdAt._seconds || event.createdAt.seconds) * 1000);
    const displayDate = !isNaN(date) ? date.toLocaleString() : '日付不明';
    const eventName = event.eventName || '無題のイベント';
    const filledSlots = event.participants.filter((p) => p.name).length;

    li.innerHTML = `
        <span class="event-info">
          <strong>${eventName}</strong>
          <span class="event-date">（${displayDate}作成）</span>
          <span>${event.status === 'started' ? '実施済み' : '受付中'}</span>
          <span class="event-status">${filledSlots} / ${event.participantCount} 名参加</span>
        </span>
        <div class="item-buttons">
            <button class="edit-event-btn" data-event-id="${event.id}">編集</button>
            <button class="start-event-btn" data-event-id="${event.id}">実施</button>
            <button class="copy-event-btn" data-event-id="${event.id}">コピー</button>
            <button class="delete-btn delete-event-btn" data-event-id="${event.id}">削除</button>
        </div>`;
    li.className = 'item-list-item';

    elements.eventList.appendChild(li);
  });
}

export function renderParticipantManagementList(handlers) {
  if (!elements.participantManagementList) return;
  elements.participantManagementList.innerHTML = '';
  state.groupParticipants.forEach((p) => {
    const li = document.createElement('li');
    const colorSwatch = document.createElement('input');
    colorSwatch.type = 'color';
    colorSwatch.value = p.color;
    colorSwatch.dataset.participantId = p.id;

    const nameSpan = document.createElement('span');
    nameSpan.textContent = p.name;

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '削除';
    deleteBtn.className = 'delete-btn';
    deleteBtn.dataset.participantId = p.id;

    deleteBtn.addEventListener('click', () => handlers.onDeleteParticipant(p.id));
    colorSwatch.addEventListener('change', (e) => handlers.onChangeColor(p.id, e.target.value));

    li.appendChild(colorSwatch);
    li.appendChild(nameSpan);
    li.appendChild(deleteBtn);
    elements.participantManagementList.appendChild(li);
  });
}

export function renderPrizeList() {
  if (!elements.prizeList) return;
  elements.prizeList.innerHTML = '';
  state.prizes.forEach((p, index) => {
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

    const btn = document.createElement('button');
    btn.textContent = '削除';
    btn.className = 'delete-btn';
    btn.dataset.index = index;
    li.appendChild(btn);
    elements.prizeList.appendChild(li);
  });
}

export function renderPrizeMasterList(masters, isSelectMode = false) {
  const listElement = isSelectMode ? elements.prizeMasterSelectList : elements.prizeMasterList;
  if (!listElement) return;
  listElement.innerHTML = '';
  masters.forEach((master) => {
    const li = document.createElement('li');
    li.className = 'item-list-item prize-master-item';
    if (isSelectMode) {
      li.classList.add('selectable');
      li.innerHTML = `<input type="checkbox">`;
    }
    li.dataset.name = master.name;
    li.dataset.imageUrl = master.imageUrl;

    const img = document.createElement('img');
    img.src = master.imageUrl;
    img.alt = master.name;
    img.className = 'prize-master-image';
    li.appendChild(img);

    const nameSpan = document.createElement('span');
    nameSpan.textContent = master.name;
    li.appendChild(nameSpan);

    if (!isSelectMode) {
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '削除';
      deleteBtn.className = 'delete-btn';
      deleteBtn.dataset.masterId = master.id;
      li.appendChild(deleteBtn);
    }
    listElement.appendChild(li);
  });
}

export function renderPasswordRequests(requests) {
  if (!elements.passwordResetRequestList) return;
  elements.passwordResetRequestList.innerHTML = '';
  if (requests.length === 0) {
    elements.passwordResetRequestList.innerHTML = '<li>現在、リセット依頼はありません。</li>';
    return;
  }
  requests.forEach((req) => {
    const li = document.createElement('li');
    li.className = 'item-list-item';
    li.innerHTML = `
            <span>${req.memberName}</span>
            <div class="item-buttons">
                <button class="approve-btn" data-group-id="${req.groupId}" data-member-id="${req.memberId}" data-request-id="${req.id}">合言葉を削除</button>
            </div>`;
    elements.passwordResetRequestList.appendChild(li);
  });
}

export function renderAdminLists(requests, groupAdmins, systemAdmins, handlers) {
  const {pendingRequestsList, adminUserList, systemAdminList} = elements;

  if (pendingRequestsList) {
    pendingRequestsList.innerHTML = requests.length === 0 ? '<li>現在、承認待ちの申請はありません。</li>' : requests.map((req) => `<li class="item-list-item"><span>${req.name} (${req.email})</span><div class="item-buttons"><button class="approve-btn" data-request-id="${req.id}">承認</button></div></li>`).join('');
    pendingRequestsList.querySelectorAll('.approve-btn').forEach((btn) => btn.addEventListener('click', () => handlers.onApprove(btn.dataset.requestId)));
  }
  if (adminUserList) {
    adminUserList.innerHTML = groupAdmins.map((user) => `<li class="item-list-item"><span>${user.name} (${user.email})</span><div class="item-buttons"><button class="impersonate-btn" data-user-id="${user.id}">成り代わり</button></div></li>`).join('');
    adminUserList.querySelectorAll('.impersonate-btn').forEach((btn) => btn.addEventListener('click', () => handlers.onImpersonate(btn.dataset.userId)));
  }
  if (systemAdminList) {
    systemAdminList.innerHTML = systemAdmins
      .map((admin) => {
        const isCurrentUser = admin.id === (state.currentUser.isImpersonating ? state.currentUser.originalUser.id : state.currentUser.id);
        const buttons = isCurrentUser ? '' : `<div class="item-buttons"><button class="demote-btn delete-btn" data-user-id="${admin.id}">権限剥奪</button></div>`;
        return `<li class="item-list-item"><span>${admin.name} (${admin.email})</span> ${buttons}</li>`;
      })
      .join('');
    systemAdminList.querySelectorAll('.demote-btn').forEach((btn) => btn.addEventListener('click', () => handlers.onDemote(btn.dataset.userId)));
  }
}

export function renderSlots(participants) {
  if (!elements.slotList) return;
  elements.slotList.innerHTML = '';
  participants.forEach((p) => {
    const slotEl = document.createElement('div');
    slotEl.className = 'slot';
    slotEl.dataset.slot = p.slot;
    if (p.name) {
      slotEl.classList.add('taken');
      slotEl.textContent = p.name;
    } else {
      slotEl.classList.add('available');
      slotEl.textContent = `参加枠 ${p.slot + 1}`;
    }
    elements.slotList.appendChild(slotEl);
  });
}

export function renderPrizesForParticipant(prizes, displayMode) {
  if (!elements.prizeDisplay) return;
  elements.prizeDisplay.innerHTML = '<h3>景品一覧</h3>';
  const ul = document.createElement('ul');
  prizes.forEach((prize) => {
    const li = document.createElement('li');
    const prizeName = typeof prize === 'object' ? prize.name : prize;
    li.textContent = displayMode === 'private' ? '???' : prizeName;
    ul.appendChild(li);
  });
  elements.prizeDisplay.appendChild(ul);
}

export function renderSuggestions(suggestions, handler) {
  if (!elements.suggestionList) return;
  elements.suggestionList.innerHTML = '';
  suggestions.forEach((s) => {
    const button = document.createElement('button');
    button.textContent = s.name;
    button.dataset.name = s.name;
    button.dataset.memberId = s.id;
    button.dataset.hasPassword = String(s.hasPassword);
    button.className = 'suggestion-button';
    button.addEventListener('click', () => handler(s.name, s.id, s.hasPassword));
    elements.suggestionList.appendChild(button);
  });
}

export function renderAllResults(results) {
  if (!elements.allResultsContainer || !results) return;
  let html = '<h3>みんなの結果</h3><ul class="item-list">';
  for (const name in results) {
    const prizeName = typeof results[name].prize === 'object' ? results[name].prize.name : results[name].prize;
    html += `<li class="item-list-item">${name} → ${prizeName}</li>`;
  }
  html += '</ul>';
  elements.allResultsContainer.innerHTML = html;
}

export function hideParticipantSubViews() {
  if (elements.nameEntrySection) elements.nameEntrySection.style.display = 'none';
  if (elements.participantControlPanel) elements.participantControlPanel.style.display = 'none';
  if (elements.joinSection) elements.joinSection.style.display = 'none';
  if (elements.waitingMessage) elements.waitingMessage.style.display = 'none';
  if (elements.resultSection) elements.resultSection.style.display = 'none';
}

export function showNameEntryView() {
  hideParticipantSubViews();
  if (elements.nameEntrySection) elements.nameEntrySection.style.display = 'block';
  if (elements.nameInput) elements.nameInput.value = '';
  if (elements.suggestionList) elements.suggestionList.innerHTML = '';
}

export function showControlPanelView(eventData) {
  hideParticipantSubViews();
  if (elements.participantControlPanel) elements.participantControlPanel.style.display = 'block';
  if (elements.welcomeName) elements.welcomeName.textContent = state.currentParticipantName;

  const myParticipation = eventData.participants.find((p) => p.memberId === state.currentParticipantId);

  if (elements.goToAmidaButton) {
    if (eventData.status === 'started') {
      elements.goToAmidaButton.textContent = '結果を見る';
    } else if (myParticipation && myParticipation.name) {
      elements.goToAmidaButton.textContent = '参加状況を確認する';
    } else {
      elements.goToAmidaButton.textContent = 'あみだくじに参加する';
    }
  }
}

export function showJoinView(eventData) {
  hideParticipantSubViews();
  if (elements.joinSection) elements.joinSection.style.display = 'block';
  renderSlots(eventData.participants);
  renderPrizesForParticipant(eventData.prizes, eventData.displayMode);
}

export function showWaitingView() {
  hideParticipantSubViews();
  if (elements.waitingMessage) elements.waitingMessage.style.display = 'block';
}

export function showResultsView() {
  hideParticipantSubViews();
  if (elements.resultSection) elements.resultSection.style.display = 'block';
}

export function resetEventCreationForm() {
  state.setPrizes([]);
  renderPrizeList();
  if (elements.participantCountInput) elements.participantCountInput.value = '';
  if (elements.displayModeSelect) elements.displayModeSelect.value = 'public';
  if (elements.eventNameInput) elements.eventNameInput.value = '';
  if (elements.createEventButton) elements.createEventButton.textContent = 'この内容でイベントを作成';
  if (elements.adminCanvas) {
    const ctx = elements.adminCanvas.getContext('2d');
    ctx.clearRect(0, 0, elements.adminCanvas.width, elements.adminCanvas.height);
    elements.adminCanvas.style.display = 'none';
  }
  if (elements.currentEventUrl) {
    elements.currentEventUrl.textContent = '（イベント作成後に表示されます）';
    elements.currentEventUrl.href = '#';
  }
  if (elements.eventIdInput) elements.eventIdInput.value = '';
  state.setCurrentEventId(null);
  state.setCurrentLotteryData(null);
  if (elements.adminControls) elements.adminControls.style.display = 'none';
  if (elements.broadcastControls) elements.broadcastControls.style.display = 'none';
}

export function renderOtherEvents(events) {
    if (!elements.otherEventsList || !elements.otherEventsSection) return;

    if (!events || events.length === 0) {
        elements.otherEventsSection.style.display = 'none';
        return;
    }

    elements.otherEventsList.innerHTML = '';
    events.forEach(event => {
        const li = document.createElement('li');
        li.className = 'item-list-item';
        const date = new Date((event.createdAt._seconds || event.createdAt.seconds) * 1000);
        
        li.innerHTML = `
            <span><strong>${event.eventName || '無題のイベント'}</strong>（${date.toLocaleDateString()} 作成）</span>
            <a href="/events/${event.id}" class="button">このイベントへ移動</a>
        `;
        elements.otherEventsList.appendChild(li);
    });
    elements.otherEventsSection.style.display = 'block';
}