import * as api from '../api.js';
import * as state from '../state.js';
import * as router from '../router.js';
import { startAnimation, isAnimationRunning, showAllTracersInstantly, prepareStepAnimation } from '../animation.js';
import { drawDoodlePreview, drawDoodleHoverPreview } from '../animation/drawing.js';
import { getVirtualWidth, getNameAreaHeight, calculatePrizeAreaHeight, getTargetHeight } from '../animation/path.js';
import { participantPanzoom } from '../animation/setup.js';
import * as ui from '../ui.js';
import { clientEmojiToLucide } from '../ui.js';
import { addFirestoreListener } from '../state.js';
import { processImage } from '../imageProcessor.js';

let processedProfileIconFile = null;

const handleInvalidTokenError = (error) => {
  if (error.errorCode === 'INVALID_TOKEN') {
    alert(error.error || '認証情報が無効です。参加状態をリセットしてやり直します。');
    state.clearParticipantState();
    window.location.reload();
    return true;
  }
  return false;
};

const handleOpenProfileModal = async () => {
  if (!state.currentGroupId || !state.currentParticipantId || !state.currentParticipantToken) {
    alert('プロフィールの表示には、再度ログインが必要です。');
    state.clearParticipantState();
    window.location.reload();
    return;
  }
  try {
    const memberData = await api.getMemberDetails(state.currentGroupId, state.currentParticipantId);
    processedProfileIconFile = null;
    ui.openProfileEditModal(memberData, {
      onSave: async () => {
        ui.elements.saveProfileButton.disabled = true;
        try {
          let newIconUrl = null;
          if (processedProfileIconFile) {
            const { signedUrl, iconUrl } = await api.generateUploadUrl(state.currentParticipantId, processedProfileIconFile.type, state.currentGroupId, state.currentParticipantToken);
            await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': processedProfileIconFile.type }, body: processedProfileIconFile });
            newIconUrl = iconUrl;
          }
          const profileData = { color: ui.elements.profileColorInput.value };
          if (newIconUrl) profileData.iconUrl = newIconUrl;
          await api.updateProfile(state.currentParticipantId, profileData, state.currentGroupId, state.currentParticipantToken);
          alert('プロフィールを保存しました。');
          ui.closeProfileEditModal();
        } catch (error) {
          if (!handleInvalidTokenError(error)) {
            alert(error.error);
          }
        } finally {
          ui.elements.saveProfileButton.disabled = false;
        }
      },
    });
  } catch (error) {
    if (!handleInvalidTokenError(error)) {
      alert(error.error);
    }
  }
};

const elements = {
  participantView: document.getElementById('participantView'),
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
  resultSection: document.getElementById('resultSection'),
  participantCanvas: document.getElementById('participantCanvas'),
  myResult: document.getElementById('myResult'),
  allResultsContainer: document.getElementById('allResultsContainer'),
  shareButton: document.getElementById('shareButton'),
  backToControlPanelFromResultButton: document.getElementById('backToControlPanelFromResultButton'),
  acknowledgeButton: document.getElementById('acknowledgeButton'),
  showAcknowledgedEventsCheckbox: document.getElementById('showAcknowledgedEvents'),
  staticAmidaView: document.getElementById('staticAmidaView'),
  deleteParticipantWaitingButton: document.getElementById('deleteParticipantWaitingButton'),
  backToDashboardFromWaitingButton: document.getElementById('backToDashboardFromWaitingButton'),
};

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
    } else if (p.memberId) {
      slotEl.classList.add('taken');
      slotEl.textContent = '参加済み';
    } else {
      slotEl.classList.add('available');
      slotEl.textContent = `参加枠 ${p.slot + 1}`;
    }
    elements.slotList.appendChild(slotEl);
  });
}

export function renderPrizesForParticipant(prizes) {
  if (!elements.prizeDisplay) return;
  elements.prizeDisplay.innerHTML = '<h3>景品一覧</h3>';
  const ul = document.createElement('ul');
  prizes.forEach((prize) => {
    const li = document.createElement('li');
    if (prize.count) {
      li.textContent = `${prize.name}: ${prize.count}個`;
    } else {
      li.textContent = prize.name;
    }
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
      imageHtml = `<img src="${prizeImageUrl}" alt="${prizeName}" class="result-prize-image large">`;
    }

    html += `<li class="item-list-item ${isHighlighted}">${imageHtml}<span>${name} → ${prizeName}</span></li>`;
  }
  html += '</ul>';
  elements.allResultsContainer.innerHTML = html;
}

export function hideParticipantSubViews(keepMainViewVisible = false) {
  if (!keepMainViewVisible && elements.participantView) elements.participantView.style.display = 'none';
  if (elements.nameEntrySection) elements.nameEntrySection.style.display = 'none';
  if (elements.participantControlPanel) elements.participantControlPanel.style.display = 'none';
  if (elements.joinSection) elements.joinSection.style.display = 'none';
  if (elements.resultSection) {
    elements.resultSection.style.display = 'none';
    if (elements.myResult) elements.myResult.innerHTML = '';
    if (elements.allResultsContainer) elements.allResultsContainer.innerHTML = '';
  }
  if (elements.staticAmidaView) elements.staticAmidaView.style.display = 'none';
  if (elements.otherEventsSection) elements.otherEventsSection.style.display = 'none';
}

export function showNameEntryView() {
  hideParticipantSubViews(true);
  if (elements.nameEntrySection) elements.nameEntrySection.style.display = 'block';
  if (elements.nameInput) elements.nameInput.value = '';
  if (elements.suggestionList) elements.suggestionList.innerHTML = '';
}

export function showControlPanelView(eventData) {
  hideParticipantSubViews(true);
  if (elements.participantControlPanel) elements.participantControlPanel.style.display = 'block';
  if (elements.welcomeName) elements.welcomeName.textContent = state.currentParticipantName;
}

export function showJoinView(eventData) {
  hideParticipantSubViews(true);
  if (elements.joinSection) elements.joinSection.style.display = 'block';
  renderSlots(eventData.participants);
  renderPrizesForParticipant(eventData.prizeSummary || eventData.prizes);
}

export async function showStaticAmidaView() {
  hideParticipantSubViews(true);
  if (ui.elements.staticAmidaView) ui.elements.staticAmidaView.style.display = 'block';

  const doodleControls = document.getElementById('doodleControls');
  if (doodleControls) {
    const eventData = state.currentLotteryData;
    if (eventData && eventData.allowDoodleMode) {
      doodleControls.style.display = 'block';
    } else {
      doodleControls.style.display = 'none';
    }
  }

  const ctx = ui.elements.participantCanvasStatic.getContext('2d');
  const storedState = participantPanzoom ? { pan: participantPanzoom.getPan(), scale: participantPanzoom.getScale() } : null;
  await prepareStepAnimation(ctx, true, false, false, storedState);

  if (state.hoverDoodle) {
    drawDoodleHoverPreview(ctx, state.hoverDoodle);
  }
  if (state.previewDoodle) {
    drawDoodlePreview(ctx, state.previewDoodle);
  }
}

export function showResultsView(eventData, targetName, isShareView) {
  hideParticipantSubViews(true);
  if (elements.resultSection) elements.resultSection.style.display = 'block';
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

      if (elements.myResult) elements.myResult.innerHTML = resultHtml;
    } else {
      if (elements.myResult) elements.myResult.innerHTML = '<b>全結果を表示します</b>';
    }
    const isParticipant = !!(state.currentParticipantId && eventData.participants.some((p) => p.memberId === state.currentParticipantId));

    if (!isShareView) {
      if (elements.shareButton) {
        elements.shareButton.style.display = isParticipant ? 'inline-flex' : 'none';
      }
      if (elements.backToControlPanelFromResultButton) {
        elements.backToControlPanelFromResultButton.style.display = 'block';
      }
    }
    if (eventData.results) {
      renderAllResults(eventData.results, isShareView, state.currentParticipantName);
    }
  };
  if (elements.myResult) elements.myResult.innerHTML = `<b>${targetName ? targetName + 'さんの結果をアニメーションで確認中...' : '結果を読み込んでいます...'}</b>`;
  const ctxParticipant = elements.participantCanvas ? elements.participantCanvas.getContext('2d') : null;

  startAnimation(ctxParticipant, targetName ? [targetName] : null, onAnimationComplete, targetName);
}

export function showUserDashboardView(groupData, events) {
  ui.showView('participantView');
  hideParticipantSubViews(true);
  elements.backToGroupEventListLink.style.display = 'none';

  if (elements.participantEventName) {
    elements.participantEventName.textContent = `${groupData.name} のダッシュボード`;
  }

  state.loadParticipantState();
  ui.updateParticipantHeader({ name: state.currentParticipantName });

  if (state.currentParticipantId && state.currentParticipantToken) {
    showControlPanelView({ participants: [], status: 'pending' });
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
        const isFull = event.participants.every((p) => p.name !== null);
        if (isFull) {
          badge = '<span class="badge full">満員御礼</span>';
        } else {
          badge = '<span class="badge ongoing">開催中</span>';
        }
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

export async function initializeParticipantView(eventId, isShare, sharedParticipantName) {
  state.setCurrentEventId(eventId);

  ui.showView('participantView');
  hideParticipantSubViews(true);

  try {
    let eventData = isShare ? await api.getPublicShareData(eventId, sharedParticipantName) : await api.getPublicEventData(eventId);

    state.setCurrentGroupId(eventData.groupId);
    state.loadParticipantState();

    ui.updateParticipantHeader({ name: state.currentParticipantName });

    if (!isShare && state.currentParticipantId) {
      eventData = await api.getPublicEventData(eventId);
    }

    state.setCurrentLotteryData(eventData);

    if (!isShare) {
      const eventRef = firebase.firestore().collection('events').doc(eventId);

      const unsubscribe = eventRef.onSnapshot(
        async (doc) => {
          if (!doc.exists) {
            return;
          }
          const updatedData = doc.data();

          if (updatedData.status === 'started' && state.currentLotteryData.status === 'pending') {
            ui.showToast('イベントが開始されました！結果発表です！', 3000);
            state.setCurrentLotteryData(updatedData);
            await showResultsView(updatedData, state.currentParticipantName, false);
            return;
          }

          let remoteTimestampMs = 0;
          if (updatedData.lastModifiedAt) {
            if (typeof updatedData.lastModifiedAt.toMillis === 'function') {
              remoteTimestampMs = updatedData.lastModifiedAt.toMillis();
            } else if (updatedData.lastModifiedAt._seconds !== undefined) {
              remoteTimestampMs = new Date(updatedData.lastModifiedAt._seconds * 1000).getTime();
            } else {
              remoteTimestampMs = new Date(updatedData.lastModifiedAt).getTime();
            }
          }

          let localTimestampMs = 0;
          const localLastModified = state.currentLotteryData?.lastModifiedAt;

          if (localLastModified) {
            if (typeof localLastModified.toMillis === 'function') {
              localTimestampMs = localLastModified.toMillis();
            } else if (localLastModified._seconds !== undefined) {
              localTimestampMs = new Date(localLastModified._seconds * 1000).getTime();
            } else {
              localTimestampMs = new Date(localLastModified).getTime();
            }
          }

          if (localTimestampMs > 0 && remoteTimestampMs > localTimestampMs) {
            ui.showToast('管理者がイベントを更新しました。画面を再読み込みします。', 4000);

            unsubscribe();

            setTimeout(() => {
              initializeParticipantView(state.currentEventId, false, null);
            }, 3000);
            return;
          }

          state.currentLotteryData.lastModifiedAt = updatedData.lastModifiedAt;

          if (updatedData.doodles && JSON.stringify(state.currentLotteryData.doodles) !== JSON.stringify(updatedData.doodles)) {
            state.currentLotteryData.doodles = updatedData.doodles || [];

            const staticCanvas = document.getElementById('participantCanvasStatic');
            if (staticCanvas && staticCanvas.offsetParent !== null) {
              const ctx = staticCanvas.getContext('2d');
              const storedState = participantPanzoom ? { pan: participantPanzoom.getPan(), scale: participantPanzoom.getScale() } : null;
              await prepareStepAnimation(ctx, true, false, false, storedState);
            }
          }
        },
        (error) => {
          console.error('Firestore onSnapshot listener failed:', error);
        }
      );
      addFirestoreListener(unsubscribe);
    }

    if (ui.elements.participantEventName) ui.elements.participantEventName.textContent = eventData.eventName || 'あみだくじイベント';

    if (ui.elements.backToGroupEventListLink) {
      if (isShare) {
        ui.elements.backToGroupEventListLink.style.display = 'none';
      } else {
        try {
          const groupData = await api.getGroup(eventData.groupId);
          if (groupData) {
            if (state.currentParticipantId && groupData.customUrl) {
              ui.elements.backToGroupEventListLink.href = `/g/${groupData.customUrl}/dashboard`;
              ui.elements.backToGroupEventListLink.textContent = `← ${groupData.name}のダッシュボードに戻る`;
            } else {
              const backUrl = groupData.customUrl ? `/g/${groupData.customUrl}` : `/groups/${groupData.id}`;
              ui.elements.backToGroupEventListLink.href = backUrl;
              ui.elements.backToGroupEventListLink.textContent = `← ${groupData.name}のイベント一覧に戻る`;
            }
            ui.elements.backToGroupEventListLink.style.display = 'inline-block';
          } else {
            ui.elements.backToGroupEventListLink.style.display = 'none';
          }
        } catch (groupError) {
          console.error('Failed to get group info for back link:', groupError);
          ui.elements.backToGroupEventListLink.style.display = 'none';
        }
      }
    }

    if (isShare) {
      if (eventData.status === 'started') {
        await showResultsView(eventData, sharedParticipantName, true);
      } else {
        await showStaticAmidaView();
      }
    } else if (eventData.status === 'started') {
      await showResultsView(eventData, state.currentParticipantName, false);
    } else {
      if (!state.currentParticipantId) {
        showNameEntryView();
      } else {
        const myParticipation = eventData.participants.find((p) => p.memberId === state.currentParticipantId);
        if (myParticipation && myParticipation.name) {
          await showStaticAmidaView();
        } else {
          showJoinView(eventData);
        }
      }
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

export function initParticipantView() {
  // ▼▼▼ 修正: backToDashboardHandler を関数の先頭に移動 ▼▼▼
  const backToDashboardHandler = async () => {
    try {
      const group = await api.getGroup(state.currentGroupId);
      if (group) {
        const url = group.customUrl ? `/g/${group.customUrl}/dashboard` : `/groups/${group.id}/dashboard`;
        await router.navigateTo(url);
      } else {
        await router.navigateTo('/');
      }
    } catch (error) {
      console.error('Failed to get group info for navigation:', error);
      await router.navigateTo('/');
    }
  };

  if (ui.elements.participantLoginButton) {
    ui.elements.participantLoginButton.addEventListener('click', () => {
      showNameEntryView();
    });
  }

  if (ui.elements.participantDashboardButtonLoggedOut) {
    ui.elements.participantDashboardButtonLoggedOut.addEventListener('click', backToDashboardHandler);
  }

  if (ui.elements.participantDashboardButton) {
    ui.elements.participantDashboardButton.addEventListener('click', backToDashboardHandler);
  }

  if (ui.elements.headerParticipantLogoutButton) {
    ui.elements.headerParticipantLogoutButton.addEventListener('click', async () => {
      if (state.currentGroupId) {
        try {
          await api.clearGroupVerification();
        } catch (error) {
          console.error('Failed to clear group verification session:', error);
        } finally {
          state.clearParticipantState();
          window.location.reload();
        }
      }
    });
  }

  if (ui.elements.participantProfileButton) {
    ui.elements.participantProfileButton.addEventListener('click', handleOpenProfileModal);
  }

  const staticCanvas = document.getElementById('participantCanvasStatic');
  if (staticCanvas) {
    const redrawCanvas = async () => {
      const storedState = participantPanzoom ? { pan: participantPanzoom.getPan(), scale: participantPanzoom.getScale() } : null;
      const ctx = staticCanvas.getContext('2d');
      await prepareStepAnimation(ctx, true, false, false, storedState);
      if (state.hoverDoodle) {
        drawDoodleHoverPreview(ctx, state.hoverDoodle);
      }
      if (state.previewDoodle) {
        drawDoodlePreview(ctx, state.previewDoodle);
      }
    };

    const getDoodleDataFromEvent = (e) => {
      const canvas = e.target;
      const rect = canvas.getBoundingClientRect();
      const pan = participantPanzoom.getPan();
      const scale = participantPanzoom.getScale();

      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    // ▼▼▼ ここからが今回の修正点です ▼▼▼
      // パンによるオフセットは rect.left と rect.top に既に含まれているため、
      // pan.x と pan.y を引く処理を削除します。
      const x = (clientX - rect.left) / scale;
      const y = (clientY - rect.top) / scale;
      // ▲▲▲ ここまでが修正点です ▲▲▲


      const { participants, prizes } = state.currentLotteryData;
      const numParticipants = participants.length;
      const container = canvas.closest('.canvas-panzoom-container');
      const VIRTUAL_WIDTH = getVirtualWidth(numParticipants, container.clientWidth);
      const participantSpacing = VIRTUAL_WIDTH / (numParticipants + 1);
      const nameAreaHeight = getNameAreaHeight(container);
      const prizeAreaHeight = calculatePrizeAreaHeight(prizes);
      const lineTopY = nameAreaHeight;
      const lineBottomY = getTargetHeight(container) - prizeAreaHeight;
      const amidaDrawableHeight = lineBottomY - lineTopY;
      const topMargin = 70;
      const bottomMargin = 330;
      const sourceLineRange = bottomMargin - topMargin;

      if (y < lineTopY || y > lineBottomY) {
        return null;
      }

      let fromIndex = -1;
      for (let i = 0; i < numParticipants - 1; i++) {
        const startX = participantSpacing * (i + 1);
        const endX = participantSpacing * (i + 2);
        if (x > startX && x < endX) {
          fromIndex = i;
          break;
        }
      }

      if (fromIndex === -1) {
        return null;
      }

      const relativeY = y - lineTopY;
      const originalY = (relativeY / amidaDrawableHeight) * sourceLineRange + topMargin;
      return { fromIndex, toIndex: fromIndex + 1, y: originalY };
    };

    const handlePointerMove = (e) => {
      if (!state.currentLotteryData || !state.currentLotteryData.allowDoodleMode || state.doodleTool !== 'draw') {
        return;
      }
      const doodleData = getDoodleDataFromEvent(e);
      if (doodleData) {
        state.setHoverDoodle(doodleData);
      } else {
        if (state.hoverDoodle) {
          state.setHoverDoodle(null);
        }
      }
      redrawCanvas();
    };

    const handlePointerDown = async (e) => {
      if (!state.currentLotteryData || !state.currentLotteryData.allowDoodleMode) {
        return;
      }
      if (state.doodleTool === 'draw') {
        const doodleData = getDoodleDataFromEvent(e);
        if (!doodleData) return;
        state.setPreviewDoodle(doodleData);
      }
    };

    staticCanvas.addEventListener('mousemove', handlePointerMove);
    staticCanvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      handlePointerMove(e);
    });
    staticCanvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      handlePointerDown(e);
      staticCanvas.dispatchEvent(
        new MouseEvent('click', {
          clientX: e.touches[0].clientX,
          clientY: e.touches[0].clientY,
        })
      );
    });

    staticCanvas.addEventListener('mouseleave', () => {
      if (state.hoverDoodle) {
        state.setHoverDoodle(null);
        redrawCanvas();
      }
    });
    staticCanvas.addEventListener('click', async (e) => {
      if (!state.currentLotteryData || !state.currentLotteryData.allowDoodleMode) {
        return;
      }
      const doodleControls = document.getElementById('doodleControls');
      const setControlsDisabled = (disabled) => {
        if (doodleControls) {
          doodleControls.querySelectorAll('button').forEach((btn) => (btn.disabled = disabled));
        }
      };
      if (state.doodleTool === 'draw') {
        const doodleData = state.hoverDoodle || getDoodleDataFromEvent(e);
        if (!doodleData) return;
        state.setPreviewDoodle(doodleData);
        setControlsDisabled(true);
        try {
          await api.addDoodle(state.currentEventId, state.currentParticipantId, doodleData);
          state.currentLotteryData.doodles = state.currentLotteryData.doodles.filter((d) => d.memberId !== state.currentParticipantId);
          state.currentLotteryData.doodles.push({ ...doodleData, memberId: state.currentParticipantId });
          state.setPreviewDoodle(null);
        } catch (error) {
          if (!handleInvalidTokenError(error)) {
            if (error.error === '他の線に近すぎるため、線を引けません。') {
              ui.showToast(error.error);
            } else {
              alert(error.error || '線の追加に失敗しました。');
            }
          }
          state.setPreviewDoodle(null);
        } finally {
          setControlsDisabled(false);
          redrawCanvas();
        }
      } else if (state.doodleTool === 'erase') {
        const myDoodle = state.currentLotteryData.doodles.find((d) => d.memberId === state.currentParticipantId);
        if (!myDoodle && !state.previewDoodle) return;
        setControlsDisabled(true);
        try {
          if (myDoodle) {
            await api.deleteDoodle(state.currentEventId, state.currentParticipantId);
          }
          state.setPreviewDoodle(null);
          state.currentLotteryData.doodles = state.currentLotteryData.doodles.filter((d) => d.memberId !== state.currentParticipantId);
        } catch (error) {
          if (!handleInvalidTokenError(error)) {
            ui.showToast(error.error || '線の削除に失敗しました。');
          }
        } finally {
          setControlsDisabled(false);
          redrawCanvas();
        }
      }
    });
    const doodleModePanBtn = document.getElementById('doodleModePan');
    const doodleModeDrawBtn = document.getElementById('doodleModeDraw');
    const doodleModeEraseBtn = document.getElementById('doodleModeErase');
    if (doodleModePanBtn && doodleModeDrawBtn && doodleModeEraseBtn) {
      const btns = [doodleModePanBtn, doodleModeDrawBtn, doodleModeEraseBtn];
      const panzoomWrapper = staticCanvas.parentElement;
      const switchMode = (tool) => {
        state.setDoodleTool(tool);
        participantPanzoom.setOptions({
          disablePan: tool !== 'pan',
          disableZoom: tool !== 'pan',
        });
        panzoomWrapper.style.cursor = tool === 'pan' ? 'grab' : 'crosshair';
        btns.forEach((btn) => btn.classList.remove('active'));
        document.getElementById(`doodleMode${tool.charAt(0).toUpperCase() + tool.slice(1)}`).classList.add('active');
        redrawCanvas();
      };
      doodleModePanBtn.addEventListener('click', () => switchMode('pan'));
      doodleModeDrawBtn.addEventListener('click', () => switchMode('draw'));
      doodleModeEraseBtn.addEventListener('click', () => switchMode('erase'));
    }
  }

  if (elements.confirmNameButton) {
    elements.confirmNameButton.addEventListener('click', async () => {
      const name = elements.nameInput.value.trim();
      if (state.currentEventId) {
        await router.handleLoginOrRegister(state.currentEventId, name);
      } else if (state.currentGroupId) {
        await router.handleParticipantLogin(state.currentGroupId, name);
      }
    });
  }

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
            renderSuggestions(suggestions, async (name, memberId, hasPassword) => {
              elements.nameInput.value = name;
              elements.suggestionList.innerHTML = '';
              const contextGroupId = state.currentGroupId;
              if (state.currentEventId) {
                if (hasPassword) {
                  const password = prompt(`「${name}」さんの合言葉を入力してください:`);
                  if (password) await router.verifyAndLogin(state.currentEventId, memberId, password);
                } else {
                  await router.handleLoginOrRegister(state.currentEventId, name, memberId);
                }
              } else if (contextGroupId) {
                await router.handleParticipantLogin(contextGroupId, name, memberId);
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
        await router.navigateTo(window.location.pathname, false);
      } else {
        const myParticipation = eventData.participants.find((p) => p.memberId === state.currentParticipantId);
        if (myParticipation && myParticipation.name) {
          showStaticAmidaView();
        } else {
          showJoinView(eventData);
        }
      }
    });

  // ▼▼▼ 修正: backToDashboardHandler を使用するように統一 ▼▼▼
  if (elements.backToControlPanelButton) {
    elements.backToControlPanelButton.addEventListener('click', backToDashboardHandler);
  }

  if (elements.backToControlPanelFromResultButton) {
    elements.backToControlPanelFromResultButton.addEventListener('click', backToDashboardHandler);
  }

  if (elements.backToDashboardFromWaitingButton) {
    elements.backToDashboardFromWaitingButton.addEventListener('click', backToDashboardHandler);
  }
  // ▲▲▲ 修正箇所 ▲▲▲

  if (elements.setPasswordButton)
    elements.setPasswordButton.addEventListener('click', async () => {
      try {
        const memberData = await api.getMemberDetails(state.currentGroupId, state.currentParticipantId);
        ui.openPasswordSetModal(
          {
            onSave: async () => {
              const password = ui.elements.newPasswordInput.value;
              try {
                await api.setPassword(state.currentParticipantId, password, state.currentGroupId, state.currentParticipantToken);
                alert('合言葉を設定しました。');
                ui.elements.passwordSetModal.style.display = 'none';
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

  if (ui.elements.deleteUserPasswordButton) {
    ui.elements.deleteUserPasswordButton.addEventListener('click', async () => {
      if (confirm('合言葉を削除しますか？')) {
        try {
          await api.setPassword(state.currentParticipantId, null, state.currentGroupId, state.currentParticipantToken);
          alert('合言葉を削除しました。');
          ui.elements.passwordSetModal.style.display = 'none';
        } catch (error) {
          alert(error.error || '合言葉の削除に失敗しました。');
        }
      }
    });
  }

  if (elements.participantLogoutButton)
    elements.participantLogoutButton.addEventListener('click', async () => {
      try {
        await api.clearGroupVerification();
      } catch (error) {
        console.error('Failed to clear group verification session:', error);
      } finally {
        state.clearParticipantState();
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
        if (!handleInvalidTokenError(error)) {
          alert(`削除エラー: ${error.error}`);
        }
      }
    });

  if (elements.slotList)
    elements.slotList.addEventListener('click', (e) => {
      const target = e.target.closest('.slot');
      if (!target || !target.classList.contains('available')) return;
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
        await router.navigateTo(window.location.pathname, false);
      } catch (error) {
        if (!handleInvalidTokenError(error)) {
          alert(error.error);
        }
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
        if (!handleInvalidTokenError(error)) {
          alert(error.error);
        }
      }
    });

  if (elements.editProfileButton) {
    elements.editProfileButton.addEventListener('click', handleOpenProfileModal);
  }

  if (ui.elements.profileIconInput) {
    ui.elements.profileIconInput.addEventListener('change', async () => {
      const file = ui.elements.profileIconInput.files[0];
      if (file) {
        const saveButton = document.getElementById('saveProfileButton');
        if (saveButton) saveButton.disabled = true;

        processedProfileIconFile = await processImage(file);

        if (saveButton) saveButton.disabled = false;

        if (processedProfileIconFile) {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (ui.elements.profileIconPreview) ui.elements.profileIconPreview.src = e.target.result;
          };
          reader.readAsDataURL(processedProfileIconFile);
        } else {
          ui.elements.profileIconInput.value = '';
        }
      }
    });
  }

  if (elements.acknowledgeButton) {
    elements.acknowledgeButton.addEventListener('click', async () => {
      try {
        await api.acknowledgeResult(state.currentEventId, state.currentParticipantId, state.currentParticipantToken);
        elements.acknowledgeButton.style.display = 'none';
        const participant = state.currentLotteryData.participants.find((p) => p.memberId === state.currentParticipantId);
        if (participant) {
          participant.acknowledgedResult = true;
        }
        alert('結果を受け取りました！');
      } catch (error) {
        if (!handleInvalidTokenError(error)) {
          alert(`エラー: ${error.error || '処理に失敗しました。'}`);
        }
      }
    });
  }

  if (elements.showAcknowledgedEventsCheckbox) {
    elements.showAcknowledgedEventsCheckbox.addEventListener('change', () => {
      localStorage.setItem('showAcknowledgedEvents', elements.showAcknowledgedEventsCheckbox.checked);
      if (state.participantEventList && state.currentGroupData) {
        renderOtherEvents(state.participantEventList, state.currentGroupData.customUrl);
      }
    });
  }

  if (elements.allResultsContainer) {
    elements.allResultsContainer.addEventListener('click', (e) => {
      console.log("くりいいいっく");
      if (e.target.id === 'showAllTracersButton') {
        if (isAnimationRunning()) {
          return;
        }
        showAllTracersInstantly();
      }
    });
  }
}
