// 動作ロジックファイル
// データの更新、編集モード管理、イベント処理を担当します

// --- グローバル変数 ---
window.isEditMode = false;
let currentSlideIndex = 0;

// バージョン管理用メタデータ
window.metaData = {
    version: 1,
    lastModified: new Date().toISOString(),
    systemName: "WowfitSlideSystem"
};

const presentation = document.getElementById('presentation');

// --- IndexedDB Configuration ---
const DB_NAME = 'WowfitPresentationDB';
const DB_VERSION = 1;
const STORE_NAME = 'slides_store';
const KEY_DATA = 'current_presentation_data';

// --- DB Helper Functions ---
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function saveToDB() {
    window.metaData.lastModified = new Date().toISOString();
    
    // 最後のスライドで保存された場合のみ再描画（バージョン表示更新のため）
    if(currentSlideIndex === slidesData.length - 1) {
        renderSlides();
        showSlide(currentSlideIndex);
    }

    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        
        const record = {
            id: KEY_DATA,
            slides: slidesData,
            meta: window.metaData
        };
        
        store.put(record);
        console.log('Auto-saved to IndexedDB:', window.metaData.lastModified);
    } catch (err) {
        console.error('Save failed:', err);
    }
}

async function loadFromDB() {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(KEY_DATA);
        
        return new Promise((resolve) => {
            request.onsuccess = (event) => {
                const result = event.target.result;
                if (result) {
                    resolve(result);
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => resolve(null);
        });
    } catch (err) {
        console.error('Load failed:', err);
        return null;
    }
}

// --- DB削除機能（2段階確認付き） ---
window.clearDatabaseWithConfirmation = async function() {
    if (!confirm("【警告】\n現在ブラウザに保存されている編集データをすべて削除し、初期状態（data.js）に戻します。\n\nよろしいですか？")) {
        return;
    }
    
    if (!confirm("【最終確認】\n本当に削除してよろしいですか？\nこの操作は取り消せません。")) {
        return;
    }

    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.clear(); 

        request.onsuccess = () => {
            alert("データを削除しました。ページを再読み込みします。");
            location.reload(); 
        };
        
        request.onerror = (err) => {
            console.error("Delete Error:", err);
            alert("削除に失敗しました。");
        };
    } catch (err) {
        console.error("DB Error:", err);
        alert("エラーが発生しました。");
    }
};


// --- 編集モード関連 ---
window.getEditAttrs = function(index, ...pathParts) {
    if (!window.isEditMode) return '';
    const path = pathParts.join('.');
    const style = 'border: 1px dashed #bbb; padding: 2px 5px; min-width: 20px; display: inline-block; cursor: text; background: rgba(255,255,255,0.9); border-radius: 4px;';
    return `contenteditable="true" style="${style}" oninput="window.updateData(${index}, '${path}', this.innerHTML)"`;
}

window.updateData = function(index, path, value) {
    const keys = path.split('.');
    let target = slidesData[index];
    for (let i = 0; i < keys.length - 1; i++) {
        target = target[keys[i]];
    }
    target[keys[keys.length - 1]] = value;
    saveToDB();
};

window.toggleEditMode = function() {
    window.isEditMode = !window.isEditMode;
    const btn = document.getElementById('btn-edit');
    if(window.isEditMode) {
        btn.innerHTML = '<span class="material-icons-round">check</span> 完了';
        btn.style.background = "#ffb74d"; 
        btn.style.color = "#000";
    } else {
        btn.innerHTML = '<span class="material-icons-round">edit</span> 編集';
        btn.style.background = ""; 
        btn.style.color = "";
    }
    renderSlides();
    showSlide(currentSlideIndex);
};

// --- 画像編集機能 ---
window.currentEditImageIndex = null;
window.startImageEdit = function(event, index) {
    if(!window.isEditMode) return;
    event.stopPropagation(); 
    window.currentEditImageIndex = index;
    const overlay = document.createElement('div');
    overlay.className = 'image-edit-overlay';
    overlay.innerHTML = `
        <div class="edit-modal">
            <h3>画像の変更</h3>
            <p><strong>Ctrl+V</strong> で画像を貼り付けるか、<br>ファイルを選択してください。</p>
            <button onclick="document.getElementById('img-upload-input').click()">ファイルを選択</button>
            <button onclick="closeImageEdit()">キャンセル</button>
            <input type="file" id="img-upload-input" accept="image/*" style="display:none" onchange="handleImageFile(this)">
        </div>
    `;
    document.body.appendChild(overlay);
    document.addEventListener('paste', handleImagePaste);
};

window.closeImageEdit = function() {
    const overlay = document.querySelector('.image-edit-overlay');
    if(overlay) overlay.remove();
    document.removeEventListener('paste', handleImagePaste);
    window.currentEditImageIndex = null;
};

window.handleImagePaste = function(e) {
    if (window.currentEditImageIndex === null) return;
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file' && item.type.includes('image/')) {
            const blob = item.getAsFile();
            const reader = new FileReader();
            reader.onload = (event) => {
                updateImage(window.currentEditImageIndex, event.target.result);
                closeImageEdit();
            };
            reader.readAsDataURL(blob);
            e.preventDefault();
            return;
        }
    }
};

window.handleImageFile = function(input) {
    if (window.currentEditImageIndex === null) return;
    const file = input.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        updateImage(window.currentEditImageIndex, e.target.result);
        closeImageEdit();
    };
    reader.readAsDataURL(file);
};

window.updateImage = function(index, dataUrl) {
    slidesData[index].img = dataUrl;
    saveToDB();
    renderSlides();
    showSlide(currentSlideIndex);
    alert('画像を更新し、保存しました');
};

// --- メイン描画関数 ---
function renderSlides() {
    // もしslidesDataが配列でない場合のエラーガード
    if (!Array.isArray(slidesData)) {
        console.error('slidesData is not an array:', slidesData);
        alert('データの読み込みエラーが発生しました。初期化ボタンを押してみてください。');
        return;
    }

    presentation.innerHTML = '';
    slidesData.forEach((slide, index) => {
        const el = document.createElement('div');
        el.id = `slide-${index}`;
        el.className = `slide ${slide.type ? 'type-'+slide.type : 'layout-'+(slide.layout || 'standard')}`;
        if(index===0) el.classList.add('active');
        el.innerHTML = LayoutRenderer.render(slide, index);
        presentation.appendChild(el);
    });
}

function showSlide(n) {
    if(!Array.isArray(slidesData) || slidesData.length === 0) return;
    if(n<0) n=0; if(n>=slidesData.length) n=slidesData.length-1;
    const activeSlide = document.querySelector('.slide.active');
    if(activeSlide) activeSlide.classList.remove('active');
    const nextSlide = document.getElementById(`slide-${n}`);
    if(nextSlide) nextSlide.classList.add('active');
    currentSlideIndex = n;
}

window.nextSlide = function(){ showSlide(currentSlideIndex+1); }
window.prevSlide = function(){ showSlide(currentSlideIndex-1); }
window.printSlides = function(){ window.print(); }

function fitToScreen() {
    const presentation = document.getElementById('presentation');
    const scale = Math.min(window.innerWidth / 1123, window.innerHeight / 794) * 0.95; 
    presentation.style.transform = `scale(${scale})`;
}

// IO機能
window.downloadJson = function() {
    const exportData = { meta: window.metaData, slides: slidesData };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `wowfit_slides_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

window.loadJson = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const loadedObj = JSON.parse(e.target.result);
            // 形式判定
            if(Array.isArray(loadedObj)){
                slidesData = loadedObj;
                window.metaData.lastModified = new Date().toISOString(); 
            } else if (loadedObj.slides && Array.isArray(loadedObj.slides)) {
                slidesData = loadedObj.slides;
                if(loadedObj.meta) window.metaData = loadedObj.meta;
            } else {
                throw new Error("Invalid Format");
            }
            saveToDB(); 
            renderSlides();
            showSlide(0); 
            alert(`データを読み込みました。\n最終更新: ${formatDate(window.metaData.lastModified)}`);
        } catch(error) {
            console.error(error);
            alert("エラー: ファイルを読み込めませんでした。");
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

window.formatDate = function(isoString) {
    if(!isoString) return 'Unversioned';
    const d = new Date(isoString);
    return `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

window.addEventListener('resize', fitToScreen);
document.addEventListener('keydown', e => {
    if(window.isEditMode) return; 
    if(e.key==="ArrowRight"||e.key===" ") nextSlide();
    if(e.key==="ArrowLeft") prevSlide();
});

// --- 初期化処理 (修正ポイント) ---
document.addEventListener('DOMContentLoaded', async () => {
    fitToScreen();
    const dbData = await loadFromDB();
    
    if (dbData) {
        // DBにある場合はそこから復元
        slidesData = dbData.slides;
        if(dbData.meta) window.metaData = dbData.meta;
        console.log("Loaded from IndexedDB");
    } else {
        // DBになく、data.js を使う場合
        console.log("Loaded default data.js");
        
        // ★ここが修正点: data.js が {meta:..., slides:[...]} 形式の場合、中身を取り出す
        if (!Array.isArray(slidesData) && slidesData.slides) {
            if(slidesData.meta) window.metaData = slidesData.meta;
            slidesData = slidesData.slides; // 配列部分だけを本体にセット
        }
    }
    
    renderSlides();
});
