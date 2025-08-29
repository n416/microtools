import * as api from '../api.js';
import * as state from '../state.js';
import * as router from '../router.js';
import * as ui from '../ui.js';
import {openGroupSettingsFor} from './groupDashboard.js';

// このコンポーネントが管理するDOM要素
const elements = {
  dashboardView: document.getElementById('dashboardView'),
  eventGroupName: document.getElementById('eventGroupName'),
  goToGroupSettingsButton: document.getElementById('goToGroupSettingsButton'),
  goToPrizeMasterButton: document.getElementById('goToPrizeMasterButton'),
  goToMemberManagementButton: document.getElementById('goToMemberManagementButton'),
  goToCreateEventViewButton: document.getElementById('goToCreateEventViewButton'),
  eventList: document.getElementById('eventList'),
  passwordResetNotification: document.getElementById('passwordResetNotification'),
  passwordResetCount: document.getElementById('passwordResetCount'),
  showPasswordResetRequestsButton: document.getElementById('showPasswordResetRequestsButton'),
  passwordResetRequestModal: document.getElementById('passwordResetRequestModal'),
  closePasswordResetRequestModalButton: document.querySelector('#passwordResetRequestModal .close-button'),
  passwordResetRequestList: document.getElementById('passwordResetRequestList'),
};

// イベントリストを描画する関数
export function renderEventList(allEvents) {
  if (!elements.eventList) return;

  const showStartedCheckbox = document.getElementById('showStartedEvents');
  const shouldShowStarted = showStartedCheckbox ? showStartedCheckbox.checked : false;

  const eventsToRender = shouldShowStarted ? allEvents : allEvents.filter((event) => event.status !== 'started');

  elements.eventList.innerHTML = '';
  eventsToRender.forEach((event) => {
    const li = document.createElement('li');
    const date = new Date((event.createdAt._seconds || event.createdAt.seconds) * 1000);
    const displayDate = !isNaN(date) ? date.toLocaleString() : '日付不明';
    const eventName = event.eventName || '無題のイベント';
    const filledSlots = event.participants.filter((p) => p.name).length;

    let statusBadge;
    if (event.status === 'started') {
      statusBadge = '<span>実施済み</span>';
    } else {
      statusBadge = '<span class="badge ongoing">開催中</span>';
    }

    const itemClass = state.currentUser ? 'item-list-item list-item-link' : 'item-list-item';
    li.className = itemClass;

    li.innerHTML = `
        <span class="event-info">
          <strong>${eventName}</strong>
          <span class="event-date">（${displayDate}作成）</span>
          ${statusBadge}
          <span class="event-status">${filledSlots} / ${event.participantCount} 名参加</span>
        </span>
        <div class="item-buttons">
            <button class="edit-event-btn" data-event-id="${event.id}">編集</button>
            <button class="start-event-btn" data-event-id="${event.id}">実施</button>
            <button class="copy-event-btn" data-event-id="${event.id}">コピー</button>
            <button class="delete-btn delete-event-btn" data-event-id="${event.id}">削除</button>
        </div>`;

    elements.eventList.appendChild(li);
  });
}

// パスワードリセット依頼の通知バナーを表示する関数
export function showPasswordResetNotification(requests) {
  if (!elements.passwordResetNotification || !elements.passwordResetCount) return;

  if (requests && requests.length > 0) {
    elements.passwordResetCount.textContent = requests.length;
    elements.passwordResetNotification.style.display = 'flex';
  } else {
    elements.passwordResetNotification.style.display = 'none';
  }
}

// パスワードリセット依頼モーダルを開く関数
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

// パスワードリセット依頼モーダルを閉じる関数
export function closePasswordResetRequestModal() {
  if (elements.passwordResetRequestModal) elements.passwordResetRequestModal.style.display = 'none';
}

// パスワードリセット依頼リストを描画する関数
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
async function handleCopyEvent(eventId) {
  if (!confirm('このイベントをコピーしますか？')) return;
  try {
    await api.copyEvent(eventId);
    alert('イベントをコピーしました。');
    await router.navigateTo(window.location.pathname, false);
  } catch (error) {
    alert(`エラー: ${error.error}`);
  }
}

// イベントリスナーを初期化する関数
export function initEventDashboard() {
  if (elements.eventList) {
    elements.eventList.addEventListener('click', async (e) => {
      const button = e.target.closest('button');
      const item = e.target.closest('.item-list-item');
      if (!item) return;

      const eventId = (button || item.querySelector('.edit-event-btn'))?.dataset.eventId;
      if (!eventId) return;

      e.stopPropagation();

      if (button?.classList.contains('delete-event-btn')) {
        if (confirm('このイベントを削除しますか？元に戻せません。')) {
          api
            .deleteEvent(eventId)
            .then(async () => {
              alert('イベントを削除しました。');
              await router.navigateTo(window.location.pathname, false);
            })
            .catch((err) => alert(err.error || 'イベントの削除に失敗しました。'));
        }
      } else if (button?.classList.contains('start-event-btn')) {
        await router.navigateTo(`/admin/event/${eventId}/broadcast`);
      } else if (button?.classList.contains('copy-event-btn')) {
        await handleCopyEvent(eventId);
      } else {
        await router.navigateTo(`/admin/event/${eventId}/edit`);
      }
    });
  }

  if (elements.dashboardView) {
    elements.dashboardView.addEventListener('click', async (e) => {
      if (e.target.id === 'goToGroupSettingsButton') {
        if (state.currentGroupId) {
          await openGroupSettingsFor(state.currentGroupId);
        }
      }
      if (e.target.id === 'goToPrizeMasterButton') {
        if (state.currentGroupId) {
          const handlers = {
            onAddMaster: async () => {
              const name = ui.elements.addMasterPrizeNameInput.value.trim();
              const file = ui.elements.addMasterPrizeImageInput.files[0];
              if (!name || !file) return alert('賞品名と画像を選択してください');
              try {
                ui.elements.addMasterPrizeButton.disabled = true;
                const {signedUrl, imageUrl} = await api.generatePrizeMasterUploadUrl(state.currentGroupId, file.type);
                await fetch(signedUrl, {method: 'PUT', headers: {'Content-Type': file.type}, body: file});
                await api.addPrizeMaster(state.currentGroupId, name, imageUrl);
                alert('賞品マスターを追加しました。');
                const masters = await api.getPrizeMasters(state.currentGroupId);
                ui.renderPrizeMasterList(masters, false);
                ui.elements.addMasterPrizeNameInput.value = '';
                ui.elements.addMasterPrizeImageInput.value = '';
              } catch (error) {
                alert(error.error);
              } finally {
                ui.elements.addMasterPrizeButton.disabled = false;
              }
            },
            onDeleteMaster: async (masterId) => {
              if (!confirm('この賞品マスターを削除しますか？')) return;
              try {
                await api.deletePrizeMaster(masterId, state.currentGroupId);
                alert('削除しました');
                const masters = await api.getPrizeMasters(state.currentGroupId);
                ui.renderPrizeMasterList(masters, false);
              } catch (error) {
                alert(error.error);
              }
            },
          };
          ui.openPrizeMasterModal(handlers);
          const masters = await api.getPrizeMasters(state.currentGroupId);
          ui.renderPrizeMasterList(masters, false);
        }
      }
      if (e.target.id === 'goToMemberManagementButton') {
        if (state.currentGroupId) {
          router.navigateTo(`/admin/groups/${state.currentGroupId}/members`);
        }
      }
      if (e.target.id === 'showPasswordResetRequestsButton') {
        if (state.currentGroupId) {
          const requests = await api.getPasswordRequests(state.currentGroupId);
          const handlers = {
            onApproveReset: async (memberId, groupId, requestId) => {
              if (!confirm('このユーザーの合言葉を削除しますか？')) return;
              try {
                await api.approvePasswordReset(memberId, groupId, requestId);
                alert('合言葉を削除しました。');
                const updatedRequests = await api.getPasswordRequests(groupId);
                renderPasswordRequests(updatedRequests);
                showPasswordResetNotification(updatedRequests);
                if (updatedRequests.length === 0) {
                  closePasswordResetRequestModal();
                }
              } catch (error) {
                alert(error.error);
              }
            },
          };
          openPasswordResetRequestModal(requests, handlers);
        }
      }
    });
  }

  if (elements.goToCreateEventViewButton) {
    elements.goToCreateEventViewButton.addEventListener('click', async () => {
      await router.navigateTo(`/admin/group/${state.currentGroupId}/event/new`);
    });
  }

  if (elements.closePasswordResetRequestModalButton) {
    elements.closePasswordResetRequestModalButton.addEventListener('click', closePasswordResetRequestModal);
  }
}
