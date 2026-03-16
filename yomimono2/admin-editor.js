// admin-editor.js

const state = {
  filename: null,
  originalContent: '',
  isModified: false,
};

// DOM Elements
const fileNameDisplay = document.getElementById('file-name-display');
const btnSave = document.getElementById('btn-save');
const markdownInput = document.getElementById('markdown-input');
const previewOutput = document.getElementById('preview-output');
const statusIndicator = document.getElementById('status-indicator');
const toastContainer = document.getElementById('toast-container');

// Toast Notification
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  // Remove toast after animation (5s total)
  setTimeout(() => {
    toast.remove();
  }, 5000);
}

// Update UI State
function updateState(isChanged) {
  state.isModified = isChanged;
  btnSave.disabled = !isChanged;
  statusIndicator.textContent = isChanged ? '未保存の変更があります' : 'すべての変更を保存しました';
  statusIndicator.className = isChanged ? 'status-indicator modified' : 'status-indicator';
}

// Render Preview
function updatePreview() {
  const markdown = markdownInput.value;
  // marked.parse は marked.js がグローバルにある前提
  if (typeof marked !== 'undefined') {
    previewOutput.innerHTML = marked.parse(markdown);
  } else {
    previewOutput.textContent = 'プレビューをレンダリングできません（marked.jsが未ロード）';
  }
}

// Fetch Raw Content
async function fetchRawContent() {
  try {
    const res = await fetch(`/api/raw?file=${encodeURIComponent(state.filename)}`);
    if (!res.ok) {
        throw new Error(`Failed to fetch: ${res.statusText}`);
    }
    const data = await res.json();
    state.originalContent = data.content || '';
    markdownInput.value = state.originalContent;
    updatePreview();
    updateState(false);
  } catch(e) {
    console.error(e);
    showToast(`ファイルの読み込みに失敗しました: ${e.message}`, 'error');
    fileNameDisplay.textContent = '読み込みエラー';
  }
}

// Save Content
async function saveContent() {
  if (!state.isModified) return;

  btnSave.textContent = '保存中...';
  btnSave.disabled = true;

  try {
    const res = await fetch('/api/raw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file: state.filename,
        content: markdownInput.value
      })
    });
    
    const data = await res.json();
    if (res.ok) {
      showToast('保存しました', 'success');
      state.originalContent = markdownInput.value;
      updateState(false);
    } else {
      showToast(`保存失敗: ${data.error || '不明なエラー'}`, 'error');
      updateState(true);
    }
  } catch(e) {
    console.error(e);
    showToast(`保存処理に失敗しました: ${e.message}`, 'error');
    updateState(true);
  } finally {
    btnSave.textContent = '保存する';
  }
}

// Initialization
function init() {
  // Parse URL to get file
  const urlParams = new URLSearchParams(window.location.search);
  const file = urlParams.get('file');

  if (!file) {
    fileNameDisplay.textContent = 'ファイルが指定されていません';
    return;
  }

  state.filename = file;
  fileNameDisplay.textContent = file;

  // Event Listeners
  markdownInput.addEventListener('input', () => {
    updatePreview();
    updateState(markdownInput.value !== state.originalContent);
  });

  btnSave.addEventListener('click', saveContent);

  // Ctrl+S or Cmd+S handling
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveContent();
    }
  });

  // Warn before leaving if modified
  window.addEventListener('beforeunload', (e) => {
    if (state.isModified) {
      e.preventDefault();
      e.returnValue = ''; // Standard for most browsers
    }
  });

  fetchRawContent();
}

// Run init
init();
