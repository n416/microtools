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
    // ログイン/登録APIを呼び出す
    const result = await api.loginOrRegisterToGroup(groupId, name);
    state.saveParticipantState(result.token, result.memberId, result.name);
    // 成功したら現在のビューを再読み込みして表示を更新
    await handleRouting();
  } catch (error) {
    if (error.requiresPassword) {
      // 合言葉が必要な場合
      const password = prompt(`「${error.name}」さんの合言葉を入力してください:`);
      if (password) {
        try {
          // 合言葉を検証
          const result = await api.loginMemberToGroup(groupId, error.memberId, password);
          state.saveParticipantState(result.token, result.memberId, result.name);
          await handleRouting();
        } catch (loginError) {
          // 合言葉が違う場合
          alert(loginError.error || '合言葉が違います。');
          await handlePasswordError(error.memberId, groupId);
        }
      }
    } else {
      // その他のエラー
      alert(error.error || '処理に失敗しました。');
    }
  }
}

export async function handleLoginOrRegister(eventId, name, memberId = null) {
  if (!name || !eventId) return;
  try {
    const result = await api.joinEvent(eventId, name, memberId);
    state.saveParticipantState(result.token, result.memberId, result.name);
    await handleRouting();
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
      await handleRouting();
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
    } else if (state.currentParticipantToken && state.currentParticipantId) {
      if (eventData.status === 'started') {
        await showResultsView(eventData, state.currentParticipantName, false);
      } else {
        ui.showControlPanelView(eventData);
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

export async function initializeGroupDashboardView(groupId) {
  try {
    // Get group data and public events in parallel
    const [groupData, events] = await Promise.all([api.getGroup(groupId), api.getPublicEventsForGroup(groupId)]);

    // Use the ui function to configure and show the participantView as a dashboard
    ui.showUserDashboardView(groupData, events);
  } catch (error) {
    console.error('Failed to initialize group dashboard view:', error);
    if (error.requiresPassword) {
      // If password is required, show modal and set this function to be retried
      state.setLastFailedAction(() => initializeGroupDashboardView(groupId));
      ui.showGroupPasswordModal(error.groupId, error.groupName);
    } else {
      // Show a generic error for other issues
      alert(error.error || 'ダッシュボードの表示に失敗しました。');
    }
  }
}

async function initializeGroupEventListView(customUrlOrGroupId, groupData, isCustomUrl) {
  const {groupEventListContainer, groupNameTitle, backToDashboardFromEventListButton} = ui.elements;
  if (!groupEventListContainer || !groupNameTitle || !backToDashboardFromEventListButton) return;

  ui.showView('groupEventListView');

  // groupDataがなくても、APIから取得してタイトルを設定する
  if (!groupData) {
    try {
      const groupDetails = await api.getGroup(customUrlOrGroupId);
      groupNameTitle.textContent = `${groupDetails.name} のイベント一覧`;
      groupData = groupDetails; // 後続の処理で使えるように格納
    } catch (e) {
      // グループが見つからない場合
      groupNameTitle.textContent = '不明なグループのイベント一覧';
    }
  } else {
    groupNameTitle.textContent = `${groupData.name} のイベント一覧`;
  }

  if (groupData) {
    state.setCurrentGroupId(groupData.id); // Set group context
    backToDashboardFromEventListButton.dataset.groupId = groupData.id;
    state.loadParticipantState(); // Check participation status for this group

    if (state.currentUser) {
      // State A: Admin is logged in
      backToDashboardFromEventListButton.textContent = '管理ダッシュボードに戻る';
      backToDashboardFromEventListButton.dataset.role = 'admin';
    } else {
      // State B & C: General Participant or Not Logged In
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

      // isCustomUrlフラグとgroupDataの有無でURLを正しく構築する
      const eventUrl = isCustomUrl ? `/g/${customUrlOrGroupId}/${event.id}` : `/events/${event.id}`;

      li.innerHTML = `
                <span><strong>${event.eventName || '無題のイベント'}</strong>（${date.toLocaleDateString()} 作成）</span>
                <a href="${eventUrl}" class="button">このイベントに参加する</a>
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

  // 1. 最初に認証状態を取得
  const user = await api.checkGoogleAuthState().catch(() => null);
  state.setCurrentUser(user);

  // 2. ヘッダーを表示すべきでない公開ページ（かつ非ログイン時）のルートを定義
  const publicRoutesToHideHeader = ['/g/', '/share/', '/events/'];
  // /groups/ はログイン状態によって挙動が変わるため、ここには含めない
  const isPublicPage = publicRoutesToHideHeader.some((route) => path.startsWith(route));

  // 3. ログイン状態とURLに基づいてヘッダーの表示を決定
  if (!user && (isPublicPage || path.startsWith('/groups/'))) {
    // 未ログインで、かつヘッダーを隠すべき公開ページの場合
    ui.setMainHeaderVisibility(false);
  } else {
    // 上記以外（ログインしている全ページ、または未ログインのトップページなど）
    ui.setMainHeaderVisibility(true);
    ui.updateAuthUI(user);
  }

  // 4. 表示するビューを決定
  if (user) {
    // --- ログイン済み管理者 のルーティング ---
    const adminMatch = path.match(/\/admin/);
    // ▼▼▼ この正規表現のマッチングを新しく1行追加 ▼▼▼
    const adminGroupDashboardMatch = path.match(/^\/admin\/groups\/([a-zA-Z0-9]+)$/);

    const groupDashboardMatch = path.match(/^\/groups\/([a-zA-Z0-9]+)$/); // ユーザー向けなので変更しない
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

    // ▼▼▼ このifブロックを、既存の groupDashboardMatch の前に追加 ▼▼▼
    if (adminGroupDashboardMatch) {
      const groupId = adminGroupDashboardMatch[1];
      await loadAndShowGroupEvents(groupId); // 既存の管理者向けダッシュボード表示関数を再利用
      await api.updateLastGroup(groupId);
      return;
    }

    if (groupDashboardMatch) {
      // このルートは今後ユーザー専用となるため、処理は変更しない
      const groupId = groupDashboardMatch[1];
      await initializeGroupEventListView(groupId, initialData ? initialData.group : null, false);
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
      return 'loadAdminDashboard';
    }
  }

  // ▼▼▼ このifブロックを新しく追加 ▼▼▼
  if (path === '/admin/dashboard') {
    ui.showView('adminDashboard');
    await loadAdminDashboard(); // 既存の管理者ダッシュボード表示関数を呼び出す
    return; // 必ずreturnで処理を終了させる
  }

  // --- 公開ページのルーティング ---
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
    await initializeGroupEventListView(customUrlMatch[1], initialData ? initialData.group : null, true);
    return;
  }

  const groupIdMatch = path.match(/^\/groups\/([a-zA-Z0-9]+)\/?$/);
  if (groupIdMatch) {
    // このルートはログイン状態によって処理が分岐済みのため、ここでは未ログインの場合のみ到達する
    await initializeGroupEventListView(groupIdMatch[1], initialData ? initialData.group : null, false);
    return;
  }

  // --- フォールバック ---
  if (user && path !== '/') {
    ui.showView('groupDashboard');
  } else if (!user && path === '/') {
    // 未ログインでトップページの場合は、ログインボタンのあるヘッダーだけ表示
    ui.showView(null);
  }

  ui.adjustBodyPadding();
}
