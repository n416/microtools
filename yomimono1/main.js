import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { CharacterNames } from './src/character_dictionary.js';

function resolveCharacters(text) {
  return text.replace(/<Char\s+role="([^"]+)"(?:\s+callrole="([^"]+)")?\s+var="([^"]+)"\s*\/>/g, (match, role, callrole, variant) => {
    const charData = CharacterNames[role];
    if (!charData) return `[Unknown Char: ${role}]`;

    if (variant === 'hiragana' || variant === 'age') {
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

const markdownContainer = document.getElementById('markdown-container');
const navLinks = document.querySelectorAll('#nav-links a');

const siteTitle = document.getElementById('site-title');
const siteSubtitle = document.getElementById('site-subtitle');

const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileOverlay = document.getElementById('mobile-overlay');
const sidebar = document.getElementById('sidebar');

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

async function loadMarkdown(target) {
  try {
    // 現在のページをLocalStorageに保存
    localStorage.setItem('yomimono_last_page', target);

    const response = await fetch(`./settings/${target}.mdx`);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const markdownText = await response.text();
    const resolvedText = resolveCharacters(markdownText);
    const html = marked(resolvedText);
    const cleanHtml = DOMPurify.sanitize(html);
    markdownContainer.innerHTML = cleanHtml;

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
          const prevLink = document.querySelector(`a[data-target="${targetToLoad}"]`);

          if (prevLink) {
            // サイドバー等の状態も同期するため、リンククリックを模倣
            prevLink.click();
            document.getElementById('content-area').scrollTop = 0;
          }
        });
      }
    }
    // ---------------------------------

    // 次へボタン（通常遷移）のイベントリスナーを登録
    const normalNextBtns = document.querySelectorAll('.btn-normal-next');
    normalNextBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const nextTarget = e.target.dataset.next;

        // メニューの動的書き換え（特定エピソードへの遷移時）
        if (nextTarget === 'ep4') {
          // トゥルーモードへ切り替え
          document.body.classList.remove('fake-mode');
          document.body.classList.add('true-mode');
          siteTitle.textContent = '[BUG_REPORT]';
          siteSubtitle.innerHTML = '仕様書にないバグですが、<br>たぶん俺のことです';

          const navContainer = document.getElementById('nav-container');
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
                <li><a href="#" data-target="ep4">第4話：観測者とメトロノーム</a></li>
                <li><a href="#" data-target="ep5">第5話：浸食の予兆</a></li>
                <li><a href="#" data-target="ep6">第6話：ロスト・シーケンス</a></li>
              </ul>
            </details>
          `;
          bindNavEvents();
        } else if (nextTarget === 'ep7') {
          // 第2章突入時の全メニュー表示
          const navContainer = document.getElementById('nav-container');
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
                <li><a href="#" data-target="ep4">第4話：観測者とメトロノーム</a></li>
                <li><a href="#" data-target="ep5">第5話：浸食の予兆</a></li>
                <li><a href="#" data-target="ep6">第6話：ロスト・シーケンス</a></li>
              </ul>
            </details>
            <details class="nav-group" open>
              <summary>第2部（第7話〜）</summary>
              <ul>
                <li><a href="#" data-target="ep7">第7話：システムからの招待状</a></li>
                <li><a href="#" data-target="ep8">第8話：六本木の休日</a></li>
                <li><a href="#" data-target="ep9">第9話：デスマーチの足音と限界</a></li>
                <li><a href="#" data-target="ep10">第10話：裏側からの接触</a></li>
                <li><a href="#" data-target="ep11">第11話：納品へのカウントダウン</a></li>
                <li><a href="#" data-target="ep12">第12話：デートとスマートウォッチ</a></li>
                <li><a href="#" data-target="ep13">第13話：赤い日の真実と罠</a></li>
                <li><a href="#" data-target="ep14">第14話：一年後の決断とフェーズアウト</a></li>
                <li><a href="#" data-target="ep15">第15話：鬼之河アンダーグラウンド</a></li>
                <li><a href="#" data-target="ep16">第16話：再会と覚醒のアプリ</a></li>
                <li><a href="#" data-target="ep17">第17話：記憶の抵抗</a></li>
                <li><a href="#" data-target="ep18">第18話：ふたつの和音（コード）</a></li>
                <li><a href="#" data-target="ep19">第19話：反逆のシステム・デプロイ</a></li>
                <li><a href="#" data-target="ep20">第20話：新しい世界の仕様書</a></li>
                <li><a href="#" data-target="ep21">最終話：日常のアップデート</a></li>
              </ul>
            </details>
          `;
          bindNavEvents();
        }

        loadMarkdown(nextTarget);

        // サイドバーのアクティブ状態も切り替え
        const currentNavLinks = document.querySelectorAll('a[data-target]');
        currentNavLinks.forEach(nav => nav.classList.remove('active'));
        const nextLink = document.querySelector(`a[data-target="${nextTarget}"]`);
        if (nextLink) nextLink.classList.add('active');

        // ページ上部へスクロール
        document.getElementById('content-area').scrollTop = 0;
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
    overlay.innerHTML = '<div class="text-glitch">第1章 完</div>';
    document.body.appendChild(overlay);
  }

  // 少し遅れて表示アニメーションを開始
  setTimeout(() => {
    overlay.classList.add('visible');
  }, 100);

  // 3.5秒後にフェードアウトし、第7話へ遷移・全メニュー表示
  setTimeout(() => {
    overlay.classList.remove('visible');

    // 第2章突入時の全メニュー表示
    const navContainer = document.getElementById('nav-container');
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
          <li><a href="#" data-target="ep4">第4話：観測者とメトロノーム</a></li>
          <li><a href="#" data-target="ep5">第5話：浸食の予兆</a></li>
          <li><a href="#" data-target="ep6">第6話：ロスト・シーケンス</a></li>
        </ul>
      </details>
      <details class="nav-group" open>
        <summary>第2部（第7話〜）</summary>
        <ul>
          <li><a href="#" data-target="ep7">第7話：システムからの招待状</a></li>
          <li><a href="#" data-target="ep8">第8話：六本木の休日</a></li>
          <li><a href="#" data-target="ep9">第9話：デスマーチの足音と限界</a></li>
          <li><a href="#" data-target="ep10">第10話：裏側からの接触</a></li>
          <li><a href="#" data-target="ep11">第11話：納品へのカウントダウン</a></li>
          <li><a href="#" data-target="ep12">第12話：デートとスマートウォッチ</a></li>
          <li><a href="#" data-target="ep13">第13話：赤い日の真実と罠</a></li>
          <li><a href="#" data-target="ep14">第14話：一年後の決断とフェーズアウト</a></li>
          <li><a href="#" data-target="ep15">第15話：鬼之河アンダーグラウンド</a></li>
          <li><a href="#" data-target="ep16">第16話：再会と覚醒のアプリ</a></li>
          <li><a href="#" data-target="ep17">第17話：記憶の抵抗</a></li>
          <li><a href="#" data-target="ep18">第18話：ふたつの和音（コード）</a></li>
          <li><a href="#" data-target="ep19">第19話：反逆のシステム・デプロイ</a></li>
          <li><a href="#" data-target="ep20">第20話：新しい世界の仕様書</a></li>
          <li><a href="#" data-target="ep21">最終話：日常のアップデート</a></li>
        </ul>
      </details>
    `;
    bindNavEvents();

    // 第7話を読み込み
    loadMarkdown('ep7');
    document.querySelector('a[data-target="ep7"]').classList.add('active');
  }, 3500);
}

function triggerGlitch() {
  // ハッキングトランジション開始
  document.body.classList.add('glitching');

  // アニメーションが一番深く沈み込むタイミング（約1.2秒後）でテーマとコンテンツを反転
  setTimeout(() => {
    document.body.classList.remove('fake-mode');
    document.body.classList.add('true-mode');

    // タイトルとメニューを書き換え
    siteTitle.textContent = '[BUG_REPORT]';
    siteSubtitle.innerHTML = '仕様書にないバグですが、<br>たぶん俺のことです';

    const navContainer = document.getElementById('nav-container');
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
          <li><a href="#" data-target="ep4">第4話：観測者とメトロノーム</a></li>
          <li><a href="#" data-target="ep5">第5話：浸食の予兆</a></li>
          <li><a href="#" data-target="ep6">第6話：ロスト・シーケンス</a></li>
        </ul>
      </details>
    `;

    // 新しいメニューのイベントリスナーを再登録
    bindNavEvents();

    // トゥルーモードの初期ページとしてep4を読み込み
    loadMarkdown('ep4');
    document.querySelector('a[data-target="ep4"]').classList.add('active');
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
      currentNavLinks.forEach(nav => nav.classList.remove('active'));
      e.target.classList.add('active');

      const target = e.target.dataset.target;
      loadMarkdown(target);

      // モバイルビューの場合はリンククリック後にサイドバーを閉じる
      if (window.innerWidth <= 768) {
        closeSidebar();
      }
    });
  });
}

// --- ページ状態復元機能 ---
function restoreState(target) {
  const trueModeTargets = ['ep4', 'ep5', 'ep6', 'true_character', 'world'];
  const part2Targets = [
    'ep7', 'ep8', 'ep9', 'ep10', 'ep11', 'ep12', 'ep13', 'ep14', 'ep15',
    'ep16', 'ep17', 'ep18', 'ep19', 'ep20', 'ep21'
  ];

  if (part2Targets.includes(target)) {
    // 第2章のメニュー構成とテーマ設定
    document.body.classList.remove('fake-mode');
    document.body.classList.add('true-mode');
    siteTitle.textContent = '[BUG_REPORT]';
    siteSubtitle.innerHTML = '仕様書にないバグですが、<br>たぶん俺のことです';

    const navContainer = document.getElementById('nav-container');
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
          <li><a href="#" data-target="ep4">第4話：観測者とメトロノーム</a></li>
          <li><a href="#" data-target="ep5">第5話：浸食の予兆</a></li>
          <li><a href="#" data-target="ep6">第6話：ロスト・シーケンス</a></li>
        </ul>
      </details>
      <details class="nav-group" open>
        <summary>第2部（第7話〜）</summary>
        <ul>
          <li><a href="#" data-target="ep7">第7話：システムからの招待状</a></li>
          <li><a href="#" data-target="ep8">第8話：六本木の休日</a></li>
          <li><a href="#" data-target="ep9">第9話：デスマーチの足音と限界</a></li>
          <li><a href="#" data-target="ep10">第10話：裏側からの接触</a></li>
          <li><a href="#" data-target="ep11">第11話：納品へのカウントダウン</a></li>
          <li><a href="#" data-target="ep12">第12話：デートとスマートウォッチ</a></li>
          <li><a href="#" data-target="ep13">第13話：赤い日の真実と罠</a></li>
          <li><a href="#" data-target="ep14">第14話：一年後の決断とフェーズアウト</a></li>
          <li><a href="#" data-target="ep15">第15話：鬼之河アンダーグラウンド</a></li>
          <li><a href="#" data-target="ep16">第16話：再会と覚醒のアプリ</a></li>
          <li><a href="#" data-target="ep17">第17話：記憶の抵抗</a></li>
          <li><a href="#" data-target="ep18">第18話：ふたつの和音（コード）</a></li>
          <li><a href="#" data-target="ep19">第19話：反逆のシステム・デプロイ</a></li>
          <li><a href="#" data-target="ep20">第20話：新しい世界の仕様書</a></li>
          <li><a href="#" data-target="ep21">最終話：日常のアップデート</a></li>
        </ul>
      </details>
    `;
    bindNavEvents();
  } else if (trueModeTargets.includes(target)) {
    // 第1章終盤（トゥルーモード展開後）のメニュー構成
    document.body.classList.remove('fake-mode');
    document.body.classList.add('true-mode');
    siteTitle.textContent = '[BUG_REPORT]';
    siteSubtitle.innerHTML = '仕様書にないバグですが、<br>たぶん俺のことです';

    const navContainer = document.getElementById('nav-container');
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
          <li><a href="#" data-target="ep4">第4話：観測者とメトロノーム</a></li>
          <li><a href="#" data-target="ep5">第5話：浸食の予兆</a></li>
          <li><a href="#" data-target="ep6">第6話：ロスト・シーケンス</a></li>
        </ul>
      </details>
    `;
    bindNavEvents();
  } else {
    // 初期のフェイクモード
    document.body.classList.remove('true-mode');
    document.body.classList.add('fake-mode');
    // デフォルト（index.html記載）のメニュー状態と見なすため上書きは不要
  }
}

// 初期化処理
const lastPage = localStorage.getItem('yomimono_last_page') || 'character';
restoreState(lastPage);
bindNavEvents();
loadMarkdown(lastPage);

// リセットボタン（初めから読み直す）のイベント登録
const btnResetState = document.getElementById('btn-reset-state');
if (btnResetState) {
  btnResetState.addEventListener('click', () => {
    localStorage.removeItem('yomimono_last_page');
    window.location.reload();
  });
}

// 初期読み込み時のアクティブリンクを設定（ちょっと遅延させて確実に）
setTimeout(() => {
  const currentNavLinks = document.querySelectorAll('a[data-target]');
  currentNavLinks.forEach(nav => nav.classList.remove('active'));
  const activeLink = document.querySelector(`a[data-target="${lastPage}"]`);
  if (activeLink) activeLink.classList.add('active');
}, 50);
