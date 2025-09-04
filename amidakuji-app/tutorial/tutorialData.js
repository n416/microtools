// tutorialData.js (最終版)
window.tutorials = [
  {
    id: '01-create-group',
    title: '最初のステップ：グループ作成',
    description: '基本操作',
    steps: [
      {
        type: 'page',
        match: 'groupDashboard',
        subSteps: [
          {
            message: 'ようこそ！まずは、すべてのイベントを管理する「グループ」を作成します。ここにグループ名（例：〇〇プロジェクト）を入力してください。',
            highlightSelector: '#groupNameInput',
            waitForInputOn: '#groupNameInput',
            removeOkButton: true,
            showNextButtonOnInput: true,
          },
          {
            message: '入力ありがとうございます！次に、「グループ作成」ボタンを押して最初のグループを作成しましょう！',
            highlightSelector: '#createGroupButton',
            waitForClickOn: '#createGroupButton',
            removeOkButton: true,
            complete: true,
          },
        ],
      },
    ],
  },
  {
    id: '02-navigate-to-event-creation',
    title: 'イベントを作成してみよう',
    description: '基本操作',
    steps: [
      {
        type: 'page',
        match: 'dashboardView',
        subSteps: [
          {
            message: 'グループが作成できましたね！次に、このグループに所属する「イベント」を作成します。「イベント新規作成」ボタンを押してください。',
            highlightSelector: '#goToCreateEventViewButton',
            waitForClickOn: '#goToCreateEventViewButton',
            removeOkButton: true,
            complete: true,
          },
        ],
      },
    ],
  },
  {
    id: '03-create-prizes',
    title: '景品を設定する',
    description: 'イベント管理',
    steps: [
      {
        type: 'page',
        match: 'eventEditView',
        // 新規イベント作成時のみ、このチュートリアルが実行されるようにする
        precondition: (state) => !state.currentEventId,
        subSteps: [
          {
            message: 'ここがイベント編集画面です。あみだくじのゴールとなる「景品」を追加します。「追加」ボタンを押してください。',
            highlightSelector: '#openAddPrizeModalButton',
            waitForClickOn: '#openAddPrizeModalButton',
            removeOkButton: true,
          },
          {
            message: 'ここに1つ目の景品名を入力してください。入力するとボタンが表示され、2秒後に自動で次に進みます。',
            highlightSelector: '#newPrizeNameInput',
            waitForInputOn: '#newPrizeNameInput',
            removeOkButton: true,
            showNextButtonOnInput: true,
          },
          {
            message: '景品名が入力できましたね。次に「追加」ボタンを押して、リストに景品を追加しましょう。',
            highlightSelector: '#addPrizeOkButton',
            waitForClickOn: '#addPrizeOkButton',
            removeOkButton: true,
          },
          {
            message: '素晴らしい！景品が1つ追加されました。あみだくじには景品が2つ以上必要です。もう一度「追加」ボタンを押して、2つ目の景品を追加しましょう。',
            highlightSelector: '#openAddPrizeModalButton',
            waitForClickOn: '#openAddPrizeModalButton',
            removeOkButton: true,
          },
          {
            message: '同じように、2つ目の景品名を入力してください。',
            highlightSelector: '#newPrizeNameInput',
            waitForInputOn: '#newPrizeNameInput',
            removeOkButton: true,
            showNextButtonOnInput: true,
          },
          {
            message: '入力できたら「追加」ボタンを押しましょう。',
            highlightSelector: '#addPrizeOkButton',
            waitForClickOn: '#addPrizeOkButton',
            removeOkButton: true,
          },
          {
            message: '景品を2つ以上追加できたら、「この内容でイベントを作成」ボタンを押して、イベントを保存しましょう。',
            highlightSelector: '#createEventButtonContainer',
            waitForClickOn: '#createEventButton',
            removeOkButton: true,
            complete: true,
          },
        ],
      },
    ],
  },
  {
    id: '04-save-prizes',
    title: 'イベントの変更を保存',
    description: 'イベント管理',
    showInList: false,
    steps: [
      {
        type: 'page',
        match: 'eventEditView',
        // 既存イベント編集中のみ、このチュートリアルが実行されるようにする
        precondition: (state) => !!state.currentEventId && state.currentLotteryData?.status !== 'started',
        subSteps: [
          {
            message: 'イベント内容を編集すると、保存ボタンが表示されます。試しにイベント名を少し変更してみてください。',
            highlightSelector: '#eventNameInput',
            waitForInputOn: '#eventNameInput',
            removeOkButton: true,
            showNextButtonOnInput: true,
          },
          {
            message: '変更が検知されました！「変更を保存してプレビューを更新」ボタンで保存するのを忘れないようにしましょう。',
            highlightSelector: '#saveForPreviewButton',
            waitForClickOn: '#saveForPreviewButton',
            removeOkButton: true,
            complete: true,
          },
        ],
      },
    ],
  },
  {
    id: '05-manage-members',
    title: 'メンバーを管理する',
    description: 'イベント管理',
    steps: [
      {
        type: 'page',
        match: 'dashboardView',
        subSteps: [
          {
            message: 'イベントに参加するメンバーを管理するには、「メンバー管理」ボタンを押します。',
            highlightSelector: '#goToMemberManagementButton',
            waitForClickOn: '#goToMemberManagementButton',
            removeOkButton: true,
          },
        ],
      },
      {
        type: 'page',
        match: 'memberManagementView',
        subSteps: [
          {
            message: 'ここがメンバー管理画面です。「一括登録」ボタンを押してみましょう。',
            highlightSelector: '#bulkRegisterButton',
            waitForClickOn: '#bulkRegisterButton',
            removeOkButton: true,
          },
          {
            message: 'ここにメンバーの名前を改行区切りで入力します。入力後、「チュートリアルを進める」ボタンを押してください。',
            highlightSelector: '#bulkNamesTextarea',
            waitForInputOn: '#bulkNamesTextarea',
            removeOkButton: true,
            showNextButtonOnInput: true,
          },
          {
            message: '入力ありがとうございます。「確認する」ボタンを押して、入力内容をチェックしましょう。',
            highlightSelector: '#analyzeBulkButton',
            waitForClickOn: '#analyzeBulkButton',
            removeOkButton: true,
          },
          {
            message: '登録内容を確認したら、「この内容で登録を実行する」ボタンを押します。これでチュートリアルは完了です！',
            highlightSelector: '#finalizeBulkButton',
            waitForClickOn: '#finalizeBulkButton',
            removeOkButton: true,
            complete: true,
          },
        ],
      },
    ],
  },
  {
    id: '06-broadcast-event',
    title: 'イベントの実施と配信',
    description: 'イベント管理',
    steps: [
      {
        type: 'page',
        match: 'dashboardView',
        subSteps: [
          {
            message: '作成済みのイベントを配信してみましょう。リストから配信したいイベントの「編集」ボタンを押してください。',
            highlightSelector: '#eventList .item-list-item',
            focusSelector: '#eventList .edit-event-btn',
            waitForClickOn: '#eventList .edit-event-btn',
            removeOkButton: true,
          },
        ],
      },
      {
        type: 'page',
        match: 'eventEditView',
        precondition: (state) => state.currentLotteryData && state.currentLotteryData.status !== 'started',
        subSteps: [
          {
            message: 'イベント実施前の最終準備画面です。参加者が足りない場合にメンバーを自動で割り当てたり、あみだくじのパターンを変更したりできます。まず「参加枠を埋める」ボタンを押してみましょう。',
            highlightSelector: '#showFillSlotsModalButton',
            waitForClickOn: '#showFillSlotsModalButton',
            removeOkButton: true,
          },
          {
            message: 'まだイベントに参加していないメンバーがいる場合、ここからランダムで選んで空いている参加枠に割り当てることができます。「メンバーをランダム選出」ボタンを押してください。',
            highlightSelector: '#selectMembersButton',
            waitForClickOn: '#selectMembersButton',
            removeOkButton: true,
          },
          {
            message: '空き枠の数だけ、メンバーが自動で選出されました。問題なければ「このメンバーで枠を埋める」ボタンを押して確定しましょう。',
            highlightSelector: '#confirmFillSlotsButton',
            waitForClickOn: '#confirmFillSlotsButton',
            removeOkButton: true,
          },
          {
            message: '次に、あみだくじの線を変更したい場合は「線を再生成」ボタンを押します。押してみましょう。',
            highlightSelector: '#regenerateLinesButton',
            waitForClickOn: '#regenerateLinesButton',
            removeOkButton: true,
          },
          {
            message: '景品の並び順を変えたい場合は「景品シャッフル」ボタンが便利です。押してみましょう。',
            highlightSelector: '#shufflePrizesBroadcastButton',
            waitForClickOn: '#shufflePrizesBroadcastButton',
            removeOkButton: true,
          },
          {
            message: 'イベントの準備が整ったら、「配信画面へ進む」ボタンで実施画面へ移動します。',
            highlightSelector: '#goToBroadcastViewButton',
            waitForClickOn: '#goToBroadcastViewButton',
            removeOkButton: true,
          },
        ],
      },
      {
        type: 'page',
        match: 'broadcastView',
        subSteps: [
          {
            message: 'ここが配信画面です！参加者が全員参加したら、中央の「イベント開始！」ボタンで抽選を確定します。押してみましょう。',
            precondition: (state) => state.currentLotteryData?.status === 'pending',
            highlightSelector: '#startEventButton',
            waitForClickOn: '#startEventButton',
            removeOkButton: true,
          },
          {
            message: 'イベントが開始されました！右下のボタンを押してコントロールパネルを開き、アニメーションを再生しましょう。',
            precondition: (state) => state.currentLotteryData?.status === 'started',
            highlightSelector: '#openSidebarButton',
            waitForClickOn: '#openSidebarButton',
            removeOkButton: true,
          },
          {
            message: '「全結果を再生」ボタンを押すと、あみだくじのアニメーションが開始します。これでチュートリアルは完了です！',
            precondition: (state) => state.currentLotteryData?.status === 'started',
            highlightSelector: '#animateAllButton',
            waitForClickOn: '#animateAllButton',
            removeOkButton: true,
            complete: true,
          },
        ],
      },
    ],
  },
];
