import * as api from '../api.js';
import * as state from '../state.js';
import * as router from '../router.js';
import {startAnimation, isAnimationRunning, showAllTracersInstantly, prepareStepAnimation} from '../animation.js';
import * as ui from '../ui.js';
import {clientEmojiToLucide} from '../ui.js';

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
      imageHtml = `<img src="${prizeImageUrl}" alt="${prizeName}" class="result-prize-image">`;
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
  renderPrizesForParticipant(eventData.prizes);
}

export async function showStaticAmidaView() {
  hideParticipantSubViews(true);
  if (ui.elements.staticAmidaView) ui.elements.staticAmidaView.style.display = 'block';

  const ctx = ui.elements.participantCanvasStatic.getContext('2d');
  await prepareStepAnimation(ctx, true, false);
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
      // ★★★★★★★★★★★★★★★★★★★★★★★★★★★
      // ★★★ ここからが修正点 ★★★
      // ★★★★★★★★★★★★★★★★★★★★★★★★★★★
      if (elements.myResult) elements.myResult.innerHTML = '<b>全結果を表示します</b>';
      // ★★★★★★★★★★★★★★★★★★★★★★★★★★★
      // ★★★ 修正はここまで ★★★
      // ★★★★★★★★★★★★★★★★★★★★★★★★★★★
    }
    if (!isShareView) {
      if (elements.shareButton) elements.shareButton.style.display = 'inline-flex';
      if (elements.backToControlPanelFromResultButton) elements.backToControlPanelFromResultButton.style.display = 'block';
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

export function initParticipantView() {
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

  if (elements.backToControlPanelButton)
    elements.backToControlPanelButton.addEventListener('click', async () => {
      try {
        const group = await api.getGroup(state.currentGroupId);
        if (group && group.customUrl) {
          await router.navigateTo(`/g/${group.customUrl}/dashboard`);
        } else {
          await router.navigateTo('/');
        }
      } catch (error) {
        console.error('Failed to get group info for navigation:', error);
        await router.navigateTo('/');
      }
    });

  if (elements.backToControlPanelFromResultButton)
    elements.backToControlPanelFromResultButton.addEventListener('click', async () => {
      try {
        const group = await api.getGroup(state.currentGroupId);
        if (group && group.customUrl) {
          await router.navigateTo(`/g/${group.customUrl}/dashboard`);
        } else {
          await router.navigateTo('/');
        }
      } catch (error) {
        console.error('Failed to get group info for navigation:', error);
        await router.navigateTo('/');
      }
    });

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

  if (elements.backToDashboardFromWaitingButton) {
    elements.backToDashboardFromWaitingButton.addEventListener('click', async () => {
      try {
        const group = await api.getGroup(state.currentGroupId);
        if (group && group.customUrl) {
          await router.navigateTo(`/g/${group.customUrl}/dashboard`);
        } else {
          await router.navigateTo(`/groups/${state.currentGroupId}`);
        }
      } catch (error) {
        console.error('Failed to get group info for navigation:', error);
        await router.navigateTo('/');
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
        alert(`削除エラー: ${error.error}`);
      }
    });
  if (elements.slotList)
    elements.slotList.addEventListener('click', (e) => {
      const target = e.target.closest('.slot.available');
      if (!target) return;
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
        alert(error.error);
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
        alert(error.error);
      }
    });

  if (elements.editProfileButton)
    elements.editProfileButton.addEventListener('click', async () => {
      try {
        const memberData = await api.getMemberDetails(state.currentGroupId, state.currentParticipantId);
        ui.openProfileEditModal(memberData, {
          onSave: async () => {
            ui.elements.saveProfileButton.disabled = true;
            try {
              let newIconUrl = null;
              const file = ui.elements.profileIconInput.files[0];
              if (file) {
                const {signedUrl, iconUrl} = await api.generateUploadUrl(state.currentParticipantId, file.type, state.currentGroupId, state.currentParticipantToken);
                await fetch(signedUrl, {method: 'PUT', headers: {'Content-Type': file.type}, body: file});
                newIconUrl = iconUrl;
              }
              const profileData = {color: ui.elements.profileColorInput.value};
              if (newIconUrl) profileData.iconUrl = newIconUrl;

              await api.updateProfile(state.currentParticipantId, profileData, state.currentGroupId, state.currentParticipantToken);
              alert('プロフィールを保存しました。');
              ui.closeProfileEditModal();
            } catch (error) {
              alert(error.error);
            } finally {
              ui.elements.saveProfileButton.disabled = false;
            }
          },
        });
      } catch (error) {
        alert(error.error);
      }
    });
  if (ui.elements.profileIconInput)
    ui.elements.profileIconInput.addEventListener('change', () => {
      const file = ui.elements.profileIconInput.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (ui.elements.profileIconPreview) ui.elements.profileIconPreview.src = e.target.result;
        };
        reader.readAsDataURL(file);
      }
    });

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
        alert(`エラー: ${error.error || '処理に失敗しました。'}`);
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
      if (e.target.id === 'showAllTracersButton') {
        if (isAnimationRunning()) {
          return;
        }
        showAllTracersInstantly();
      }
    });
  }
}
