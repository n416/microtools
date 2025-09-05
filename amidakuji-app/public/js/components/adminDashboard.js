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
  groupAdminSearchInput: document.getElementById('groupAdminSearchInput'),
  groupAdminSearchButton: document.getElementById('groupAdminSearchButton'),
  systemAdminSearchInput: document.getElementById('systemAdminSearchInput'),
  systemAdminSearchButton: document.getElementById('systemAdminSearchButton'),
};

let groupAdminState = {page: 0, history: [null], nextCursor: null, hasNext: false, searchTerm: ''};
let systemAdminState = {page: 0, history: [null], nextCursor: null, hasNext: false, searchTerm: ''};

export async function loadAdminDashboardData() {
  groupAdminState = {page: 0, history: [null], nextCursor: null, hasNext: false, searchTerm: ''};
  systemAdminState = {page: 0, history: [null], nextCursor: null, hasNext: false, searchTerm: ''};
  if (elements.groupAdminSearchInput) elements.groupAdminSearchInput.value = '';
  if (elements.systemAdminSearchInput) elements.systemAdminSearchInput.value = '';

  try {
    const requests = await api.getAdminRequests();
    renderPendingRequests(requests || []);

    await loadGroupAdmins();
    await loadSystemAdmins();
  } catch (error) {
    console.error('管理ダッシュボードの読み込みに失敗:', error);
  }
}

async function loadGroupAdmins(cursor = null, search = '') {
  try {
    const data = await api.getGroupAdmins(cursor, search);
    renderGroupAdmins(data?.admins || []);
    groupAdminState.nextCursor = data?.lastVisible;
    groupAdminState.hasNext = data?.hasNextPage || false;
    updatePaginationControls('groupAdmin');
  } catch (error) {
    console.error('グループ管理者の読み込みに失敗:', error);
    renderGroupAdmins([]);
  }
}

async function loadSystemAdmins(cursor = null, search = '') {
  try {
    const data = await api.getSystemAdmins(cursor, search);
    renderSystemAdmins(data?.admins || []);
    systemAdminState.nextCursor = data?.lastVisible;
    systemAdminState.hasNext = data?.hasNextPage || false;
    updatePaginationControls('systemAdmin');
  } catch (error) {
    console.error('システム管理者の読み込みに失敗:', error);
    renderSystemAdmins([]);
  }
}

function renderPendingRequests(requests) {
  if (elements.pendingRequestsList) {
    elements.pendingRequestsList.innerHTML = requests.length === 0 ? '<li>現在、承認待ちの申請はありません。</li>' : requests.map((req) => `<li class="item-list-item"><span>${req.name} (id: ${req.id})</span><div class="item-buttons"><button class="approve-btn" data-request-id="${req.id}">承認</button></div></li>`).join('');
  }
}

function renderGroupAdmins(admins) {
  if (elements.adminUserList) {
    elements.adminUserList.innerHTML = admins.length === 0 ? '<li>ユーザーは存在しません。</li>' : admins.map((user) => `<li class="item-list-item"><span>${user.name} (id: ${user.id})</span><div class="item-buttons"><button class="impersonate-btn" data-user-id="${user.id}">成り代わり</button></div></li>`).join('');
  }
}

function renderSystemAdmins(admins) {
  if (elements.systemAdminList) {
    elements.systemAdminList.innerHTML = admins
      .map((admin) => {
        const isCurrentUser = admin.id === (state.currentUser.isImpersonating ? state.currentUser.originalUser.id : state.currentUser.id);
        const buttons = isCurrentUser ? '' : `<div class="item-buttons"><button class="demote-btn delete-btn" data-user-id="${admin.id}">権限剥奪</button></div>`;
        const registrationDate = admin.createdAt && admin.createdAt._seconds ? new Date(admin.createdAt._seconds * 1000).toLocaleDateString() : '不明';
        return `<li class="item-list-item"><span>${admin.name} (id: ${admin.id})</span> <span class="registration-date">登録日: ${registrationDate}</span> ${buttons}</li>`;
      })
      .join('');
  }
}

function updatePaginationControls(type) {
  const state = type === 'groupAdmin' ? groupAdminState : systemAdminState;
  const paginationControls = type === 'groupAdmin' ? elements.groupAdminPagination : elements.systemAdminPagination;
  if (!paginationControls) return;

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

  if (elements.groupAdminSearchInput) {
    elements.groupAdminSearchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            elements.groupAdminSearchButton.click();
        }
    });
  }
  
  if (elements.groupAdminSearchButton) {
    elements.groupAdminSearchButton.addEventListener('click', () => {
      groupAdminState = {page: 0, history: [null], nextCursor: null, hasNext: false, searchTerm: elements.groupAdminSearchInput.value};
      loadGroupAdmins(null, groupAdminState.searchTerm);
    });
  }

  if (elements.systemAdminSearchInput) {
    elements.systemAdminSearchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            elements.systemAdminSearchButton.click();
        }
    });
  }

  if (elements.systemAdminSearchButton) {
    elements.systemAdminSearchButton.addEventListener('click', () => {
      systemAdminState = {page: 0, history: [null], nextCursor: null, hasNext: false, searchTerm: elements.systemAdminSearchInput.value};
      loadSystemAdmins(null, systemAdminState.searchTerm);
    });
  }

  if (elements.groupAdminPagination) {
    elements.groupAdminPagination.querySelector('.next-btn').addEventListener('click', () => {
      groupAdminState.page++;
      groupAdminState.history.push(groupAdminState.nextCursor);
      loadGroupAdmins(groupAdminState.nextCursor, groupAdminState.searchTerm);
    });
    elements.groupAdminPagination.querySelector('.prev-btn').addEventListener('click', () => {
      groupAdminState.page--;
      groupAdminState.history.pop();
      loadGroupAdmins(groupAdminState.history[groupAdminState.page], groupAdminState.searchTerm);
    });
  }

  if (elements.systemAdminPagination) {
    elements.systemAdminPagination.querySelector('.next-btn').addEventListener('click', () => {
      systemAdminState.page++;
      systemAdminState.history.push(systemAdminState.nextCursor);
      loadSystemAdmins(systemAdminState.nextCursor, systemAdminState.searchTerm);
    });
    elements.systemAdminPagination.querySelector('.prev-btn').addEventListener('click', () => {
      systemAdminState.page--;
      systemAdminState.history.pop();
      loadSystemAdmins(systemAdminState.history[systemAdminState.page], systemAdminState.searchTerm);
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