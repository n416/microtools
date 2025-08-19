// js/router.js
import * as api from './api.js';
import * as ui from './ui.js';
import * as state from './state.js';
import {startAnimation, stopAnimation, prepareStepAnimation} from './animation.js';

async function loadAndShowGroupEvents(groupId) {
  const groupData = await api.getGroup(groupId).catch(() => null);
  const groupName = groupData ? groupData.name : '不明なグループ';

  state.setCurrentGroupId(groupId);
  ui.showView('dashboardView');
  if (ui.elements.eventGroupName) ui.elements.eventGroupName.textContent = `グループ: ${groupName}`;

  try {
    const events = await api.getEventsForGroup(groupId);
    ui.renderEventList(events);
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

export async function loadEventForEditing(eventId, viewToShow = 'eventEditView') {
  if (!eventId) return;
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

    const parentGroup = state.allUserGroups.find((g) => g.id === data.groupId);
    const url = parentGroup && parentGroup.customUrl ? `${window.location.origin}/g/${parentGroup.customUrl}/${eventId}` : `/events/${eventId}`;

    if (ui.elements.currentEventUrl) {
      ui.elements.currentEventUrl.textContent = url;
      ui.elements.currentEventUrl.href = url;
    }
    if (ui.elements.eventIdInput) ui.elements.eventIdInput.value = eventId;

    if (viewToShow === 'eventEditView') {
      ui.elements.eventNameInput.value = data.eventName || '';
      state.setPrizes(data.prizes || []);
      ui.elements.participantCountInput.value = data.participantCount;
      ui.elements.displayModeSelect.value = data.displayMode;
      ui.elements.createEventButton.textContent = 'この内容でイベントを保存';
      ui.renderPrizeList();
    } else if (viewToShow === 'broadcastView') {
      if (data.status === 'pending') {
        if (ui.elements.adminControls) ui.elements.adminControls.style.display = 'block';
        if (ui.elements.startEventButton) ui.elements.startEventButton.style.display = 'inline-block';
        if (ui.elements.broadcastControls) ui.elements.broadcastControls.style.display = 'none';
        if (ui.elements.adminCanvas) ui.elements.adminCanvas.style.display = 'none';
      } else if (data.status === 'started') {
        if (ui.elements.adminControls) ui.elements.adminControls.style.display = 'none';
        if (ui.elements.broadcastControls) ui.elements.broadcastControls.style.display = 'flex';
        if (ui.elements.adminCanvas) ui.elements.adminCanvas.style.display = 'block';

        const allParticipants = data.participants.filter((p) => p.name);
        if (ui.elements.highlightUserSelect) {
          ui.elements.highlightUserSelect.innerHTML = allParticipants.map((p) => `<option value="${p.name}">${p.name}</option>`).join('');
        }

        const ctx = ui.elements.adminCanvas.getContext('2d');
        await prepareStepAnimation(ctx);
      }
    }
  } catch (error) {
    alert(error.error || 'イベントの読み込みに失敗しました。');
  }
}

async function loadAndShowBroadcast(eventId) {
  await loadEventForEditing(eventId, 'broadcastView');
}

async function loadAndShowEventForm(groupId) {
  state.setCurrentGroupId(groupId);
  ui.resetEventCreationForm();
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
    // ログイン後にダッシュボードのURLへ遷移させる
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
          ui.showControlPanelView({participants: [], status: 'pending'});
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
    navigateTo(window.location.pathname, false);
  } catch (error) {
    if (error.requiresPassword) {
      const password = prompt(`「${error.name}」さんの合言葉を入力してください:`);
      if (password) {
        await verifyAndLogin(eventId, error.memberId, password);
      } else {
        await handlePasswordError(error.memberId, state.currentGroupId);
      }
    } else {
      alert(error.error);
    }
  }
}

export async function verifyAndLogin(eventId, memberId, password, slot = null) {
  try {
    const result = await api.verifyPasswordAndJoin(eventId, memberId, password, slot);
    state.saveParticipantState(result.token, result.memberId, result.name);
    if (slot !== null) {
      ui.showWaitingView();
    } else {
      navigateTo(window.location.pathname, false);
    }
  } catch (error) {
    alert(error.error);
    await handlePasswordError(memberId, state.currentGroupId);
  }
}

async function initializeParticipantView(eventId, isShare, sharedParticipantName) {
  state.setCurrentEventId(eventId);
  ui.showView('participantView');
  ui.hideParticipantSubViews();

  try {
    const eventData = isShare ? await api.getPublicShareData(eventId) : await api.getPublicEventData(eventId);

    state.setCurrentLotteryData(eventData);
    state.setCurrentGroupId(eventData.groupId);
    state.loadParticipantState();

    if (ui.elements.participantEventName) ui.elements.participantEventName.textContent = eventData.eventName || 'あみだくじイベント';

    if (ui.elements.backToGroupEventListLink) {
      try {
        const groupData = await api.getGroup(eventData.groupId);
        if (groupData) {
          // ▼▼▼▼▼ ここからが今回の修正箇所です ▼▼▼▼▼
          if (state.currentParticipantId && groupData.customUrl) {
            // 参加者としてログインしている場合はダッシュボードへ
            ui.elements.backToGroupEventListLink.href = `/g/${groupData.customUrl}/dashboard`;
            ui.elements.backToGroupEventListLink.textContent = `← ${groupData.name}のダッシュボードに戻る`;
          } else {
            // ログインしていない場合は通常のイベント一覧へ
            const backUrl = groupData.customUrl ? `/g/${groupData.customUrl}` : `/groups/${groupData.id}`;
            ui.elements.backToGroupEventListLink.href = backUrl;
            ui.elements.backToGroupEventListLink.textContent = `← ${groupData.name}のイベント一覧に戻る`;
          }
          // ▲▲▲▲▲ 修正はここまで ▲▲▲▲▲
          ui.elements.backToGroupEventListLink.style.display = 'inline-block';
        } else {
          ui.elements.backToGroupEventListLink.style.display = 'none';
        }
      } catch (groupError) {
        console.error('Failed to get group info for back link:', groupError);
        ui.elements.backToGroupEventListLink.style.display = 'none';
      }
    }

    if (eventData.otherEvents) {
      ui.renderOtherEvents(eventData.otherEvents, state.currentLotteryData.groupCustomUrl);
    }

    if (isShare) {
      await showResultsView(eventData, sharedParticipantName, true);
    } else if (state.currentParticipantToken && state.currentParticipantId) {
      if (eventData.status === 'started') {
        await showResultsView(eventData, state.currentParticipantName, false);
      } else {
        const myParticipation = eventData.participants.find((p) => p.memberId === state.currentParticipantId);
        if (myParticipation && myParticipation.name) {
          ui.showWaitingView();
        } else {
          ui.showJoinView(eventData);
        }
      }
    } else {
      ui.showNameEntryView((name) => handleLoginOrRegister(eventId, name));
    }
  } catch (error) {
    console.error('Error in initializeParticipantView:', error);
    if (error.requiresPassword) {
      state.setLastFailedAction(() => initializeParticipantView(eventId, isShare, sharedParticipantName));
      ui.showGroupPasswordModal(error.groupId, error.groupName);
    } else {
      if (ui.elements.participantView) ui.elements.participantView.innerHTML = `<div class="view-container"><p class="error-message">${error.error || error.message}</p></div>`;
    }
  }
}

async function initializeParticipantDashboardView(customUrlOrGroupId, isCustomUrl = true) {
  try {
    const groupData = isCustomUrl ? await api.getGroupByCustomUrl(customUrlOrGroupId) : await api.getGroup(customUrlOrGroupId);
    const events = await api.getPublicEventsForGroup(groupData.id);

    state.setCurrentGroupId(groupData.id);
    state.loadParticipantState();

    ui.showUserDashboardView(groupData, events);
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
async function showResultsView(eventData, targetName, isShareView) {
  ui.showResultsView();
  const onAnimationComplete = () => {
    const result = eventData.results ? eventData.results[targetName] : null;
    if (result) {
      const prize = result.prize;
      const prizeName = typeof prize === 'object' ? prize.name : prize;
      const prizeImageUrl = typeof prize === 'object' ? prize.imageUrl : null;

      let resultHtml = `<b>${targetName}さんの結果は…「${prizeName}」でした！</b>`;
      if (prizeImageUrl) {
        resultHtml = `<img src="${prizeImageUrl}" alt="${prizeName}" class="result-prize-image large"><br>` + resultHtml;
      }

      if (ui.elements.myResult) ui.elements.myResult.innerHTML = resultHtml;
    } else {
      if (ui.elements.myResult) ui.elements.myResult.textContent = 'まだ結果は発表されていません。';
    }
    if (!isShareView) {
      if (ui.elements.shareButton) ui.elements.shareButton.style.display = 'block';
      if (ui.elements.backToControlPanelFromResultButton) ui.elements.backToControlPanelFromResultButton.style.display = 'block';
    }
    if (eventData.results) {
      ui.renderAllResults(eventData.results);
    }
  };
  if (ui.elements.myResult) ui.elements.myResult.innerHTML = `<b>${targetName}さんの結果をアニメーションで確認中...</b>`;
  const ctxParticipant = ui.elements.participantCanvas ? ui.elements.participantCanvas.getContext('2d') : null;
  await startAnimation(ctxParticipant, [targetName], onAnimationComplete);
}

export async function handleRouting(initialData) {
  stopAnimation();
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
      ui.renderGroupList(groups);
      ui.updateGroupSwitcher();
      return;
    }

    if (adminGroupDashboardMatch) {
      const groupId = adminGroupDashboardMatch[1];
      await loadAndShowGroupEvents(groupId);
      await api.updateLastGroup(groupId);
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
    ui.showView(null);
  }

  ui.adjustBodyPadding();
}
