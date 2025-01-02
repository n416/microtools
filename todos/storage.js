import { renderMembers, renderTasks, saveState } from './script.js';
import { showToast, openImportModal, closeModal } from './script.js';

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
};
data.title = 'やること';

export function generateShareableUrl() {
    loadFromLocalStorage();
    // LZStringで圧縮
    const compressedData = LZString.compressToEncodedURIComponent(
        JSON.stringify({
            title: data.title,
            tasks: data.tasks,
            members: data.members,
        })
    );
    const baseUrl = window.location.origin + window.location.pathname;
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
            localStorage.setItem('importedTitle', parsedData.title);
        }
        localStorage.setItem('importedTasks', JSON.stringify(parsedData.tasks || []));
        localStorage.setItem('importedMembers', JSON.stringify(parsedData.members || []));
        
        openImportModal(parsedData);
    }
}

// タスクとスタックをローカルストレージに保存
export function saveToLocalStorage() {
    console.log("セーブコール");
    try {
        localStorage.setItem('title', data.title);
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

    data.title = storedTitle || 'やること';
    data.tasks = storedTasks ? JSON.parse(storedTasks) : [];
    data.undoStack = storedUndoStack ? JSON.parse(storedUndoStack) : [];
    data.redoStack = storedRedoStack ? JSON.parse(storedRedoStack) : [];
    data.members = storedMembers ? JSON.parse(storedMembers) : [];

    if (data.members.length === 0) {
        data.members.push({ name: 'A', icon: 'fas fa-user' });
    }
    const appTitle = document.getElementById('appTitle');
    if (appTitle) {
        appTitle.textContent = data.title;
    }

    data.tasks.forEach((task) => {
        if (!task.buttons) {
            task.buttons = {};
            data.members.forEach((member) => {
                task.buttons[member.name] = false;
            });
        }
    });

    renderMembers();
    renderTasks();
}

// パラメータを簡易チェック
function validateParams(data) {
    const { title, members, tasks } = data;
    return (
        ((members && members.length > 0) || (tasks && tasks.length > 0))
    );
}

/**********************************************
 * タイトル編集モーダル関連
 **********************************************/
const appTitle = document.getElementById('appTitle');
const titleModalOverlay = document.getElementById('titleModalOverlay');
const titleModal = document.getElementById('titleModal');
const titleInput = document.getElementById('titleInput');
const saveTitleButton = document.getElementById('saveTitleButton');
const closeTitleModalButton = document.getElementById('closeTitleModalButton');

appTitle.addEventListener('click', () => {
    titleInput.value = data.title;
    titleModalOverlay.classList.add('active');
    titleModal.style.display = 'block';
});

saveTitleButton.addEventListener('click', () => {
    saveState();
    data.title = titleInput.value.trim();
    appTitle.textContent = data.title;
    saveToLocalStorage();
    showToast('タイトルを保存しました');
    closeModal(titleModalOverlay);
});

closeTitleModalButton.addEventListener('click', () => {
    closeModal(titleModalOverlay);
});
