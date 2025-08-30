import * as api from '../api.js';
import * as state from '../state.js';
import * as router from '../router.js';

const elements = {
  adminDashboard: document.getElementById('adminDashboard'),
  pendingRequestsList: document.getElementById('pendingRequestsList'),
  adminUserList: document.getElementById('adminUserList'),
  systemAdminList: document.getElementById('systemAdminList'),
  groupAdminPagination: document.getElementById('groupAdminPagination'),
  systemAdminPagination: document.getElementById('systemAdminPagination'),
};

let groupAdminState = {page: 0, history: [null], nextCursor: null, hasNext: false};
let systemAdminState = {page: 0, history: [null], nextCursor: null, hasNext: false};

export async function loadAdminDashboardData() {
  console.log('[FRONTEND LOG] --- Enter loadAdminDashboardData ---');
  groupAdminState = {page: 0, history: [null], nextCursor: null, hasNext: false};
  systemAdminState = {page: 0, history: [null], nextCursor: null, hasNext: false};

  try {
    console.log('[FRONTEND LOG] Fetching pending requests...');
    const requests = await api.getAdminRequests();
    renderPendingRequests(requests || []);

    await loadGroupAdmins();
    await loadSystemAdmins();
  } catch (error) {
    console.error('[FRONTEND ERROR] Initial dashboard load failed:', error);
  }
}

async function loadGroupAdmins(cursor = null) {
  console.log(`[FRONTEND LOG] --- Enter loadGroupAdmins (cursor: ${cursor}) ---`);
  try {
    const data = await api.getGroupAdmins(cursor);
    console.log('[FRONTEND LOG] Received data from getGroupAdmins API:', data);
    renderGroupAdmins(data?.admins || []);
    groupAdminState.nextCursor = data?.lastVisible;
    groupAdminState.hasNext = data?.hasNextPage || false;
    updatePaginationControls('groupAdmin');
  } catch (error) {
    console.error('[FRONTEND ERROR] loadGroupAdmins failed:', error);
    renderGroupAdmins([]);
  }
}

async function loadSystemAdmins(cursor = null) {
  console.log(`[FRONTEND LOG] --- Enter loadSystemAdmins (cursor: ${cursor}) ---`);
  try {
    const data = await api.getSystemAdmins(cursor);
    console.log('[FRONTEND LOG] Received data from getSystemAdmins API:', data);
    renderSystemAdmins(data?.admins || []);
    systemAdminState.nextCursor = data?.lastVisible;
    systemAdminState.hasNext = data?.hasNextPage || false;
    updatePaginationControls('systemAdmin');
  } catch (error) {
    console.error('[FRONTEND ERROR] loadSystemAdmins failed:', error);
    renderSystemAdmins([]);
  }
}

function renderPendingRequests(requests) {
  console.log(`[FRONTEND LOG] Rendering ${requests.length} pending requests.`);
  if (elements.pendingRequestsList) {
    elements.pendingRequestsList.innerHTML = requests.length === 0 ? '<li>現在、承認待ちの申請はありません。</li>' : requests.map((req) => `<li class="item-list-item"><span>${req.name} (${req.email})</span><div class="item-buttons"><button class="approve-btn" data-request-id="${req.id}">承認</button></div></li>`).join('');
  }
}

function renderGroupAdmins(admins) {
  console.log(`[FRONTEND LOG] Rendering ${admins.length} group admins.`);
  if (elements.adminUserList) {
    elements.adminUserList.innerHTML = admins.length === 0 ? '<li>グループ管理者は存在しません。</li>' : admins.map((user) => `<li class="item-list-item"><span>${user.name} (${user.email})</span><div class="item-buttons"><button class="impersonate-btn" data-user-id="${user.id}">成り代わり</button></div></li>`).join('');
  }
}

function renderSystemAdmins(admins) {
  console.log(`[FRONTEND LOG] Rendering ${admins.length} system admins.`);
  if (elements.systemAdminList) {
    elements.systemAdminList.innerHTML = admins
      .map((admin) => {
        const isCurrentUser = admin.id === (state.currentUser.isImpersonating ? state.currentUser.originalUser.id : state.currentUser.id);
        const buttons = isCurrentUser ? '' : `<div class="item-buttons"><button class="demote-btn delete-btn" data-user-id="${admin.id}">権限剥奪</button></div>`;
        const registrationDate = admin.createdAt && admin.createdAt._seconds ? new Date(admin.createdAt._seconds * 1000).toLocaleDateString() : '不明';
        return `<li class="item-list-item"><span>${admin.name} (${admin.email})</span> <span class="registration-date">登録日: ${registrationDate}</span> ${buttons}</li>`;
      })
      .join('');
  }
}

function updatePaginationControls(type) {
  const state = type === 'groupAdmin' ? groupAdminState : systemAdminState;
  const paginationControls = type === 'groupAdmin' ? elements.groupAdminPagination : elements.systemAdminPagination;
  if (!paginationControls) return;
  console.log(`[FRONTEND LOG] Updating pagination for ${type}: page=${state.page}, hasNext=${state.hasNext}`);

  const prevBtn = paginationControls.querySelector('.prev-btn');
  const nextBtn = paginationControls.querySelector('.next-btn');
  prevBtn.style.display = state.page > 0 ? 'inline-block' : 'none';
  nextBtn.style.display = state.hasNext ? 'inline-block' : 'none';
}

// --- Event Handlers ---
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

  if (elements.groupAdminPagination) {
    elements.groupAdminPagination.querySelector('.next-btn').addEventListener('click', () => {
      groupAdminState.page++;
      groupAdminState.history.push(groupAdminState.nextCursor);
      loadGroupAdmins(groupAdminState.nextCursor);
    });
    elements.groupAdminPagination.querySelector('.prev-btn').addEventListener('click', () => {
      groupAdminState.page--;
      groupAdminState.history.pop();
      loadGroupAdmins(groupAdminState.history[groupAdminState.page]);
    });
  }

  if (elements.systemAdminPagination) {
    elements.systemAdminPagination.querySelector('.next-btn').addEventListener('click', () => {
      systemAdminState.page++;
      systemAdminState.history.push(systemAdminState.nextCursor);
      loadSystemAdmins(systemAdminState.nextCursor);
    });
    elements.systemAdminPagination.querySelector('.prev-btn').addEventListener('click', () => {
      systemAdminState.page--;
      systemAdminState.history.pop();
      loadSystemAdmins(systemAdminState.history[systemAdminState.page]);
    });
  }
}

async function handleApproveAdmin(requestId) {
  if (!confirm('このユーザーの管理者権限を承認しますか？')) return;
  try {
    await api.approveAdminRequest(requestId);
    alert('申請を承認しました。');
    await loadAdminDashboardData();
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
    await loadAdminDashboardData();
  } catch (error) {
    alert(error.error);
  }
}
