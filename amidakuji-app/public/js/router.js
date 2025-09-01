import {clearAllFirestoreListeners, addFirestoreListener} from './state.js';
import * as api from './api.js';
import * as ui from './ui.js';
import * as state from './state.js';
import {startAnimation, stopAnimation, prepareStepAnimation} from './animation.js';
import {renderGroupList} from './components/groupDashboard.js';
import {renderEventList, showPasswordResetNotification} from './components/eventDashboard.js';
import {renderMemberList} from './components/memberManagement.js';
import {renderPrizeCardList, renderPrizeListMode, renderEventForEditing} from './components/eventEdit.js';
import {loadAdminDashboardData} from './components/adminDashboard.js';
import {showUserDashboardView, showJoinView, showStaticAmidaView, showNameEntryView, showResultsView, hideParticipantSubViews, renderOtherEvents, initializeParticipantView} from './components/participantView.js';
import {db} from './main.js';

async function loadAdminDashboard() {
  try {
    await loadAdminDashboardData();
  } catch (error) {
    console.error('管理ダッシュボードの読み込みに失敗:', error);
  }
}

async function handleRouting(initialData) {
  const path = window.location.pathname;

  const user = await api.checkGoogleAuthState().catch(() => null);
  state.setCurrentUser(user);

  const publicRoutesToHideHeader = ['/g/', '/share/', '/events/'];
  const isPublicPage = publicRoutesToHideHeader.some((route) => path.startsWith(route));

  if (!user && (isPublicPage || path.startsWith('/groups/'))) {
    ui.setMainHeaderVisibility(false);
  } else {
    ui.setMainHeaderVisibility(true);
    ui.updateAuthUI(user);
  }

  state.loadParticipantState();

  if (user) {
    const adminMatch = path.match(/\/admin/);
    const adminGroupDashboardMatch = path.match(/^\/admin\/groups\/([a-zA-Z0-9]+)$/);
    const adminMemberManagementMatch = path.match(/^\/admin\/groups\/([a-zA-Z0-9]+)\/members$/);
    const adminEventEditMatch = path.match(/^\/admin\/event\/([a-zA-Z0-9]+)\/edit$/);
    const adminNewEventMatch = path.match(/^\/admin\/group\/([a-zA-Z0-9]+)\/event\/new$/);
    const adminEventBroadcastMatch = path.match(/^\/admin\/event\/([a-zA-Z0-9]+)\/broadcast$/);

    const eventEditMatch = path.match(/^\/event\/([a-zA-Z0-9]+)\/edit$/);
    const newEventMatch = path.match(/^\/group\/([a-zA-Z0-9]+)\/event\/new$/);
    const groupDashboardMatch = path.match(/^\/groups\/([a-zA-Z0-9]+)$/);
    const eventBroadcastMatch = path.match(/^\/event\/([a-zA-Z0-9]+)\/broadcast$/);

    if (path === '/') {
      ui.showView('groupDashboard');
      const groups = await api.getGroups();
      state.setAllUserGroups(groups);
      renderGroupList(groups);
      ui.updateGroupSwitcher();
      return;
    }

    if (adminGroupDashboardMatch) {
      const groupId = adminGroupDashboardMatch[1];
      await loadAndShowGroupEvents(groupId);
      await api.updateLastGroup(groupId);
      return;
    }

    if (adminMemberManagementMatch) {
      const groupId = adminMemberManagementMatch[1];
      await loadAndShowMemberManagement(groupId);
      return;
    }

    if (groupDashboardMatch) {
      const groupId = groupDashboardMatch[1];
      await initializeGroupEventListView(groupId, initialData ? initialData.group : null, false);
      return;
    }

    if (adminEventEditMatch) {
      const eventId = adminEventEditMatch[1];
      await loadEventForEditing(eventId, 'eventEditView');
      return;
    }

    if (eventEditMatch) {
      const eventId = eventEditMatch[1];
      await loadEventForEditing(eventId, 'eventEditView');
      return;
    }

    if (adminEventBroadcastMatch) {
      const eventId = adminEventBroadcastMatch[1];
      await loadAndShowBroadcast(eventId);
      return;
    }

    if (eventBroadcastMatch) {
      const eventId = eventBroadcastMatch[1];
      await loadAndShowBroadcast(eventId);
      return;
    }

    if (adminNewEventMatch) {
      const groupId = adminNewEventMatch[1];
      await loadAndShowEventForm(groupId);
      return;
    }

    if (newEventMatch) {
      const groupId = newEventMatch[1];
      await loadAndShowEventForm(groupId);
      return;
    }
    if (adminMatch && user.role === 'system_admin' && !user.isImpersonating) {
      ui.showView('adminDashboard');
      return 'loadAdminDashboard';
    }
  }

  if (path === '/admin/dashboard') {
    ui.showView('adminDashboard');
    return 'loadAdminDashboard';
  }

  const participantDashboardMatch = path.match(/^\/g\/(.+?)\/dashboard\/?$/);
  if (participantDashboardMatch) {
    await initializeParticipantDashboardView(participantDashboardMatch[1], true);
    return;
  }

  const shareMatch = path.match(/^\/share\/([a-zA-Z0-9]+)\/(.+)/);
  if (shareMatch) {
    const [, eventId, participantName] = shareMatch;
    await initializeParticipantView(eventId, true, decodeURIComponent(participantName));
    return;
  }

  const eventMatch = path.match(/^\/events\/([a-zA-Z0-9]+)/) || path.match(/^\/g\/.+?\/([a-zA-Z0-9]+)/);
  if (eventMatch) {
    const eventId = eventMatch[1] || eventMatch[2];
    await initializeParticipantView(eventId, false, null);
    return;
  }

  const customUrlMatch = path.match(/^\/g\/(.+?)\/?$/);
  if (customUrlMatch) {
    if (state.currentParticipantId) {
      await initializeParticipantDashboardView(customUrlMatch[1], true);
    } else {
      await initializeGroupEventListView(customUrlMatch[1], initialData ? initialData.group : null, true);
    }
    return;
  }

  const groupIdMatch = path.match(/^\/groups\/([a-zA-Z0-9]+)\/?$/);
  if (groupIdMatch) {
    if (state.currentParticipantId) {
      await initializeParticipantDashboardView(groupIdMatch[1], false);
    } else {
      await initializeGroupEventListView(groupIdMatch[1], initialData ? initialData.group : null, false);
    }
    return;
  }

  if (user && path !== '/') {
    ui.showView('groupDashboard');
  } else if (!user && path === '/') {
    ui.showView('landingView');
  }

  ui.adjustBodyPadding();
}

export async function navigateTo(path, pushState = true) {
  clearAllFirestoreListeners();

  if (pushState && window.location.pathname !== path) {
    history.pushState({path}, '', path);
  }
  const action = await handleRouting({
    group: window.history.state?.groupData,
    event: window.history.state?.eventData,
  });
  if (action === 'loadAdminDashboard') {
    await loadAdminDashboard();
  }
}

async function loadAndShowGroupEvents(groupId) {
  const groupData = await api.getGroup(groupId).catch(() => null);
  const groupName = groupData ? groupData.name : '不明なグループ';

  state.setCurrentGroupId(groupId);
  ui.showView('dashboardView');
  if (ui.elements.eventGroupName) ui.elements.eventGroupName.textContent = `グループ: ${groupName}`;

  const showStartedCheckbox = document.getElementById('showStartedEvents');
  let originalEvents = [];

  const savedPreference = localStorage.getItem('showStartedEvents');
  if (showStartedCheckbox) {
    showStartedCheckbox.checked = savedPreference === 'true';
  }

  const rerenderEvents = () => {
    renderEventList(originalEvents);
  };

  if (showStartedCheckbox) {
    showStartedCheckbox.removeEventListener('change', rerenderEvents);
    showStartedCheckbox.addEventListener('change', () => {
      localStorage.setItem('showStartedEvents', showStartedCheckbox.checked);
      rerenderEvents();
    });
  }

  try {
    const [events, passwordRequests] = await Promise.all([api.getEventsForGroup(groupId), api.getPasswordRequests(groupId)]);

    originalEvents = events;
    rerenderEvents();

    showPasswordResetNotification(passwordRequests);

    if (state.allUserGroups.length === 0) {
      const allGroups = await api.getGroups();
      state.setAllUserGroups(allGroups);
    }
    ui.updateGroupSwitcher();
  } catch (error) {
    console.error(`イベント一覧の読み込み失敗 (Group ID: ${groupId}):`, error);
    if (ui.elements.eventList) ui.elements.eventList.innerHTML = `<li class="error-message">${error.error || error.message}</li>`;
  }
}

async function loadAndShowMemberManagement(groupId) {
  state.setCurrentGroupId(groupId);
  ui.showView('memberManagementView');
  try {
    const [group, members] = await Promise.all([api.getGroup(groupId), api.getMembers(groupId)]);
    if (ui.elements.memberManagementGroupName) {
      ui.elements.memberManagementGroupName.textContent = group.name;
    }
    renderMemberList(members);
  } catch (error) {
    console.error(`メンバー管理画面の読み込み失敗 (Group ID: ${groupId}):`, error);
    if (ui.elements.memberList) {
      ui.elements.memberList.innerHTML = `<li class="error-message">${error.error || error.message}</li>`;
    }
  }
}

export async function loadEventForEditing(eventId, viewToShow = 'eventEditView') {
  if (!eventId) {
    return;
  }
  try {
    if (state.allUserGroups.length === 0) {
      const groups = await api.getGroups();
      state.setAllUserGroups(groups);
    }

    const data = await api.getEvent(eventId);

    state.setCurrentLotteryData(data);
    state.setCurrentEventId(eventId);
    state.setCurrentGroupId(data.groupId);

    ui.showView(viewToShow);

    let parentGroup = state.allUserGroups.find((g) => g.id === data.groupId);

    if (!parentGroup) {
      try {
        parentGroup = await api.getGroup(data.groupId);
      } catch (groupError) {
        console.error(`Could not fetch parent group ${data.groupId}`, groupError);
        parentGroup = null;
      }
    }
    const url = parentGroup && parentGroup.customUrl ? `${window.location.origin}/g/${parentGroup.customUrl}/${eventId}` : `${window.location.origin}/events/${eventId}`;

    if (ui.elements.currentEventUrl) {
      ui.elements.currentEventUrl.textContent = url;
      ui.elements.currentEventUrl.href = url;
    }
    if (ui.elements.broadcastEventUrl) {
      ui.elements.broadcastEventUrl.textContent = url;
      ui.elements.broadcastEventUrl.href = url;
    }

    if (viewToShow === 'eventEditView') {
      renderEventForEditing(data);
    } else if (viewToShow === 'broadcastView') {
      const adminControls = document.getElementById('adminControls');
      const highlightUserSelect = document.getElementById('highlightUserSelect');
      const adminCanvas = document.getElementById('adminCanvas');
      const openSidebarButton = document.getElementById('openSidebarButton');

      if (adminCanvas) adminCanvas.style.display = 'block';

      const allParticipants = data.participants.filter((p) => p.name);
      if (highlightUserSelect) {
        highlightUserSelect.innerHTML = allParticipants.map((p) => `<option value="${p.name}">${p.name}</option>`).join('');
      }

      const isPending = data.status === 'pending';

      if (adminControls) adminControls.style.display = isPending ? 'flex' : 'none';
      if (openSidebarButton) openSidebarButton.style.display = isPending ? 'none' : 'flex';

      const hidePrizes = true;
      const ctx = adminCanvas.getContext('2d');
      await prepareStepAnimation(ctx, hidePrizes);
    }
  } catch (error) {
    console.error('イベントの読み込み中にAPIエラーが発生しました:', error);
    alert(error.error || 'イベントの読み込みに失敗しました。');
  }
}

async function loadAndShowBroadcast(eventId) {
  await loadEventForEditing(eventId, 'broadcastView');
}

async function loadAndShowEventForm(groupId) {
  state.setCurrentGroupId(groupId);
  ui.resetEventCreationForm();
  await renderEventForEditing({}); // フォームの表示をリセット
  ui.showView('eventEditView');
}

async function handlePasswordError(memberId, groupId) {
  const forgot = confirm('合言葉を忘れましたか？管理者にリセットを依頼します。');
  if (forgot) {
    try {
      await api.requestPasswordDeletion(memberId, groupId);
      alert('管理者に合言葉の削除を依頼しました。');
    } catch (resetError) {
      alert(resetError.error || '依頼の送信に失敗しました。');
    }
  }
}

export async function handleParticipantLogin(groupId, name, memberId = null) {
  if (!name) return;

  try {
    const result = await api.loginOrRegisterToGroup(groupId, name);
    state.saveParticipantState(result.token, result.memberId, result.name);
    const groupData = await api.getGroup(groupId);
    if (groupData && groupData.customUrl) {
      navigateTo(`/g/${groupData.customUrl}/dashboard`);
    } else {
      navigateTo(`/groups/${groupId}`);
    }
  } catch (error) {
    if (error.requiresPassword) {
      const password = prompt(`「${error.name}」さんの合言葉を入力してください:`);
      if (password) {
        try {
          const result = await api.loginMemberToGroup(groupId, error.memberId, password);
          state.saveParticipantState(result.token, result.memberId, result.name);
          showControlPanelView({participants: [], status: 'pending'});
          await handleRouting();
        } catch (loginError) {
          alert(loginError.error || '合言葉が違います。');
          await handlePasswordError(error.memberId, groupId);
        }
      }
    } else {
      alert(error.error || '処理に失敗しました。');
    }
  }
}

export async function handleLoginOrRegister(eventId, name, memberId = null) {
  if (!name || !eventId) return;
  try {
    const result = await api.joinEvent(eventId, name, memberId);
    state.saveParticipantState(result.token, result.memberId, result.name);

    if (result.status === 'event_full') {
      alert('枠がいっぱいで参加できませんでした。ダッシュボードに遷移します。');
      const groupData = await api.getGroup(state.currentGroupId);
      if (groupData && groupData.customUrl) {
        navigateTo(`/g/${groupData.customUrl}/dashboard`);
      } else {
        navigateTo(`/groups/${state.currentGroupId}`);
      }
    } else {
      navigateTo(window.location.pathname, false);
    }
  } catch (error) {
    if (error.requiresPassword) {
      const password = prompt(`「${error.name}」さんの合言葉を入力してください:`);
      if (password) {
        await verifyAndLogin(eventId, error.memberId, password);
      } else {
        await handlePasswordError(error.memberId, state.currentGroupId);
      }
    } else {
      const errorMessage = error.error || error.message || '処理中に予期せぬエラーが発生しました。';
      alert(errorMessage);
    }
  }
}

export async function verifyAndLogin(eventId, memberId, password, slot = null) {
  try {
    const result = await api.verifyPasswordAndJoin(eventId, memberId, password, slot);
    state.saveParticipantState(result.token, result.memberId, result.name);
    if (slot !== null) {
      showStaticAmidaView();
    } else {
      await handleRouting();
    }
  } catch (error) {
    const errorMessage = error.error || error.message || 'ログイン処理中に予期せぬエラーが発生しました。';
    alert(errorMessage);
    if (error.error) {
      await handlePasswordError(memberId, state.currentGroupId);
    }
  }
}

async function initializeParticipantDashboardView(customUrlOrGroupId, isCustomUrl = true) {
  try {
    const groupData = isCustomUrl ? await api.getGroupByCustomUrl(customUrlOrGroupId) : await api.getGroup(customUrlOrGroupId);
    const events = await api.getPublicEventsForGroup(groupData.id);

    state.setCurrentGroupId(groupData.id);
    state.setCurrentGroupData(groupData);
    state.setParticipantEventList(events);
    state.loadParticipantState();

    const showAcknowledgedCheckbox = document.getElementById('showAcknowledgedEvents');
    if (showAcknowledgedCheckbox) {
      const savedPreference = localStorage.getItem('showAcknowledgedEvents');
      showAcknowledgedCheckbox.checked = savedPreference === 'true';
    }

    showUserDashboardView(groupData, events);
  } catch (error) {
    console.error('Failed to initialize participant dashboard:', error);
    if (error.requiresPassword) {
      state.setLastFailedAction(() => initializeParticipantDashboardView(customUrlOrGroupId, isCustomUrl));
      ui.showGroupPasswordModal(error.groupId, error.groupName);
    } else {
      alert(error.error || 'ダッシュボードの表示に失敗しました。');
    }
  }
}

async function initializeGroupEventListView(customUrlOrGroupId, groupData, isCustomUrl) {
  const {groupEventListContainer, groupNameTitle, backToDashboardFromEventListButton} = ui.elements;
  if (!groupEventListContainer || !groupNameTitle || !backToDashboardFromEventListButton) return;

  ui.showView('groupEventListView');

  if (!groupData) {
    try {
      const groupDetails = isCustomUrl ? await api.getGroupByCustomUrl(customUrlOrGroupId) : await api.getGroup(customUrlOrGroupId);
      groupNameTitle.textContent = `${groupDetails.name} のイベント一覧`;
      groupData = groupDetails;
    } catch (e) {
      groupNameTitle.textContent = '不明なグループのイベント一覧';
    }
  } else {
    groupNameTitle.textContent = `${groupData.name} のイベント一覧`;
  }

  if (groupData) {
    state.setCurrentGroupId(groupData.id);
    backToDashboardFromEventListButton.dataset.groupId = groupData.id;
    state.loadParticipantState();

    if (state.currentUser) {
      backToDashboardFromEventListButton.textContent = '管理ダッシュボードに戻る';
      backToDashboardFromEventListButton.dataset.role = 'admin';
    } else {
      backToDashboardFromEventListButton.textContent = 'ダッシュボードに戻る';
      backToDashboardFromEventListButton.dataset.role = 'dashboard';
    }
    backToDashboardFromEventListButton.style.display = 'block';
  } else {
    backToDashboardFromEventListButton.style.display = 'none';
  }

  try {
    const events = isCustomUrl ? await api.getEventsByCustomUrl(customUrlOrGroupId) : await api.getPublicEventsForGroup(customUrlOrGroupId);

    groupEventListContainer.innerHTML = '';
    if (events.length === 0) {
      groupEventListContainer.innerHTML = '<li class="item-list-item">現在参加できるイベントはありません。</li>';
      return;
    }

    events.forEach((event) => {
      const li = document.createElement('li');
      li.className = 'item-list-item';
      const date = new Date((event.createdAt._seconds || event.createdAt.seconds) * 1000);
      const eventUrl = isCustomUrl ? `/g/${customUrlOrGroupId}/${event.id}` : `/events/${event.id}`;
      li.innerHTML = `
                <span><strong>${event.eventName || '無題のイベント'}</strong>（${date.toLocaleDateString()} 作成）</span>
                <a href="${eventUrl}" class="button">参加する</a>
            `;
      groupEventListContainer.appendChild(li);
    });
  } catch (error) {
    console.error(error);
    if (error.requiresPassword) {
      state.setLastFailedAction(() => initializeGroupEventListView(customUrlOrGroupId, groupData, isCustomUrl));
      ui.showGroupPasswordModal(error.groupId, error.groupName);
    } else {
      groupEventListContainer.innerHTML = `<li class="error-message">${error.error || error.message}</li>`;
    }
  }
}

export async function loadUserAndRedirect(lastUsedGroupId) {
  try {
    const groups = await api.getGroups();
    state.setAllUserGroups(groups);
    renderGroupList(groups);

    if (groups.length > 0) {
      let targetGroup = groups.find((g) => g.id === lastUsedGroupId) || groups[0];
      await navigateTo(`/admin/groups/${targetGroup.id}`);
    } else {
      ui.showView('groupDashboard');
    }
  } catch (error) {
    console.error(error);
    ui.showView('groupDashboard');
  }
}
