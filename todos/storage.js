import { renderMembers, renderTasks,saveState } from './script.js';
import { showToast, openImportModal,closeModal } from './script.js';
const TASKS_STORAGE_KEY = 'tasks';
const UNDO_STACK_STORAGE_KEY = 'undoStack';
const REDO_STACK_STORAGE_KEY = 'redoStack';
const MEMBERS_STORAGE_KEY = 'members';

export let data = {
    title: "",
    tasks: [],
    undoStack: [],
    redoStack: [],
    members: []
}
data.title = 'やること';

export function generateShareableUrl() {
    loadFromLocalStorage();

    // LZStringで圧縮
    const compressedData = LZString.compressToEncodedURIComponent(
        JSON.stringify({
            title: data.title, // タイトルも含める
            tasks: data.tasks,
            members: data.members,
        })
    );
    const baseUrl = window.location.origin + window.location.pathname;

    // 圧縮したデータをURLに追加
    return `${baseUrl}?data=${compressedData}`;
}


// GETパラメータ読み込み
export function loadFromUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const compressedData = urlParams.get('data');

    if (compressedData) {
        const decompressedData = LZString.decompressFromEncodedURIComponent(compressedData);
        const parsedData = JSON.parse(decompressedData);

        if (!validateParams(parsedData)) {
            showToast("無効なデータです。");
            return;
        }

        // タイトル、タスク、ボタンを一時保存
        if (parsedData.title) {
            localStorage.setItem('importedTitle', parsedData.title); // 一時保存
        }
        localStorage.setItem('importedTasks', JSON.stringify(parsedData.tasks || []));
        localStorage.setItem('importedMembers', JSON.stringify(parsedData.members || []));
        
        openImportModal(parsedData); // モーダルを表示
    }
}


// タスクとスタックをローカルストレージに保存
export function saveToLocalStorage() {
    console.log("セーブコール");
    try {
        localStorage.setItem('title', data.title); // タイトルを保存
        localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(data.tasks));
        localStorage.setItem(MEMBERS_STORAGE_KEY, JSON.stringify(data.members));
        localStorage.setItem(UNDO_STACK_STORAGE_KEY, JSON.stringify(data.undoStack));
        localStorage.setItem(REDO_STACK_STORAGE_KEY, JSON.stringify(data.redoStack));
    } catch (error) {
        console.error('Error saving to localStorage:', error);
    }
}


// ボタンリストをローカルストレージに保存
export function saveMembersToLocalStorage() {
    const members = Array.from(memberList.querySelectorAll('.member-row')).map(row => {
        const name = row.querySelector('input').value.trim();
        const icon = row.querySelector('.icon-button i')?.className || '';
        return { name, icon };
    });
    localStorage.setItem(MEMBERS_STORAGE_KEY, JSON.stringify(data.members));
    showToast('設定を保存しました！');
}

// ローカルストレージからデータを読み込む
export function loadFromLocalStorage() {
    const storedTitle = localStorage.getItem('title');
    const storedTasks = localStorage.getItem(TASKS_STORAGE_KEY);
    const storedUndoStack = localStorage.getItem(UNDO_STACK_STORAGE_KEY);
    const storedRedoStack = localStorage.getItem(REDO_STACK_STORAGE_KEY);
    const storedMembers = localStorage.getItem(MEMBERS_STORAGE_KEY);

    // データを復元
    data.title = storedTitle || 'やること'; // タイトルを設定
    data.tasks = storedTasks ? JSON.parse(storedTasks) : [];
    data.undoStack = storedUndoStack ? JSON.parse(storedUndoStack) : [];
    data.redoStack = storedRedoStack ? JSON.parse(storedRedoStack) : [];
    data.members = storedMembers ? JSON.parse(storedMembers) : [];


    // デフォルトメンバーの追加（メンバーが空の場合）
    if (data.members.length === 0) {
        data.members.push({ name: 'A', icon: 'fas fa-user' });
    }

    // タイトルをDOMに反映
    const appTitle = document.getElementById('appTitle');
    if (appTitle) {
        appTitle.textContent = data.title;
    }

    // 必要に応じてタスクやボタンを補正
    data.tasks.forEach((task) => {
        if (!task.buttons) {
            task.buttons = {};
            data.members.forEach((member) => {
                task.buttons[member.name] = false; // 必要なら初期化
            });
        }
    });

    renderMembers();
    renderTasks();
}

function validateParams(data) {
    const { title, members, tasks } = data;
    return (
//        typeof title === 'string' && title.trim() !== '' &&
        ((members && members.length > 0) || (tasks && tasks.length > 0))
    );
}


function showModalA(data) {
    console.log('Before ModalA:', data.members);
    const modalMessage = "データが上書きされます。宜しいですか？";
    const userConfirmed = confirm(modalMessage);

    if (userConfirmed) {
        if (data.members && data.members.length > 0) {
            showModalB(data); // ボタンがある場合はモーダルBへ
        } else if (data.tasks && data.tasks.length > 0) {
            showModalC(data); // タスクのみの場合はモーダルCへ
        }
    }
}

function showModalB(data) {
    console.log('Before ModalB:', data.members);
    const modalMessage = "対象ボタンが上書きされます。宜しいですか？";
    const userConfirmed = confirm(modalMessage);

    if (userConfirmed) {
        importMembers(data.members); // ボタンの取り込み
        if (data.tasks && data.tasks.length > 0) {
            showModalC(data); // tasksがある場合はモーダルC
        }
    } else {
        if (data.tasks && data.tasks.length > 0) {
            showModalC(data); // tasksがある場合はモーダルC
        } else {
            showToast("取り込みを中止しました。");
        }
    }
}

function showModalC(data) {
    console.log('Before ModalC:', data.members);
    const modalMessage = "対象タスクが上書きされます。宜しいですか？";
    const userConfirmed = confirm(modalMessage);

    if (userConfirmed) {
        importTasks(data.tasks); // タスクの取り込み
    } else {
        showToast("取り込みを中止しました。");
    }
}

function importMembers(members) {
    saveState(); // 現在の状態を保存
    data.members = [...members]; // ボタンを上書き
    saveToLocalStorage();
    renderMembers();
    showToast("ボタンを取り込みました。");
}

function importTasks(tasks) {
    saveState(); // 現在の状態を保存
    data.tasks = [...tasks]; // タスクを上書き
    saveToLocalStorage();
    renderTasks();
    showToast("タスクを取り込みました。");
}



const appTitle = document.getElementById('appTitle');
const titleModalOverlay = document.getElementById('titleModalOverlay');
const titleModal = document.getElementById('titleModal');
const titleInput = document.getElementById('titleInput');
const saveTitleButton = document.getElementById('saveTitleButton');
const closeTitleModalButton = document.getElementById('closeTitleModalButton');

// タイトルをクリックしてモーダルを表示
appTitle.addEventListener('click', () => {
    titleInput.value = data.title; // 現在のタイトルをモーダルに設定
    titleModalOverlay.classList.add('active');
    titleModal.style.display = 'block';
});

// タイトル保存処理
saveTitleButton.addEventListener('click', () => {
    saveState(); // アンドゥ用に現在の状態を保存
    data.title = titleInput.value.trim(); // タイトルを更新
    appTitle.textContent = data.title; // UIに反映
    saveToLocalStorage(); // ローカルストレージに保存
    showToast('タイトルを保存しました');
    closeModal(titleModalOverlay); // モーダルを閉じる
});

// モーダルを閉じる
closeTitleModalButton.addEventListener('click', () => {
    closeModal(titleModalOverlay);
});
