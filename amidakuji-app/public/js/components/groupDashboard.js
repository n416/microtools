import * as api from '../api.js';
import * as state from '../state.js';
import * as router from '../router.js';

// 外部の関数や状態に依存するため、main.jsからインポートします
import {openGroupSettingsFor, loadUserAndRedirect} from '../main.js';

// このコンポーネントが管理するDOM要素
const elements = {
  groupDashboard: document.getElementById('groupDashboard'),
  groupNameInput: document.getElementById('groupNameInput'),
  createGroupButton: document.getElementById('createGroupButton'),
  groupList: document.getElementById('groupList'),
  requestAdminButton: document.getElementById('requestAdminButton'),
  requestAdminControls: document.getElementById('requestAdminControls'),
};

// グループリストを描画する関数
export function renderGroupList(groups) {
  if (!elements.groupList) return;
  elements.groupList.innerHTML = '';
  groups.forEach((group) => {
    const li = document.createElement('li');
    li.className = 'item-list-item list-item-link';
    li.dataset.groupId = group.id;
    li.dataset.groupName = group.name;

    const groupInfo = document.createElement('span');
    const date = new Date((group.createdAt._seconds || group.createdAt.seconds) * 1000);
    groupInfo.textContent = `${group.name} (${date.toLocaleDateString()})`;
    groupInfo.style.cursor = 'pointer';

    const settingsBtn = document.createElement('button');
    settingsBtn.textContent = '設定';

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '削除';
    deleteBtn.className = 'delete-btn delete-group-btn';

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'item-buttons';
    buttonContainer.appendChild(settingsBtn);
    buttonContainer.appendChild(deleteBtn);
    li.appendChild(groupInfo);
    li.appendChild(buttonContainer);
    elements.groupList.appendChild(li);
  });
}

// イベントリスナーを初期化する関数
export function initGroupDashboard() {
  if (elements.createGroupButton) {
    elements.createGroupButton.addEventListener('click', async () => {
      const name = elements.groupNameInput.value.trim();
      if (!name) return alert('グループ名を入力してください。');
      try {
        await api.createGroup(name);
        elements.groupNameInput.value = '';
        await loadUserAndRedirect();
      } catch (error) {
        alert(error.error);
      }
    });
  }

  if (elements.groupList) {
    elements.groupList.addEventListener('click', async (e) => {
      const groupItem = e.target.closest('.item-list-item');
      if (!groupItem) return;
      const {groupId, groupName} = groupItem.dataset;
      const button = e.target.closest('button');

      if (button) {
        e.stopPropagation();
        if (button.classList.contains('delete-group-btn')) {
          if (confirm(`グループ「${groupName}」を削除しますか？\n関連するすべてのイベントも削除され、元に戻せません。`)) {
            try {
              await api.deleteGroup(groupId);
              alert('グループを削除しました。');
              await loadUserAndRedirect();
            } catch (error) {
              alert(error.error || 'グループの削除に失敗しました。');
            }
          }
        } else {
          state.setCurrentGroupId(groupId);
          await openGroupSettingsFor(groupId);
        }
      } else {
        await router.navigateTo(`/admin/groups/${groupId}`);
      }
    });
  }
}
