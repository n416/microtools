import * as api from '../api.js';
import * as state from '../state.js';
import * as router from '../router.js';

// このコンポーネントが管理するDOM要素
const elements = {
  adminDashboard: document.getElementById('adminDashboard'),
  pendingRequestsList: document.getElementById('pendingRequestsList'),
  adminUserList: document.getElementById('adminUserList'),
  systemAdminList: document.getElementById('systemAdminList'),
};

// Adminリストを描画する関数
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

// イベントリスナーを初期化する関数
export function initAdminDashboard() {
  if (elements.adminDashboard) {
    elements.adminDashboard.addEventListener('click', async (e) => {
      const button = e.target.closest('button');
      if (!button) return;

      if (button.classList.contains('impersonate-btn')) {
        await handleImpersonate(button.dataset.userId);
      } else if (button.classList.contains('approve-btn')) {
        await handleApproveAdmin(button.dataset.requestId);
      } else if (button.classList.contains('demote-btn')) {
        await handleDemoteAdmin(button.dataset.userId);
      }
    });
  }
}

// Private helper functions from main.js
async function handleApproveAdmin(requestId) {
  if (!confirm('このユーザーの管理者権限を承認しますか？')) return;
  try {
    await api.approveAdminRequest(requestId);
    alert('申請を承認しました。');
    await router.navigateTo('/admin/dashboard', false);
  } catch (error) {
    alert(error.error);
  }
}

async function handleImpersonate(userId) {
  if (!confirm('このユーザーとしてログインしますか？')) return;
  try {
    await api.impersonateUser(userId);
    alert('成り代わりました。ページをリロードします。');
    window.location.href = '/';
  } catch (error) {
    alert(error.error);
  }
}

async function handleDemoteAdmin(userId) {
  if (!confirm('本当にこのシステム管理者を通常ユーザーに戻しますか？')) return;
  try {
    await api.demoteAdmin(userId);
    alert('ユーザーを降格させました。');
    await router.navigateTo('/admin/dashboard', false);
  } catch (error) {
    alert(error.error);
  }
}
