import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { CharacterNames } from './src/character_dictionary.js';
import { ItTermDictionary } from './src/it_term_dictionary.js';
import { TermDictionary } from './src/term_dictionary.js';
import { TermFirstAppearanceMap } from './src/term_map.js';
import { SidebarNavItems } from './src/sidebar_nav.js';
import { addSpaceAfterPunctuation } from './src/text_formatter.js';
function resolveCharacters(text) {
  return text.replace(/<Char\s+role="([^"]+)"(?:\s+callrole="([^"]+)")?\s+var="([^"]+)"\s*\/>/g, (match, role, callrole, variant) => {
    const charData = CharacterNames[role];
    if (!charData) return `[Unknown Char: ${role}]`;

    if (variant === 'furigana' || variant === 'age') {
      return charData[variant] || `[Unknown Prop: ${variant}]`;
    }

    if (callrole) {
      if (charData.callers?.[callrole]?.[variant]) {
        return charData.callers[callrole][variant];
      }
      // フォールバック: 指定されたcallroleが無い場合、'system'の該当バリエーションを探す
      if (charData.callers?.system?.[variant]) {
        return charData.callers.system[variant];
      }
      return `[Unknown Var: ${role}/${callrole} or system/${variant}]`;
    }

    return `[Missing CallRole: ${role}]`;
  });
}

function resolveTerms(text, currentEpisode) {
  const combinedDictionary = { ...ItTermDictionary, ...TermDictionary };
  const localSeen = new Set(); // ページ内で同一用語が複数回出た場合の重複防止
  const footnotes = [];
  let footnoteCounter = 1;

  // 現在の設定モードを取得 "ignore", "expert", "simple" のいずれか（デフォルトは expert）
  const termsMode = localStorage.getItem('yomimono_terms_mode') || 'expert';

  let newText = text.replace(/<Term\s+id="([^"]+)"(?:\s*>([\s\S]*?)<\/Term>|\s*\/>)/g, (match, id, innerText) => {
    const termData = combinedDictionary[id];
    if (!termData) return `[Unknown Term: ${id}]`;

    const displayStr = (innerText && innerText.trim().length > 0) ? innerText : termData.term;

    // モードごとの分岐
    if (termsMode === 'simple' && termData.simple_term) {
      // 中学3年生モード（IT用語などを簡単な言葉に置き換える。ルビや注釈はつけない）
      return termData.simple_term;
    } else if (termsMode === 'expert') {
      // 通常モード（本文にそのまま表示＋初回登場時に注釈マーク）
      if (TermFirstAppearanceMap[id] === currentEpisode && !localSeen.has(id)) {
        localSeen.add(id);
        const mark = `※${footnoteCounter}`;
        footnotes.push(`${mark} ${termData.term}： ${termData.description}`);
        footnoteCounter++;
        return `${displayStr}<span class="term-mark">（${mark}）</span>`;
      } else {
        return displayStr;
      }
    } else {
      // 'ignore' モードを含む、その他（単に表示のみ、注釈なし）
      return displayStr;
    }
  });

  // モードがエキスパートであり、かつ注釈がある場合のみフッターに一覧を追加
  if (termsMode === 'expert' && footnotes.length > 0) {
    let footnoteMarkdown = '\n\n<div class="term-footnotes">\n\n**【用語解説】**\n\n';
    footnotes.forEach(note => {
      footnoteMarkdown += `${note}  \n`;
    });
    footnoteMarkdown += '</div>\n\n';
    
    const nextActionIndex = newText.indexOf('<div class="next-action">');
    if (nextActionIndex !== -1) {
      newText = newText.slice(0, nextActionIndex) + footnoteMarkdown + newText.slice(nextActionIndex);
    } else {
      newText += footnoteMarkdown;
    }
  }

  return newText;
}

const markdownContainer = document.getElementById('markdown-container');
const siteTitle = document.getElementById('site-title');
const siteSubtitle = document.getElementById('site-subtitle');

const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileOverlay = document.getElementById('mobile-overlay');
const sidebar = document.getElementById('sidebar');

// currentPhase 削除済
function toggleSidebar() {
  if (sidebar) sidebar.classList.toggle('sidebar-open');
  if (mobileOverlay) mobileOverlay.classList.toggle('active');
}

function closeSidebar() {
  if (sidebar) sidebar.classList.remove('sidebar-open');
  if (mobileOverlay) mobileOverlay.classList.remove('active');
}

if (mobileMenuBtn) {
  mobileMenuBtn.addEventListener('click', toggleSidebar);
}

if (mobileOverlay) {
  mobileOverlay.addEventListener('click', closeSidebar);
}

function navigateTo(target, push = true) {
  if (push) {
    const url = new URL(window.location);
    url.searchParams.set('p', target);
    url.searchParams.delete('ph'); // 古いパラメータがある場合は消去
    window.history.pushState({ p: target }, '', url);
  }

  localStorage.setItem('yomimono_last_page', target);

  // 初回アクセスから別のページへ移動した場合、トゥルーモードを解禁する
  if (target !== 'ep0000') {
    localStorage.setItem('yomimono_unlocked', 'true');
  }

  restoreState(target);
  updateSidebarAccordion(target);
  loadMarkdown(target);

  // ページ上部へスクロール
  const contentArea = document.getElementById('content-area');
  if (contentArea) contentArea.scrollTop = 0;

  // モバイルビューの場合はリンククリック後にサイドバーを閉じる
  if (window.innerWidth <= 768) {
    closeSidebar();
  }
}

async function loadMarkdown(target) {
  try {
    const response = await fetch(`./settings/${target}.mdx`);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const markdownText = await response.text();
    const charResolved = resolveCharacters(markdownText);
    const fullyResolved = resolveTerms(charResolved, target);
    const formatted = addSpaceAfterPunctuation(fullyResolved);
    const html = marked(formatted);
    const cleanHtml = DOMPurify.sanitize(html);
    markdownContainer.innerHTML = cleanHtml;

    // --- テキストコピペボタンの生成 ---
    const copyBtnContainer = document.createElement('div');
    copyBtnContainer.className = 'copy-text-btn-wrap';
    
    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn-copy-text';
    copyBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      <span class="copy-btn-text">テキストをコピー</span>
    `;
    copyBtn.addEventListener('click', () => {
      const clone = markdownContainer.cloneNode(true);
      // 「.term-footnotes」を削除対象から外す
      const elementsToRemove = clone.querySelectorAll('.term-modal-btn-wrap, .copy-text-btn-wrap, .next-action, .btn-normal-prev');
      elementsToRemove.forEach(el => el.remove());

      const offscreen = document.createElement('div');
      offscreen.style.position = 'absolute';
      offscreen.style.left = '-9999px';
      offscreen.style.whiteSpace = 'pre-wrap';
      offscreen.appendChild(clone);
      document.body.appendChild(offscreen);
      let plainText = offscreen.innerText;
      
      plainText = plainText
        .split('\n')
        .map(line => line.trim()) // 各行の前後の空白を削除
        .join('\n')
        .replace(/\n{3,}/g, '\n\n') // 3連続以上の改行を2つに圧縮
        .trim();

      document.body.removeChild(offscreen);

      navigator.clipboard.writeText(plainText).then(() => {
        const textSpan = copyBtn.querySelector('.copy-btn-text');
        const originalText = textSpan.textContent;
        textSpan.textContent = 'コピーしました';
        copyBtn.classList.add('copied');
        setTimeout(() => {
          textSpan.textContent = originalText;
          copyBtn.classList.remove('copied');
        }, 2000);
      }).catch(err => {
        console.error('Copy failed', err);
      });
    });
    copyBtnContainer.appendChild(copyBtn);

    const firstH1ForCopy = markdownContainer.querySelector('h1');
    if (firstH1ForCopy) {
      firstH1ForCopy.parentNode.insertBefore(copyBtnContainer, firstH1ForCopy.nextSibling);
    } else {
      markdownContainer.prepend(copyBtnContainer);
    }

    // --- 用語の抽出と解説ボタンの生成 ---
    if (target !== 'world' && target !== 'character' && target !== 'true_character') {
      const { matchedIT, matchedNovel } = extractTermsFromText(fullyResolved, target);
      
      if (matchedIT.length > 0 || matchedNovel.length > 0) {
        // ボタンを生成
        const btnContainer = document.createElement('div');
        btnContainer.className = 'term-modal-btn-wrap';
        
        const termBtn = document.createElement('button');
        termBtn.className = 'btn-term-modal';
        termBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          この話の用語解説
        `;
        btnContainer.appendChild(termBtn);
        
        // H1タイトルの直後、またはコンテナの先頭に挿入
        const firstH1 = markdownContainer.querySelector('h1');
        if (firstH1) {
          firstH1.parentNode.insertBefore(btnContainer, firstH1.nextSibling);
        } else {
          markdownContainer.prepend(btnContainer);
        }

        // クリックイベントでモーダルを開く
        termBtn.addEventListener('click', () => {
          openTermModal(matchedIT, matchedNovel);
        });
      }
    }
    // ---------------------------------

    // --- 前に戻るボタンの動的生成 ---
    const navLinksArray = Array.from(document.querySelectorAll('a[data-target]'));
    const currentIndex = navLinksArray.findIndex(link => link.dataset.target === target);

    // 現在のページが一覧にあり、かつ最初のページ(0番目)ではない場合のみ
    if (currentIndex > 0 && target !== 'ep0000') {
      const prevTarget = navLinksArray[currentIndex - 1].dataset.target;
      const nextActionContainer = markdownContainer.querySelector('.next-action');

      if (nextActionContainer) {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'btn-normal-prev';
        prevBtn.dataset.prev = prevTarget;
        prevBtn.textContent = '前の話に戻る';

        nextActionContainer.prepend(prevBtn);

        prevBtn.addEventListener('click', (e) => {
          const targetToLoad = e.target.dataset.prev;
          navigateTo(targetToLoad);
        });
      }
    }
    // ---------------------------------

    // 次へボタン（通常遷移）のイベントリスナーを登録
    const normalNextBtns = document.querySelectorAll('.btn-normal-next');
    normalNextBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const nextTarget = e.target.dataset.next;
        navigateTo(nextTarget);
      });
    });

    // 暗転・グリッチ遷移のエフェクトボタン
    const glitchNextBtns = document.querySelectorAll('.btn-glitch-next');
    glitchNextBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const nextTarget = e.target.dataset.next;
        const overlay = document.getElementById('chapter-end-overlay');
        const isUnlocked = localStorage.getItem('yomimono_unlocked') === 'true';
        
        if (overlay && !isUnlocked) {
          overlay.classList.add('visible');
          
          // 2.5秒後に画面遷移し、オーバーレイを消す
          setTimeout(() => {
            navigateTo(nextTarget);
            // 遷移後にオーバーレイのフェードアウトを開始
            overlay.classList.remove('visible');
          }, 2500);
        } else {
          // すでに反転モードの場合はエフェクトなしで遷移
          navigateTo(nextTarget);
        }
      });
    });
  } catch (error) {
    markdownContainer.innerHTML = `<p class="error">コンテンツの読み込みに失敗しました。Error: ${error.message}</p>`;
  }
}


function updateSidebarAccordion(target) {
  const links = document.querySelectorAll('#sidebar .nav-group a');
  let activeLink = null;

  links.forEach(link => {
    link.classList.remove('active');
    if (link.dataset.target === target) {
      link.classList.add('active');
      activeLink = link;
    }
  });

  if (activeLink) {
    const activeDetails = activeLink.closest('details.nav-group');
    const allDetails = document.querySelectorAll('#sidebar details.nav-group');

    allDetails.forEach(details => {
      // 設定資料（true_character, world）は手動開閉に任せる場合は除外する等の調整が可能ですが、
      // 今回は「現在いるエピソードのグループだけを開き、他は閉じる」という仕様に基づき全制御します。
      if (details === activeDetails) {
        details.setAttribute('open', '');
      } else {
        details.removeAttribute('open');
      }
    });
  }
}

function bindNavEvents() {
  const currentNavLinks = document.querySelectorAll('a[data-target]');
  currentNavLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = e.target.dataset.target;
      navigateTo(target);
    });
  });
}

// --- ページ状態復元機能 ---
function restoreState(target) {
  const navContainer = document.getElementById('nav-container');

  const isUnlocked = localStorage.getItem('yomimono_unlocked') === 'true';

  if (!isUnlocked) {
    // -------------------------
    // フェイクモード（初期状態）
    // -------------------------
    document.body.classList.remove('true-mode');
    document.body.classList.add('fake-mode');
    siteTitle.textContent = '業務マニュアル';
    siteSubtitle.innerHTML = '社内業務引き継ぎ資料<br>作成者：小林悠太';
    
    // サイドバーメニュー構成（プロローグのみ見せる）
    navContainer.innerHTML = `
      <details class="nav-group item-list" open>
        <summary>マニュアル項目</summary>
        <ul id="nav-links">
          <li><a href="#" data-target="ep0000">プロローグ</a></li>
        </ul>
      </details>
    `;
  } else {
    // -------------------------
    // トゥルーモード（解禁後）
    // -------------------------
    document.body.classList.remove('fake-mode');
    document.body.classList.add('true-mode');
    siteTitle.textContent = '[BUG_REPORT]';
    siteSubtitle.innerHTML = '仕様書にないバグですが、<br>たぶん俺のことです';
    
    const mainNavLinks = SidebarNavItems.map(item => 
      `<li><a href="#" data-target="${item.target}">${item.title}</a></li>`
    ).join('\n          ');

    // サイドバーメニュー構成（通常通り全開）
    navContainer.innerHTML = `
        <details class="nav-group">
          <summary>設定資料</summary>
          <ul>
            <li><a href="#" data-target="true_character">キャラクター（本編）</a></li>
            <li><a href="#" data-target="world">世界観・ルール</a></li>
          </ul>
        </details>
        <details class="nav-group" open>
          <summary>本編</summary>
          <ul>
            ${mainNavLinks}
          </ul>
        </details>
    `;
  }

  bindNavEvents();

  // アクティブリンクの設定
  const currentNavLinks = document.querySelectorAll('a[data-target]');
  currentNavLinks.forEach(nav => nav.classList.remove('active'));
  const activeLink = document.querySelector(`a[data-target="${target}"]`);
  if (activeLink) activeLink.classList.add('active');
}

// ブラウザの戻る・進む（popstate）対応
window.addEventListener('popstate', (e) => {
  if (e.state) {
    navigateTo(e.state.p, false);
  } else {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('p') || localStorage.getItem('yomimono_last_page') || 'prologue1';
    navigateTo(p, false);
  }
});

// リセットボタン（初めから読み直す）のイベント登録
const btnResetState = document.getElementById('btn-reset-state');
if (btnResetState) {
  btnResetState.addEventListener('click', () => {
    localStorage.removeItem('yomimono_last_page');
    localStorage.removeItem('yomimono_phase');
    localStorage.removeItem('yomimono_unlocked'); // フェイクモード状態のフラグも消す
    localStorage.removeItem('yomimono_initial_setup_done');
    navigateTo('ep0000');
    checkInitialModal();
  });
}

// 古いフラグ形式からのマイグレーションも兼ねて設定を初期化
const settingTermsModeSelect = document.getElementById('setting-terms-mode');
let currentTermsMode = localStorage.getItem('yomimono_terms_mode');

if (!currentTermsMode) {
  // 古い yomimono_show_terms フラグがあればそれを見る
  const oldFlag = localStorage.getItem('yomimono_show_terms');
  if (oldFlag === 'false') {
    currentTermsMode = 'ignore';
  } else {
    currentTermsMode = 'expert'; // デフォルト
  }
  localStorage.setItem('yomimono_terms_mode', currentTermsMode);
}

if (settingTermsModeSelect) {
  settingTermsModeSelect.value = currentTermsMode;

  settingTermsModeSelect.addEventListener('change', (e) => {
    const newMode = e.target.value;
    localStorage.setItem('yomimono_terms_mode', newMode);
    
    // 即時反映のために本文を再描画する
    const urlParams = new URLSearchParams(window.location.search);
    const target = urlParams.get('p') || localStorage.getItem('yomimono_last_page') || 'ep0000';
    loadMarkdown(target);
  });
}

// 初期化処理
function init() {
  const urlParams = new URLSearchParams(window.location.search);
  const urlTarget = urlParams.get('p');
  const lastPage = urlTarget || localStorage.getItem('yomimono_last_page') || 'ep0000'; // 初期ページはプロローグ

  // URLにパラメーターがない場合は localStorage の値を付与して replaceState
  if (!urlTarget) {
    const url = new URL(window.location);
    url.searchParams.set('p', lastPage);
    url.searchParams.delete('ph'); // 古いパラメータ対策で念の為消去
    window.history.replaceState({ p: lastPage }, '', url);
  } else if (!window.history.state) {
    // パラメーターはあるが history.state が空の場合（直リンク等）
    window.history.replaceState({ p: lastPage }, '', window.location.href);
  }

  restoreState(lastPage);
  updateSidebarAccordion(lastPage);
  loadMarkdown(lastPage);

  checkInitialModal();
}

function checkInitialModal() {
  const isUnlocked = localStorage.getItem('yomimono_unlocked') === 'true';
  const isSetupDone = localStorage.getItem('yomimono_initial_setup_done') === 'true';
  const initialModal = document.getElementById('initial-settings-modal');
  const initialOverlay = document.getElementById('initial-settings-overlay');
  
  if (!isUnlocked && !isSetupDone && initialModal && initialOverlay) {
    initialModal.classList.add('active');
    initialOverlay.classList.add('active');
  }
}

function closeInitialModal() {
  localStorage.setItem('yomimono_initial_setup_done', 'true');
  const initialModal = document.getElementById('initial-settings-modal');
  const initialOverlay = document.getElementById('initial-settings-overlay');
  if (initialModal) initialModal.classList.remove('active');
  if (initialOverlay) initialOverlay.classList.remove('active');
}

function showSettingsTooltip() {
  const originalToggle = document.querySelector('.settings-toggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('mobile-overlay');

  if (!originalToggle) return;

  if (window.innerWidth <= 768 && sidebar && !sidebar.classList.contains('sidebar-open')) {
    // モバイルでサイドバーが閉じていたら開く
    sidebar.classList.add('sidebar-open');
    if (overlay) overlay.classList.add('active');
    
    // 開くアニメーションを待ってからクローンを出す
    setTimeout(createHighlightClone, 400); 
  } else {
    // 既に開いている（PCなど）場合はすぐに処理
    setTimeout(createHighlightClone, 300);
  }

  function createHighlightClone() {
    // 現在の座標を取得
    const rect = originalToggle.getBoundingClientRect();
    
    // 背景を暗くする専用のオーバーレイを生成
    const dimOverlay = document.createElement('div');
    dimOverlay.className = 'clone-highlight-overlay';
    document.body.appendChild(dimOverlay);

    // 要素のクローン
    const clone = originalToggle.cloneNode(true);
    // 元のクラスは維持したまま、クローン専用のハイライトクラスを追加
    clone.classList.add('clone-highlight-target');
    
    // クローンのスタイルを絶対座標で配置
    clone.style.position = 'fixed';
    clone.style.top = rect.top + 'px';
    clone.style.left = rect.left + 'px';
    clone.style.width = rect.width + 'px';
    clone.style.height = rect.height + 'px';
    clone.style.margin = '0'; // 元のmarginが影響しないようリセット
    clone.style.pointerEvents = 'none'; // 操作阻害防止
    
    // ツールチップ部分を強制表示させる
    const cloneTooltip = clone.querySelector('.settings-tooltip');
    if (cloneTooltip) {
      cloneTooltip.classList.add('show');
    }

    document.body.appendChild(clone);

    // アニメーション表示（1フレームあけてtransitionを発火させる）
    requestAnimationFrame(() => {
      dimOverlay.classList.add('active');
    });

    // 5秒後に消す
    setTimeout(() => {
      dimOverlay.classList.remove('active');
      if (cloneTooltip) cloneTooltip.classList.remove('show');
      
      setTimeout(() => {
        clone.remove();
        dimOverlay.remove();
      }, 500); // 0.5s fade
    }, 5000);
  }
}

// 電話キーパッドボタンのイベント
const keypadBtns = document.querySelectorAll('.keypad-btn');
keypadBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    const key = e.target.dataset.key;
    
    if (key === '1') {
      localStorage.setItem('yomimono_terms_mode', 'ignore');
      if (settingTermsModeSelect) settingTermsModeSelect.value = 'ignore';
    } else if (key === '2') {
      localStorage.setItem('yomimono_terms_mode', 'expert');
      if (settingTermsModeSelect) settingTermsModeSelect.value = 'expert';
    } else if (key === '3') {
      localStorage.setItem('yomimono_terms_mode', 'simple');
      if (settingTermsModeSelect) settingTermsModeSelect.value = 'simple';
    } else {
      // 0, 4~9は何もしない
      return;
    }

    // 1, 2, 3のいずれかが押されたら初期設定完了とし、本文を再描画してツールチップを出す
    closeInitialModal();
    const target = new URLSearchParams(window.location.search).get('p') || localStorage.getItem('yomimono_last_page') || 'ep0000';
    loadMarkdown(target);
    showSettingsTooltip();
  });
});

// ==========================================
// 用語抽出・モーダル表示ロジック
// ==========================================

const termModal = document.getElementById('term-modal');
const termModalOverlay = document.getElementById('term-modal-overlay');
const termModalCloseBtn = document.getElementById('close-term-modal');
const termModalContentNovel = document.getElementById('term-modal-content-term');
const termModalContentIT = document.getElementById('term-modal-content-it');

function closeTermModal() {
  if (termModal) termModal.classList.remove('active');
  if (termModalOverlay) termModalOverlay.classList.remove('active');
}

if (termModalCloseBtn) termModalCloseBtn.addEventListener('click', closeTermModal);
if (termModalOverlay) termModalOverlay.addEventListener('click', closeTermModal);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && termModal && termModal.classList.contains('active')) {
    closeTermModal();
  }
});

/**
 * 生テキストから、各辞書の用語が含まれているか判定してリストを返す
 */
function extractTermsFromText(text, target) {
  const matchedIT = [];
  const matchedNovel = [];

  // IT用語の抽出
  for (const key in ItTermDictionary) {
    const item = ItTermDictionary[key];
    // "プロセス / バックグラウンド（通信）" のような表記を考慮し、/や（）で分割・クリーニング
    const searchWords = item.term.split(/[\/／（(]/).map(w => w.replace(/[）)]/g, '').trim()).filter(w => w.length > 0);
    
    // searchWords のいずれかがテキストに含まれていればヒット
    const isHit = searchWords.some(word => text.includes(word));
    if (isHit) {
      matchedIT.push(item);
    }
  }

  const episodeSequence = [
    'ep0000', 'ep0100', 'ep0200', 'ep0300', 'ep0400', 
    'ep0500', 'ep0600', 'ep0700', 'ep0800', 'ep0900'
  ];
  const epIndex = episodeSequence.indexOf(target);
  const ep5Index = episodeSequence.indexOf('ep0400'); // 旧ep0500（第5章: 第4話）
  const allowNovelTerms = (epIndex === -1 || epIndex >= ep5Index);

  // 小説用語の抽出（第5話以降のみ）
  if (allowNovelTerms) {
    for (const key in TermDictionary) {
      const item = TermDictionary[key];
      const searchWords = item.term.split(/[\/／（(]/).map(w => w.replace(/[）)]/g, '').trim()).filter(w => w.length > 0);
      const isHit = searchWords.some(word => text.includes(word));
      if (isHit) {
        matchedNovel.push(item);
      }
    }
  }

  return { matchedIT, matchedNovel };
}

/**
 * モーダルに内容を描画して開く
 */
function openTermModal(matchedIT, matchedNovel) {
  // 小説用語エリアの描画
  if (matchedNovel.length > 0) {
    let html = '<h3 class="term-category-title">世界観・システム用語</h3>';
    matchedNovel.forEach(item => {
      html += `
        <div class="term-item">
          <h4 class="term-item-title">${escapeHTML(item.term)}</h4>
          <span class="term-item-furigana">${escapeHTML(item.furigana)}</span>
          <p class="term-item-desc">${escapeHTML(item.description)}</p>
        </div>
      `;
    });
    termModalContentNovel.innerHTML = html;
    termModalContentNovel.style.display = 'block';
  } else {
    termModalContentNovel.innerHTML = '';
    termModalContentNovel.style.display = 'none';
  }

  // IT用語エリアの描画
  if (matchedIT.length > 0) {
    let html = '<h3 class="term-category-title">IT・開発専門用語</h3>';
    matchedIT.forEach(item => {
      html += `
        <div class="term-item">
          <h4 class="term-item-title">${escapeHTML(item.term)}</h4>
          <span class="term-item-furigana">${escapeHTML(item.furigana)}</span>
          <p class="term-item-desc">${escapeHTML(item.description)}</p>
        </div>
      `;
    });
    termModalContentIT.innerHTML = html;
    termModalContentIT.style.display = 'block';
  } else {
    termModalContentIT.innerHTML = '';
    termModalContentIT.style.display = 'none';
  }

  // モーダルを開く
  if (termModalOverlay) termModalOverlay.classList.add('active');
  if (termModal) termModal.classList.add('active');
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

init();
