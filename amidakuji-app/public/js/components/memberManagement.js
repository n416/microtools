import * as api from '../api.js';
import * as state from '../state.js';
import * as ui from '../ui.js';
import * as router from '../router.js';

const elements = {
  memberManagementView: document.getElementById('memberManagementView'),
  memberManagementGroupName: document.getElementById('memberManagementGroupName'),
  backToDashboardFromMembersButton: document.getElementById('backToDashboardFromMembersButton'),
  addNewMemberButton: document.getElementById('addNewMemberButton'),
  memberSearchInput: document.getElementById('memberSearchInput'),
  memberList: document.getElementById('memberList'),
  bulkRegisterButton: document.getElementById('bulkRegisterButton'),
  cleanupEventsButton: document.getElementById('cleanupEventsButton'), // ★ 追加
  memberEditModal: document.getElementById('memberEditModal'),
  closeMemberEditModalButton: document.querySelector('#memberEditModal .close-button'),
  memberIdInput: document.getElementById('memberIdInput'),
  memberNameEditInput: document.getElementById('memberNameEditInput'),
  memberColorInput: document.getElementById('memberColorInput'),
  saveMemberButton: document.getElementById('saveMemberButton'),
  bulkRegisterModal: document.getElementById('bulkRegisterModal'),
  closeBulkRegisterModalButton: document.querySelector('#bulkRegisterModal .close-button'),
  bulkNamesTextarea: document.getElementById('bulkNamesTextarea'),
  analyzeBulkButton: document.getElementById('analyzeBulkButton'),
  bulkStep1Input: document.getElementById('bulk-step1-input'),
  bulkStep2Preview: document.getElementById('bulk-step2-preview'),
  finalizeBulkButton: document.getElementById('finalizeBulkButton'),
};

export function renderMemberList(members) {
  if (!elements.memberList) return;
  elements.memberList.innerHTML = '';
  const searchTerm = elements.memberSearchInput.value.toLowerCase();

  members
    .filter((member) => member.name.toLowerCase().includes(searchTerm))
    .forEach((member) => {
      const li = document.createElement('li');
      const isActive = typeof member.isActive === 'boolean' ? member.isActive : true;
      li.className = `item-list-item member-list-item ${isActive ? '' : 'inactive'}`;
      li.dataset.memberId = member.id;

      const createdByLabel = member.createdBy === 'admin' ? '<span class="label admin">管理者登録</span>' : '<span class="label user">本人登録</span>';
      const checkedAttribute = isActive ? 'checked' : '';

      li.innerHTML = `
                <div class="member-info">
                    <input type="color" value="${member.color || '#cccccc'}" disabled>
                    <span>${member.name}</span>
                    ${createdByLabel}
                </div>
                <div class="item-buttons">
                    <label class="switch">
                        <input type="checkbox" class="is-active-toggle" ${checkedAttribute}>
                        <span class="slider"></span>
                    </label>
                    <button class="edit-member-btn">編集</button>
                    <button class="delete-btn delete-member-btn">削除</button>
                </div>
            `;
      elements.memberList.appendChild(li);
    });
}

export function openMemberEditModal(member, handlers) {
  if (!elements.memberEditModal) return;
  elements.memberIdInput.value = member.id;
  elements.memberNameEditInput.value = member.name;
  elements.memberColorInput.value = member.color || '#cccccc';
  elements.saveMemberButton.onclick = handlers.onSave;
  elements.memberEditModal.style.display = 'block';
}

export function closeMemberEditModal() {
  if (elements.memberEditModal) elements.memberEditModal.style.display = 'none';
}

export function openBulkRegisterModal() {
  if (!elements.bulkRegisterModal) return;
  elements.bulkNamesTextarea.value = '';
  elements.bulkStep1Input.style.display = 'block';
  elements.bulkStep2Preview.style.display = 'none';
  elements.analyzeBulkButton.disabled = false;
  elements.analyzeBulkButton.textContent = '確認する';
  elements.finalizeBulkButton.disabled = true;
  elements.bulkRegisterModal.style.display = 'block';
}

export function closeBulkRegisterModal() {
  if (elements.bulkRegisterModal) elements.bulkRegisterModal.style.display = 'none';
}

export function renderBulkAnalysisPreview(analysisResults) {
  const newRegistrationTab = document.getElementById('newRegistrationTab');
  const potentialMatchTab = document.getElementById('potentialMatchTab');
  const exactMatchTab = document.getElementById('exactMatchTab');

  newRegistrationTab.innerHTML =
    '<ul>' +
    analysisResults
      .filter((r) => r.status === 'new_registration')
      .map((r) => `<li>"${r.inputName}" を新規登録します。</li>`)
      .join('') +
    '</ul>';
  exactMatchTab.innerHTML =
    '<ul>' +
    analysisResults
      .filter((r) => r.status === 'exact_match')
      .map((r) => `<li>"${r.inputName}" は登録済みのためスキップします。</li>`)
      .join('') +
    '</ul>';

  potentialMatchTab.innerHTML =
    '<ul>' +
    analysisResults
      .filter((r) => r.status === 'potential_match')
      .map(
        (r, i) => `
        <li data-input-name="${r.inputName}">
            <p><strong>"${r.inputName}"</strong> は、既存の <strong>"${r.suggestions[0].name}"</strong> と類似しています。</p>
            <label><input type="radio" name="resolve_${i}" value="skip" checked> 同一人物として扱う (スキップ)</label>
            <label><input type="radio" name="resolve_${i}" value="create"> 別人として新規登録する</label>
        </li>
    `
      )
      .join('') +
    '</ul>';

  document.querySelector('.tab-link[data-tab="newRegistrationTab"]').textContent = `新規登録 (${analysisResults.filter((r) => r.status === 'new_registration').length})`;
  document.querySelector('.tab-link[data-tab="potentialMatchTab"]').textContent = `類似候補 (${analysisResults.filter((r) => r.status === 'potential_match').length})`;
  document.querySelector('.tab-link[data-tab="exactMatchTab"]').textContent = `完全一致 (${analysisResults.filter((r) => r.status === 'exact_match').length})`;

  document.querySelectorAll('#bulk-step2-preview .tab-link').forEach((button) => {
    button.onclick = (e) => {
      document.querySelectorAll('#bulk-step2-preview .tab-link, #bulk-step2-preview .tab-content').forEach((el) => el.classList.remove('active'));
      const tabId = e.target.dataset.tab;
      e.target.classList.add('active');
      document.getElementById(tabId).classList.add('active');
    };
  });

  elements.bulkStep1Input.style.display = 'none';
  elements.bulkStep2Preview.style.display = 'block';
  elements.finalizeBulkButton.disabled = false;
}

export function initMemberManagement() {
  if (elements.memberManagementView) {
    elements.backToDashboardFromMembersButton.addEventListener('click', () => {
      if (state.currentGroupId) {
        router.navigateTo(`/admin/groups/${state.currentGroupId}`);
      }
    });

    elements.addNewMemberButton.addEventListener('click', async () => {
      const name = prompt('追加するメンバーの名前を入力してください:');
      if (name && name.trim()) {
        try {
          await api.addMember(state.currentGroupId, name.trim());
          const members = await api.getMembers(state.currentGroupId);
          renderMemberList(members);
        } catch (error) {
          alert(error.error || 'メンバーの追加に失敗しました。');
        }
      }
    });

    elements.memberSearchInput.addEventListener('input', async () => {
      const members = await api.getMembers(state.currentGroupId);
      renderMemberList(members);
    });

    elements.memberList.addEventListener('click', async (e) => {
      const memberItem = e.target.closest('.member-list-item');
      if (!memberItem) return;

      const memberId = memberItem.dataset.memberId;
      const members = await api.getMembers(state.currentGroupId);
      const member = members.find((m) => m.id === memberId);

      if (e.target.classList.contains('delete-member-btn')) {
        if (confirm(`メンバー「${member.name}」を削除しますか？`)) {
          try {
            await api.deleteMember(state.currentGroupId, memberId);
            const updatedMembers = await api.getMembers(state.currentGroupId);
            renderMemberList(updatedMembers);
          } catch (error) {
            alert(error.error || 'メンバーの削除に失敗しました。');
          }
        }
      } else if (e.target.classList.contains('edit-member-btn')) {
        openMemberEditModal(member, {
          onSave: async () => {
            const newName = elements.memberNameEditInput.value.trim();
            const newColor = elements.memberColorInput.value;
            if (!newName) return alert('名前は必須です。');

            try {
              await api.updateMember(state.currentGroupId, memberId, {name: newName, color: newColor});
              closeMemberEditModal();
              const updatedMembers = await api.getMembers(state.currentGroupId);
              renderMemberList(updatedMembers);
            } catch (error) {
              alert(error.error || '更新に失敗しました。');
            }
          },
        });
      }
    });

    elements.memberList.addEventListener('change', async (e) => {
      if (e.target.classList.contains('is-active-toggle')) {
        const memberItem = e.target.closest('.member-list-item');
        const memberId = memberItem.dataset.memberId;
        const isActive = e.target.checked;

        try {
          await api.updateMemberStatus(state.currentGroupId, memberId, isActive);
          memberItem.classList.toggle('inactive', !isActive);
        } catch (error) {
          alert('状態の更新に失敗しました。');
          e.target.checked = !isActive;
        }
      }
    });

    elements.memberManagementView.addEventListener('click', (e) => {
      if (e.target.id === 'bulkRegisterButton') {
        openBulkRegisterModal();
      }
    });

    // ★★★ ここからが修正点 ★★★
    if (elements.cleanupEventsButton) {
      elements.cleanupEventsButton.addEventListener('click', async () => {
        if (!confirm('過去に削除されたメンバーの参加情報を、開催前のイベントから一括で削除します。よろしいですか？')) return;

        try {
          const result = await api.cleanupEvents(state.currentGroupId);
          alert(result.message);
        } catch (error) {
          alert(error.error || '処理に失敗しました。');
        }
      });
    }
    // ★★★ ここまで ★★★
  }

  if (elements.closeMemberEditModalButton) {
    elements.closeMemberEditModalButton.addEventListener('click', closeMemberEditModal);
  }
  if (elements.closeBulkRegisterModalButton) {
    elements.closeBulkRegisterModalButton.addEventListener('click', closeBulkRegisterModal);
  }

  if (elements.analyzeBulkButton) {
    elements.analyzeBulkButton.addEventListener('click', async () => {
      const namesText = elements.bulkNamesTextarea.value;
      if (!namesText.trim()) return alert('名前を入力してください。');

      elements.analyzeBulkButton.disabled = true;
      elements.analyzeBulkButton.textContent = '分析中...';
      try {
        const result = await api.analyzeBulkMembers(state.currentGroupId, namesText);
        renderBulkAnalysisPreview(result.analysisResults);
      } catch (error) {
        alert(error.error || '分析に失敗しました。');
        elements.analyzeBulkButton.disabled = false;
        elements.analyzeBulkButton.textContent = '確認する';
      }
    });
  }

  if (elements.finalizeBulkButton) {
    elements.finalizeBulkButton.addEventListener('click', async () => {
      elements.finalizeBulkButton.disabled = true;
      elements.finalizeBulkButton.textContent = '登録処理中...';

      const resolutions = [];
      document.querySelectorAll('#newRegistrationTab li').forEach((li) => {
        resolutions.push({inputName: li.textContent.match(/"(.*?)"/)[1], action: 'create'});
      });
      document.querySelectorAll('#potentialMatchTab li').forEach((li) => {
        const inputName = li.dataset.inputName;
        const action = li.querySelector('input[type="radio"]:checked').value;
        resolutions.push({inputName, action});
      });

      try {
        const result = await api.finalizeBulkMembers(state.currentGroupId, resolutions);
        alert(`${result.createdCount}名のメンバーを新しく登録しました。`);
        closeBulkRegisterModal();
        const members = await api.getMembers(state.currentGroupId);
        renderMemberList(members);
      } catch (error) {
        alert(error.error || '登録に失敗しました。');
      } finally {
        elements.finalizeBulkButton.disabled = false;
        elements.finalizeBulkButton.textContent = 'この内容で登録を実行する';
      }
    });
  }
}
