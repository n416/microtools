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
    ui.renderEventList(events, {});
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

async function initializeParticipantView(eventId, isShare, sharedParticipantName) {
  ui.showView('participantView'); // まず参加者ビューのコンテナを表示
  ui.hideParticipantSubViews(); // 全てのサブビューを一旦隠す

  try {
    const eventData = isShare
      ? await api.getPublicShareData(eventId) // シェアページ用のAPI
      : await api.getPublicEventData(eventId); // 通常の参加ページ用API

    state.setCurrentLotteryData(eventData);
    state.setCurrentGroupId(eventData.groupId);
    state.loadParticipantState(); // localStorageから参加者情報を読み込む

    if (ui.elements.participantEventName) ui.elements.participantEventName.textContent = eventData.eventName || 'あみだくじイベント';

    const backLink = document.getElementById('backToGroupEventListLink');
    if (backLink) {
      try {
        const groupData = await api.getGroup(eventData.groupId);
        if (groupData) {
          const backUrl = groupData.customUrl ? `/g/${groupData.customUrl}` : `/groups/${groupData.id}`;
          backLink.href = backUrl;
          backLink.textContent = `← ${groupData.name}のイベント一覧に戻る`;
          backLink.style.display = 'inline-block';
        } else {
          backLink.style.display = 'none';
        }
      } catch (groupError) {
        console.error('Failed to get group info for back link:', groupError);
        backLink.style.display = 'none';
      }
    }

    if (eventData.otherEvents) {
      ui.renderOtherEvents(eventData.otherEvents);
    }

    if (isShare) {
      await showResultsView(eventData, sharedParticipantName, true);
    } else if (state.currentParticipantToken) {
      // トークンがあるか？
      if (eventData.status === 'started') {
        await showResultsView(eventData, state.currentParticipantName, false);
      } else {
        ui.showControlPanelView(eventData);
      }
    } else {
      // トークンがなければ名前入力
      ui.showNameEntryView();
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

async function initializeGroupEventListView(customUrlOrGroupId, groupData) {
  const {groupEventListContainer, groupNameTitle} = ui.elements;
  if (!groupEventListContainer || !groupNameTitle) return;

  if (groupData) {
    groupNameTitle.textContent = `${groupData.name} のイベント一覧`;
  }

  try {
    const events = groupData && groupData.customUrl ? await api.getEventsByCustomUrl(customUrlOrGroupId) : await api.getPublicEventsForGroup(customUrlOrGroupId);

    groupEventListContainer.innerHTML = '';
    if (events.length === 0) {
      groupEventListContainer.innerHTML = '<li class="item-list-item">現在参加できるイベントはありません。</li>';
      return;
    }

    events.forEach((event) => {
      const li = document.createElement('li');
      li.className = 'item-list-item';
      const date = new Date((event.createdAt._seconds || event.createdAt.seconds) * 1000);

      const eventUrl = groupData && groupData.customUrl ? `/g/${groupData.customUrl}/${event.id}` : `/events/${event.id}`;

      li.innerHTML = `
                <span><strong>${event.eventName || '無題のイベント'}</strong>（${date.toLocaleDateString()} 作成）</span>
                <a href="${eventUrl}" class="button">このイベントに参加する</a>
            `;
      groupEventListContainer.appendChild(li);
    });
  } catch (error) {
    console.error(error);
    if (error.requiresPassword) {
      state.setLastFailedAction(() => initializeGroupEventListView(customUrlOrGroupId, groupData));
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
      const prizeName = typeof result.prize === 'object' ? result.prize.name : result.prize;
      if (ui.elements.myResult) ui.elements.myResult.innerHTML = `<b>${targetName}さんの結果は…「${prizeName}」でした！</b>`;
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

  // 最初に認証状態を確認
  const user = await api.checkGoogleAuthState().catch(() => null);
  state.setCurrentUser(user);
  ui.updateAuthUI(user);

  if (user) {
    const adminMatch = path.match(/\/admin/);
    const groupDashboardMatch = path.match(/^\/groups\/([a-zA-Z0-9]+)$/);
    const eventEditMatch = path.match(/^\/event\/([a-zA-Z0-9]+)\/edit$/);
    const eventBroadcastMatch = path.match(/^\/event\/([a-zA-Z0-9]+)\/broadcast$/);
    const newEventMatch = path.match(/^\/group\/([a-zA-Z0-9]+)\/event\/new$/);

    if (path === '/') {
      ui.showView('groupDashboard');
      const groups = await api.getGroups();
      state.setAllUserGroups(groups);
      ui.renderGroupList(groups);
      ui.updateGroupSwitcher();
      return;
    }
    if (groupDashboardMatch) {
      const groupId = groupDashboardMatch[1];
      await loadAndShowGroupEvents(groupId);
      await api.updateLastGroup(groupId);
      return;
    }
    if (eventEditMatch) {
      const eventId = eventEditMatch[1];
      await loadEventForEditing(eventId, 'eventEditView');
      return;
    }
    if (eventBroadcastMatch) {
      const eventId = eventBroadcastMatch[1];
      await loadAndShowBroadcast(eventId);
      return;
    }
    if (newEventMatch) {
      const groupId = newEventMatch[1];
      await loadAndShowEventForm(groupId);
      return;
    }
    if (adminMatch && user.role === 'system_admin' && !user.isImpersonating) {
      ui.showView('adminDashboard');
      return;
    }
  }

  // --- 公開ページのルーティング ---
  const groupEventListMatch = path.match(/^\/g\/(.+?)\/?$/) || path.match(/^\/groups\/([a-zA-Z0-9]+)\/?$/);
  const eventMatch = path.match(/^\/events\/([a-zA-Z0-9]+)/) || path.match(/^\/g\/.+?\/([a-zA-Z0-9]+)/);
  const shareMatch = path.match(/^\/share\/([a-zA-Z0-9]+)\/(.+)/);

  if (shareMatch) {
    const [, eventId, participantName] = shareMatch;
    await initializeParticipantView(eventId, true, decodeURIComponent(participantName));
  } else if (eventMatch) {
    const eventId = eventMatch[1] || eventMatch[2];
    await initializeParticipantView(eventId, false, null);
  } else if (groupEventListMatch) {
    // 公開イベント一覧の表示ロジック
    await initializeGroupEventListView(groupEventListMatch[1]);
  }

  ui.adjustBodyPadding();
}
