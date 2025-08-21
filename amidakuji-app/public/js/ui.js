// js/ui.js
import * as state from './state.js';
import {stopAnimation} from './animation.js';

/* ==========================================================================
   DOM要素の参照
   -------------------------------------------------------------------------- */
export const elements = {
  // Header & Auth
  mainHeader: document.querySelector('.main-header'),
  impersonationBanner: document.querySelector('.impersonation-banner'),
  loginButton: document.getElementById('loginButton'),
  logoutButton: document.getElementById('logoutButton'),
  deleteAccountButton: document.getElementById('deleteAccountButton'),
  adminDashboardButton: document.getElementById('adminDashboardButton'),
  stopImpersonatingButton: document.getElementById('stopImpersonatingButton'),
  hamburgerButton: document.getElementById('hamburger-button'),
  navMenu: document.getElementById('nav-menu'),

  // Views
  groupDashboard: document.getElementById('groupDashboard'),
  dashboardView: document.getElementById('dashboardView'),
  memberManagementView: document.getElementById('memberManagementView'),
  eventEditView: document.getElementById('eventEditView'),
  broadcastView: document.getElementById('broadcastView'),
  participantView: document.getElementById('participantView'),
  adminDashboard: document.getElementById('adminDashboard'),
  groupEventListView: document.getElementById('groupEventListView'),

  // Group Dashboard
  groupNameInput: document.getElementById('groupNameInput'),
  createGroupButton: document.getElementById('createGroupButton'),
  groupList: document.getElementById('groupList'),
  requestAdminButton: document.getElementById('requestAdminButton'),
  requestAdminControls: document.getElementById('requestAdminControls'),

  // Group Switcher
  groupSwitcher: document.getElementById('groupSwitcher'),
  currentGroupName: document.getElementById('currentGroupName'),
  groupDropdown: document.getElementById('groupDropdown'),
  switcherGroupList: document.getElementById('switcherGroupList'),
  switcherCreateGroup: document.getElementById('switcherCreateGroup'),

  // Member Management View
  memberManagementGroupName: document.getElementById('memberManagementGroupName'),
  backToDashboardFromMembersButton: document.getElementById('backToDashboardFromMembersButton'),
  addNewMemberButton: document.getElementById('addNewMemberButton'),
  memberSearchInput: document.getElementById('memberSearchInput'),
  memberList: document.getElementById('memberList'),
  bulkRegisterButton: document.getElementById('bulkRegisterButton'),

  // Group Settings Modal
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
  participantManagementList: document.getElementById('participantManagementList'),

  // Prize Master Modal
  prizeMasterModal: document.getElementById('prizeMasterModal'),
  closePrizeMasterModalButton: document.querySelector('#prizeMasterModal .close-button'),
  prizeMasterList: document.getElementById('prizeMasterList'),
  addMasterPrizeNameInput: document.getElementById('addMasterPrizeNameInput'),
  addMasterPrizeImageInput: document.getElementById('addMasterPrizeImageInput'),
  addMasterPrizeButton: document.getElementById('addMasterPrizeButton'),

  // Password Reset Notification & Modal
  passwordResetNotification: document.getElementById('passwordResetNotification'),
  passwordResetCount: document.getElementById('passwordResetCount'),
  showPasswordResetRequestsButton: document.getElementById('showPasswordResetRequestsButton'),
  passwordResetRequestModal: document.getElementById('passwordResetRequestModal'),
  closePasswordResetRequestModalButton: document.querySelector('#passwordResetRequestModal .close-button'),
  passwordResetRequestList: document.getElementById('passwordResetRequestList'),

  // Event Dashboard (dashboardView)
  eventGroupName: document.getElementById('eventGroupName'),
  goToGroupSettingsButton: document.getElementById('goToGroupSettingsButton'),
  goToPrizeMasterButton: document.getElementById('goToPrizeMasterButton'),
  goToMemberManagementButton: document.getElementById('goToMemberManagementButton'),
  goToCreateEventViewButton: document.getElementById('goToCreateEventViewButton'),
  eventList: document.getElementById('eventList'),

  // Event Edit View
  backToGroupsButton: document.getElementById('backToGroupsButton'),
  eventNameInput: document.getElementById('eventNameInput'),
  bulkAddPrizesButton: document.getElementById('bulkAddPrizesButton'),
  prizeList: document.getElementById('prizeList'),
  displayModeSelect: document.getElementById('displayModeSelect'),
  createEventButton: document.getElementById('createEventButton'),
  eventIdInput: document.getElementById('eventIdInput'),
  loadButton: document.getElementById('loadButton'),
  currentEventUrl: document.getElementById('currentEventUrl'),
  openAddPrizeModalButton: document.getElementById('openAddPrizeModalButton'),
  showSummaryButton: document.getElementById('showSummaryButton'),

  // Broadcast View
  backToDashboardButton: document.getElementById('backToDashboardButton'),
  adminControls: document.getElementById('adminControls'),
  startEventButton: document.getElementById('startEventButton'),
  startBroadcastButton: document.getElementById('startBroadcastButton'),
  adminCanvas: document.getElementById('adminCanvas'),
  broadcastControls: document.querySelector('.broadcast-controls'),
  animateAllButton: document.getElementById('animateAllButton'),
  nextStepButton: document.getElementById('nextStepButton'),
  regenerateLinesButton: document.getElementById('regenerateLinesButton'),
  glimpseButton: document.getElementById('glimpseButton'),
  highlightUserSelect: document.getElementById('highlightUserSelect'),
  highlightUserButton: document.getElementById('highlightUserButton'),

  // Participant View
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

  // Admin Dashboard
  pendingRequestsList: document.getElementById('pendingRequestsList'),
  adminUserList: document.getElementById('adminUserList'),
  systemAdminList: document.getElementById('systemAdminList'),

  // Modals
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

  memberEditModal: document.getElementById('memberEditModal'),
  closeMemberEditModalButton: document.querySelector('#memberEditModal .close-button'),
  memberIdInput: document.getElementById('memberIdInput'),
  memberNameEditInput: document.getElementById('memberNameEditInput'),
  memberColorInput: document.getElementById('memberColorInput'),
  saveMemberButton: document.getElementById('saveMemberButton'),

  bulkRegisterModal: document.getElementById('bulkRegisterModal'),
  closeBulkRegisterModalButton: document.querySelector('#bulkRegisterModal .close-button'),
  bulkNamesTextarea: document.getElementById('bulkNamesTextarea'),
  analyzeBulkButton: document.getElementById('analyzeBulkButton'),
  bulkStep1Input: document.getElementById('bulk-step1-input'),
  bulkStep2Preview: document.getElementById('bulk-step2-preview'),
  finalizeBulkButton: document.getElementById('finalizeBulkButton'),

  prizeBulkAddModal: document.getElementById('prizeBulkAddModal'),
  closePrizeBulkAddModalButton: document.querySelector('#prizeBulkAddModal .close-button'),
  prizeBulkTextarea: document.getElementById('prizeBulkTextarea'),
  updatePrizesFromTextButton: document.getElementById('updatePrizesFromTextButton'),
  clearBulkPrizesButton: document.getElementById('clearBulkPrizesButton'),
  cancelBulkAddButton: document.getElementById('cancelBulkAddButton'),

  groupEventListContainer: document.getElementById('groupEventList'),
  groupNameTitle: document.getElementById('groupEventListName'),
  backToDashboardFromEventListButton: document.getElementById('backToDashboardFromEventListButton'),

  addPrizeModal: document.getElementById('addPrizeModal'),
  newPrizeNameInput: document.getElementById('newPrizeNameInput'),
  newPrizeImageInput: document.getElementById('newPrizeImageInput'),
  newPrizeImagePreview: document.getElementById('newPrizeImagePreview'),
  callMasterButton: document.getElementById('callMasterButton'),
  addPrizeOkButton: document.getElementById('addPrizeOkButton'),
  summaryModal: document.getElementById('summaryModal'),
  totalPrizes: document.getElementById('totalPrizes'),
  prizeSummaryList: document.getElementById('prizeSummaryList'),
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
export function openAddPrizeModal() {
  if (!elements.addPrizeModal) return;
  elements.newPrizeNameInput.value = '';
  elements.newPrizeImageInput.value = '';
  elements.newPrizeImagePreview.src = '';
  elements.newPrizeImagePreview.style.display = 'none';
  elements.addPrizeModal.style.display = 'block';
}

export function closeAddPrizeModal() {
  if (elements.addPrizeModal) elements.addPrizeModal.style.display = 'none';
}

export function openSummaryModal(summary) {
  if (!elements.summaryModal) return;
  elements.totalPrizes.textContent = summary.total;
  elements.prizeSummaryList.innerHTML = '';
  for (const name in summary.breakdown) {
    const li = document.createElement('li');
    li.textContent = `${name}: ${summary.breakdown[name]}個`;
    elements.prizeSummaryList.appendChild(li);
  }
  elements.summaryModal.style.display = 'block';
}

export function closeSummaryModal() {
  if (elements.summaryModal) elements.summaryModal.style.display = 'none';
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

export function closeSettingsModal() {
  if (elements.groupSettingsModal) elements.groupSettingsModal.style.display = 'none';
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

export function closePrizeMasterModal() {
  if (elements.prizeMasterModal) elements.prizeMasterModal.style.display = 'none';
}

export function openPasswordResetRequestModal(requests, handlers) {
  if (!elements.passwordResetRequestModal) return;
  renderPasswordRequests(requests);
  elements.passwordResetRequestList.onclick = (e) => {
    const button = e.target.closest('button.approve-btn');
    if (button) {
      const {groupId, memberId, requestId} = button.dataset;
      handlers.onApproveReset(memberId, groupId, requestId);
    }
  };
  elements.passwordResetRequestModal.style.display = 'block';
}

export function closePasswordResetRequestModal() {
  if (elements.passwordResetRequestModal) elements.passwordResetRequestModal.style.display = 'none';
}

export function showPasswordResetNotification(requests) {
  if (!elements.passwordResetNotification || !elements.passwordResetCount) return;

  if (requests && requests.length > 0) {
    elements.passwordResetCount.textContent = requests.length;
    elements.passwordResetNotification.style.display = 'flex';
  } else {
    elements.passwordResetNotification.style.display = 'none';
  }
}

export function openMemberEditModal(member, handlers) {
  if (!elements.memberEditModal) return;
  elements.memberIdInput.value = member.id;
  elements.memberNameEditInput.value = member.name;
  elements.memberColorInput.value = member.color || '#cccccc';
  elements.saveMemberButton.onclick = handlers.onSave;
  elements.memberEditModal.style.display = 'block';
}

export function closeMemberEditModal() {
  if (elements.memberEditModal) elements.memberEditModal.style.display = 'none';
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

export function openPrizeBulkAddModal() {
  if (elements.prizeBulkAddModal) {
    elements.prizeBulkTextarea.value = state.prizes.map((p) => p.name).join('\n');
    elements.prizeBulkAddModal.style.display = 'block';
  }
}

export function closePrizeBulkAddModal() {
  if (elements.prizeBulkAddModal) elements.prizeBulkAddModal.style.display = 'none';
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

export function renderEventList(events) {
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

export function renderMemberList(members) {
  if (!elements.memberList) return;
  elements.memberList.innerHTML = '';
  const searchTerm = elements.memberSearchInput.value.toLowerCase();

  members
    .filter((member) => member.name.toLowerCase().includes(searchTerm))
    .forEach((member) => {
      const li = document.createElement('li');
      li.className = 'item-list-item member-list-item';
      li.dataset.memberId = member.id;

      const createdByLabel = member.createdBy === 'admin' ? '<span class="label admin">管理者登録</span>' : '<span class="label user">本人登録</span>';

      li.innerHTML = `
                <div class="member-info">
                    <input type="color" value="${member.color || '#cccccc'}" disabled>
                    <span>${member.name}</span>
                    ${createdByLabel}
                </div>
                <div class="item-buttons">
                    <button class="edit-member-btn">編集</button>
                    <button class="delete-btn delete-member-btn">削除</button>
                </div>
            `;
      elements.memberList.appendChild(li);
    });
}

export function renderPrizeList() {
  if (!elements.prizeList) return;
  elements.prizeList.innerHTML = '';
  state.prizes.forEach((p, index) => {
    const li = document.createElement('li');
    li.className = 'prize-card';

    const prizeName = typeof p === 'object' ? p.name : p;
    let prizeImageUrl = typeof p === 'object' ? p.imageUrl : null;
    const uniqueId = `prize-image-upload-${index}`;

    // カードの画像部分
    const imageContainer = document.createElement('div');
    imageContainer.className = 'prize-card-image';
    const imgPreview = document.createElement('img');
    imgPreview.alt = prizeName;

    // ▼▼▼ ここから修正 ▼▼▼
    if (prizeImageUrl) {
      imgPreview.src = prizeImageUrl;
    } else if (p.newImageFile) {
      // newImageFileが存在する場合、それを使ってプレビューを表示
      const reader = new FileReader();
      reader.onload = (event) => {
        imgPreview.src = event.target.result;
      };
      reader.readAsDataURL(p.newImageFile);
    } else {
      imgPreview.classList.add('placeholder');
      imgPreview.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    }
    // ▲▲▲ ここまで修正 ▲▲▲

    imageContainer.appendChild(imgPreview);
    imageContainer.onclick = () => document.getElementById(uniqueId).click();

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.id = uniqueId;
    fileInput.style.display = 'none';
    fileInput.dataset.index = index;

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          imgPreview.src = event.target.result;
          imgPreview.classList.remove('placeholder');
        };
        reader.readAsDataURL(file);
        state.prizes[index].newImageFile = file;
        // 既存の画像URLがある場合はリセット
        state.prizes[index].imageUrl = null;
      }
    });
    imageContainer.appendChild(fileInput);
    li.appendChild(imageContainer);

    // カードの情報部分（景品名とボタン）
    const infoContainer = document.createElement('div');
    infoContainer.className = 'prize-card-info';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = prizeName;
    nameInput.className = 'prize-card-name-input';
    nameInput.dataset.index = index;
    nameInput.addEventListener('change', (event) => {
      const updatedIndex = parseInt(event.target.dataset.index, 10);
      const newName = event.target.value.trim();
      if (newName) {
        state.prizes[updatedIndex].name = newName;
      } else {
        event.target.value = prizeName;
      }
    });
    infoContainer.appendChild(nameInput);

    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'prize-card-actions';

    const duplicateBtn = document.createElement('button');
    duplicateBtn.textContent = '複製';
    duplicateBtn.className = 'duplicate-btn';
    duplicateBtn.dataset.index = index;
    duplicateBtn.type = 'button';

    duplicateBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const sourceIndex = parseInt(e.target.dataset.index, 10);
      const prizeToDuplicate = JSON.parse(JSON.stringify(state.prizes[sourceIndex]));
      if (state.prizes[sourceIndex].newImageFile) {
        prizeToDuplicate.newImageFile = state.prizes[sourceIndex].newImageFile;
      }
      state.prizes.splice(sourceIndex + 1, 0, prizeToDuplicate);
      renderPrizeList();
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '削除';
    deleteBtn.className = 'delete-btn';
    deleteBtn.dataset.index = index;
    deleteBtn.type = 'button';

    actionsContainer.appendChild(duplicateBtn);
    actionsContainer.appendChild(deleteBtn);
    infoContainer.appendChild(actionsContainer);

    li.appendChild(infoContainer);
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

export function renderAdminLists(requests, groupAdmins, systemAdmins) {
  const {pendingRequestsList, adminUserList, systemAdminList} = elements;

  if (pendingRequestsList) {
    pendingRequestsList.innerHTML = requests.length === 0 ? '<li>現在、承認待ちの申請はありません。</li>' : requests.map((req) => `<li class="item-list-item"><span>${req.name} (${req.email})</span><div class="item-buttons"><button class="approve-btn" data-request-id="${req.id}">承認</button></div></li>`).join('');
  }
  if (adminUserList) {
    adminUserList.innerHTML = groupAdmins.map((user) => `<li class="item-list-item"><span>${user.name} (${user.email})</span><div class="item-buttons"><button class="impersonate-btn" data-user-id="${user.id}">成り代わり</button></div></li>`).join('');
  }
  if (systemAdminList) {
    systemAdminList.innerHTML = systemAdmins
      .map((admin) => {
        const isCurrentUser = admin.id === (state.currentUser.isImpersonating ? state.currentUser.originalUser.id : state.currentUser.id);
        const buttons = isCurrentUser ? '' : `<div class="item-buttons"><button class="demote-btn delete-btn" data-user-id="${admin.id}">権限剥奪</button></div>`;
        return `<li class="item-list-item"><span>${admin.name} (${admin.email})</span> ${buttons}</li>`;
      })
      .join('');
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

export function renderAllResults(results) {
  if (!elements.allResultsContainer || !results) return;
  let html = '<h3>みんなの結果</h3><ul class="item-list">';
  for (const name in results) {
    const prize = results[name].prize;
    const prizeName = typeof prize === 'object' ? prize.name : prize;
    const prizeImageUrl = typeof prize === 'object' ? prize.imageUrl : null;

    let imageHtml = '';
    if (prizeImageUrl) {
      imageHtml = `<img src="${prizeImageUrl}" alt="${prizeName}" class="result-prize-image">`;
    }

    html += `<li class="item-list-item">${imageHtml}<span>${name} → ${prizeName}</span></li>`;
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

export function renderOtherEvents(events, groupCustomUrl) {
  if (!elements.otherEventsList || !elements.otherEventsSection) return;

  if (!events || events.length === 0) {
    elements.otherEventsSection.style.display = 'none';
    return;
  }

  elements.otherEventsList.innerHTML = '';
  events.forEach((event) => {
    const li = document.createElement('li');
    li.className = 'item-list-item';
    const date = new Date((event.createdAt._seconds || event.createdAt.seconds) * 1000);
    const eventUrl = groupCustomUrl ? `/g/${groupCustomUrl}/${event.id}` : `/events/${event.id}`;

    li.innerHTML = `
            <span><strong>${event.eventName || '無題のイベント'}</strong>（${date.toLocaleDateString()} 作成）</span>
            <a href="${eventUrl}" class="button">参加する</a>
        `;
    elements.otherEventsList.appendChild(li);
  });
  elements.otherEventsSection.style.display = 'block';
}

export function openBulkRegisterModal() {
  if (!elements.bulkRegisterModal) return;
  elements.bulkNamesTextarea.value = '';
  elements.bulkStep1Input.style.display = 'block';
  elements.bulkStep2Preview.style.display = 'none';
  elements.analyzeBulkButton.disabled = false;
  elements.analyzeBulkButton.textContent = '確認する';
  elements.finalizeBulkButton.disabled = true;
  elements.bulkRegisterModal.style.display = 'block';
}

export function closeBulkRegisterModal() {
  if (elements.bulkRegisterModal) elements.bulkRegisterModal.style.display = 'none';
}

export function renderBulkAnalysisPreview(analysisResults) {
  const newRegistrationTab = document.getElementById('newRegistrationTab');
  const potentialMatchTab = document.getElementById('potentialMatchTab');
  const exactMatchTab = document.getElementById('exactMatchTab');

  newRegistrationTab.innerHTML =
    '<ul>' +
    analysisResults
      .filter((r) => r.status === 'new_registration')
      .map((r) => `<li>"${r.inputName}" を新規登録します。</li>`)
      .join('') +
    '</ul>';
  exactMatchTab.innerHTML =
    '<ul>' +
    analysisResults
      .filter((r) => r.status === 'exact_match')
      .map((r) => `<li>"${r.inputName}" は登録済みのためスキップします。</li>`)
      .join('') +
    '</ul>';

  potentialMatchTab.innerHTML =
    '<ul>' +
    analysisResults
      .filter((r) => r.status === 'potential_match')
      .map(
        (r, i) => `
        <li data-input-name="${r.inputName}">
            <p><strong>"${r.inputName}"</strong> は、既存の <strong>"${r.suggestions[0].name}"</strong> と類似しています。</p>
            <label><input type="radio" name="resolve_${i}" value="skip" checked> 同一人物として扱う (スキップ)</label>
            <label><input type="radio" name="resolve_${i}" value="create"> 別人として新規登録する</label>
        </li>
    `
      )
      .join('') +
    '</ul>';

  // タブの件数を更新
  document.querySelector('.tab-link[data-tab="newRegistrationTab"]').textContent = `新規登録 (${analysisResults.filter((r) => r.status === 'new_registration').length})`;
  document.querySelector('.tab-link[data-tab="potentialMatchTab"]').textContent = `類似候補 (${analysisResults.filter((r) => r.status === 'potential_match').length})`;
  document.querySelector('.tab-link[data-tab="exactMatchTab"]').textContent = `完全一致 (${analysisResults.filter((r) => r.status === 'exact_match').length})`;

  // タブ切り替えロジック
  document.querySelectorAll('#bulk-step2-preview .tab-link').forEach((button) => {
    button.onclick = (e) => {
      document.querySelectorAll('#bulk-step2-preview .tab-link, #bulk-step2-preview .tab-content').forEach((el) => el.classList.remove('active'));
      const tabId = e.target.dataset.tab;
      e.target.classList.add('active');
      document.getElementById(tabId).classList.add('active');
    };
  });

  elements.bulkStep1Input.style.display = 'none';
  elements.bulkStep2Preview.style.display = 'block';
  elements.finalizeBulkButton.disabled = false;
}
