import * as state from './state.js';
import {stopAnimation} from './animation.js';

const clientEmojiMap = new Map(window.emojiMapData || []);
function clientEmojiToLucide(emoji) {
  return clientEmojiMap.get(emoji) || '';
}
export const elements = {
  mainHeader: document.querySelector('.main-header'),
  impersonationBanner: document.querySelector('.impersonation-banner'),
  loginButton: document.getElementById('loginButton'),
  logoutButton: document.getElementById('logoutButton'),
  deleteAccountButton: document.getElementById('deleteAccountButton'),
  adminDashboardButton: document.getElementById('adminDashboardButton'),
  stopImpersonatingButton: document.getElementById('stopImpersonatingButton'),
  hamburgerButton: document.getElementById('hamburger-button'),
  navMenu: document.getElementById('nav-menu'),
  groupDashboard: document.getElementById('groupDashboard'),
  dashboardView: document.getElementById('dashboardView'),
  broadcastView: document.getElementById('broadcastView'),
  participantView: document.getElementById('participantView'),
  groupEventListView: document.getElementById('groupEventListView'),
  groupSwitcher: document.getElementById('groupSwitcher'),
  currentGroupName: document.getElementById('currentGroupName'),
  groupDropdown: document.getElementById('groupDropdown'),
  switcherGroupList: document.getElementById('switcherGroupList'),
  switcherCreateGroup: document.getElementById('switcherCreateGroup'),
  groupSettingsModal: document.getElementById('groupSettingsModal'),
  closeSettingsModalButton: document.querySelector('#groupSettingsModal .close-button'),
  settingsGroupId: document.getElementById('settingsGroupId'),
  groupNameEditInput: document.getElementById('groupNameEditInput'),
  customUrlInput: document.getElementById('customUrlInput'),
  customUrlPreview: document.getElementById('customUrlPreview'),
  groupPasswordInput: document.getElementById('groupPasswordInput'),
  deletePasswordButton: document.getElementById('deletePasswordButton'),
  noIndexCheckbox: document.getElementById('noIndexCheckbox'),
  saveGroupSettingsButton: document.getElementById('saveGroupSettingsButton'),
  prizeMasterModal: document.getElementById('prizeMasterModal'),
  closePrizeMasterModalButton: document.querySelector('#prizeMasterModal .close-button'),
  prizeMasterList: document.getElementById('prizeMasterList'),
  addMasterPrizeNameInput: document.getElementById('addMasterPrizeNameInput'),
  addMasterPrizeImageInput: document.getElementById('addMasterPrizeImageInput'),
  addMasterPrizeButton: document.getElementById('addMasterPrizeButton'),
  backToDashboardButton: document.getElementById('backToDashboardButton'),
  adminControls: document.getElementById('adminControls'),
  broadcastEventUrl: document.getElementById('broadcastEventUrl'),
  currentEventUrl: document.getElementById('currentEventUrl'),
  showFillSlotsModalButton: document.getElementById('showFillSlotsModalButton'),
  broadcastSidebar: document.getElementById('broadcastSidebar'),
  openSidebarButton: document.getElementById('openSidebarButton'),
  closeSidebarButton: document.getElementById('closeSidebarButton'),
  toggleFullscreenButton: document.getElementById('toggleFullscreenButton'),
  startEventButton: document.getElementById('startEventButton'),
  startBroadcastButton: document.getElementById('startBroadcastButton'),
  adminCanvas: document.getElementById('adminCanvas'),
  broadcastControls: document.querySelector('.broadcast-controls'),
  animateAllButton: document.getElementById('animateAllButton'),
  advanceLineByLineButton: document.getElementById('advanceLineByLineButton'),
  regenerateLinesButton: document.getElementById('regenerateLinesButton'),
  glimpseButton: document.getElementById('glimpseButton'),
  shufflePrizesBroadcastButton: document.getElementById('shufflePrizesBroadcastButton'),
  highlightUserSelect: document.getElementById('highlightUserSelect'),
  highlightUserButton: document.getElementById('highlightUserButton'),
  revealRandomButton: document.getElementById('revealRandomButton'),
  participantEventName: document.getElementById('participantEventName'),
  backToGroupEventListLink: document.getElementById('backToGroupEventListLink'),
  nameEntrySection: document.getElementById('nameEntrySection'),
  nameInput: document.getElementById('nameInput'),
  confirmNameButton: document.getElementById('confirmNameButton'),
  suggestionList: document.getElementById('suggestionList'),
  participantControlPanel: document.getElementById('participantControlPanel'),
  welcomeName: document.getElementById('welcomeName'),
  goToAmidaButton: document.getElementById('goToAmidaButton'),
  setPasswordButton: document.getElementById('setPasswordButton'),
  editProfileButton: document.getElementById('editProfileButton'),
  participantLogoutButton: document.getElementById('participantLogoutButton'),
  deleteMyAccountButton: document.getElementById('deleteMyAccountButton'),
  otherEventsSection: document.getElementById('otherEventsSection'),
  otherEventsList: document.getElementById('otherEventsList'),
  joinSection: document.getElementById('joinSection'),
  backToControlPanelButton: document.getElementById('backToControlPanelButton'),
  prizeDisplay: document.getElementById('prizeDisplay'),
  slotList: document.getElementById('slotList'),
  joinButton: document.getElementById('joinButton'),
  waitingMessage: document.getElementById('waitingMessage'),
  deleteParticipantWaitingButton: document.getElementById('deleteParticipantWaitingButton'),
  backToDashboardFromWaitingButton: document.getElementById('backToDashboardFromWaitingButton'),
  resultSection: document.getElementById('resultSection'),
  participantCanvas: document.getElementById('participantCanvas'),
  myResult: document.getElementById('myResult'),
  allResultsContainer: document.getElementById('allResultsContainer'),
  shareButton: document.getElementById('shareButton'),
  backToControlPanelFromResultButton: document.getElementById('backToControlPanelFromResultButton'),
  groupPasswordModal: document.getElementById('groupPasswordModal'),
  closeGroupPasswordModalButton: document.querySelector('#groupPasswordModal .close-button'),
  verificationTargetGroupId: document.getElementById('verificationTargetGroupId'),
  verificationTargetGroupName: document.getElementById('verificationTargetGroupName'),
  groupPasswordVerifyInput: document.getElementById('groupPasswordVerifyInput'),
  verifyPasswordButton: document.getElementById('verifyPasswordButton'),
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
  closePrizeMasterSelectModal: document.querySelector('#prizeMasterSelectModal .close-button'),
  prizeMasterSelectList: document.getElementById('prizeMasterSelectList'),
  addSelectedPrizesButton: document.getElementById('addSelectedPrizesButton'),
  groupEventListContainer: document.getElementById('groupEventList'),
  groupNameTitle: document.getElementById('groupEventListName'),
  backToDashboardFromEventListButton: document.getElementById('backToDashboardFromEventListButton'),
  fillSlotsModal: document.getElementById('fillSlotsModal'),
  unjoinedMemberList: document.getElementById('unjoinedMemberList'),
  emptySlotCount: document.getElementById('emptySlotCount'),
  selectMembersButton: document.getElementById('selectMembersButton'),
  selectedMemberList: document.getElementById('selectedMemberList'),
  confirmFillSlotsButton: document.getElementById('confirmFillSlotsButton'),
  // ★★★★★★★★★★★★★★★★★★★★★★★★★★★
  // ★★★ 以下2行を追記 ★★★
  // ★★★★★★★★★★★★★★★★★★★★★★★★★★★
  requestAdminButton: document.getElementById('requestAdminButton'),
  requestAdminControls: document.getElementById('requestAdminControls'),
};

const ALL_VIEWS = ['groupDashboard', 'dashboardView', 'memberManagementView', 'eventEditView', 'broadcastView', 'participantView', 'adminDashboard', 'groupEventListView'];

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

export function setMainHeaderVisibility(visible) {
  if (elements.mainHeader) {
    elements.mainHeader.style.display = visible ? 'flex' : 'none';
  }
  adjustBodyPadding();
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

    if (elements.loginButton) elements.loginButton.style.display = 'none';
    if (elements.logoutButton) elements.logoutButton.style.display = 'block';
    if (elements.deleteAccountButton) elements.deleteAccountButton.style.display = 'block';

    const isSystemAdmin = user.role === 'system_admin' && !user.isImpersonating;
    if (elements.adminDashboardButton) elements.adminDashboardButton.style.display = isSystemAdmin ? 'block' : 'none';

    if (elements.requestAdminControls) {
      if (user.role === 'user') {
        elements.requestAdminControls.style.display = 'block';
        elements.requestAdminButton.style.display = 'block';
        if (user.adminRequestStatus === 'pending') {
          elements.requestAdminButton.textContent = '申請中';
          elements.requestAdminButton.disabled = true;
        } else {
          elements.requestAdminButton.textContent = '管理者権限を申請する';
          elements.requestAdminButton.disabled = false;
        }
      } else {
        elements.requestAdminControls.style.display = 'none';
      }
    }
  } else {
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

  elements.saveGroupSettingsButton.onclick = handlers.onSave;
  elements.deletePasswordButton.onclick = handlers.onDeletePassword;

  elements.groupSettingsModal.style.display = 'block';
}

export function openPrizeMasterModal(handlers) {
  if (!elements.prizeMasterModal) return;
  elements.addMasterPrizeButton.onclick = handlers.onAddMaster;
  elements.prizeMasterList.onclick = (e) => {
    const button = e.target.closest('button.delete-btn');
    if (button) {
      handlers.onDeleteMaster(button.dataset.masterId);
    }
  };
  elements.prizeMasterModal.style.display = 'block';
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

export function openPrizeMasterSelectModal(masters, handlers) {
  renderPrizeMasterList(masters, true);
  if (elements.addSelectedPrizesButton) elements.addSelectedPrizesButton.onclick = handlers.onAddSelected;
  if (elements.prizeMasterSelectModal) elements.prizeMasterSelectModal.style.display = 'block';
}

export function showGroupPasswordModal(groupId, groupName) {
  if (!elements.groupPasswordModal) return;
  elements.verificationTargetGroupId.value = groupId;
  elements.verificationTargetGroupName.textContent = groupName;
  elements.groupPasswordVerifyInput.value = '';
  elements.groupPasswordModal.style.display = 'block';
  elements.groupPasswordVerifyInput.focus();
}

export function closeSettingsModal() {
  if (elements.groupSettingsModal) elements.groupSettingsModal.style.display = 'none';
}

export function closePrizeMasterModal() {
  if (elements.prizeMasterModal) elements.prizeMasterModal.style.display = 'none';
}

export function closeProfileEditModal() {
  if (elements.profileEditModal) elements.profileEditModal.style.display = 'none';
}

export function closePrizeMasterSelectModal() {
  if (elements.prizeMasterSelectModal) elements.prizeMasterSelectModal.style.display = 'none';
}

export function closeGroupPasswordModal() {
  if (elements.groupPasswordModal) elements.groupPasswordModal.style.display = 'none';
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
    li.textContent = prizeName;
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

export function renderAllResults(results, isShareView, highlightName) {
  if (isShareView) {
    if (elements.allResultsContainer) elements.allResultsContainer.innerHTML = '';
    return;
  }

  if (!elements.allResultsContainer || !results) return;

  let html = `
    <div class="list-header">
      <h3>みんなの結果</h3>
      <button id="showAllTracersButton" class="secondary-btn">他の人の軌跡見る！</button>
    </div>
    <ul class="item-list">
  `;

  for (const name in results) {
    const prize = results[name].prize;
    const prizeName = typeof prize === 'object' ? prize.name : prize;
    const prizeImageUrl = typeof prize === 'object' ? prize.imageUrl : null;

    const isHighlighted = name === highlightName ? 'highlight' : '';

    let imageHtml = '';
    if (prizeImageUrl) {
      imageHtml = `<img src="${prizeImageUrl}" alt="${prizeName}" class="result-prize-image">`;
    }

    html += `<li class="item-list-item ${isHighlighted}">${imageHtml}<span>${name} → ${prizeName}</span></li>`;
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

export function showUserDashboardView(groupData, events) {
  showView('participantView');
  hideParticipantSubViews();
  elements.backToGroupEventListLink.style.display = 'none';

  if (elements.participantEventName) {
    elements.participantEventName.textContent = `${groupData.name} のダッシュボード`;
  }

  state.loadParticipantState();
  if (state.currentParticipantId && state.currentParticipantToken) {
    showControlPanelView({participants: [], status: 'pending'});
  } else {
    showNameEntryView();
    if (elements.nameInput) elements.nameInput.placeholder = '名前を入力して参加/ログイン';
    if (elements.confirmNameButton) {
      elements.confirmNameButton.textContent = 'OK';
      elements.confirmNameButton.style.display = 'block';
    }
  }

  renderOtherEvents(events, groupData.customUrl);
}

export function resetEventCreationForm() {
  state.setPrizes([]);
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

export function renderOtherEvents(events, groupCustomUrl) {
  if (!elements.otherEventsList || !elements.otherEventsSection) return;

  const showAcknowledgedCheckbox = document.getElementById('showAcknowledgedEvents');
  const shouldShowAcknowledged = showAcknowledgedCheckbox ? showAcknowledgedCheckbox.checked : false;
  const myMemberId = state.currentParticipantId;

  const eventsToRender = events.filter((event) => {
    const myParticipation = myMemberId ? event.participants.find((p) => p.memberId === myMemberId) : null;
    const isStarted = event.status === 'started';

    if (isStarted && myParticipation && !myParticipation.acknowledgedResult) {
      return true;
    }
    if (shouldShowAcknowledged) {
      return true;
    }
    return !isStarted;
  });

  if (eventsToRender.length === 0) {
    elements.otherEventsSection.style.display = 'none';
    return;
  }

  elements.otherEventsList.innerHTML = '';
  eventsToRender.forEach((event) => {
    const li = document.createElement('li');
    li.className = 'item-list-item';
    const date = new Date((event.createdAt._seconds || event.createdAt.seconds) * 1000);
    const eventUrl = groupCustomUrl ? `/g/${groupCustomUrl}/${event.id}` : `/events/${event.id}`;

    const myParticipation = myMemberId ? event.participants.find((p) => p.memberId === myMemberId) : null;
    let badge = '';

    if (event.status === 'started' && myParticipation && !myParticipation.acknowledgedResult) {
      const iconName = clientEmojiToLucide('🎉');
      badge = `<span class="badge result-ready"><i data-lucide="${iconName}"></i>結果発表！</span>`;
    } else if (event.status === 'pending') {
      if (myParticipation) {
        badge = '<span class="badge joined">参加登録済</span>';
      } else {
        badge = '<span class="badge ongoing">開催中</span>';
      }
    }

    li.innerHTML = `
            <span><strong>${event.eventName || '無題のイベント'}</strong> ${badge}</span>
            <a href="${eventUrl}" class="button">${event.status === 'started' ? '結果を見る' : '参加する'}</a>
        `;
    elements.otherEventsList.appendChild(li);
  });
  elements.otherEventsSection.style.display = 'block';

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

export function setBroadcastControlsDisabled(disabled) {
  const controls = document.querySelectorAll('#broadcastSidebar button, #broadcastSidebar select');
  controls.forEach((control) => {
    control.disabled = disabled;
  });
}
