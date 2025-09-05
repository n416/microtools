// public/js/tutorial/tutorialList.js
(function () {
  const LIST_CONTAINER_ID = 'tutorial-list-container';
  let containerEl = null;
  let state = null; // モジュール内変数として依存性を保持
  let router = null; // モジュール内変数として依存性を保持
  let ui = null; // ★★★ uiオブジェクトを保持する変数を追加 ★★★
  let isInitialized = false; // イベントリスナーの重複登録を防ぐフラグ

  const viewToUrlMap = {
    groupDashboard: '/admin/groups',
    dashboardView: (groupId) => `/admin/groups/${groupId}`,
    eventEditView: (groupId) => `/admin/group/${groupId}/event/new`,
  };

  window.tutorialList = {
    init: function (dependencies) {
      state = dependencies.state;
      router = dependencies.router;
      ui = dependencies.ui; // ★★★ 渡されたuiオブジェクトを保存 ★★★
    },

    renderView: function () {
      containerEl = document.getElementById(LIST_CONTAINER_ID);
      if (!containerEl) return;

      this.renderList();

      if (!isInitialized) {
        this.attachEventListeners();
        isInitialized = true;
      }
    },

    renderList: function () {
      if (!window.tutorials || !containerEl) return;

      const tutorialsToShow = window.tutorials.filter((t) => t.showInList !== false);

      const groupedTutorials = tutorialsToShow.reduce((acc, tutorial) => {
        const group = tutorial.description || 'その他';
        if (!acc[group]) {
          acc[group] = [];
        }
        acc[group].push(tutorial);
        return acc;
      }, {});

      let html = '';
      for (const groupName in groupedTutorials) {
        html += `<h3>${escapeHtml(groupName)}</h3>`;
        html += '<ul class="item-list">';
        groupedTutorials[groupName].forEach((tutorial) => {
          const isCompleted = localStorage.getItem(`tutorialCompleted_${tutorial.id}`) === 'true';
          // 共通関数を使ってURLを生成
          const href = window.tutorialUtils.generateTutorialUrl(tutorial, state);

          html += `
                    <li class="item-list-item" data-tutorial-id="${tutorial.id}" data-target-view="${tutorial.steps[0]?.match || ''}">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span class="tutorial-status-icon ${isCompleted ? 'completed' : ''}"></span>
                            <a href="${href}" class="tutorial-link">${escapeHtml(tutorial.title)}</a>
                        </div>
                        <div class="item-buttons">
                            <button class="secondary-btn reset-tutorial-btn">進捗リセット</button>
                        </div>
                    </li>
                `;
        });
        html += '</ul>';
      }
      containerEl.innerHTML = html;
    },

    attachEventListeners: function () {
      containerEl.addEventListener('click', (e) => {
        const link = e.target.closest('a.tutorial-link');
        const button = e.target.closest('button.reset-tutorial-btn');
        const parentLi = e.target.closest('.item-list-item');

        if (!parentLi) return;
        const tutorialId = parentLi.dataset.tutorialId;

        if (link) {
          e.preventDefault();
          // ▼▼▼ チュートリアル開始前に現在のURLを保存 ▼▼▼
          if (window.tutorialManager) {
            window.tutorialManager.setReturnUrl(window.location.pathname);
          }
          // ▲▲▲ ここまで ▲▲▲
          setTimeout(() => {
            router.navigateTo(link.getAttribute('href'));
          }, 0);
        } else if (button) {
          setTimeout(() => {
            localStorage.removeItem(`tutorialCompleted_${tutorialId}`);
            const statusIcon = parentLi.querySelector('.tutorial-status-icon');
            if (statusIcon) statusIcon.classList.remove('completed');
            ui.showToast(`「${parentLi.querySelector('.tutorial-link').textContent}」の進捗をリセットしました。`);
          }, 0);
        }
      });
    },
  };

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
})();
