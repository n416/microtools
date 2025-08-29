import * as api from '../api.js';
import * as state from '../state.js';
import * as router from '../router.js';
import * as ui from '../ui.js';

// このコンポーネントが管理するDOM要素
const elements = {
  groupDashboard: document.getElementById('groupDashboard'),
  groupNameInput: document.getElementById('groupNameInput'),
  createGroupButton: document.getElementById('createGroupButton'),
  groupList: document.getElementById('groupList'),
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

export async function openGroupSettingsFor(groupId) {
  const groupData = state.allUserGroups.find((g) => g.id === groupId);
  if (!groupData) {
    alert('グループ情報が見つかりませんでした。');
    return;
  }

  groupData.hasPassword = !!groupData.password;

  const handlers = {
    onSave: handleSaveSettings,
    onDeletePassword: async () => {
      if (!confirm('本当にこのグループの合言葉を削除しますか？')) return;
      try {
        await api.deleteGroupPassword(groupId);
        alert('合言葉を削除しました。');
        if (ui.elements.deletePasswordButton) {
          ui.elements.deletePasswordButton.style.display = 'none';
        }
        const groupInState = state.allUserGroups.find((g) => g.id === groupId);
        if (groupInState) delete groupInState.password;
      } catch (error) {
        alert(error.error);
      }
    },
  };

  ui.openSettingsModal(groupData, handlers);
}

async function handleSaveSettings() {
  const groupId = ui.elements.settingsGroupId.value;
  const settingsPayload = {
    groupName: ui.elements.groupNameEditInput.value.trim(),
    customUrl: ui.elements.customUrlInput.value.trim(),
    noIndex: ui.elements.noIndexCheckbox.checked,
  };
  if (ui.elements.groupPasswordInput.value) {
    settingsPayload.password = ui.elements.groupPasswordInput.value;
  }

  ui.elements.saveGroupSettingsButton.disabled = true;
  try {
    await api.updateGroupSettings(groupId, settingsPayload);
    alert('設定を保存しました。');
    ui.closeSettingsModal();
    const groups = await api.getGroups();
    state.setAllUserGroups(groups);
    renderGroupList(groups);
  } catch (error) {
    alert(error.error || '設定の保存に失敗しました。');
  } finally {
    ui.elements.saveGroupSettingsButton.disabled = false;
  }
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
        await router.loadUserAndRedirect();
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
              await router.loadUserAndRedirect();
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
