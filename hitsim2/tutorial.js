import { driver } from "driver.js";
import "driver.js/dist/driver.css";

const TUTORIAL_KEY = "hitsim2_tutorial_state";

export function getTutorialState() {
  return localStorage.getItem(TUTORIAL_KEY);
}

export function setTutorialState(state) {
  if (state === null) {
    localStorage.removeItem(TUTORIAL_KEY);
  } else {
    localStorage.setItem(TUTORIAL_KEY, state);
  }
}

export function resetTutorial() {
  setTutorialState(null);
  window.location.href = "index.html";
}

// ------------------------------------
// カスタムUIヘルパー：標準のalert/confirmをリッチなUIに置き換える
// ------------------------------------
function applyDriverInteractionFix() {
  if (!document.getElementById('driver-fix-style')) {
    const style = document.createElement('style');
    style.id = 'driver-fix-style';
    style.innerHTML = `
      /* Driver.jsのSVGオーバーレイによるクリック吸収を無効化し、下の要素へ貫通させる */
      body.driver-active .driver-overlay { pointer-events: none !important; }
      
      /* 設定モーダルおよびカスタムアラート全体を常にクリック可能にする */
      body.driver-active #settings-modal-overlay,
      body.driver-active #settings-modal-overlay *,
      body.driver-active .premium-modal-overlay,
      body.driver-active .premium-modal-overlay * { pointer-events: auto !important; }
    `;
    document.head.appendChild(style);
  }
}

function showCustomAlert(message) {
  const overlay = document.createElement('div');
  overlay.className = 'premium-modal-overlay';
  overlay.style.display = 'flex';
  overlay.style.zIndex = '9999999'; // Driver.jsのオーバーレイより前面に
  overlay.style.pointerEvents = 'auto'; // Driver.jsによるpointer-events: noneを解除
  overlay.innerHTML = `
    <div class="premium-modal" style="max-width: 400px; height: auto; min-height: 180px; text-align: center; display: flex; flex-direction: column; justify-content: center;">
      <div class="premium-modal-header" style="justify-content: center; margin-bottom: 15px; padding-bottom: 15px;">
        <h2 class="premium-modal-title" style="font-size: 1.4rem;">⚠️ 確認</h2>
      </div>
      <div class="premium-settings-content" style="padding: 10px; flex: none;">
        <p style="margin-bottom: 25px; font-size: 1.1rem;">${message}</p>
        <button class="button-like" style="background-color: #007bff; color: white; padding: 8px 30px; font-size: 1rem; cursor: pointer; display: inline-block;" onclick="this.closest('.premium-modal-overlay').remove()">OK</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function showCustomConfirm(message, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'premium-modal-overlay';
  overlay.style.display = 'flex';
  overlay.style.zIndex = '9999999';
  overlay.style.pointerEvents = 'auto'; // Driver.jsによるpointer-events: noneを解除
  
  const modal = document.createElement('div');
  modal.className = 'premium-modal';
  modal.style.maxWidth = '400px';
  modal.style.height = 'auto';
  modal.style.minHeight = '180px';
  modal.style.textAlign = 'center';
  modal.style.display = 'flex';
  modal.style.flexDirection = 'column';
  modal.style.justifyContent = 'center';
  
  modal.innerHTML = `
    <div class="premium-modal-header" style="justify-content: center; margin-bottom: 15px; padding-bottom: 15px;">
      <h2 class="premium-modal-title" style="font-size: 1.4rem;">確認</h2>
    </div>
    <div class="premium-settings-content" style="padding: 10px; flex: none;">
      <p style="margin-bottom: 25px; font-size: 1.1rem;">${message}</p>
      <div style="display: flex; gap: 15px; justify-content: center;">
        <button class="button-like" id="custom-confirm-ok" style="background-color: #007bff; color: white; padding: 8px 20px; font-size: 1rem; cursor: pointer;">OK</button>
        <button class="button-like" id="custom-confirm-cancel" style="background-color: #555; color: white; padding: 8px 20px; font-size: 1rem; cursor: pointer;">キャンセル</button>
      </div>
    </div>
  `;
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  document.getElementById('custom-confirm-ok').onclick = () => {
    overlay.remove();
    onConfirm();
  };
  document.getElementById('custom-confirm-cancel').onclick = () => {
    overlay.remove();
  };
}

export function setupTutorialResetButton(buttonId) {
  const btn = document.getElementById(buttonId);
  if (btn) {
    btn.addEventListener("click", () => {
      showCustomConfirm("チュートリアルを最初からやり直しますか？", () => {
        resetTutorial();
      });
    });
  }
}

// ------------------------------------
// ヘルパー関数：要素のクリックや状態変更を代行する
// ------------------------------------
function simulateCheckboxClick(id, desiredState) {
  const cb = document.getElementById(id);
  if (cb && cb.checked !== desiredState) {
    cb.checked = desiredState;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function simulateButtonClick(id) {
  const btn = document.getElementById(id);
  if (btn) {
    btn.click();
  }
}

// ------------------------------------
// メイン画面（index.html）のチュートリアル
// ------------------------------------
export function runSimulatorTutorial() {
  applyDriverInteractionFix();
  const state = getTutorialState();

  if (!state) {
    // 【フェーズ1】未実施状態（index.htmlに直接アクセスされた場合）
    const driverObj = driver({
      showProgress: true,
      allowClose: false, // 途中で閉じられないようにする
      steps: [
        {
          element: "#edit-inventory-button",
          popover: {
            title: "まずは初期設定をしましょう！",
            description: "このツールを使うには、最初に「データ画面」での初期設定が必要です。<br>「移動する」を押すと、自動的にデータ画面へ移動します。",
            side: "bottom",
            align: "start",
            doneBtnText: '移動する'
          }
        }
      ],
      onDestroyStarted: () => {
        setTutorialState('step_data_setup');
        simulateButtonClick('edit-inventory-button');
        driverObj.destroy();
      }
    });
    driverObj.drive();
  } else if (state === "step_simulator_practice") {
    // 【フェーズ3】実践編（すべて選択してindex.htmlに戻ってきた場合）
    const driverObj = driver({
      showProgress: true,
      nextBtnText: '次へ',
      prevBtnText: '戻る',
      doneBtnText: '完了',
      steps: [
        {
          element: "#inventory-panel",
          popover: {
            title: "インベントリ",
            description: "先ほど自動追加したアイテムがここに入っています。<br>アイテムをクリックすると「選択状態」になります。",
            side: "left",
            align: "start"
          }
        },
        {
          element: "#sets-container",
          popover: {
            title: "装備スロット",
            description: "アイテムを選択した状態でここのスロットをクリックすると、アイテムを装備できます。",
            side: "right",
            align: "start"
          }
        },
        {
          element: "#stats-panel",
          popover: {
            title: "ステータス",
            description: "装備したアイテムの合計ステータスがここに計算されて表示されます。",
            side: "top",
            align: "start"
          }
        },
        {
          element: "#set-switchers",
          popover: {
            title: "セットの切り替え",
            description: "最大4つの装備セットを保存して切り替えることができます。<br>以上でチュートリアルは終了です！",
            side: "bottom",
            align: "start"
          }
        }
      ],
      onDestroyStarted: () => {
        setTutorialState("completed");
        driverObj.destroy();
      }
    });
    driverObj.drive();
  }
}

// ------------------------------------
// データ画面（data.html）のチュートリアル
// ------------------------------------
export function runDataSelectorTutorial() {
  applyDriverInteractionFix();
  const state = getTutorialState();
  
  // もし未実施状態でいきなりdata.htmlに来たらフェーズ2を開始する
  if (!state) {
    setTutorialState("step_data_setup");
  }

  // 「トップページに戻る」が手動で押された時の保険
  const backBtn = document.getElementById('back-to-top-button');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (getTutorialState() === "step_data_setup") {
        setTutorialState("step_simulator_practice");
      }
    });
  }

  if (getTutorialState() === "step_data_setup") {
    const driverObj = driver({
      showProgress: true,
      nextBtnText: '次へ',
      prevBtnText: '戻る',
      doneBtnText: '完了',
      allowClose: false, // ガイドに沿って進めさせる
      steps: [
        {
          element: "#settings-button",
          popover: {
            title: "初期設定",
            description: "初期設定を行います。「次へ」を押すと自動で設定画面を開きます。",
            side: "bottom",
            align: "start",
            onNextClick: () => {
              simulateButtonClick('settings-button');
              // モーダルが開くアニメーション等に対応するため少し待つ
              setTimeout(() => {
                driverObj.moveNext();
              }, 100);
            }
          }
        },
        {
          element: "#settings-modal .premium-settings-content",
          popover: {
            title: "おすすめ設定の適用",
            description: "「古代以上のみ表示」「伝説は表示しない」「カンパネラ等を常に表示」の3つのおすすめ設定を、自動でオンにしました！",
            side: "left",
            align: "start",
            onPopoverRender: () => {
              // ポップアップが表示されるタイミングで自動チェック
              simulateCheckboxClick('setting-ancient-only', true);
              simulateCheckboxClick('setting-hide-legendary', true);
              simulateCheckboxClick('setting-always-show-special', true);
            }
          }
        },
        {
          element: "#setting-class-grid",
          popover: {
            title: "職業の選択",
            description: "ご自身のプレイする職業（武器）をここからクリックして選択してください。<br>複数選択も可能です。<br>選択できたら「次へ」を押してください。",
            side: "left",
            align: "start",
            onNextClick: () => {
              const checkedClasses = document.querySelectorAll('#setting-class-grid input[type="checkbox"]:checked');
              if (checkedClasses.length === 0) {
                showCustomAlert("少なくとも1つの職業を選択してください！");
              } else {
                driverObj.moveNext();
              }
            }
          }
        },
        {
          element: "#settings-close-btn",
          popover: {
            title: "設定の完了",
            description: "この設定は後からいつでも変更できます。「次へ」を押すと設定を閉じます。",
            side: "bottom",
            align: "start",
            onNextClick: () => {
              simulateButtonClick('settings-close-btn');
              setTimeout(() => {
                driverObj.moveNext();
              }, 100);
            }
          }
        },
        {
          element: "#check-all-header",
          popover: {
            title: "一括選択",
            description: "設定した条件のアイテムが絞り込まれました。<br>「次へ」を押すと、全て自動でインベントリに追加します！",
            side: "bottom",
            align: "start",
            onNextClick: () => {
              simulateButtonClick('check-all-header');
              setTimeout(() => {
                driverObj.moveNext();
              }, 100);
            }
          }
        },
        {
          element: "#back-to-top-button",
          popover: {
            title: "シミュレータへ戻る",
            description: "準備が完了しました！「シミュレータへ」を押して画面に戻りましょう。",
            side: "bottom",
            align: "start",
            doneBtnText: 'シミュレータへ'
          }
        }
      ],
      onDestroyStarted: () => {
        // 最終ステップの「シミュレータへ（完了）」が押された時、あるいは手動離脱の時の処理
        setTutorialState("step_simulator_practice");
        simulateButtonClick('back-to-top-button');
        driverObj.destroy();
      }
    });
    driverObj.drive();
  }
}
