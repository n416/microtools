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
    } else if (termsMode === 'ruby') {
      // ルビモード（初回登場時のみルビ表示、その他は通常表示＋注釈一覧あり）
      if (TermFirstAppearanceMap[id] === currentEpisode && !localSeen.has(id)) {
        localSeen.add(id);
        const mark = `※${footnoteCounter}`;
        footnotes.push(`${mark} ${termData.term}： ${termData.description}`);
        footnoteCounter++;
        return (termData.simple_term) ? `<ruby>${displayStr}<rt>${termData.simple_term}</rt></ruby>` : displayStr;
      } else {
        return displayStr;
      }
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

  // モードがエキスパートの場合のみフッターに一覧を追加
  if ((termsMode === 'expert') && footnotes.length > 0) {
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
    localStorage.removeItem('yomimono_settings_tooltip_shown_v2'); // ツールチップ表示フラグもリセット
    localStorage.removeItem('yomimono_typewriter_done'); // タイプライターフラグもリセット
    navigateTo('ep0000');
    checkInitialModal();
  });
}

// 古いフラグ形式からのマイグレーションも兼ねて設定を初期化
const btnOpenSettings = document.getElementById('btn-open-settings');
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

function updateSettingsButtonText(mode) {
  if (!btnOpenSettings) return;
  const labels = {
    'ignore': '用語解説を表示しない',
    'expert': '用語解説（注釈）を表示',
    'simple': 'IT用語を簡単な言葉に置換',
    'ruby': 'IT用語に簡単なルビを振る'
  };
  btnOpenSettings.textContent = labels[mode] || '設定を変更する';
}

if (btnOpenSettings) {
  updateSettingsButtonText(currentTermsMode);

  btnOpenSettings.addEventListener('click', () => {
    const initialModal = document.getElementById('initial-settings-modal');
    const initialOverlay = document.getElementById('initial-settings-overlay');
    if (initialModal && initialOverlay) {
      initialModal.classList.add('active');
      initialOverlay.classList.add('active');
    }
    
    // モバイルモードでサイドバーが開いていれば閉じる
    if (window.innerWidth <= 768) {
      closeSidebar();
    }
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

    // タイプライター演出（初回のみ）
    const typewriterDone = localStorage.getItem('yomimono_typewriter_done') === 'true';
    if (!typewriterDone) {
      const p = initialModal.querySelector('.modal-content p');
      if (p) {
        // 元のHTMLを保持
        const originalHTML = p.innerHTML;
        // 一旦空にする
        p.innerHTML = '';
        
        // 意図的な遅延を入れてからタイピング開始
        setTimeout(() => {
          let i = 0;
          let inTag = false;
          let tagBuffer = '';
          const maxLen = originalHTML.length;

          function type() {
            if (i >= maxLen) {
              localStorage.setItem('yomimono_typewriter_done', 'true');
              return;
            }

            const char = originalHTML[i];
            i++;

            if (char === '<') {
              inTag = true;
              tagBuffer = char;
              type(); // タグ内は即時処理
              return;
            }

            if (inTag) {
              tagBuffer += char;
              if (char === '>') {
                inTag = false;
                p.innerHTML += tagBuffer;
              }
              type(); // タグ内はウェイトなしで一気に処理
              return;
            }

            // 通常の文字の場合
            p.innerHTML += char;

            // ランダムな遅延でシステム感を出す（10ms〜40ms）
            setTimeout(type, Math.random() * 30 + 10);
          }

          type();
        }, 500); // モーダルが開いてから0.5秒後に開始
      }
    }
  }
}

function closeInitialModal() {
  localStorage.setItem('yomimono_initial_setup_done', 'true');
  const initialModal = document.getElementById('initial-settings-modal');
  const initialOverlay = document.getElementById('initial-settings-overlay');
  if (initialModal) initialModal.classList.remove('active');
  if (initialOverlay) initialOverlay.classList.remove('active');
}

// ユーザーが意図的に閉じた場合はそのまま閉じる（ただし設定は変更・初期化されない）
const closeInitialModalBtn = document.getElementById('close-initial-modal');
if (closeInitialModalBtn) {
  closeInitialModalBtn.addEventListener('click', closeInitialModal);
}
const initialSettingsOverlay = document.getElementById('initial-settings-overlay');
if (initialSettingsOverlay) {
  initialSettingsOverlay.addEventListener('click', closeInitialModal);
}

function showSettingsTooltip() {
  if (localStorage.getItem('yomimono_settings_tooltip_shown_v2') === 'true') {
    return;
  }
  
  const originalToggle = document.querySelector('.settings-toggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('mobile-overlay');

  if (!originalToggle) return;
  
  // フラグをセットして次回以降は出さないようにする
  localStorage.setItem('yomimono_settings_tooltip_shown_v2', 'true');

  if (window.innerWidth <= 768 && sidebar && !sidebar.classList.contains('sidebar-open')) {
    // モバイルでサイドバーが閉じていたら開く
    sidebar.classList.add('sidebar-open');
    if (overlay) overlay.classList.add('active');
    
    setTimeout(createHighlightClone, 400); 
  } else {
    setTimeout(createHighlightClone, 300);
  }

  function createHighlightClone() {
    const rect = originalToggle.getBoundingClientRect();
    
    const dimOverlay = document.createElement('div');
    dimOverlay.className = 'clone-highlight-overlay';
    // オーバーレイ自体にポインターイベントを有効にする（背景クリックで閉じられるようにする）
    dimOverlay.style.pointerEvents = 'auto';
    document.body.appendChild(dimOverlay);

    const clone = originalToggle.cloneNode(true);
    clone.classList.add('clone-highlight-target');
    
    clone.style.position = 'fixed';
    clone.style.top = rect.top + 'px';
    clone.style.left = rect.left + 'px';
    clone.style.width = rect.width + 'px';
    clone.style.height = rect.height + 'px';
    clone.style.margin = '0'; 
    // 操作阻害防止を解除して内部の閉じるボタンをクリック可能にする
    clone.style.pointerEvents = 'auto'; 
    
    const cloneTooltip = clone.querySelector('.settings-tooltip');
    
    let closeTimeout;

    // ハイライトを閉じる処理
    const closeHighlight = () => {
      clearTimeout(closeTimeout);
      dimOverlay.classList.remove('active');
      if (cloneTooltip) cloneTooltip.classList.remove('show');
      
      setTimeout(() => {
        clone.remove();
        dimOverlay.remove();
      }, 500);
    };

    if (cloneTooltip) {
      cloneTooltip.classList.add('show');
      
      // Xボタンを追加
      const closeBtn = document.createElement('button');
      closeBtn.innerHTML = '×';
      closeBtn.style.position = 'absolute';
      closeBtn.style.right = '4px';
      closeBtn.style.top = '2px';
      closeBtn.style.background = 'none';
      closeBtn.style.border = 'none';
      closeBtn.style.color = 'inherit';
      closeBtn.style.fontSize = '1.2rem';
      closeBtn.style.cursor = 'pointer';
      closeBtn.style.padding = '2px 6px';
      closeBtn.style.lineHeight = '1';
      closeBtn.style.pointerEvents = 'auto';
      
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // 伝播を防ぐ
        closeHighlight();
      });
      
      // ボタンが重ならないように余白を確保
      cloneTooltip.style.paddingRight = '30px';
      cloneTooltip.appendChild(closeBtn);
    }

    document.body.appendChild(clone);

    // 背景（dimOverlay）クリックでも閉じるようにする
    dimOverlay.addEventListener('click', closeHighlight);

    requestAnimationFrame(() => {
      dimOverlay.classList.add('active');
    });

    // 5秒経過で自動的にも閉じる
    closeTimeout = setTimeout(() => {
      closeHighlight();
    }, 5000);
  }
}

function showToast(message) {
  let toast = document.getElementById('setting-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'setting-toast';
    toast.className = 'toast-notification';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  
  if (toast.hideTimeout) clearTimeout(toast.hideTimeout);
  
  toast.hideTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// 電話キーパッドボタンのイベント
const keypadBtns = document.querySelectorAll('.keypad-btn');
keypadBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    const key = e.target.dataset.key;
    let newMode = null;
    let toastMessage = '';
    
    if (key === '1') {
      newMode = 'ignore';
      toastMessage = '隠蔽モードが選択されました！';
    } else if (key === '2') {
      newMode = 'expert';
      toastMessage = 'エキスパートモードが選択されました！';
    } else if (key === '3') {
      newMode = 'simple';
      toastMessage = '翻訳モードが選択されました！';
    } else if (key === '4') {
      newMode = 'ruby';
      toastMessage = 'ルビモードが選択されました！';
    } else {
      const messages = [
        // 小林 (10)
        "小林「すみませーん！その機能、まだ実装されてませーん…！」",
        "小林「あ、そこ押しても何も起きない仕様です！」",
        "小林「デバッグ中なんで触らないでもらえますか！？」",
        "小林「（……やばい、未実装メソッド呼ばれた）」",
        "小林「えっと、その機能のリリースは来期以降の予定です」",
        "小林「待って、そこにボタンがあるの仕様書に書いてないんだけど」",
        "小林「現在エラーログを吐き続けているので押さないでください…」",
        "小林「あーっ！そこはダミーのUIです！」",
        "小林「実装漏れじゃないです、仕様です。たぶん」",
        "小林「（誰だ今の機能のモック置いたの……俺か）」",
        
        // 土屋 (10)
        "土屋「小林、そのボタンは追加要件だ。見積もり出しとけ」",
        "土屋「意味のない操作に会社の稼働を使うな」",
        "土屋「そこはまだ予算が確保できてないんだ。押すなよ」",
        "土屋「未実装機能のテストなら、自分のローカル環境でやってくれ」",
        "土屋「そんなボタンを押す暇があるなら仕様書を読め」",
        "土屋「おい小林、この無効ボタンはいつリリース予定だ？」",
        "土屋「そこを実装しても利益にならないから後回しだ」",
        "土屋「押しても無駄だぞ。物理的に配線が繋がってない」",
        "土屋「なるほど、ユーザーはこういう想定外の操作をするのか……」",
        "土屋「（また小林が変な機能を仕込んだか……？）」",

        // 天宮 (10)
        "天宮「……仕様書にないシステムコールはやめていただけますか」",
        "天宮「その機能はフェーズ２での対応予定です」",
        "天宮「無効な操作です。マニュアルを読み直してください」",
        "天宮「（……本当にこの人たちに任せて大丈夫かしら）」",
        "天宮「不具合ですか？いえ、未実装の機能ですね」",
        "天宮「お客様からの要件には含まれていないボタンです」",
        "天宮「その遷移先は定義されていませんよ」",
        "天宮「……小林さん、このボタン何のためにあるんですか？」",
        "天宮「意味不明な操作ログが残るのでご遠慮ください」",
        "天宮「ここはエラーハンドリングが必要ですね。起票しておきます」",

        // 相馬 (10)
        "相馬「んー、そこは権限足りてないねえ。どんまい」",
        "相馬「あー、そこは俺もまだソース組んでないんだわ」",
        "相馬「はいはい、未実装未実装。次いこう次」",
        "相馬「そこ押してもコーヒーは出てこないよー」",
        "相馬「おっ、そこ見つけちゃった？まだ空っぽだけどね」",
        "相馬「一応ボタンの形はしてるけど、中身はVoidだよ」",
        "相馬「まあ、気長に待っててよ。いつか動くかもね」",
        "相馬「（……小林の奴、またTODOコメント放置してるな）」",
        "相馬「その機能は俺の裁量じゃないから、社長に聞いてよ」",
        "相馬「エラーは出てないでしょ？なら仕様ってことで」",

        // 結衣 (10)
        "結衣「お客さま〜、そちらのコマンドは現在品切れ中でして……」",
        "結衣「あ、そこはスタッフ専用の画面なので入れません！」",
        "結衣「ごめんなさい、その機能は準備中なんです」",
        "結衣「えっと、押しても何も出ないボタン、ですか？」",
        "結衣「それ、店長がまだ設定してないやつかもしれません」",
        "結衣「……（不思議そうに首を傾げている）」",
        "結衣「小林さーん！エラーが出たって言われてますけどー！」",
        "結衣「その操作、メニューには載ってない隠しコマンドですか？」",
        "結衣「押しても何も起きないボタン……なんだか哲学的ですね」",
        "結衣「申し訳ありません、担当のプログラマーが現在不在で……」",

        // テツ (10)
        "テツ「おっと、そこから先は『裏』の領域だぜ」",
        "テツ「そんなもん押しても、ただのノイズだ」",
        "テツ「あんま深入りすんな。そこは空っぽだ」",
        "テツ「（……素人が無闇に触るもんじゃねえな）」",
        "テツ「悪いが、そのシステムはすでに死んでる」",
        "テツ「そこを掘っても、過去の残骸しか出てこないぜ」",
        "テツ「ほう？お前、そこが見えるのか」",
        "テツ「そこのアクセスルートはとうの昔に潰したはずだが……」",
        "テツ「大人しく表の世界の機能だけ使っとけ」",
        "テツ「……深淵を覗くってのは、こういうことかもな」",

        // 黒須 (10)
        "黒須「404 Not Found……ふふっ、滑稽ですね」",
        "黒須「無意味な操作だ。時間を無駄にしている自覚はありますか？」",
        "黒須「（……監視システムのログには残しておきましょう）」",
        "黒須「そんな操作、仕様の抜け穴とでも言いたいんですか」",
        "黒須「そこは私の管轄外です。……いえ、だからこそ面白い」",
        "黒須「エラーを意図的に引き起こすつもりですか？」",
        "黒須「そんな無駄な行動ログ、分析する価値もありません」",
        "黒須「……ほう、そこを突いてきますか」",
        "黒須「そのボタンの裏には、何もありませんよ。ご安心を」",
        "黒須「未実装の機能を叩く……なるほど、ストレステストの一環ですか」",

        // 佐々木 (10)
        "佐々木「もね先輩！誰かが変なボタン連打してます！」",
        "佐々木「えっ！？なんですかその機能、私聞いてないです！」",
        "佐々木「あわわ……そこ押したらシステム壊れたりしませんよね！？」",
        "佐々木「（……また小林さんがバグ残したのかな）」",
        "佐々木「す、すみません！そこはまだ開発中でして！」",
        "佐々木「ひぇっ！？今の操作でエラー出ませんでしたか！？」",
        "佐々木「あの、そこは押しても何も起こらないダミーなんです……」",
        "佐々木「ちょっと！勝手に未定義の操作しないでください！」",
        "佐々木「ええっと、マニュアルには……載ってないですね、このボタン」",
        "佐々木「私に聞かれても困りますぅ！開発に聞いてください！」"
      ];
      const randomMsg = messages[Math.floor(Math.random() * messages.length)];
      
      const notImplOverlay = document.getElementById('not-implemented-overlay');
      const notImplModal = document.getElementById('not-implemented-modal');
      
      if (notImplOverlay && notImplModal) {
        const p = notImplModal.querySelector('p');
        if (p) p.textContent = randomMsg;
        
        notImplOverlay.classList.add('active');
        notImplModal.classList.add('active');
        
        const closeNotImpl = () => {
          notImplOverlay.classList.remove('active');
          notImplModal.classList.remove('active');
        };
        
        notImplOverlay.onclick = closeNotImpl;
        
        // 自動で消えるタイマーを削除し、スクリーンショットが撮りやすいようにユーザーのアクションでのみ閉じるように変更
        if (notImplModal.hideTimeout) clearTimeout(notImplModal.hideTimeout);
      }
      return;
    }

    localStorage.setItem('yomimono_terms_mode', newMode);
    currentTermsMode = newMode; // 状態更新
    
    if (typeof updateSettingsButtonText === 'function') {
      updateSettingsButtonText(newMode);
    }

    const isFirstTime = localStorage.getItem('yomimono_settings_tooltip_shown_v2') !== 'true';

    // 1, 2, 3, 4のいずれかが押されたら初期設定完了とし、本文を再描画してツールチップを出す
    closeInitialModal();
    const target = new URLSearchParams(window.location.search).get('p') || localStorage.getItem('yomimono_last_page') || 'ep0000';
    loadMarkdown(target);

    if (isFirstTime) {
      showSettingsTooltip();
    } else {
      showToast(toastMessage);
    }
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
