import { generateShareableUrl, saveToLocalStorage, loadFromLocalStorage } from './storage.js';
import { data, loadFromUrlParams } from './storage.js';

/****************************************
 * 必要な変数や要素の取得
 ****************************************/
const taskInput = document.getElementById('task-input');
const addTaskButton = document.getElementById('add-task-button');
const taskList = document.getElementById('task-list');
const progressText = document.getElementById('progress-text');
const toast = document.getElementById('toast');
const undoButton = document.getElementById('undoButton');
const redoButton = document.getElementById('redoButton');
const settingsButton = document.getElementById('settingsButton');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsButton = document.getElementById('closeSettingsButton');
const addMemberButton = document.getElementById('addMemberButton');
const saveSettingsButton = document.getElementById('saveSettingsButton');
const memberList = document.getElementById('memberList');
const iconPickerModal = document.getElementById('iconPickerModal');
const closeIconPickerButton = document.getElementById('closeIconPickerButton');
const iconList = document.getElementById('iconList');
const shareButton = document.getElementById('shareButton');

/****************************************
 * タスク削除モーダル（確認用）
 ****************************************/
const deleteConfirmModalOverlay = document.getElementById('deleteConfirmModalOverlay');
const confirmDeleteModal = document.getElementById('deleteConfirmModal');
const confirmDeleteButton = document.getElementById('confirmDeleteButton');
const cancelDeleteButton = document.getElementById('cancelDeleteButton');
let pendingDeleteTaskIndex = null;  // どのタスクを削除するか、一時保存

/****************************************
 * ★キュー方式による逐次処理
 ****************************************/
let actionQueue = [];
let isProcessing = false;

/**
 * アクションをキューに積む
 */
function enqueueAction(action) {
    actionQueue.push(action);
    processQueue();
}

/**
 * キューを順次実行
 */
function processQueue() {
    if (isProcessing) return;
    if (actionQueue.length === 0) return;

    isProcessing = true;
    try {
        const nextAction = actionQueue.shift();
        nextAction();
    } catch (error) {
        console.error('Action Error:', error);
    } finally {
        isProcessing = false;
        if (actionQueue.length > 0) {
            processQueue();
        }
    }
}

/**
 * トースト通知の表示
 */
export function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

/**
 * 状態の保存（アンドゥ用）
 */
export function saveState() {
    console.log("コール！");
    console.log("Saving state:", JSON.stringify(data.tasks));
    const currentState = {
        tasks: JSON.parse(JSON.stringify(data.tasks)),
        members: JSON.parse(JSON.stringify(data.members))
    };
    data.undoStack.push(JSON.stringify(currentState));
    if (data.undoStack.length > 20) data.undoStack.shift();
    data.redoStack = [];
    updateUndoRedoButtons(); // Undo/Redoボタンの有効・無効を更新
}

/****************************************
 * Undo/Redoボタン無効化ロジック
 ****************************************/
function updateUndoRedoButtons() {
    // Undo
    if (data.undoStack.length === 0) {
        undoButton.disabled = true;
    } else {
        undoButton.disabled = false;
    }
    // Redo
    if (data.redoStack.length === 0) {
        redoButton.disabled = true;
    } else {
        redoButton.disabled = false;
    }
}

/**
 * タスクリストを描画する
 */
export function renderTasks() {
    const taskList = document.querySelector('#task-list');
    const hideIndex = document.querySelector('#index-number-invisible').checked;
    taskList.innerHTML = '';

    data.tasks.forEach((task, index) => {
        const taskElement = createTaskElement(task, index, hideIndex);
        taskList.appendChild(taskElement);
    });

    updateProgress();
}

/**
 * メンバーリストを描画
 */
export function renderMembers() {
    // 既存のリストをクリア
    memberList.innerHTML = '';

    // メンバーごとにUIを生成
    data.members.forEach((member) => {
        // メンバー行のコンテナ
        const memberRow = document.createElement('div');
        memberRow.className = 'member-row';

        // 名前の入力欄
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'member-name-input input-box'; // input-box を適用
        nameInput.value = member.name;

        // 名前変更時のイベントリスナー
        nameInput.addEventListener('input', () => {
            member.name = nameInput.value.trim();
        });

        // アイコンボタン
        const iconButton = document.createElement('button');
        iconButton.className = 'icon-button btn'; // ボタン共通クラス＋独自クラス
        const iconElement = document.createElement('i');
        iconElement.className = member.icon || 'fas fa-user'; // デフォルトアイコン
        iconButton.appendChild(iconElement);

        // アイコンボタンがクリックされたとき
        iconButton.addEventListener('click', () => {
            openIconPickerModal(iconButton);
        });

        // アイコン選択モーダルでのアイコン選択
        iconList.addEventListener('click', (event) => {
            const closestOption = event.target.closest('.icon-option'); // アイコン選択肢を取得
            if (!closestOption) {
                console.warn('No .icon-option element found.');
                return;
            }

            // 現在選択されているアイコンをすべて解除
            document.querySelectorAll('.icon-option.selected').forEach(option => {
                option.classList.remove('selected');
            });

            // 新しく選択されたアイコンに選択クラスを追加
            closestOption.classList.add('selected');

            const ic = closestOption.querySelector('i');
            const iconClass = ic ? ic.className : 'fas fa-user';

            if (selectedIconButton) {
                selectedIconButton.innerHTML = `<i class="${iconClass}"></i>`;
                const memberRow = selectedIconButton.closest('.member-row');
                if (memberRow) {
                    const nameInput = memberRow.querySelector('.member-name-input');
                    const memberName = nameInput ? nameInput.value.trim() : null;

                    if (memberName) {
                        const foundMember = data.members.find((m) => m.name === memberName);
                        if (foundMember) {
                            foundMember.icon = iconClass;
                        }
                    }
                }
            }
        });

        // グローバルでクリックを監視して、選択中アイコンボタンを更新
        document.addEventListener('click', (event) => {
            const button = event.target.closest('.icon-button');
            if (button) {
                selectedIconButton = button;
            }
        });

        // 削除ボタン
        const deleteButton = document.createElement('button');
        // ボタン共通クラス + 赤ボタン
        deleteButton.className = 'delete-member-btn btn btn--red';
        deleteButton.textContent = '削除';

        // 削除ボタンのイベントリスナー
        deleteButton.addEventListener('click', () => {
            memberRow.classList.add('deleted-member-row');
            memberRow.style.display = 'none';
            data.member = data.members.filter((m) => m !== member); // メンバーリストから削除
        });

        // メンバー行に要素を追加
        memberRow.appendChild(nameInput);
        memberRow.appendChild(iconButton);
        memberRow.appendChild(deleteButton);

        // リストに追加
        memberList.appendChild(memberRow);
    });
}

/**
 * 進捗の更新（パーセンテージ）
 */
function updateProgress() {
    const totalButtons = data.tasks.reduce((sum, task) => sum + Object.keys(task.buttons).length, 0);
    const completedButtons = data.tasks.reduce(
        (sum, task) => sum + Object.values(task.buttons).filter((state) => state).length,
        0
    );
    const progress = totalButtons > 0 ? Math.round((completedButtons / totalButtons) * 100) : 0;
    progressText.textContent = `${progress}%`;
}

/**
 * 1つのタスク要素を生成
 */
function createTaskElement(task, index, hideIndex) {
    const li = document.createElement('li');
    li.className = task.completed ? 'completed' : '';

    // HTML5 DnD属性
    li.draggable = true;

    // 既存のHTML5 DnDイベント
    li.addEventListener('dragstart', handleDragStart);
    li.addEventListener('dragover', handleDragOver);
    li.addEventListener('dragend', handleDragEnd);

    // 連番表示
    const indexSpan = hideIndex ? '' : `<span class="task-index">${index + 1}. </span>`;
    li.innerHTML = `
      ${indexSpan}<div class="task-caption"><span>${task.text}</span></div>
      <div class="task-buttons"></div>
      <div class="task-delete-buttons">
          <!-- 削除ボタンは script.js で付与しない場合、ここでHTML直書きでもOK -->
          <button class="delete-task-btn btn btn--red">削除</button>
      </div>
    `;

    const buttonsContainer = li.querySelector('.task-buttons');

    data.members.forEach((member) => {
        const iconClass = member.icon || 'fas fa-user';
        if (!(member.name in task.buttons)) {
            task.buttons[member.name] = false;
        }
        // ボタン共通クラスを付与しつつ、完了時はちょっと違う見た目にする例
        const button = document.createElement('button');
        button.className = task.buttons[member.name] ? 'completed-button btn' : 'btn';
        button.innerHTML = task.buttons[member.name] ? '完了' : `<i class="${iconClass}"></i>`;

        button.addEventListener('click', () => {
            enqueueAction(() => {
                saveState();
                task.buttons[member.name] = !task.buttons[member.name];
                button.innerHTML = task.buttons[member.name] ? '完了' : `<i class="${iconClass}"></i>`;
                button.className = task.buttons[member.name] ? 'completed-button btn' : 'btn';
                checkTaskCompletion(task, index);
            });
        });
        buttonsContainer.appendChild(button);
    });

    // 削除ボタン => 削除確認モーダルを表示
    li.querySelector('.delete-task-btn').addEventListener('click', () => {
        pendingDeleteTaskIndex = index;
        deleteConfirmModalOverlay.classList.add('active');
        confirmDeleteModal.style.display = 'block';
    });

    /********************************************
     * Pointer Eventsを用いたモバイル対応
     ********************************************/
    li.addEventListener('pointerdown', (event) => {
        // pointerdown => dragstart相当
        handlePointerDown(event, li);

        // ★追加: 長押し判定（500ms）でタスク編集
        startLongPressTimer(li);
    });
    li.addEventListener('pointermove', (event) => {
        // pointermove => dragover相当
        handlePointerMove(event);

        // 長押しが解除されるほど動いたらキャンセル
        cancelLongPressTimer();
    });
    li.addEventListener('pointerup', (event) => {
        // pointerup => dragend相当
        handlePointerUp(event);

        // 長押しの最終キャンセル
        cancelLongPressTimer();
    });

    return li;
}

/**********************************************
 * 長押し処理（タスク編集）
 **********************************************/
let longPressTimeout;
let isLongPress = false;

/**
 * 長押しタイマーを開始
 */
function startLongPressTimer(li) {
    isLongPress = false;
    longPressTimeout = setTimeout(() => {
        isLongPress = true;
        const taskIndex = Array.from(taskList.children).indexOf(li);
        handleLongPress(taskIndex);
    }, 500); // 500ms 長押し
}

/**
 * 長押しタイマーをキャンセル
 */
function cancelLongPressTimer() {
    clearTimeout(longPressTimeout);
}

/**
 * 長押し時のタスク編集処理
 */
function handleLongPress(taskIndex) {
    const editTaskModalOverlay = document.getElementById('editTaskModalOverlay');
    const editTaskModal = document.getElementById('editTaskModal');
    const editTaskInput = document.getElementById('editTaskInput');

    // 現在のタスク内容を入力欄に設定
    editTaskInput.value = data.tasks[taskIndex].text;

    // モーダルを表示
    editTaskModalOverlay.classList.add('active');
    editTaskModal.style.display = 'block';

    // 保存ボタンの動作
    const saveEditTaskButton = document.getElementById('saveEditTaskButton');
    saveEditTaskButton.onclick = () => {
        data.tasks[taskIndex].text = editTaskInput.value.trim();
        saveToLocalStorage();
        renderTasks();
        closeModal(editTaskModalOverlay);
        showToast('タスクを編集しました');
    };

    // キャンセルボタンの動作
    const cancelEditTaskButton = document.getElementById('cancelEditTaskButton');
    cancelEditTaskButton.onclick = () => {
        closeModal(editTaskModalOverlay);
    };
}

/**
 * タスク完了チェック
 */
function checkTaskCompletion(task, index) {
    const allCompleted = Object.values(task.buttons).every((state) => state);
    updateProgress();

    if (allCompleted && !task.completed) {
        task.completed = true;
        const moveToBottomDisabled = document.getElementById('move-task-to-Bottom-disabled').checked;
        if (!moveToBottomDisabled) {
            moveTaskToBottom(index);
        } else {
            renderTasks();
        }
        showToast('タスクが完了しました');
    } else if (!allCompleted && task.completed) {
        task.completed = false;
        showToast('タスクを未完了に戻しました');
        renderTasks();
    }
    saveToLocalStorage();
}

/**
 * タスクを追加
 */
function addTask(taskText) {
    const newTask = {
        text: taskText,
        completed: false,
        buttons: {},
    };
    data.members.forEach((member) => {
        newTask.buttons[member.name] = false;
    });
    data.tasks.push(newTask);
    saveToLocalStorage();
    renderTasks();
    showToast('タスクを追加しました');
}

/**
 * タスクを最下部に移動
 */
function moveTaskToBottom(clickedIndex) {
    const taskItems = Array.from(taskList.children);
    const movedTask = data.tasks[clickedIndex];

    // タスクを完了状態に更新
    movedTask.completed = true;

    // 配列を更新しタスクを末尾に移動
    data.tasks.splice(clickedIndex, 1);
    data.tasks.push(movedTask);

    // アニメーションの適用
    taskItems.forEach((item, index) => {
        if (index === clickedIndex) {
            item.style.transition = 'transform 0.3s';
            item.style.transform = `translateY(${(taskItems.length - clickedIndex - 1) * item.offsetHeight}px)`;
        } else if (index > clickedIndex) {
            item.style.transition = 'transform 0.3s';
            item.style.transform = `translateY(-${item.offsetHeight}px)`;
        }
    });

    // アニメーション終了後にUIを更新
    taskItems[clickedIndex].addEventListener(
        'transitionend',
        () => {
            // スタイルリセット
            taskItems.forEach((item) => {
                item.style.transition = '';
                item.style.transform = '';
            });

            // タスクを末尾に移動
            const movedItem = taskItems.splice(clickedIndex, 1)[0];
            taskList.appendChild(movedItem);

            // 再描画して状態をUIに反映
            renderTasks();

            // ローカルストレージに保存
            saveToLocalStorage();
        },
        { once: true }
    );
}

/**
 * タスクを削除（確認モーダルOK後に実行）
 */
function deleteTask(index) {
    saveState(); // 現在の状態をアンドゥ用に保存
    data.tasks.splice(index, 1); // 指定したタスクを削除
    saveToLocalStorage(); // 削除後の状態をローカルストレージに保存
    renderTasks(); // 更新後のタスクリストを表示
    showToast('タスクを削除しました'); // トースト通知を表示
}

/**
 * Undo処理
 */
function undo() {
    enqueueAction(() => {
        if (data.undoStack.length === 0) {
            showToast('アンドゥできる操作がありません');
            return;
        }
        data.redoStack.push(JSON.stringify({ tasks: data.tasks, members: data.members }));
        const prevState = JSON.parse(data.undoStack.pop());
        data.tasks = prevState.tasks;
        data.members = prevState.members;

        saveToLocalStorage(); // ローカルストレージを更新
        renderTasks(); // タスクリストを再描画
        renderMembers(); // メンバーリストを再描画

        showToast('アンドゥしました');
        updateUndoRedoButtons();
    });
}

/**
 * Redo処理
 */
function redo() {
    enqueueAction(() => {
        if (data.redoStack.length === 0) {
            showToast('リドゥできる操作がありません');
            return;
        }
        data.undoStack.push(JSON.stringify({ tasks: data.tasks, members: data.members }));
        const nextState = JSON.parse(data.redoStack.pop());
        data.tasks = nextState.tasks;
        data.members = nextState.members;

        saveToLocalStorage(); // ローカルストレージを更新
        renderTasks(); // タスクリストを再描画
        renderMembers(); // メンバーリストを再描画

        showToast('リドゥしました');
        updateUndoRedoButtons();
    });
}

// 設定モーダルの表示
settingsButton.addEventListener('click', () => {
    settingsModal.style.display = 'block';
});

// 設定モーダルを閉じる
closeSettingsButton.addEventListener('click', () => {
    settingsModal.style.display = 'none';
});

// 設定モーダルの「追加」ボタン
addMemberButton.addEventListener('click', () => {
    const row = document.createElement('div');
    row.className = 'member-row';
    row.innerHTML = `
        <input type="text" class="member-name-input input-box" placeholder="ボタン名">
        <button class="icon-button btn"><i class="fas fa-user"></i></button>
        <button class="delete-member-btn btn btn--red">削除</button>
    `;
    // 削除ボタン
    row.querySelector('.delete-member-btn').addEventListener('click', () => {
        row.classList.add('deleted-member-row');
        row.style.display = 'none';
    });

    // アイコンボタンの動作を設定
    const iconButton = row.querySelector('.icon-button');
    iconButton.addEventListener('click', () => {
        openIconPickerModal(iconButton);
    });
    memberList.appendChild(row);
});

// アイコン選択モーダルを閉じる
closeIconPickerButton.addEventListener('click', () => {
    iconPickerModal.style.display = 'none';
});

/**
 * 設定モーダルの「保存」ボタン
 */
saveSettingsButton.addEventListener('click', () => {
    enqueueAction(() => {
        saveState();
        const updatedMembers = getMembers();
        const deletedMembers = getDeletedMembers();

        if (updatedMembers.length === 0) {
            showToast('メンバー情報を確認してください');
            return;
        }

        updateTasksAndMembers(updatedMembers, deletedMembers);
        renderTasks();
        renderMembers();
        showToast('設定を保存しました');
    });
});

/**
 * 設定モーダルのメンバー情報をタスクに反映
 */
function updateTasksAndMembers(updatedMembers, deletedMembers) {
    // 削除されたメンバーをmembersから削除
    data.members = data.members.filter((member) =>
        !deletedMembers.some((deletedMember) => deletedMember.name === member.name)
    );

    // 新規追加または更新されたメンバーを反映
    updatedMembers.forEach((updatedMember) => {
        const existingMemberIndex = data.members.findIndex((member) => member.name === updatedMember.name);
        if (existingMemberIndex !== -1) {
            data.members[existingMemberIndex] = updatedMember; // 既存メンバーを更新
        } else {
            data.members.push(updatedMember);
        }
    });

    // 削除されたメンバーをタスクから削除
    deletedMembers.forEach((deletedMember) => {
        data.tasks.forEach((task) => {
            if (task.buttons && typeof task.buttons === 'object') {
                const normalizedDeletedName = deletedMember.name.trim().toLowerCase();
                Object.keys(task.buttons).forEach((key) => {
                    if (key.trim().toLowerCase() === normalizedDeletedName) {
                        delete task.buttons[key];
                    }
                });
            }
        });
    });

    // タスクボタンの更新
    updatedMembers.forEach((updatedMember) => {
        data.tasks.forEach((task) => {
            if (!task.buttons.hasOwnProperty(updatedMember.name)) {
                task.buttons[updatedMember.name] = false;
            }
        });
    });

    // 完了状態を再計算
    data.tasks.forEach((task) => {
        const allCompleted = Object.values(task.buttons).every((state) => state);
        task.completed = allCompleted;
    });

    // ローカルストレージを更新
    saveToLocalStorage();
}

/****************************************
 * ページロード時にデータを復元
 ****************************************/
document.addEventListener('DOMContentLoaded', () => {
    loadCheckboxState(); // チェックボックスの状態を復元

    // ▼ クイックSavesを読み込んでUI再構築
    loadQuickSavesFromLocalStorage();

    // デフォルトメンバー
    if (data.members.length === 0) {
        data.members.push({ name: 'A', icon: 'fas fa-user' });
    }

    // URLクエリパラメータ経由のインポート時処理
    if (new URLSearchParams(window.location.search).has('data')) {
        const advancedSection = document.querySelector(".advanced");
        const openAdvancedCheckbox = document.getElementById("openAdvancedCheckbox");

        // アコーディオンの展開制御
        openAdvancedCheckbox.addEventListener("change", () => {
            if (openAdvancedCheckbox.checked) {
                advancedSection.classList.add("show");
            } else {
                advancedSection.classList.remove("show");
            }
        });

        // すべて取り込むボタンの挙動
        const importAllButton = document.getElementById("importAllButton");
        importAllButton.addEventListener("click", () => {
            // タイトルをインポート
            const importedTitle = localStorage.getItem("importedTitle");
            if (importedTitle) {
                data.title = importedTitle;
            }

            // タスクをインポート
            const importedTasks = JSON.parse(localStorage.getItem("importedTasks") || "[]");
            data.tasks = importedTasks;

            // メンバーをインポート
            const importedMembers = JSON.parse(localStorage.getItem("importedMembers") || "[]");
            data.members = importedMembers;
            saveToLocalStorage();
            renderTasks();
            renderMembers();
            showToast("すべてのデータを取り込みました！");
            // モーダルを閉じる
            importModalOverlay.classList.remove("active");
        });
        loadFromLocalStorage();
        renderTasks();
        renderMembers();
        loadFromUrlParams();
        saveToLocalStorage();
        renderTasks();
        renderMembers();
        removeHistoryGetData();
    } else {
        // 通常時ロード
        loadFromLocalStorage();
        renderTasks();
        // アンドゥ・リドゥボタン
        undoButton.addEventListener('click', undo);
        redoButton.addEventListener('click', redo);

        // ショートカットキー(Ctrl+Z / Ctrl+Y)
        document.addEventListener('keydown', (event) => {
            if (event.ctrlKey && event.key === 'z') {
                undo();
            }
            if (event.ctrlKey && event.key === 'y') {
                redo();
            }
        });
        renderMembers();
    }
    // Undo/Redoボタンの初期状態
    updateUndoRedoButtons();
});

/**
 * URLのクエリパラメータからdataを削除
 */
function removeHistoryGetData() {
    const url = new URL(window.location);
    url.searchParams.delete('data');
    history.replaceState(null, '', url);
}

/**
 * タスク追加ボタン
 */
addTaskButton.addEventListener('click', () => {
    const taskText = taskInput.value.trim();
    if (taskText) {
        enqueueAction(() => {
            saveState(); // 状態をアンドゥ用に保存
            addTask(taskText);
            taskInput.value = ''; // 入力欄をクリア
        });
    } else {
        showToast('タスク名を入力してください');
    }
});

/**
 * メンバー取得
 */
function getMembers() {
    const memberElements = document.querySelectorAll('.member-row'); // メンバー行を取得

    const updatedMembers = [];
    memberElements.forEach((memberRow) => {
        if (memberRow.classList.contains('deleted-member-row')) return; // 削除済み行をスキップ
        const nameInput = memberRow.querySelector('.member-name-input');
        const iconElement = memberRow.querySelector('.icon-button i'); // <i>タグを取得
        const iconClass = iconElement ? iconElement.className : 'fas fa-user'; // クラス名を取得

        if (nameInput && nameInput.value.trim()) {
            updatedMembers.push({
                name: nameInput.value.trim(),
                icon: iconClass,
            });
        }
    });
    return updatedMembers;
}

/**
 * 削除されたメンバー取得
 */
function getDeletedMembers() {
    const deletedMembers = [];
    const deletedMemberElements = document.querySelectorAll('.deleted-member-row');
    deletedMemberElements.forEach((memberRow) => {
        const nameInput = memberRow.querySelector('.member-name-input');
        if (nameInput) {
            deletedMembers.push({ name: nameInput.value.trim() });
        }
    });
    return deletedMembers;
}

/**
 * シェアボタン
 */
shareButton.addEventListener('click', async () => {
    const shareUrl = generateShareableUrl();
    try {
        await navigator.share({
            title: 'シェア',
            url: shareUrl
        });
    } catch (error) {
        console.error(error);
    }
    showToast("シェアします");
});

/****************************************
 * モーダルを閉じる共通関数
 ****************************************/
export function closeModal(overlay) {
    overlay.classList.remove('active');
    const modal = overlay.querySelector('.modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 設定モーダル背景クリック
const settingsOverlay = document.getElementById('settingsOverlay');
settingsOverlay.addEventListener('click', (event) => {
    if (event.target === settingsOverlay) {
        closeModal(settingsOverlay);
    }
});

// アイコン選択モーダル背景クリック
const iconPickerOverlay = document.getElementById('iconPickerOverlay');
iconPickerOverlay.addEventListener('click', (event) => {
    if (event.target === iconPickerOverlay) {
        closeModal(iconPickerOverlay);
    }
});

// 設定ボタンと閉じるボタン
settingsButton.addEventListener('click', () => {
    settingsOverlay.classList.add('active');
    settingsModal.style.display = 'block';
});
closeSettingsButton.addEventListener('click', () => {
    closeModal(settingsOverlay);
});

// アイコン選択モーダルを閉じる
closeIconPickerButton.addEventListener('click', () => {
    closeModal(iconPickerOverlay);
});

/**
 * アイコン選択モーダルを開く
 */
function openIconPickerModal(iconButton) {
    selectedIconButton = iconButton; // 選択中のボタンを記録

    // モーダルと背景を表示
    const iconPickerOverlay = document.getElementById('iconPickerOverlay');
    const iconPickerModal = document.getElementById('iconPickerModal');
    if (iconPickerOverlay && iconPickerModal) {
        iconPickerOverlay.classList.add('active'); // 背景を表示
        iconPickerModal.style.display = 'block';    // モーダルを表示

        // アイコン選択モーダル内で現在のアイコンを選択済みに設定
        const currentIcon = iconButton.querySelector('i')?.className;
        document.querySelectorAll('.icon-option').forEach(option => {
            const optionIcon = option.querySelector('i')?.className;
            if (optionIcon === currentIcon) {
                option.classList.add('selected'); // 現在のアイコンを強調表示
            } else {
                option.classList.remove('selected'); // 他のアイコンは選択解除
            }
        });
    }
}

/****************************************
 * インポートモーダル関連
 ****************************************/
const importTitleSection = document.getElementById('importTitleSection');
const importModalOverlay = document.getElementById('importModalOverlay');
const importTasksList = document.getElementById('importTasksList');
const importMembersList = document.getElementById('importMembersList');
const importTasksButton = document.getElementById('importTasksButton');
const importMembersButton = document.getElementById('importMembersButton');
const closeImportModalButton1 = document.getElementById('closeImportModalButton1');
const closeImportModalButton2 = document.getElementById('closeImportModalButton2');

/**
 * インポートモーダルを開く
 */
export function openImportModal(data) {
    // タイトルをモーダルに表示
    if (data.title) {
        importTitleSection.innerHTML = `<p>${data.title}</p>`;
        localStorage.setItem('importedTitle', data.title);
    } else {
        importTitleSection.innerHTML = `<p>タイトルがありません</p>`;
    }
    importTasksList.innerHTML = data.tasks.map(task => `<li>${task.text}</li>`).join('');
    importMembersList.innerHTML = data.members.map(member => `
        <li><i class="${member.icon || 'fas fa-user'}"></i>${member.name}</li>
    `).join('');

    // モーダルを表示
    importModalOverlay.classList.add('active');
    const modal = document.getElementById('importModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

// インポートモーダルを閉じる
closeImportModalButton1.addEventListener('click', () => {
    importModalOverlay.classList.remove('active');
});
closeImportModalButton2.addEventListener('click', () => {
    importModalOverlay.classList.remove('active');
});

/**
 * タスクのインポート
 */
importTasksButton.addEventListener('click', () => {
    const tasksToImport = JSON.parse(localStorage.getItem('importedTasks'));
    if (tasksToImport && tasksToImport.length > 0) {
        // 既存のタスクをクリアして新しいタスクを追加
        data.tasks = [];
        data.tasks.push(...tasksToImport);
        saveToLocalStorage();
        renderTasks();
        showToast('タスクをインポートしました！');

        // ボタンを無効化し、キャプションを変更
        importTasksButton.disabled = true;
        importTasksButton.textContent = 'インポート済';
    } else {
        showToast('インポートするタスクがありません。');
    }
});

/**
 * メンバーのインポート
 */
importMembersButton.addEventListener('click', () => {
    const membersToImport = JSON.parse(localStorage.getItem('importedMembers'));
    if (membersToImport && membersToImport.length > 0) {
        // 既存のメンバーをクリアして新しいメンバーを追加
        data.members = [];
        data.members.push(...membersToImport);
        saveToLocalStorage();
        renderMembers();
        renderTasks();
        showToast('メンバーをインポートしました！');

        // ボタンを無効化し、キャプションを変更
        importMembersButton.disabled = true;
        importMembersButton.textContent = 'インポート済';
    } else {
        showToast('インポートするメンバーがありません。');
    }
});

/**
 * タイトルのインポート
 */
const importTitleButton = document.getElementById('importTitleButton');
importTitleButton.addEventListener('click', () => {
    const importedTitle = localStorage.getItem('importedTitle');
    if (importedTitle) {
        // 既存のタイトルを新しいタイトルで上書き
        data.title = importedTitle;
        document.getElementById('appTitle').textContent = data.title; // UIに反映
        saveToLocalStorage();
        showToast('タイトルをインポートしました！');

        // ボタンを無効化し、キャプションを変更
        importTitleButton.disabled = true;
        importTitleButton.textContent = 'インポート済';
    } else {
        showToast('インポートするタイトルがありません。');
    }
});

/****************************************
 * Pointer Events（スマホ向け）実装
 ****************************************/
let draggedTaskPE = null;  // Pointer Events用のドラッグ対象
let placeholderPE = null;  // Pointer Events用のプレースホルダー
function handlePointerDown(event, li) {
    // スマホなどで pointerdown => ドラッグを開始
    if (event.pointerType === 'touch') {
        draggedTaskPE = li;
        draggedTaskPE.classList.add('dragging');
        placeholderPE = document.createElement('li');
        placeholderPE.className = 'placeholder';
        draggedTaskPE.parentNode.insertBefore(placeholderPE, draggedTaskPE.nextSibling);
    }
}
function handlePointerMove(event) {
    if (!draggedTaskPE) return;
    if (event.pointerType === 'touch') {
        event.preventDefault();
        const taskList = document.getElementById('task-list');
        const afterElement = getDragAfterElementPE(taskList, event.clientY);
        if (afterElement) {
            taskList.insertBefore(placeholderPE, afterElement);
        } else {
            taskList.appendChild(placeholderPE);
        }
    }
}
function handlePointerUp(event) {
    if (!draggedTaskPE) return;
    if (event.pointerType === 'touch') {
        event.preventDefault();
        placeholderPE.parentNode.insertBefore(draggedTaskPE, placeholderPE);
        draggedTaskPE.classList.remove('dragging');
        placeholderPE.remove();
        placeholderPE = null;

        // 並び替え後の状態を保存（Undo用）
        saveState();
        updateIndexes();
        saveToLocalStorage();
        draggedTaskPE = null;
    }
}
/**
 * PointerEvents用: 移動先要素を算出
 */
function getDragAfterElementPE(list, y) {
    const elements = [...list.children].filter(
        (child) => child !== placeholderPE && child !== draggedTaskPE
    );
    return elements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - (box.top + box.height / 2);
        if (offset < 0 && offset > closest.offset) {
            return { offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

/****************************************
 * HTML5 DnD（PC向け従来機能）実装
 ****************************************/
let draggedTask = null; // ドラッグ中のタスク要素(HTML5 DnD)
let placeholder = null; // プレースホルダー要素(HTML5 DnD)
function handleDragStart(event) {
    // PC用のHTML5ドラッグ開始
    draggedTask = event.target;
    draggedTask.classList.add('dragging');

    // プレースホルダー作成
    placeholder = document.createElement('li');
    placeholder.className = 'placeholder';

    // プレースホルダーをリストに挿入
    draggedTask.parentNode.insertBefore(placeholder, draggedTask.nextSibling);
}
function handleDragOver(event) {
    event.preventDefault(); // デフォルト動作を無効化(ドロップ許可)
    const taskList = document.getElementById('task-list');
    const afterElement = getDragAfterElement(taskList, event.clientY);
    if (afterElement) {
        taskList.insertBefore(placeholder, afterElement);
    } else {
        taskList.appendChild(placeholder);
    }
}
function handleDragEnd() {
    // ドロップ
    if (placeholder && draggedTask) {
        placeholder.parentNode.insertBefore(draggedTask, placeholder);
        draggedTask.classList.remove('dragging');
    }
    if (placeholder) placeholder.remove();
    saveState();
    updateIndexes();
    saveToLocalStorage();
    draggedTask = null;
    placeholder = null;
}
/**
 * HTML5 DnD用: クライアント座標から挿入先を取得
 */
function getDragAfterElement(list, y) {
    const draggableElements = [...list.children].filter(
        (child) => child !== placeholder && child !== draggedTask
    );
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - (box.top + box.height / 2);
        if (offset < 0 && offset > closest.offset) {
            return { offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

/**
 * 並び替え後のインデックスを data.tasks に反映
 */
function updateIndexes() {
    const taskList = document.getElementById('task-list');
    const updatedTasks = Array.from(taskList.children).map((taskElement) => {
        // 連番以外の <span> を探す
        const taskTextElement = taskElement.querySelector('span:not(.task-index)');
        if (!taskTextElement) return null;
        const taskText = taskTextElement.textContent.trim();
        const taskData = data.tasks.find((t) => t.text === taskText);
        return taskData;
    }).filter(taskData => taskData !== null);

    data.tasks = updatedTasks;
    console.log('タスクの順序が更新されました', data.tasks);
}

/**************************************
 * リセットボタン
 **************************************/
const resetButton = document.getElementById('resetButton');
resetButton.addEventListener('click', () => {
    enqueueAction(() => {
        const confirmation = confirm("すべてのデータをリセットしますか？");
        if (confirmation) {
            localStorage.clear();
            data.title = 'やること';
            data.tasks = [];
            data.undoStack = [];
            data.redoStack = [];
            data.members = [];
            data.members.push({ name: 'A', icon: 'fas fa-user' });
            renderTasks();
            renderMembers();
            document.getElementById('appTitle').textContent = data.title;
            loadCheckboxState();
            showToast("データをリセットしました");
        }
    });
});

/****************************************
 * チェックボックスの状態を保存/復元
 ****************************************/
document.querySelector('#index-number-invisible').addEventListener('change', () => {
    saveCheckboxState();
    renderTasks();
});
document.getElementById('move-task-to-Bottom-disabled').addEventListener('change', saveCheckboxState);

function saveCheckboxState() {
    const indexNumberInvisible = document.getElementById('index-number-invisible').checked;
    const moveTaskToBottomDisabled = document.getElementById('move-task-to-Bottom-disabled').checked;
    localStorage.setItem('checkboxState', JSON.stringify({
        indexNumberInvisible,
        moveTaskToBottomDisabled
    }));
}

function loadCheckboxState() {
    const savedState = localStorage.getItem('checkboxState');
    if (savedState) {
        const { indexNumberInvisible, moveTaskToBottomDisabled } = JSON.parse(savedState);
        document.getElementById('index-number-invisible').checked = indexNumberInvisible;
        document.getElementById('move-task-to-Bottom-disabled').checked = moveTaskToBottomDisabled;
    } else {
        document.getElementById('index-number-invisible').checked = false;
        document.getElementById('move-task-to-Bottom-disabled').checked = false;
    }
}

/****************************************
 * 進捗リセットボタン
 ****************************************/
const progressContainer = document.querySelector('.progress-container');
const progressClearButton = document.getElementById('progress-clear');

progressContainer.addEventListener('click', () => {
    if (progressClearButton.style.display === 'none') {
        progressClearButton.style.display = 'block';
        progressClearButton.classList.add('show');
    } else {
        progressClearButton.style.display = 'none';
        progressClearButton.classList.remove('show');
    }
});

progressClearButton.addEventListener('click', (event) => {
    event.stopPropagation();
    const confirmation = confirm("本当に進捗をクリアしますか？");
    if (confirmation) {
        data.tasks.forEach(task => {
            task.completed = false;
            Object.keys(task.buttons).forEach(button => {
                task.buttons[button] = false;
            });
        });
        saveState();
        saveToLocalStorage();
        renderTasks();
        updateProgress();
        showToast('進捗がクリアされました');
    }
    progressClearButton.style.display = 'none';
    progressClearButton.classList.remove('show');
});

/****************************************
 * タスク削除確認モーダルのボタン動作
 ****************************************/
confirmDeleteButton.addEventListener('click', () => {
    if (pendingDeleteTaskIndex !== null) {
        enqueueAction(() => {
            deleteTask(pendingDeleteTaskIndex);
        });
    }
    closeModal(deleteConfirmModalOverlay);
    pendingDeleteTaskIndex = null;
});
cancelDeleteButton.addEventListener('click', () => {
    closeModal(deleteConfirmModalOverlay);
    pendingDeleteTaskIndex = null;
});

/****************************************
 * ▼▼▼ ここからクイックバー関連追加 ▼▼▼
 ****************************************/
const quickAddButton = document.getElementById('quickAddButton');
const quickLinksContainer = document.getElementById('quickLinksContainer');

// クイック保存の配列(メモリ上で管理)
let quickSaves = [];

/**
 * +ボタン押下時:
 *  - 現在のdata(タイトル、タスク、メンバー、undo/redo)をコピーして配列へ保存
 *  - quickLinksContainerに"クイック再生リンク"と"閉じるボタン"を表示
 *  - さらに、quickSavesをlocalStorageにも保存する
 */
quickAddButton.addEventListener('click', () => {
    // dataのスナップショットを作成
    const snapshot = {
        title: data.title,
        tasks: JSON.parse(JSON.stringify(data.tasks)),
        members: JSON.parse(JSON.stringify(data.members)),
        undoStack: [...data.undoStack],
        redoStack: [...data.redoStack],
        id: generateQuickSaveId()
    };
    // UIに追加
    addQuickSaveToUI(snapshot);

    // スナップショットを配列に保存
    quickSaves.push(snapshot);

    // localStorageに保存
    saveQuickSavesToLocalStorage();
    showToast('クイック保存を追加しました');
});

/**
 * QuickSaveをUIに反映（クイック再生リンク・閉じボタン作成）
 */
function addQuickSaveToUI(snapshot) {
    const quickLinkWrapper = document.createElement('div');
    quickLinkWrapper.classList.add('quick-link-wrapper');

    // クイック再生リンク（app-titleをcaptionにする）
    const quickLink = document.createElement('button');
    quickLink.className = 'quick-replay-link';
    quickLink.textContent = snapshot.title || '(無題)';

    // 閉じボタン(X)
    const closeBtn = document.createElement('button');
    closeBtn.className = 'quick-replay-close-btn';
    closeBtn.textContent = 'X';

    // クリックで復元
    quickLink.addEventListener('click', () => {
        // 保存時のスナップショットを復元
        data.title = snapshot.title;
        data.tasks = JSON.parse(JSON.stringify(snapshot.tasks));
        data.members = JSON.parse(JSON.stringify(snapshot.members));
        data.undoStack = [...snapshot.undoStack];
        data.redoStack = [...snapshot.redoStack];

        // UI更新
        document.getElementById('appTitle').textContent = data.title;
        saveToLocalStorage(); // script.js 上部でimport済みの関数
        renderMembers();
        renderTasks();
        updateUndoRedoButtons(); // Undo/Redo ボタンの状態を更新
        showToast(`クイック再生リンクを復元しました`);
    });

    // 閉じるボタンで削除
    closeBtn.addEventListener('click', () => {
        quickLinksContainer.removeChild(quickLinkWrapper);

        // quickSaves配列から削除
        quickSaves = quickSaves.filter(q => q.id !== snapshot.id);

        // localStorageに反映
        saveQuickSavesToLocalStorage();
    });

    // 要素を組み立ててコンテナに追加
    quickLinkWrapper.appendChild(quickLink);
    quickLinkWrapper.appendChild(closeBtn);
    quickLinksContainer.appendChild(quickLinkWrapper);
}

/**
 * クイック保存用ID生成(簡易的に日時ベース)
 */
function generateQuickSaveId() {
    return 'qs-' + Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * quickSaves配列を localStorage に保存
 */
function saveQuickSavesToLocalStorage() {
    localStorage.setItem('quickSaves', JSON.stringify(quickSaves));
}

/**
 * ページ読み込み時に localStorage から quickSaves を復元
 */
function loadQuickSavesFromLocalStorage() {
    const saved = localStorage.getItem('quickSaves');
    if (saved) {
        try {
            quickSaves = JSON.parse(saved);
            quickSaves.forEach(snapshot => {
                // 各スナップショットをUIに復元
                addQuickSaveToUI(snapshot);
            });
        } catch (error) {
            console.error('Failed to parse quickSaves:', error);
        }
    }
}

/****************************************
 * ▲▲▲ ここまでクイックバー関連追加 ▲▲▲
 ****************************************/
