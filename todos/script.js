import { generateShareableUrl, saveToLocalStorage, loadFromLocalStorage } from './storage.js';
import { data, loadFromUrlParams } from './storage.js';

// 必要な変数や要素の取得
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
let selectedIconButton = null; // 選択中のアイコンボタン

// トースト通知の表示
export function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// 状態の保存
export function saveState() {
    console.log("コール！");
    console.log("Saving state:", JSON.stringify(data.tasks));
    // `tasks` と `members` をまとめて保存
    const currentState = {
        tasks: JSON.parse(JSON.stringify(data.tasks)), // 深いコピー
        members: JSON.parse(JSON.stringify(data.members))
    };
    data.undoStack.push(JSON.stringify(currentState)); // スタックに保存

    if (data.undoStack.length > 20) data.undoStack.shift(); // 履歴を20件に制限

    data.redoStack = []; // 新しい操作後はリドゥスタックをクリア
    // console.log("Undo Stack after save:", undoStack);
}

export function renderTasks() {
    const taskList = document.querySelector('#task-list');
    const hideIndex = document.querySelector('#index-number-invisible').checked; // チェックボックスの状態を取得
    taskList.innerHTML = '';

    data.tasks.forEach((task, index) => {
        const taskElement = createTaskElement(task, index, hideIndex);
        taskList.appendChild(taskElement);
    });

    updateProgress();
}

// メンバーリストを描画
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
        nameInput.className = 'member-name-input';
        nameInput.value = member.name;

        // 名前変更時のイベントリスナー
        nameInput.addEventListener('input', () => {
            member.name = nameInput.value.trim();
        });

        // アイコンボタン
        const iconButton = document.createElement('button');
        iconButton.className = 'icon-button';
        const iconElement = document.createElement('i');
        iconElement.className = member.icon || 'fas fa-user'; // デフォルトアイコン
        iconButton.appendChild(iconElement);

        // renderMembers 内の iconButton.addEventListener
        iconButton.addEventListener('click', () => {
            openIconPickerModal(iconButton); // 共通関数を呼び出し
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

            const iconElement = closestOption.querySelector('i');
            const iconClass = iconElement ? iconElement.className : 'fas fa-user';

            if (selectedIconButton) {
                selectedIconButton.innerHTML = `<i class="${iconClass}"></i>`;
                const memberRow = selectedIconButton.closest('.member-row');
                if (memberRow) {
                    const nameInput = memberRow.querySelector('.member-name-input');
                    const memberName = nameInput ? nameInput.value.trim() : null;

                    if (memberName) {
                        const member = data.members.find((m) => m.name === memberName);
                        if (member) {
                            member.icon = iconClass; // メンバー情報を更新
                        } else {
                            console.warn('No member found with name:', memberName);
                        }
                    } else {
                        console.warn('No name input found in memberRow.');
                    }
                } else {
                    console.warn('No memberRow found for selectedIconButton.');
                }
            } else {
                console.warn('No selectedIconButton found. Please ensure it is set correctly.');
            }
        });

        // アイコンボタンがクリックされたときに選択状態を設定
        document.addEventListener('click', (event) => {
            const button = event.target.closest('.icon-button');
            if (button) {
                selectedIconButton = button;
                // console.log('Selected Icon Button:', selectedIconButton);
            }
        });


        // 削除ボタン
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-member-btn';
        deleteButton.textContent = '削除';

        // 削除ボタンのイベントリスナー
        deleteButton.addEventListener('click', () => {
            memberRow.classList.add('deleted-member-row');
            memberRow.style.display = 'none'; // UIから削除
            member = data.members.filter((m) => m !== member); // メンバーリストから削除
        });

        // メンバー行に要素を追加
        memberRow.appendChild(nameInput);
        memberRow.appendChild(iconButton);
        memberRow.appendChild(deleteButton);

        // リストに追加
        memberList.appendChild(memberRow);
    });
}


// 進捗の更新
function updateProgress() {
    const totalButtons = data.tasks.reduce((sum, task) => sum + Object.keys(task.buttons).length, 0);
    const completedButtons = data.tasks.reduce(
        (sum, task) => sum + Object.values(task.buttons).filter((state) => state).length,
        0
    );
    const progress = totalButtons > 0 ? Math.round((completedButtons / totalButtons) * 100) : 0;
    progressText.textContent = `${progress}%`;
}

function createTaskElement(task, index, hideIndex) {
    const li = document.createElement('li');
    li.className = task.completed ? 'completed' : '';
    li.draggable = true; // 追加


    li.addEventListener('dragstart', handleDragStart);
    li.addEventListener('dragover', handleDragOver);
    li.addEventListener('dragend', handleDragEnd);

    // 連番表示をチェック
    const indexSpan = hideIndex ? '' : `<span class="task-index">${index + 1}. </span>`;

    li.innerHTML = `
      ${indexSpan}<span>${task.text}</span>
      <div class="task-buttons"></div>
      <button class="delete-task-btn">削除</button>
    `;
    const buttonsContainer = li.querySelector('.task-buttons');

    data.members.forEach((member) => {
        const iconClass = member.icon || 'fas fa-user'; // デフォルトアイコン

        if (!(member.name in task.buttons)) {
            // ボタンが存在しない場合は初期化
            task.buttons[member.name] = false;
        }

        const button = document.createElement('button');
        button.innerHTML = task.buttons[member.name] ? '完了' : `<i class="${iconClass}"></i>`;
        button.className = task.buttons[member.name] ? 'completed-button' : '';
        button.addEventListener('click', () => {
            saveState(); // 状態を保存
            task.buttons[member.name] = !task.buttons[member.name];
            button.innerHTML = task.buttons[member.name] ? '完了' : `<i class="${iconClass}"></i>`;
            button.className = task.buttons[member.name] ? 'completed-button' : '';
            checkTaskCompletion(task, index); // 完了状態を確認
        });
        buttonsContainer.appendChild(button);
    });

    li.querySelector('.delete-task-btn').addEventListener('click', () => {
        deleteTask(index);
    });

    return li;
}


function checkTaskCompletion(task, index) {
    // すべてのボタンが「完了」かどうかをチェック
    const allCompleted = Object.values(task.buttons).every((state) => state);

    updateProgress();

    if (allCompleted && !task.completed) {
        // タスクを完了状態に更新
        task.completed = true;

        // チェックボックスがオフの場合のみ最下部に移動
        const moveToBottomDisabled = document.getElementById('move-task-to-Bottom-disabled').checked;
        if (!moveToBottomDisabled) {
            moveTaskToBottom(index);
        } else {
            renderTasks();
        }
        showToast('タスクが完了しました');
    } else if (!allCompleted && task.completed) {
        // タスクを未完了状態に戻す
        task.completed = false;
        showToast('タスクが未完了に戻りました');
        renderTasks(); // 即時再描画
    }

    saveToLocalStorage();

}


// タスクの追加
function addTask(taskText) {
    const newTask = {
        text: taskText,
        completed: false,
        buttons: {},
    };

    // すべてのメンバーに対応するボタンを初期化
    data.members.forEach((member) => {
        newTask.buttons[member.name] = false;
    });

    data.tasks.push(newTask);
    saveToLocalStorage();
    renderTasks();
    showToast('タスクを追加しました');
}


const moveTaskToBottom = (clickedIndex) => {
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
};

// タスクを削除
function deleteTask(index) {
    saveState(); // 現在の状態をアンドゥ用に保存
    data.tasks.splice(index, 1); // 指定したタスクを削除
    saveToLocalStorage(); // 削除後の状態をローカルストレージに保存
    renderTasks(); // 更新後のタスクリストを表示
    showToast('タスクを削除しました'); // トースト通知を表示
}

function undo() {
    if (data.undoStack.length === 0) {
        showToast('アンドゥできる操作がありません');
        return;
    }
    const tasksString = data.tasks;
    const membersString = data.members;
    data.redoStack.push(JSON.stringify({ tasks: data.tasks, members: data.members })); // 現在の状態を保存

    const prevState = JSON.parse(data.undoStack.pop()); // 前の状態を復元
    data.tasks = prevState.tasks;
    data.members = prevState.members;

    saveToLocalStorage(); // ローカルストレージを更新
    renderTasks(); // タスクリストを再描画
    renderMembers(); // メンバーリストを再描画

    showToast('アンドゥしました');
    // console.log("Undo completed. Current state:", { tasks, members });
}

function redo() {
    if (data.redoStack.length === 0) {
        showToast('リドゥできる操作がありません');
        return;
    }
    const tasksString = data.tasks;
    const membersString = data.members;
    data.undoStack.push(JSON.stringify({ tasks: data.tasks, members: data.members })); // 現在の状態を保存

    const nextState = JSON.parse(data.redoStack.pop()); // 次の状態を復元
    data.tasks = nextState.tasks;
    data.members = nextState.members;

    saveToLocalStorage(); // ローカルストレージを更新
    renderTasks(); // タスクリストを再描画
    renderMembers(); // メンバーリストを再描画

    showToast('リドゥしました');
    // console.log("Redo completed. Current state:", { tasks, members });
}

// 設定モーダルの表示
settingsButton.addEventListener('click', () => {
    settingsModal.style.display = 'block';
});

// 設定モーダルを閉じる
closeSettingsButton.addEventListener('click', () => {
    settingsModal.style.display = 'none';
});



// 設定モーダルの「追加」ボタンの動作修正
addMemberButton.addEventListener('click', () => {
    const row = document.createElement('div');
    row.className = 'member-row';
    row.innerHTML = `
        <input type="text" class="member-name-input" placeholder="ボタン名">
        <button class="icon-button"><i class="fas fa-user"></i></button>
        <button class="delete-member-btn">削除</button>
    `;

    // 削除ボタンの動作
    row.querySelector('.delete-member-btn').addEventListener('click', () => {
        row.remove();
    });

    // アイコンボタンの動作を設定
    const iconButton = row.querySelector('.icon-button');
    iconButton.addEventListener('click', () => {
        openIconPickerModal(iconButton); // 共通関数を呼び出し
    });

    memberList.appendChild(row);
});


// アイコン選択モーダルを閉じる
closeIconPickerButton.addEventListener('click', () => {
    iconPickerModal.style.display = 'none';
    selectedIconButton = null;
});


// 設定モーダルの「保存」ボタンの動作
saveSettingsButton.addEventListener('click', () => {
    saveState(); // 現在の状態を保存
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
            data.members.push(updatedMember); // 新規メンバーを追加
        }
    });

    // 削除されたメンバーをタスクから削除
    deletedMembers.forEach((deletedMember) => {
        data.tasks.forEach((task) => {
            if (task.buttons && typeof task.buttons === 'object') {
                const normalizedDeletedName = deletedMember.name.trim().toLowerCase();
                Object.keys(task.buttons).forEach((key) => {
                    if (key.trim().toLowerCase() === normalizedDeletedName) {
                        // console.log(`Deleting button for member: ${key} in task: ${task.text}`);
                        delete task.buttons[key]; // 確実に削除
                    }
                });
            }
        });
    });

    // タスクボタンの更新
    updatedMembers.forEach((updatedMember) => {
        data.tasks.forEach((task) => {
            if (!task.buttons.hasOwnProperty(updatedMember.name)) {
                task.buttons[updatedMember.name] = false; // 初期値を設定
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




// ページロード時にデータを復元
document.addEventListener('DOMContentLoaded', () => {
    loadCheckboxState(); // チェックボックスの状態を復元

    // デフォルトのメンバーを登録
    if (data.members.length === 0) {
        data.members.push({ name: 'A', icon: 'fas fa-user' });
    }

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
    }
    else {

        loadFromLocalStorage();
        renderTasks();

        // アンドゥ・リドゥボタンのイベントリスナー
        undoButton.addEventListener('click', undo);
        redoButton.addEventListener('click', redo);

        // ショートカットキー
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
});

// URLのクエリパラメータからdataを削除
function removeHistoryGetData() {
    const url = new URL(window.location);
    url.searchParams.delete('data');
    history.replaceState(null, '', url);  // ブラウザ履歴を更新し、URLからdataパラメータを削除
}

addTaskButton.addEventListener('click', () => {
    const taskInput = document.querySelector('#task-input');
    const taskText = taskInput.value.trim();

    if (taskText) {
        saveState(); // 状態をアンドゥ用に保存
        addTask(taskText);
        taskInput.value = ''; // 入力欄をクリア
    } else {
        showToast('タスク名を入力してください');
    }
});

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





function getDeletedMembers() {
    const deletedMembers = [];
    const deletedMemberElements = document.querySelectorAll('.deleted-member-row');
    // console.log("deletedMemberElements！", deletedMemberElements);

    deletedMemberElements.forEach((memberRow) => {
        const nameInput = memberRow.querySelector('.member-name-input');
        if (nameInput) {
            deletedMembers.push({ name: nameInput.value.trim() });
        }
    });
    return deletedMembers;
}


// シェアボタンの機能
shareButton.addEventListener('click', async () => {
    const shareUrl = generateShareableUrl();  // storage.jsからURLを生成

    try {
        await navigator.share(
            {
                title: 'シェア',
                url: shareUrl
            });
    } catch (error) {
        console.error(error);
    }
    showToast("シェアします");  // ui.jsのトースト表示
});




// 背景要素とモーダル要素を取得
const settingsOverlay = document.getElementById('settingsOverlay');
const iconPickerOverlay = document.getElementById('iconPickerOverlay');

// モーダルを閉じる共通関数
export function closeModal(overlay) {
    overlay.classList.remove('active');
    const modal = overlay.querySelector('.modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 設定モーダル背景のクリックで閉じる
settingsOverlay.addEventListener('click', (event) => {
    if (event.target === settingsOverlay) {
        closeModal(settingsOverlay);
    }
});

// アイコン選択モーダル背景のクリックで閉じる
iconPickerOverlay.addEventListener('click', (event) => {
    if (event.target === iconPickerOverlay) {
        closeModal(iconPickerOverlay);
    }
});

// 設定ボタンと閉じるボタンの動作を修正
settingsButton.addEventListener('click', () => {
    settingsOverlay.classList.add('active');
    settingsModal.style.display = 'block';
});

closeSettingsButton.addEventListener('click', () => {
    closeModal(settingsOverlay);
});

// アイコン選択モーダルを閉じるボタンの動作を修正
closeIconPickerButton.addEventListener('click', () => {
    closeModal(iconPickerOverlay);
});


function openIconPickerModal(iconButton) {
    selectedIconButton = iconButton; // 選択中のボタンを記録

    // モーダルと背景を表示
    const iconPickerOverlay = document.getElementById('iconPickerOverlay');
    const iconPickerModal = document.getElementById('iconPickerModal');

    if (iconPickerOverlay && iconPickerModal) {
        iconPickerOverlay.classList.add('active'); // 背景を表示
        iconPickerModal.style.display = 'block'; // モーダルを表示

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
    } else {
        console.warn("iconPickerOverlayまたはiconPickerModalが見つかりません");
    }
}



const importTitleSection = document.getElementById('importTitleSection');
const importModalOverlay = document.getElementById('importModalOverlay');
const importTasksList = document.getElementById('importTasksList');
const importMembersList = document.getElementById('importMembersList');
const importTasksButton = document.getElementById('importTasksButton');
const importMembersButton = document.getElementById('importMembersButton');
const closeImportModalButton1 = document.getElementById('closeImportModalButton1');
const closeImportModalButton2 = document.getElementById('closeImportModalButton2');

export function openImportModal(data) {
    // タイトルをモーダルに表示
    if (data.title) {
        importTitleSection.innerHTML = `
            <p>${data.title}</p>
        `;

        // タイトルを一時保存
        localStorage.setItem('importedTitle', data.title);
    } else {
        importTitleSection.innerHTML = `
            <p>タイトルがありません</p>
        `;
    }

    // タスク一覧をテキストのみで表示
    importTasksList.innerHTML = data.tasks.map(task => `
        <li>${task.text}</li>
    `).join('');

    // メンバー一覧をアイコン付きで表示
    importMembersList.innerHTML = data.members.map(member => `
        <li>
            <i class="${member.icon || 'fas fa-user'}"></i>
            ${member.name}
        </li>
    `).join('');

    // モーダルを表示
    importModalOverlay.classList.add('active');
    const modal = document.getElementById('importModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

closeImportModalButton1.addEventListener('click', () => {
    importModalOverlay.classList.remove('active');
});
closeImportModalButton2.addEventListener('click', () => {
    importModalOverlay.classList.remove('active');
});

// タスクのインポート
importTasksButton.addEventListener('click', () => {
    const tasksToImport = JSON.parse(localStorage.getItem('importedTasks')); // 一時保存されたタスクを取得
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



// メンバーのインポート
importMembersButton.addEventListener('click', () => {
    const membersToImport = JSON.parse(localStorage.getItem('importedMembers')); // 一時保存されたメンバーを取得
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

// タイトルのインポート
const importTitleButton = document.getElementById('importTitleButton');

importTitleButton.addEventListener('click', () => {
    const importedTitle = localStorage.getItem('importedTitle'); // 一時保存されたタイトルを取得

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

let isDragAllowed = false; // ドラッグが許可されるかを管理

// mousedownイベントをタスクリストに限定
taskList.addEventListener('mousedown', (event) => {
    // クリックされた場所がtask-buttons内ならドラッグを禁止
    if (event.target.closest('.task-buttons')) {
        isDragAllowed = false;
    } else {
        isDragAllowed = true;
    }
});

let draggedTask = null; // ドラッグ中のタスク要素
let placeholder = null; // プレースホルダー要素
function handleDragStart(event) {
    // ドラッグが許可されていない場合、キャンセル
    if (!isDragAllowed) {
        event.preventDefault();
        return;
    }
    draggedTask = event.target; // ドラッグする要素を保持
    draggedTask.classList.add('dragging'); // スタイル変更


    // プレースホルダー作成
    placeholder = document.createElement('li');
    placeholder.className = 'placeholder';

    // プレースホルダーをリストに挿入
    draggedTask.parentNode.insertBefore(placeholder, draggedTask.nextSibling);
}

function handleDragOver(event) {
    event.preventDefault(); // デフォルト動作を無効化

    const taskList = document.getElementById('task-list');
    const afterElement = getDragAfterElement(taskList, event.clientY);

    // プレースホルダーを移動
    if (afterElement) {
        taskList.insertBefore(placeholder, afterElement);
    } else {
        taskList.appendChild(placeholder);
    }
}

function handleDragEnd() {
    if (placeholder && draggedTask) {
        placeholder.parentNode.insertBefore(draggedTask, placeholder);
        draggedTask.classList.remove('dragging');
    }

    if (placeholder) placeholder.remove();

    saveState();      // 状態を保存
    updateIndexes();  // 並び替え後の順序を反映
    saveToLocalStorage(); // 永続化

    draggedTask = null;
    placeholder = null;
}

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
function updateIndexes() {
    const taskList = document.getElementById('task-list'); // タスクリストの親要素を取得
    const updatedTasks = Array.from(taskList.children).map((taskElement) => {
        // 連番が含まれる場合と含まれない場合を考慮して、タスクテキスト部分を特定
        const taskTextElement = taskElement.querySelector('span:not(.task-index)'); // 連番以外の <span> を選択
        if (!taskTextElement) return null; // 見つからない場合は無視

        const taskText = taskTextElement.textContent.trim(); // タスクテキストを取得
        const taskData = data.tasks.find((task) => task.text === taskText); // 内部データから一致するタスクを探す
        return taskData;
    }).filter(taskData => taskData !== null); // 無効なタスクを除外

    // タスクリストを新しい順序で更新
    data.tasks = updatedTasks;

    console.log('タスクの順序が更新されました', data.tasks);
}

const resetButton = document.getElementById('resetButton');

// resetButtonのクリックイベントを追加
resetButton.addEventListener('click', () => {
    const confirmation = confirm("すべてのデータをリセットしますか？");
    if (confirmation) {
        localStorage.clear(); // ローカルストレージをクリア

        // dataオブジェクト内のプロパティを初期化
        data.title = 'やること';
        data.tasks = [];
        data.undoStack = [];
        data.redoStack = [];
        data.members = [];

        // デフォルトメンバーを追加
        data.members.push({ name: 'A', icon: 'fas fa-user' });

        renderTasks(); // タスクリストをリセット
        renderMembers(); // メンバーリストをリセット
        document.getElementById('appTitle').textContent = data.title; // タイトルも初期化
        loadCheckboxState();
        showToast("データをリセットしました");
    }
});

document.querySelector('#index-number-invisible').addEventListener('change', () => {
    saveCheckboxState();
    renderTasks(); // チェックボックスの変更でタスクリストを再描画
});
document.getElementById('move-task-to-Bottom-disabled').addEventListener('change', saveCheckboxState);

// チェックボックスの状態を保存
function saveCheckboxState() {
    const indexNumberInvisible = document.getElementById('index-number-invisible').checked;
    const moveTaskToBottomDisabled = document.getElementById('move-task-to-Bottom-disabled').checked;

    const checkboxState = {
        indexNumberInvisible,
        moveTaskToBottomDisabled
    };

    localStorage.setItem('checkboxState', JSON.stringify(checkboxState));
}

// チェックボックスの状態を復元
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
const progressContainer = document.querySelector('.progress-container');
const progressClearButton = document.getElementById('progress-clear');

// アコーディオン表示の切り替え
progressContainer.addEventListener('click', () => {
    if (progressClearButton.style.display === 'none') {
        progressClearButton.style.display = 'block'; // 表示
        progressClearButton.classList.add('show');
    } else {
        progressClearButton.style.display = 'none'; // 非表示
        progressClearButton.classList.remove('show');
    }
});

// 進捗をクリアする機能
progressClearButton.addEventListener('click', (event) => {
    event.stopPropagation(); // 親要素のクリックイベントを無視

    const confirmation = confirm("本当に進捗をクリアしますか？");
    if (confirmation) {
        // 全タスクの進捗をクリア
        data.tasks.forEach(task => {
            task.completed = false; // タスクの完了状態をリセット
            Object.keys(task.buttons).forEach(button => {
                task.buttons[button] = false; // 各メンバーの完了状態もリセット
            });
        });

        // 状態を保存し、UIを更新
        saveState();
        saveToLocalStorage();
        renderTasks();
        updateProgress();
        showToast('進捗がクリアされました');
    }

    // アコーディオンを閉じる（OKでもキャンセルでも閉じる）
    progressClearButton.style.display = 'none';
    progressClearButton.classList.remove('show');
});
