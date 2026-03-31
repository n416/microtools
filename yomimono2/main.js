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
  const localSeen = new Set();
  const footnotes = [];
  let footnoteCounter = 1;

  let newText = text.replace(/<Term\s+id="([^"]+)"(?:\s*>([\s\S]*?)<\/Term>|\s*\/>)/g, (match, id, innerText) => {
    const termData = combinedDictionary[id];
    if (!termData) return `[Unknown Term: ${id}]`;

    const displayStr = (innerText && innerText.trim().length > 0) ? innerText : termData.term;

    if (TermFirstAppearanceMap[id] === currentEpisode && !localSeen.has(id)) {
      localSeen.add(id);
      const mark = `※${footnoteCounter}`;
      footnotes.push(`${mark} ${termData.term}： ${termData.description}`);
      footnoteCounter++;
      return `${displayStr}<span class="term-mark">（${mark}）</span>`;
    } else {
      return displayStr;
    }
  });

  if (footnotes.length > 0) {
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
    const html = marked.parse(formatted, { breaks: true });
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



    // --- 前に戻る・次に進むボタンの動的生成 ---
    // targetが設定資料等でなく、短編(ep0000)でもない場合のみナビゲーションを繋ぐ
    if (target !== 'plot' && target !== 'character' && target !== 'world' && target !== 'true_character' && target !== 'lifespan_economy' && target !== 'ep0000') {
      let nextActionContainer = markdownContainer.querySelector('.next-action');
      if (!nextActionContainer) {
        nextActionContainer = document.createElement('div');
        nextActionContainer.className = 'next-action';
        markdownContainer.appendChild(nextActionContainer);
      }

      const mainStoryItems = SidebarNavItems.filter(item => item.target !== 'ep0000');
      const currentIndex = mainStoryItems.findIndex(item => item.target === target);

      if (currentIndex !== -1) {
        // 前へボタン
        if (currentIndex > 0) {
          const prevTarget = mainStoryItems[currentIndex - 1].target;
          const prevBtn = document.createElement('button');
          prevBtn.className = 'btn-normal-prev';
          prevBtn.dataset.prev = prevTarget;
          prevBtn.textContent = '前の話に戻る';
          nextActionContainer.prepend(prevBtn);
          
          prevBtn.addEventListener('click', (e) => {
            navigateTo(e.target.dataset.prev);
          });
        }
        // 次へボタン (MDX内に既存の次へボタンが無い場合のみ追加する)
        if (currentIndex < mainStoryItems.length - 1 && !nextActionContainer.querySelector('.btn-normal-next, .btn-glitch-next')) {
          const nextTarget = mainStoryItems[currentIndex + 1].target;
          const nextBtn = document.createElement('button');
          nextBtn.className = 'btn-normal-next';
          nextBtn.dataset.next = nextTarget;
          nextBtn.textContent = '次の話へ進む';
          nextActionContainer.appendChild(nextBtn);
        }
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

  document.body.classList.remove('fake-mode');
  document.body.classList.add('true-mode');
  siteTitle.textContent = '灰の少年と、三百年の魔女';
  siteSubtitle.innerHTML = '';

  // サイドバーメニュー構成
  const shortNavLinks = SidebarNavItems.filter(item => item.target === 'ep0000').map(item => 
    `<li><a href="#" data-target="${item.target}">${item.title}</a></li>`
  ).join('\n          ');

  const mainNavLinks = SidebarNavItems.filter(item => item.target !== 'ep0000').map(item => 
    `<li><a href="#" data-target="${item.target}">${item.title}</a></li>`
  ).join('\n          ');

  navContainer.innerHTML = `
      <details class="nav-group">
        <summary>設定資料</summary>
        <ul id="nav-links">
          <li><a href="#" data-target="plot">プロット</a></li>
          <li><a href="#" data-target="character">登場人物</a></li>
          <li><a href="#" data-target="world">世界観設定</a></li>
          <li><a href="#" data-target="lifespan_economy">寿命経済（命価効率）</a></li>
        </ul>
      </details>
      <details class="nav-group" ${target === 'ep0000' ? 'open' : ''}>
        <summary>短編</summary>
        <ul>
          ${shortNavLinks}
        </ul>
      </details>
      <details class="nav-group" ${(target !== 'ep0000' && target !== 'plot' && target !== 'character' && target !== 'world' && target !== 'true_character' && target !== 'lifespan_economy') ? 'open' : ''}>
        <summary>本編</summary>
        <ul>
          ${mainNavLinks}
        </ul>
      </details>
  `;

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
    localStorage.removeItem('yomimono_unlocked');
    navigateTo('ep0000');
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
}



init();
