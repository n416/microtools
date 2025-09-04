// public/js/tutorial/tutorialUtils.js (新規作成)
(function () {
  const viewToUrlMap = {
    groupDashboard: '/admin/groups',
    dashboardView: (groupId) => `/admin/groups/${groupId}`,
    eventEditView: (groupId) => `/admin/group/${groupId}/event/new`,
  };

  window.tutorialUtils = {
    generateTutorialUrl: function (tutorial, state) {
      const targetView = tutorial.steps[0]?.match;
      const urlBuilder = viewToUrlMap[targetView];

      if (urlBuilder) {
        let baseUrl;
        if (typeof urlBuilder === 'function') {
          const groupId = state.currentGroupId || (state.currentUser && state.currentUser.lastUsedGroupId);
          if (groupId) {
            baseUrl = urlBuilder(groupId);
          } else if (targetView === 'eventEditView') {
            baseUrl = viewToUrlMap['groupDashboard'];
          } else {
            baseUrl = '/admin/groups';
          }
        } else {
          baseUrl = urlBuilder;
        }
        return `${baseUrl}?forceTutorial=${encodeURIComponent(tutorial.id)}`;
      }

      // フォールバック
      const groupId = state.currentGroupId || (state.currentUser && state.currentUser.lastUsedGroupId);
      return groupId ? `/admin/groups/${groupId}?forceTutorial=${tutorial.id}` : `/admin/groups?forceTutorial=${tutorial.id}`;
    }
  };
})();