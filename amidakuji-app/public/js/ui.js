import * as api from './api.js';
import * as state from './state.js';
import {stopAnimation} from './animation.js';

const clientEmojiMap = new Map(window.emojiMapData || []);
export function clientEmojiToLucide(emoji) {
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
  memberManagementGroupName: document.getElementById('memberManagementGroupName'), // ★★★ この行を追記しました ★★★
  groupSwitcher: document.getElementById('groupSwitcher'),
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
  broadcastEventUrl: document.getElementById('broadcastEventUrl'),
  currentEventUrl: document.getElementById('currentEventUrl'),
  broadcastControls: document.querySelector('.broadcast-controls'),
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

export async function buildNewPrizesWithDataPreservation(newNames) {
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
