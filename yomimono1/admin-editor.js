import { basicSetup } from "codemirror";
import { EditorView, keymap, Decoration, WidgetType, ViewPlugin } from "@codemirror/view";
import { EditorState, StateEffect, StateField, RangeSetBuilder } from "@codemirror/state";

const state = {
  filename: null,
  originalContent: '',
  isModified: false,
};

// Config
const POV_CHARACTERS = ["土屋", "雨宮", "小林", "鉄", "黒須"];
const POV_NG_WORDS = ["思った", "感じた", "悲しんだ", "安堵した", "焦った", "胸を撫で下ろした", "気がした", "表情を曇らせた", "見えた"];
let currentDefaultPov = "";

// DOM Elements
const fileNameDisplay = document.getElementById('file-name-display');
const btnSave = document.getElementById('btn-save');
const previewOutput = document.getElementById('preview-output');
const statusIndicator = document.getElementById('status-indicator');
const toastContainer = document.getElementById('toast-container');
const defaultPovSelect = document.getElementById('default-pov-select');

// Modal Elements
const modalOverlay = document.getElementById('tag-edit-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalSaveBtn = document.getElementById('modal-save-btn');
const modalAttrContainer = document.getElementById('modal-attributes-container');

let editorView = null;

// --- Toast Notification ---
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

// --- Status Update ---
function updateState(isChanged) {
  state.isModified = isChanged;
  btnSave.disabled = !isChanged;
  statusIndicator.textContent = isChanged ? '未保存の変更があります' : 'すべての変更を保存しました';
  statusIndicator.className = isChanged ? 'status-indicator modified' : 'status-indicator';
}

function updatePreview() {
  if (!editorView) return;
  const markdown = editorView.state.doc.toString();
  if (typeof marked !== 'undefined') {
    previewOutput.innerHTML = marked.parse(markdown);
  } else {
    previewOutput.textContent = 'プレビューをレンダリングできません（marked.jsが未ロード）';
  }
}

// --- CodeMirror Plugins ---

// 1. Tag Widget Plugin
class TagWidget extends WidgetType {
  constructor(tagName, isClosing, rawAttrs) {
    super();
    this.tagName = tagName;
    this.isClosing = isClosing;
    this.rawAttrs = rawAttrs;
    
    this.attrs = {};
    if (!isClosing && rawAttrs) {
      const attrRegex = /([a-zA-Z0-9_]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^>\s]+))/g;
      let m;
      while ((m = attrRegex.exec(rawAttrs)) !== null) {
        this.attrs[m[1]] = m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : m[4]);
      }
    }
  }

  toDOM(view) {
    const span = document.createElement("span");
    span.className = "cm-tag-widget";
    
    const nameEl = document.createElement("span");
    nameEl.className = "cm-tag-widget-name";
    nameEl.textContent = this.isClosing ? `/${this.tagName}` : this.tagName;
    span.appendChild(nameEl);

    if (!this.isClosing) {
      const keys = Object.keys(this.attrs);
      if (keys.length > 0) {
        // Display summary of attributes (max 2 for brevity)
        const summaryKeys = keys.slice(0, 2);
        const attrStr = summaryKeys.map(k => `${k}="${this.attrs[k]}"`).join(" ") + (keys.length > 2 ? " ..." : "");
        const attrEl = document.createElement("span");
        attrEl.style.opacity = "0.7";
        attrEl.style.fontSize = "0.9em";
        attrEl.textContent = attrStr;
        span.appendChild(attrEl);
      }
    }

    span.onclick = (e) => {
      e.preventDefault();
      const pos = view.posAtDOM(span);
      view.dom.dispatchEvent(new CustomEvent('edit-tag', {
        detail: { tagName: this.tagName, isClosing: this.isClosing, attrs: this.attrs, pos, rawAttrs: this.rawAttrs },
        bubbles: true
      }));
    };
    return span;
  }
}

function tagDecorations(view) {
  let builder = new RangeSetBuilder();
  for (let {from, to} of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    // matches <Tag ...> or </Tag> or <POV ...>
    const regex = /<(\/?)([A-Z][a-zA-Z0-9]*|POV)([^>]*)>/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      let isClosing = match[1] === '/';
      let tagName = match[2];
      let rawAttrs = match[3] || "";
      
      let start = from + match.index;
      let end = start + match[0].length;
      
      builder.add(start, end, Decoration.replace({
        widget: new TagWidget(tagName, isClosing, rawAttrs),
        inclusive: false
      }));
    }
  }
  return builder.finish();
}

const tagPlugin = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = tagDecorations(view); }
  update(update) {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = tagDecorations(update.view);
    }
  }
}, { decorations: v => v.decorations });

// 2. POV Check Plugin
function povDecorations(view) {
  let builder = new RangeSetBuilder();
  const text = view.state.doc.toString();
  
  let currentPov = currentDefaultPov;
  let povRanges = []; 
  const tagRegex = /<(\/?)(POV)([^>]*)>/g;
  let m;
  let lastPos = 0;
  
  while ((m = tagRegex.exec(text)) !== null) {
      let isClosing = m[1] === '/';
      if (!isClosing) {
          povRanges.push({start: lastPos, end: m.index, pov: currentPov});
          let nameMatch = /name\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(m[3]);
          if(nameMatch) currentPov = nameMatch[1] || nameMatch[2];
          lastPos = m.index + m[0].length;
      } else {
          povRanges.push({start: lastPos, end: m.index, pov: currentPov});
          currentPov = currentDefaultPov;
          lastPos = m.index + m[0].length;
      }
  }
  povRanges.push({start: lastPos, end: text.length, pov: currentPov});
  
  let decos = [];
  povRanges.forEach(range => {
    if (!range.pov) return; // No POV set means no warning is generated
    
    let chunk = text.substring(range.start, range.end);
    let sentenceRegex = /[^。\n]+(?:。|\n|$)/g;
    let sMatch;
    while ((sMatch = sentenceRegex.exec(chunk)) !== null) {
       let sentence = sMatch[0];
       if (sentence.trim() === "") continue;
       
       let sentenceStart = range.start + sMatch.index;
       let otherCharsFound = POV_CHARACTERS.filter(c => c !== range.pov && sentence.includes(c));
       if (otherCharsFound.length > 0) {
           let ngWordsFound = POV_NG_WORDS.filter(w => sentence.includes(w));
           if (ngWordsFound.length > 0) {
               decos.push({
                  from: sentenceStart, 
                  to: sentenceStart + sentence.trim().length,
                  deco: Decoration.mark({
                     class: "cm-pov-warning",
                     attributes: {title: `POV違反の疑い: [${otherCharsFound.join(',')}] の心情描写 ([${ngWordsFound.join(',')}])`}
                  })
               });
           }
       }
    }
  });
  
  decos.sort((a,b) => a.from - b.from);
  decos.forEach(d => builder.add(d.from, d.to, d.deco));
  
  return builder.finish();
}

const povForceUpdateEffect = StateEffect.define();
const povTriggerField = StateField.define({
  create() { return 0; },
  update(val, tr) { 
    for(let e of tr.effects) if (e.is(povForceUpdateEffect)) return val + 1;
    return val;
  }
});

const povPlugin = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = povDecorations(view); }
  update(update) {
    if (update.docChanged || update.viewportChanged || 
        (update.state.field(povTriggerField, false) !== update.startState.field(povTriggerField, false))) {
      this.decorations = povDecorations(update.view);
    }
  }
}, { decorations: v => v.decorations });

// --- Modal Logic ---
let currentEditingTag = null;

function openModal(tagInfo) {
  if (tagInfo.isClosing) return;
  currentEditingTag = tagInfo;
  
  modalAttrContainer.innerHTML = '';
  
  // Tag Name readonly
  const nameLabel = document.createElement('label');
  nameLabel.textContent = 'タグ名';
  const nameInput = document.createElement('input');
  nameInput.value = currentEditingTag.tagName;
  nameInput.readOnly = true;
  nameLabel.appendChild(nameInput);
  modalAttrContainer.appendChild(nameLabel);
  
  // Existing attributes
  for (const [key, val] of Object.entries(currentEditingTag.attrs)) {
     const lbl = document.createElement('label');
     lbl.textContent = key;
     const inp = document.createElement('input');
     inp.type = 'text';
     inp.value = val;
     inp.dataset.attrKey = key;
     inp.className = 'tag-attr-input';
     lbl.appendChild(inp);
     modalAttrContainer.appendChild(lbl);
  }
  
  modalOverlay.classList.remove('hidden');
}

function closeModal() {
  modalOverlay.classList.add('hidden');
  currentEditingTag = null;
}

modalCloseBtn.onclick = closeModal;
modalCancelBtn.onclick = closeModal;

modalSaveBtn.onclick = () => {
    if (!currentEditingTag) return;
    
    const inputs = modalAttrContainer.querySelectorAll('.tag-attr-input');
    let attrStr = '';
    inputs.forEach(inp => {
        attrStr += ` ${inp.dataset.attrKey}="${inp.value}"`;
    });
    
    // Maintain self-closing if original had it
    const isSelfClosing = currentEditingTag.rawAttrs.trim().endsWith('/');
    const newTagString = `<${currentEditingTag.tagName}${attrStr}${isSelfClosing ? ' /' : ''}>`;
    
    const text = editorView.state.doc.toString();
    const regex = /<([A-Z][a-zA-Z0-9]*|POV)[^>]*>/g;
    regex.lastIndex = currentEditingTag.pos;
    const match = regex.exec(text);
    
    if (match && match.index === currentEditingTag.pos) {
        editorView.dispatch({
           changes: {from: match.index, to: match.index + match[0].length, insert: newTagString}
        });
    } else {
        showToast("タグの更新に失敗しました（位置の不一致）", "error");
    }
    closeModal();
};

document.getElementById('editor-container-cm').addEventListener('edit-tag', (e) => {
    openModal(e.detail);
});

// --- Main Integration ---

// Fetch Raw Content
async function fetchRawContent() {
  try {
    const res = await fetch(`/api/raw?file=${encodeURIComponent(state.filename)}`);
    if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
    const data = await res.json();
    state.originalContent = data.content || '';
    
    const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged) {
            updatePreview();
            updateState(editorView.state.doc.toString() !== state.originalContent);
        }
    });

    editorView = new EditorView({
      doc: state.originalContent,
      extensions: [
        basicSetup,
        updateListener,
        EditorView.lineWrapping,
        tagPlugin,
        povTriggerField,
        povPlugin
      ],
      parent: document.getElementById('editor-container-cm')
    });

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
    const currentText = editorView.state.doc.toString();
    const res = await fetch('/api/raw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file: state.filename,
        content: currentText
      })
    });
    
    const data = await res.json();
    if (res.ok) {
      showToast('保存しました', 'success');
      state.originalContent = currentText;
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
  const urlParams = new URLSearchParams(window.location.search);
  const file = urlParams.get('file');

  if (!file) {
    fileNameDisplay.textContent = 'ファイルが指定されていません';
    return;
  }

  state.filename = file;
  fileNameDisplay.textContent = file;

  defaultPovSelect.addEventListener('change', (e) => {
      currentDefaultPov = e.target.value;
      if (editorView) {
          editorView.dispatch({
              effects: povForceUpdateEffect.of(null)
          });
      }
  });

  // --- Insert Toolbar ---
  const btnInsertChar = document.getElementById('btn-insert-char');
  const btnInsertPov = document.getElementById('btn-insert-pov');
  const btnInsertTerm = document.getElementById('btn-insert-term');

  function insertTextAtCursor(text, cursorIndex) {
    if (!editorView) return;
    const selection = editorView.state.selection.main;
    editorView.dispatch({
      changes: {from: selection.from, to: selection.to, insert: text},
      selection: {anchor: selection.from + cursorIndex}
    });
    editorView.focus();
  }

  if (btnInsertChar) btnInsertChar.addEventListener('click', () => insertTextAtCursor('<Char role="" />', 12));
  if (btnInsertPov) btnInsertPov.addEventListener('click', () => insertTextAtCursor('<POV name="">\n\n</POV>', 11));
  if (btnInsertTerm) btnInsertTerm.addEventListener('click', () => insertTextAtCursor('<Term id="">用語</Term>', 10));

  btnSave.addEventListener('click', saveContent);

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveContent();
    }
  });

  window.addEventListener('beforeunload', (e) => {
    if (state.isModified) {
      e.preventDefault();
      e.returnValue = ''; 
    }
  });

  fetchRawContent();
}

init();
