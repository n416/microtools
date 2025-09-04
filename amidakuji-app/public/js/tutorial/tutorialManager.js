// tutorialManager.js (リサイズ対応・SPA対応・入力待機・アラート検知・事前条件機能 最終版)
(function () {
  let dialogEl = null;
  let highlightEl = null;
  let focusBorderEl = null;
  const CHECK_INTERVAL = 100;
  const MAX_WAIT_TIME = 5000;

  let activeTutorialState = {
    isDialogVisible: false,
    targetEl: null,
    focusTargetEl: null,
    resizeTimeout: null,
    navigatingFromTutorial: false,
  };

  let isInitialized = false;
  let state = null;
  let router = null; // routerを受け取る変数を追加
  let ui = null;     // uiを受け取る変数を追加
  let returnUrl = null; // 戻り先URLを保存する変数を追加

  window.runTutorials = async function () {
    if (activeTutorialState.isDialogVisible || !isInitialized) return;

    if (activeTutorialState.navigatingFromTutorial) {
      activeTutorialState.navigatingFromTutorial = false;
    }

    if (!window.tutorials || !Array.isArray(window.tutorials)) return;

    const searchParams = new URLSearchParams(window.location.search);
    const forcedTutorialId = searchParams.get('forceTutorial');

    const activeView = document.querySelector('.view-container[style*="display: block"]');
    if (!activeView) return;
    const currentViewId = activeView.id;

    if (forcedTutorialId) {
      const storyToForce = window.tutorials.find((s) => s.id === forcedTutorialId);
      if (storyToForce) {
        setTimeout(() => startTutorialSteps(storyToForce, currentViewId), 100);
      }
      return;
    }

    for (const story of window.tutorials) {
      if (isTutorialCompleted(story.id)) continue;

      const pageStep = story.steps.find((step) => step.type === 'page' && step.match === currentViewId);

      if (pageStep) {
        if (pageStep.precondition && !pageStep.precondition(state)) {
          continue;
        }

        await startTutorialSteps(story, currentViewId);
        break;
      }
    }
  };

  function initializeManager(dependencies) {
    if (isInitialized) return;
    state = dependencies.state;
    router = dependencies.router; // routerを保存
    ui = dependencies.ui;         // uiを保存
    createBaseElements();
    setupGlobalListeners();
    isInitialized = true;
  }

  if (!window.tutorialManager) {
    window.tutorialManager = {
      init: initializeManager,
      // 外部から戻り先URLを設定する関数を追加
      setReturnUrl: function (url) {
        returnUrl = url;
      },
    };
  }

  function createBaseElements() {
    if (document.getElementById('tutorial-dialog')) return;
    const styles = `
            .tutorial-highlight-box {
                position: fixed; z-index: 9999; display: none;
                box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.75);
                border-radius: 5px; pointer-events: none;
                transition: all 0.3s ease-in-out;
            }
            .tutorial-focus-border {
                position: fixed; z-index: 10001; display: none;
                pointer-events: none;
                transition: all 0.3s ease-in-out;
                border: 3px solid blue;
                border-radius: 5px;
                box-sizing: border-box; /* ★★★ 修正点 ★★★ */
            }
            .tutorial-dialog {
                position: fixed; background-color: white; border: 1px solid #ccc;
                border-radius: 8px; padding: 20px; box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                z-index: 10002; display: none; max-width: 350px;
                transition: opacity 0.3s ease, transform 0.3s ease; color: #333;
            }
            @media (prefers-color-scheme: dark) {
                .tutorial-dialog {
                    background-color: #333; border-color: #555; color: #eee;
                }
                .tutorial-dialog button {
                    border-color: #555; background-color: #444; color: #eee;
                }
                .tutorial-dialog button.primary {
                    background-color: #0d6efd; border-color: #0d6efd; color: white;
                }
            }
            .tutorial-dialog .step-title { font-weight: bold; margin-bottom: 10px; font-size: 1.2em; }
            .tutorial-dialog .step-message { margin-bottom: 20px; line-height: 1.6; }
            .tutorial-dialog .step-actions { display: flex; justify-content: flex-end; gap: 10px; }
            .tutorial-dialog button { padding: 8px 16px; border-radius: 4px; cursor: pointer; border: 1px solid #ccc; }
            .tutorial-dialog button.primary { background-color: #007bff; color: white; border-color: #007bff; }
        `;
    const styleSheet = document.createElement('style');
    styleSheet.type = 'text/css';
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);

    highlightEl = document.createElement('div');
    highlightEl.id = 'tutorial-highlight-box';
    highlightEl.className = 'tutorial-highlight-box';
    document.body.appendChild(highlightEl);

    focusBorderEl = document.createElement('div');
    focusBorderEl.id = 'tutorial-focus-border';
    focusBorderEl.className = 'tutorial-focus-border';
    document.body.appendChild(focusBorderEl);

    dialogEl = document.createElement('div');
    dialogEl.id = 'tutorial-dialog';
    dialogEl.className = 'tutorial-dialog';
    document.body.appendChild(dialogEl);
  }

  function setupGlobalListeners() {
    window.addEventListener('resize', () => {
      if (activeTutorialState.isDialogVisible) {
        clearTimeout(activeTutorialState.resizeTimeout);
        activeTutorialState.resizeTimeout = setTimeout(() => {
          updateHighlightPosition(activeTutorialState.targetEl);
          updateFocusBorderPosition(activeTutorialState.focusTargetEl);
          positionDialog(dialogEl, activeTutorialState.focusTargetEl || activeTutorialState.targetEl);
        }, 100);
      }
    });
  }

  function waitForElement(selector) {
    return new Promise((resolve, reject) => {
      let elapsedTime = 0;
      const interval = setInterval(() => {
        const element = document.querySelector(selector);
        if (element && element.offsetParent !== null) {
          clearInterval(interval);
          resolve(element);
        }
        elapsedTime += CHECK_INTERVAL;
        if (elapsedTime >= MAX_WAIT_TIME) {
          clearInterval(interval);
          reject(new Error(`Element with selector "${selector}" not found or not visible within ${MAX_WAIT_TIME}ms`));
        }
      }, CHECK_INTERVAL);
    });
  }

  async function startTutorialSteps(story, currentViewId) {
    const pageStep = story.steps.find((step) => step.type === 'page' && step.match === currentViewId);
    if (!pageStep || !pageStep.subSteps) return;

    if (pageStep.precondition && !pageStep.precondition(state)) {
      return;
    }

    let startIndex = 0;
    for (let i = 0; i < pageStep.subSteps.length; i++) {
      const subStep = pageStep.subSteps[i];
      if (subStep.precondition && !subStep.precondition(state)) {
        startIndex = i + 1;
      } else {
        break;
      }
    }

    if (startIndex >= pageStep.subSteps.length) {
      return;
    }

    try {
      for (let i = startIndex; i < pageStep.subSteps.length; i++) {
        const subStep = pageStep.subSteps[i];
        if (subStep.precondition && !subStep.precondition(state)) {
          continue;
        }
        const result = await showDialog(story, subStep, currentViewId);
        if (!result.ok) {
          returnUrl = null; // キャンセルされたら戻り先URLをリセット
          return;
        }
        if (subStep.complete === true) {
          markTutorialAsCompleted(story.id);
          // ▼▼▼ チュートリアル完了時の処理を追加 ▼▼▼
          if (story.returnOnComplete && returnUrl && router) {
            const urlToReturn = returnUrl;
            returnUrl = null; // 次回のためにリセット
            ui.showToast('チュートリアル完了！元の画面に戻ります。', 2000);
            setTimeout(() => router.navigateTo(urlToReturn), 1500);
          }
          // ▲▲▲ ここまで ▲▲▲
          return;
        }
      }
    } catch (error) {
      console.warn('[TUTORIAL_LOG] Tutorial aborted as expected:', error.message);
      if (dialogEl) dialogEl.style.display = 'none';
      if (highlightEl) highlightEl.style.display = 'none';
      if (focusBorderEl) focusBorderEl.style.display = 'none';
      activeTutorialState.isDialogVisible = false;
      returnUrl = null; // エラー時も戻り先URLをリセット
    }
  }

  function showDialog(story, subStep, currentViewId) {
    return new Promise(async (resolve, reject) => {
      const highlightSelector = subStep.highlightSelector;
      const clickSelector = subStep.waitForClickOn;
      const inputSelector = subStep.waitForInputOn;
      const focusSelector = subStep.focusSelector;

      activeTutorialState.targetEl = null;
      activeTutorialState.focusTargetEl = null;

      try {
        const selectorForHighlight = highlightSelector || clickSelector || inputSelector;
        if (selectorForHighlight) {
          activeTutorialState.targetEl = await waitForElement(selectorForHighlight);

          await new Promise((resolveScroll) => {
            activeTutorialState.targetEl.scrollIntoView({behavior: 'smooth', block: 'center', inline: 'center'});

            let scrollTimeout;
            const scrollListener = () => {
              clearTimeout(scrollTimeout);
              scrollTimeout = setTimeout(() => {
                window.removeEventListener('scroll', scrollListener);
                resolveScroll();
              }, 150);
            };

            const fallbackTimeout = setTimeout(() => {
              window.removeEventListener('scroll', scrollListener);
              resolveScroll();
            }, 1000);

            window.addEventListener('scroll', scrollListener);

            const rect = activeTutorialState.targetEl.getBoundingClientRect();
            if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
              setTimeout(() => {
                clearTimeout(fallbackTimeout);
                window.removeEventListener('scroll', scrollListener);
                resolveScroll();
              }, 300);
            }
          });

          updateHighlightPosition(activeTutorialState.targetEl);
        } else {
          highlightEl.style.display = 'block';
          highlightEl.style.boxShadow = '0 0 0 9999px rgba(0, 0, 0, 0.75)';
        }

        if (focusSelector) {
          activeTutorialState.focusTargetEl = await waitForElement(focusSelector);
          updateFocusBorderPosition(activeTutorialState.focusTargetEl);
        }
      } catch (error) {
        reject(error);
        return;
      }

      dialogEl.innerHTML = `
                <div class="step-title">${escapeHtml(story.title)}</div>
                <div class="step-message">${escapeHtml(subStep.message)}</div>
                <div class="step-actions">
                    <button id="tutorial-cancel-btn">終了</button>
                    <button id="tutorial-next-btn" class="primary">次へ</button>
                </div>
            `;
      const nextBtn = dialogEl.querySelector('#tutorial-next-btn');
      const cancelBtn = dialogEl.querySelector('#tutorial-cancel-btn');

      if (subStep.removeOkButton) nextBtn.style.display = 'none';

      dialogEl.style.display = 'block';
      activeTutorialState.isDialogVisible = true;
      positionDialog(dialogEl, activeTutorialState.focusTargetEl || activeTutorialState.targetEl);

      let cleanupListeners = () => {};
      let originalAlert = window.alert;
      let alertTriggered = false;

      const closeDialog = (result) => {
        cleanupListeners();
        dialogEl.style.display = 'none';
        highlightEl.style.display = 'none';
        focusBorderEl.style.display = 'none';
        activeTutorialState.isDialogVisible = false;
        activeTutorialState.targetEl = null;
        activeTutorialState.focusTargetEl = null;
        resolve(result);
      };

      const onNext = () => closeDialog({ok: true});
      const onCancel = () => closeDialog({ok: false});

      nextBtn.addEventListener('click', onNext);
      cancelBtn.addEventListener('click', onCancel);

      let clickHandler;
      let inputHandler, compositionStartHandler, compositionEndHandler, debounceTimeout;

      if (clickSelector) {
        const clickTarget = await waitForElement(clickSelector);
        window.alert = function (message) {
          alertTriggered = true;
          originalAlert(message);
        };
        
        // ▼▼▼ ここからが今回の修正点です ▼▼▼
        clickHandler = () => {
          window.alert = originalAlert;
          if (alertTriggered) {
            alert('チュートリアルを続行できませんでした。最初のステップからやり直します。');
            closeDialog({ok: false});
            startTutorialSteps(story, currentViewId);
          } else {
            closeDialog({ok: true});
          }
        };
        // ▲▲▲ ここまでが修正点です ▲▲▲
        clickTarget.addEventListener('click', clickHandler, {once: true});
      } else if (inputSelector) {
        const inputEl = await waitForElement(inputSelector);
        let isComposing = false;

        compositionStartHandler = () => {
          isComposing = true;
        };
        compositionEndHandler = (e) => {
          isComposing = false;
          e.target.dispatchEvent(new Event('input'));
        };

        inputHandler = () => {
          clearTimeout(debounceTimeout);
          if (isComposing) return;

          const hasValue = inputEl.value.trim() !== '';

          if (subStep.showNextButtonOnInput) {
            if (hasValue) {
              nextBtn.style.display = 'inline-flex';
              nextBtn.textContent = 'チュートリアルを進める';
            } else {
              nextBtn.style.display = 'none';
            }
          } else if (hasValue) {
            debounceTimeout = setTimeout(() => {
              closeDialog({ok: true});
            }, 2000);
          }
        };

        inputEl.addEventListener('input', inputHandler);
        inputEl.addEventListener('compositionstart', compositionStartHandler);
        inputEl.addEventListener('compositionend', compositionEndHandler);
      }

      cleanupListeners = () => {
        window.alert = originalAlert;
        nextBtn.removeEventListener('click', onNext);
        cancelBtn.removeEventListener('click', onCancel);
        if (clickSelector && clickHandler) {
          const clickTarget = document.querySelector(clickSelector);
          if (clickTarget) clickTarget.removeEventListener('click', clickHandler);
        }
        if (inputSelector && inputHandler) {
          clearTimeout(debounceTimeout);
          const inputEl = document.querySelector(inputSelector);
          if (inputEl) {
            inputEl.removeEventListener('input', inputHandler);
            inputEl.removeEventListener('compositionstart', compositionStartHandler);
            inputEl.removeEventListener('compositionend', compositionEndHandler);
          }
        }
      };
    });
  }

  function updateHighlightPosition(targetEl) {
    if (!targetEl) {
      highlightEl.style.display = 'block';
      highlightEl.style.boxShadow = '0 0 0 9999px rgba(0, 0, 0, 0.75)';
      highlightEl.style.left = '0px';
      highlightEl.style.top = '0px';
      highlightEl.style.width = '0px';
      highlightEl.style.height = '0px';
      return;
    }
    const rect = targetEl.getBoundingClientRect();
    const padding = 5;
    highlightEl.style.left = `${rect.left - padding}px`;
    highlightEl.style.top = `${rect.top - padding}px`;
    highlightEl.style.width = `${rect.width + padding * 2}px`;
    highlightEl.style.height = `${rect.height + padding * 2}px`;
    highlightEl.style.display = 'block';
  }

  function updateFocusBorderPosition(targetEl) {
    if (!targetEl) {
      focusBorderEl.style.display = 'none';
      return;
    }
    const rect = targetEl.getBoundingClientRect();
    focusBorderEl.style.left = `${rect.left}px`;
    focusBorderEl.style.top = `${rect.top}px`;
    focusBorderEl.style.width = `${rect.width}px`;
    focusBorderEl.style.height = `${rect.height}px`;
    focusBorderEl.style.display = 'block';
  }

  function positionDialog(dialog, targetEl) {
    const dialogRect = dialog.getBoundingClientRect();
    let top, left;
    if (!targetEl) {
      top = (window.innerHeight - dialogRect.height) / 2;
      left = (window.innerWidth - dialogRect.width) / 2;
    } else {
      const rect = targetEl.getBoundingClientRect();
      const padding = 15;
      top = rect.bottom + padding;
      left = rect.left + rect.width / 2 - dialogRect.width / 2;
      if (top + dialogRect.height > window.innerHeight - 10) top = rect.top - dialogRect.height - padding;
      if (top < 10) top = 10;
      if (left < 10) left = 10;
      if (left + dialogRect.width > window.innerWidth - 10) left = window.innerWidth - dialogRect.width - 10;
    }
    dialog.style.top = `${top}px`;
    dialog.style.left = `${left}px`;
    dialog.style.transform = 'none';
  }

  function isTutorialCompleted(storyId) {
    try {
      return localStorage.getItem(`tutorialCompleted_${storyId}`) === 'true';
    } catch (e) {
      return false;
    }
  }

  function markTutorialAsCompleted(storyId) {
    try {
      localStorage.setItem(`tutorialCompleted_${storyId}`, 'true');
    } catch (e) {
      console.error('[TUTORIAL_LOG] FAILED to set item in localStorage:', e);
    }
  }

  function escapeHtml(str) {
    return str ? str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;') : '';
  }
})();