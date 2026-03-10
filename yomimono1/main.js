import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { CharacterNames } from './src/character_dictionary.js';
import { ItTermDictionary } from './src/it_term_dictionary.js';
import { TermDictionary } from './src/term_dictionary.js';
import { TermFirstAppearanceMap } from './src/term_map.js';
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

  let newText = text.replace(/<Term\s+id="([^"]+)"(?:\s*>([\s\S]*?)<\/Term>|\s*\/>)/g, (match, id, innerText) => {
    const termData = combinedDictionary[id];
    if (!termData) return `[Unknown Term: ${id}]`;

    const displayStr = (innerText && innerText.trim().length > 0) ? innerText : termData.term;

    if (TermFirstAppearanceMap[id] === currentEpisode && !localSeen.has(id)) {
      localSeen.add(id);
      const mark = `※${footnoteCounter}`;
      footnotes.push(`${mark} ${termData.term}： ${termData.description}`);
      footnoteCounter++;
      return `${displayStr}（${mark}）`;
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

let currentPhase = 1;

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

function navigateTo(target, phase, push = true) {
  currentPhase = phase;

  if (push) {
    const url = new URL(window.location);
    url.searchParams.set('p', target);
    url.searchParams.set('ph', phase);
    window.history.pushState({ p: target, ph: phase }, '', url);
  }

  localStorage.setItem('yomimono_last_page', target);
  localStorage.setItem('yomimono_phase', phase);

  restoreState(target, phase);
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
    const html = marked(fullyResolved);
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
    if (currentIndex > 0 && target !== 'ep1' && target !== 'ep4') {
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
          navigateTo(targetToLoad, currentPhase);
        });
      }
    }
    // ---------------------------------

    // 次へボタン（通常遷移）のイベントリスナーを登録
    const normalNextBtns = document.querySelectorAll('.btn-normal-next');
    normalNextBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const nextTarget = e.target.dataset.next;
        let nextPhase = currentPhase;
        if (nextTarget === 'ep4' && currentPhase < 2) nextPhase = 2;
        if (nextTarget === 'ep7' && currentPhase < 3) nextPhase = 3;
        navigateTo(nextTarget, nextPhase);
      });
    });

    // 次へボタン（グリッチ・反転用）のイベントリスナーを登録
    const glitchBtn = document.getElementById('btn-glitch-next');
    if (glitchBtn) {
      glitchBtn.addEventListener('click', triggerGlitch);
    }

    // 第1章完結ボタンのイベントリスナーを登録
    const chapterEndBtn = document.getElementById('btn-chapter-end');
    if (chapterEndBtn) {
      chapterEndBtn.addEventListener('click', triggerChapterEnd);
    }
  } catch (error) {
    markdownContainer.innerHTML = `<p class="error">コンテンツの読み込みに失敗しました。Error: ${error.message}</p>`;
  }
}

function triggerChapterEnd() {
  let overlay = document.getElementById('chapter-end-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'chapter-end-overlay';
    overlay.innerHTML = '<div class="text-glitch">第1部 完</div>';
    document.body.appendChild(overlay);
  }

  // 少し遅れて表示アニメーションを開始
  setTimeout(() => {
    overlay.classList.add('visible');
  }, 100);

  // 3.5秒後にフェードアウトし、第7話へ遷移・全メニュー表示
  setTimeout(() => {
    overlay.classList.remove('visible');
    navigateTo('ep7', 3);
  }, 3500);
}

function triggerGlitch() {
  // ハッキングトランジション開始
  document.body.classList.add('glitching');

  // アニメーションが一番深く沈み込むタイミング（約1.2秒後）でテーマとコンテンツを反転
  setTimeout(() => {
    navigateTo('ep4', 2);
  }, 1200); // 1.2秒後（アニメのくぼみ）で反転

  // 完全にアニメーションが終わる2秒後にクラスをリセット
  setTimeout(() => {
    document.body.classList.remove('glitching');
  }, 2200);
}

function bindNavEvents() {
  const currentNavLinks = document.querySelectorAll('a[data-target]');
  currentNavLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = e.target.dataset.target;
      navigateTo(target, currentPhase);
    });
  });
}

// --- ページ状態復元機能 ---
function restoreState(target, phase) {
  const navContainer = document.getElementById('nav-container');

  if (phase === 3) {
    // 第2部（フェーズ3）のメニュー構成とテーマ設定
    document.body.classList.remove('fake-mode');
    document.body.classList.add('true-mode');
    siteTitle.textContent = '[BUG_REPORT]';
    siteSubtitle.innerHTML = '仕様書にないバグですが、<br>たぶん俺のことです';
    navContainer.innerHTML = `
      <details class="nav-group">
        <summary>設定資料</summary>
        <ul>
          <li><a href="#" data-target="true_character">キャラクター（本編）</a></li>
          <li><a href="#" data-target="world">世界観・ルール</a></li>
        </ul>
      </details>
      <details class="nav-group">
        <summary>第1部（第1話〜第6話）</summary>
        <ul>
          <li><a href="#" data-target="ep1">第1話：システム障害の現状と課題</a></li>
          <li><a href="#" data-target="ep2">第2話：人的リソースの枯渇と影響</a></li>
          <li><a href="#" data-target="ep3">第3話：クリティカルエラー発生報告</a></li>
          <li><a href="#" data-target="ep4">第4話：偶然のハックとメトロノーム</a></li>
          <li><a href="#" data-target="ep5">第5話：浸食の予兆</a></li>
          <li><a href="#" data-target="ep6">第6話：ロスト・シーケンス</a></li>
        </ul>
      </details>
      <details class="nav-group" open>
        <summary>第2部（第7話〜）</summary>
        <ul>
          <li><a href="#" data-target="ep7">第7話：システムからの招待状</a></li>
          <li><a href="#" data-target="ep8">第8話（第2章）：六本木の休日</a></li>
          <li><a href="#" data-target="ep8_5">第8.5話：幕間・裏路地のオアシス</a></li>
          <li><a href="#" data-target="ep9">第9話：デスマーチの足音と限界</a></li>
          <li><a href="#" data-target="ep10_1">第10.1話：ファミレスと「電子ドラッグ」の真実</a></li>
          <li><a href="#" data-target="ep10_2">第10.2話：職人のプライドとポンコツ・ガジェット</a></li>
          <li><a href="#" data-target="ep10_3">第10.3話：赤い日の真実と、反逆の兆し</a></li>
          <li><a href="#" data-target="ep11">第11話：納品へのカウントダウン</a></li>
          <li><a href="#" data-target="ep12_0">第12話：面白星人</a></li>
          <li><a href="#" data-target="ep12_1">第12.1話：赤い日</a></li>
          <li><a href="#" data-target="ep12_2">第12.2話：ノイズとアンカー</a></li>
          <li><a href="#" data-target="ep13_0">第13話：赤い日の真実と罠</a></li>
          <li><a href="#" data-target="ep13_1">第13.1話：完璧すぎる視界</a></li>
          <li><a href="#" data-target="ep13_2">第13.2話：見えないものを直す手</a></li>
          <li><a href="#" data-target="ep13_3">第13.3話：優しさと最適化の矛盾</a></li>
          <li><a href="#" data-target="ep13_4">第13.4話：黒須の監視と、ノイズの体温</a></li>
          <li><a href="#" data-target="ep13_5">第13.5話：隔絶される世界線</a></li>
          <li><a href="#" data-target="ep13_6">第13.6話：アンカーの決断</a></li>
          <li><a href="#" data-target="ep13_7">第13.7話：休日のバグとコーヒーブレイク</a></li>
          <li><a href="#" data-target="ep14">第14話：雪の日の決断とフェーズアウト</a></li>
          <li><a href="#" data-target="ep14_1">第14.1話：雪の日の翌朝 - 喪失の輪郭</a></li>
          <li><a href="#" data-target="ep14_2">第14.2話：落下するノイズへの追跡劇 - 虚無のカーチェイス</a></li>
          <li><a href="#" data-target="ep15">第15話：鬼之河アンダーグラウンド</a></li>
          <li><a href="#" data-target="ep15_5">第15.5話：泥水と蒸気タービン - あるプログラマの覚醒</a></li>
          <li><a href="#" data-target="ep16_0">第16話：再会と覚醒のアプリ</a></li>
          <li><a href="#" data-target="ep16_0_5">第16.0.5話：幕間・黄色いトラックの少女</a></li>
          <li><a href="#" data-target="ep16_0_6">第16.0.6話：幕間・休日のカフェ</a></li>
          <li><a href="#" data-target="ep16_1">第16話：再会と覚醒のアプリ（続き）</a></li>
          <li><a href="#" data-target="ep17">第17話：記憶の抵抗</a></li>
          <li><a href="#" data-target="ep17_5">第17.5話：インカムのノイズ</a></li>
          <li><a href="#" data-target="ep18">第18話：ふたつの和音（コード）</a></li>
          <li><a href="#" data-target="ep19_1">第19話：反逆のカウンター・ノイズ I - 崩壊の足音</a></li>
          <li><a href="#" data-target="ep19_2">第19話：反逆のカウンター・ノイズ II - 重なり合う波長</a></li>
          <li><a href="#" data-target="ep19_3">第19話：反逆のカウンター・ノイズ III - 泥臭い一撃</a></li>
          <li><a href="#" data-target="ep19_4">第19話：反逆のカウンター・ノイズ IV - 完璧なる自滅</a></li>
          <li><a href="#" data-target="ep20">第20話：新しい世界の仕様書</a></li>
          <li><a href="#" data-target="ep21">第21話・最終話：終わらない運用保守（メンテナンス）</a></li>
          <li><a href="#" data-target="ep22">第22話 断章：侵食</a></li>
        </ul>
      </details>
    `;
  } else if (phase === 2) {
    // 1部完了前のOverRide（フェーズ2）のメニュー構成
    document.body.classList.remove('fake-mode');
    document.body.classList.add('true-mode');
    siteTitle.textContent = '[BUG_REPORT]';
    siteSubtitle.innerHTML = '仕様書にないバグですが、<br>たぶん俺のことです';
    navContainer.innerHTML = `
      <details class="nav-group">
        <summary>設定資料</summary>
        <ul>
          <li><a href="#" data-target="true_character">キャラクター（本編）</a></li>
          <li><a href="#" data-target="world">世界観・ルール</a></li>
        </ul>
      </details>
      <details class="nav-group" open>
        <summary>第1部（〜第6話）</summary>
        <ul>
          <li><a href="#" data-target="ep4">第4話：偶然のハックとメトロノーム</a></li>
          <li><a href="#" data-target="ep5">第5話：浸食の予兆</a></li>
          <li><a href="#" data-target="ep6">第6話：ロスト・シーケンス</a></li>
        </ul>
      </details>
    `;
  } else {
    // 初期のフェイクモード（フェーズ1）
    document.body.classList.remove('true-mode');
    document.body.classList.add('fake-mode');
    siteTitle.textContent = '業務マニュアル';
    siteSubtitle.innerHTML = '社内業務引き継ぎ資料<br>作成者：小林悠太';
    navContainer.innerHTML = `
      <details class="nav-group item-list" open>
        <summary>マニュアル項目</summary>
        <ul>
          <li><a href="#" data-target="character">登場人物</a></li>
          <li><a href="#" data-target="ep1">第1話：システム障害の現状と課題</a></li>
          <li><a href="#" data-target="ep2">第2話：人的リソースの枯渇と影響</a></li>
          <li><a href="#" data-target="ep3">第3話：クリティカルエラー発生報告</a></li>
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
    navigateTo(e.state.p, e.state.ph, false);
  } else {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('p') || localStorage.getItem('yomimono_last_page') || 'character';
    const ph = parseInt(params.get('ph'), 10) || parseInt(localStorage.getItem('yomimono_phase'), 10) || 1;
    navigateTo(p, ph, false);
  }
});

// リセットボタン（初めから読み直す）のイベント登録
const btnResetState = document.getElementById('btn-reset-state');
if (btnResetState) {
  btnResetState.addEventListener('click', () => {
    localStorage.removeItem('yomimono_last_page');
    localStorage.removeItem('yomimono_phase');
    const url = new URL(window.location);
    url.searchParams.delete('p');
    url.searchParams.delete('ph');
    window.location.href = url.pathname;
  });
}

// 初期化処理
function init() {
  const urlParams = new URLSearchParams(window.location.search);
  const urlTarget = urlParams.get('p');
  const urlPhase = parseInt(urlParams.get('ph'), 10);

  const lastPage = urlTarget || localStorage.getItem('yomimono_last_page') || 'character';
  let initialPhase = urlPhase || parseInt(localStorage.getItem('yomimono_phase'), 10);

  if (!initialPhase) {
    // 既存ユーザー向けのマイグレーションフォールバック
    const trueModeTargets = ['ep4', 'ep5', 'ep6', 'true_character', 'world', 'lore_kurosu_hidden'];
    const part2Targets = [
      'ep7', 'ep8', 'ep8_5', 'ep9', 'ep10_1', 'ep10_2', 'ep10_3', 'ep11', 'ep12_0', 'ep12_1', 'ep12_2', 'ep13_0',
      'ep13_1', 'ep13_2', 'ep13_3', 'ep13_4', 'ep13_5', 'ep13_6', 'ep13_7',
      'ep14', 'ep14_1', 'ep14_2', 'ep15', 'ep15_5', 'ep16_0', 'ep16_0_5', 'ep16_0_6', 'ep16_1', 'ep17', 'ep17_5', 'ep18', 'ep19_1', 'ep19_2', 'ep19_3', 'ep19_4', 'ep20', 'ep21', 'ep22',
      'lore_kurosu_hidden', 'lore_lin_hidden'
    ];
    if (part2Targets.includes(lastPage)) {
      initialPhase = 3;
    } else if (trueModeTargets.includes(lastPage)) {
      initialPhase = 2;
    } else {
      initialPhase = 1;
    }
  }

  // URLにパラメーターがない場合は localStorage の値を付与して replaceState
  if (!urlTarget || !urlPhase) {
    const url = new URL(window.location);
    url.searchParams.set('p', lastPage);
    url.searchParams.set('ph', initialPhase);
    window.history.replaceState({ p: lastPage, ph: initialPhase }, '', url);
  } else if (!window.history.state) {
    // パラメーターはあるが history.state が空の場合（直リンク等）
    window.history.replaceState({ p: lastPage, ph: initialPhase }, '', window.location.href);
  }

  // currentPhase を初期化
  currentPhase = initialPhase;

  restoreState(lastPage, currentPhase);
  loadMarkdown(lastPage);
}

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
    'ep1', 'ep2', 'ep3', 'ep4', 'ep5', 'ep6', 'ep7', 'ep8', 'ep8_5', 'ep9',
    'ep10_1', 'ep10_2', 'ep10_3', 'ep11', 'ep12_0', 'ep12_1', 'ep12_2',
    'ep13_0', 'ep13_1', 'ep13_2', 'ep13_3', 'ep13_4', 'ep13_5', 'ep13_6', 'ep13_7',
    'ep14', 'ep14_1', 'ep14_2', 'ep15', 'ep15_5', 'ep16_0', 'ep16_0_5', 'lore_lin_hidden', 'ep16_0_6', 'ep16_1', 'ep17', 'ep17_5', 'lore_kurosu_hidden', 'ep18', 'ep19_1', 'ep19_2', 'ep19_3', 'ep19_4', 'ep20', 'ep21', 'ep22'
  ];
  const epIndex = episodeSequence.indexOf(target);
  const ep11Index = episodeSequence.indexOf('ep11');
  const allowNovelTerms = (epIndex === -1 || epIndex >= ep11Index);

  // 小説用語の抽出（第11話以降のみ）
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
