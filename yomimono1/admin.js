// admin.js
import * as Diff from 'https://cdn.jsdelivr.net/npm/diff@5.2.0/+esm';

const state = {
  mdxData: [],    // { name: string, rawContent: string, builtContent: string | null }
  isLoading: false,
};

// DOM Elements
const btnFetch = document.getElementById('btn-fetch');
const statusMessage = document.getElementById('status-message');
const dataTbody = document.getElementById('data-tbody');
const barChart = document.getElementById('bar-chart');

// ユーティリティ: CSSクラスを動的に生成して追加する
const styleSheet = document.createElement('style');
document.head.appendChild(styleSheet);

function addDynamicHeightClass(className, heightPercentage) {
  // 安全のため英数字とハイフンのみ許可
  const sanitizedClassName = className.replace(/[^a-zA-Z0-9-]/g, '');
  const rule = `.${sanitizedClassName} { height: ${heightPercentage}%; }`;
  styleSheet.sheet.insertRule(rule, styleSheet.sheet.cssRules.length);
}

// ユーティリティ: 文字数カウント (MDXタグやフロントマター等を除去し、純粋な文章量をカウントする)
function countCharacters(text) {
  if (!text) return 0;

  let processed = text;

  // 1. フロントマター (先頭の --- から次の --- まで) を削除
  processed = processed.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n*/, '');

  // 2. MDXやHTMLのタグを削除 (<Char ... /> 等の長い属性文字列を省いて文章量のみにする)
  processed = processed.replace(/<[^>]+>/g, '');

  // 3. 代表的なMarkdown記号を削除 (#, *, -, >, `, _, ~)
  processed = processed.replace(/[#*>\-`_~]/g, '');

  // 4. 空白（半角・全角スペース、タブ、改行）をすべて除去
  processed = processed.replace(/\s+/g, '');

  return processed.length;
}

// メッセージ表示
function showMessage(type, message) {
  statusMessage.className = `status-message ${type}`;
  statusMessage.textContent = message;
}

function hideMessage() {
  statusMessage.className = 'status-message hidden';
}

// データの取得と処理
async function fetchData() {
  state.isLoading = true;
  showMessage('loading', 'MDXデータを取得中...');

  try {
    // 1. Viteのimport.meta.globを使用して元のMDXファイルを取得
    // ?raw をつけることで文字列として取得可能
    const rawModules = import.meta.glob('./public/settings/*.mdx', { query: '?raw', import: 'default' });

    // 取得したモジュール群を配列化
    const fetchPromises = Object.entries(rawModules).map(async ([path, resolver]) => {
      // ファイル名の抽出 (例: '/public/settings/ep1.mdx' -> 'ep1.mdx')
      const fileName = path.split('/').pop() || '';

      try {
        const rawContent = await resolver();

        // 2. /dist/settings/ からビルド後のMDXをフェッチ
        let builtContent = null;
        try {
          // distフォルダへのアクセスはローカルサーバー（Vite dev server等）のルートにdistが公開されているか、
          // fetchで叩けるパスにある必要があります。
          // ※ Viteの開発サーバーでは /dist はデフォルトでは公開されません。
          // また Vite が .mdx を解釈しようとして 500 エラーになるのを防ぐため "?raw" を付与します。
          const res = await fetch(`/dist/settings/${fileName}?raw`);
          if (res.ok) {
            builtContent = await res.text();
          } else {
            console.warn(`[admin] Failed to fetch built file: /dist/settings/${fileName} (${res.status})`);
            builtContent = null; // buildデータ無し
          }
        } catch (e) {
          console.warn(`[admin] Error fetching built file: /dist/settings/${fileName}`, e);
          builtContent = null;
        }

        return {
          name: fileName,
          rawContent: rawContent,
          builtContent: builtContent,
        };
      } catch (err) {
        console.error(`[admin] Error loading raw MDX: ${path}`, err);
        return { name: fileName, rawContent: '', builtContent: null };
      }
    });

    state.mdxData = await Promise.all(fetchPromises);

    // 名前でソート (ep1, ep2... のような命名であれば、数値比較を入れると良いが、簡略化のため文字列ソート)
    state.mdxData.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    renderData();
    showMessage('success', `${state.mdxData.length} 件のファイルを分析しました。`);
  } catch (error) {
    console.error(error);
    showMessage('error', 'データの取得中にエラーが発生しました。コンソールを確認してください。');
  } finally {
    state.isLoading = false;
  }
}

function renderData() {
  // クリア
  dataTbody.innerHTML = '';
  barChart.innerHTML = '';

  // スタイルシートの動的ルールをクリア
  while (styleSheet.sheet.cssRules.length > 0) {
    styleSheet.sheet.deleteRule(0);
  }

  if (state.mdxData.length === 0) return;

  let totalRawCount = 0;
  let totalBuiltCount = 0;

  // グラフ描画のための最大値を計算
  const maxBuiltCount = Math.max(...state.mdxData.map(d => {
    return d.builtContent ? countCharacters(d.builtContent) : 0;
  }));

  // 極端に少ないとみなす閾値（例: 平均の50%未満、今回は簡略化のため最大値の一定割合などを設定可能。ここでは一旦固定値または最大値の30%とする）
  const thresholdDanger = maxBuiltCount * 0.3;
  const thresholdWarning = maxBuiltCount * 0.5;

  state.mdxData.forEach((item, index) => {
    const rawCount = countCharacters(item.rawContent);
    const builtCount = item.builtContent ? countCharacters(item.builtContent) : 0;
    const isBuiltAvailable = item.builtContent !== null;

    totalRawCount += rawCount;
    totalBuiltCount += builtCount;

    // -- テーブル行の生成 --
    const tr = document.createElement('tr');

    // ファイル名
    const tdName = document.createElement('td');
    tdName.textContent = item.name;
    tr.appendChild(tdName);

    // 元文字数とリンク
    const tdRaw = document.createElement('td');
    tdRaw.textContent = rawCount.toLocaleString() + ' ';
    const aRaw = document.createElement('a');
    aRaw.href = `/settings/${item.name}?raw`;
    aRaw.target = '_blank';
    aRaw.className = 'link-open';
    aRaw.textContent = '[開く]';
    tdRaw.appendChild(aRaw);
    tr.appendChild(tdRaw);

    // ビルド後文字数とリンク
    const tdBuilt = document.createElement('td');
    if (isBuiltAvailable) {
      tdBuilt.textContent = builtCount.toLocaleString() + ' ';
      const aBuilt = document.createElement('a');
      aBuilt.href = `/dist/settings/${item.name}?raw`;
      aBuilt.target = '_blank';
      aBuilt.className = 'link-open';
      aBuilt.textContent = '[開く]';
      tdBuilt.appendChild(aBuilt);
    } else {
      tdBuilt.textContent = '未ビルド';
    }
    tr.appendChild(tdBuilt);

    // 同期（投稿）ボタン群
    const tdSync = document.createElement('td');
    
    // なろう同期ボタン
    const syncNarouBtn = document.createElement('button');
    syncNarouBtn.className = 'action-btn sync-btn';
    syncNarouBtn.dataset.originalText = 'なろう同期';
    syncNarouBtn.style.padding = '4px 8px';
    syncNarouBtn.style.fontSize = '0.9em';
    syncNarouBtn.style.marginRight = '4px';
    syncNarouBtn.style.backgroundColor = '#2c7c7f'; // なろう用カラー
    syncNarouBtn.textContent = 'なろう同期';
    
    // カクヨム同期ボタン
    const syncKakuyomuBtn = document.createElement('button');
    syncKakuyomuBtn.className = 'action-btn sync-btn';
    syncKakuyomuBtn.dataset.originalText = 'カクヨム同期';
    syncKakuyomuBtn.style.padding = '4px 8px';
    syncKakuyomuBtn.style.fontSize = '0.9em';
    syncKakuyomuBtn.style.backgroundColor = '#0083eb'; // カクヨム用カラー
    syncKakuyomuBtn.textContent = 'カクヨム同期';

    if (!isBuiltAvailable) {
      syncNarouBtn.disabled = true;
      syncNarouBtn.style.cursor = 'not-allowed';
      syncNarouBtn.style.opacity = '0.5';
      
      syncKakuyomuBtn.disabled = true;
      syncKakuyomuBtn.style.cursor = 'not-allowed';
      syncKakuyomuBtn.style.opacity = '0.5';
    } else {
      syncNarouBtn.onclick = () => syncEpisode(item.name, syncNarouBtn, 'narou');
      syncKakuyomuBtn.onclick = () => syncEpisode(item.name, syncKakuyomuBtn, 'kakuyomu');
    }
    
    tdSync.appendChild(syncNarouBtn);
    tdSync.appendChild(syncKakuyomuBtn);
    tr.appendChild(tdSync);

    dataTbody.appendChild(tr);

    // -- 棒グラフの生成 --
    if (isBuiltAvailable) {
      const barWrapper = document.createElement('div');
      barWrapper.className = 'bar-wrapper';

      const barValue = document.createElement('div');
      barValue.className = 'bar-value';
      barValue.textContent = builtCount.toLocaleString();
      barWrapper.appendChild(barValue);

      const barElement = document.createElement('div');
      const dynamicClassName = `bar-height-${index}`;

      // 動的クラスの追加とルールの注入
      const heightPercent = maxBuiltCount > 0 ? Math.max((builtCount / maxBuiltCount) * 100, 5) : 5; // 最低5%は確保
      addDynamicHeightClass(dynamicClassName, heightPercent);

      barElement.className = `bar-element ${dynamicClassName}`;

      // 色の判定 (CSSクラス追加)
      if (builtCount < thresholdDanger) {
        barElement.classList.add('danger');
      } else if (builtCount < thresholdWarning) {
        barElement.classList.add('warning');
      }

      barWrapper.appendChild(barElement);

      const barLabel = document.createElement('div');
      barLabel.className = 'bar-label';
      barLabel.textContent = item.name.replace('.mdx', ''); // 拡張子削除など
      barWrapper.appendChild(barLabel);

      barChart.appendChild(barWrapper);
    }
  });

  const rawTotalElem = document.getElementById('total-raw');
  if (rawTotalElem) rawTotalElem.textContent = totalRawCount.toLocaleString();

  const builtTotalElem = document.getElementById('total-built');
  if (builtTotalElem) builtTotalElem.textContent = totalBuiltCount.toLocaleString();
}

// イベントリスナー
btnFetch.addEventListener('click', fetchData);

// 同期（投稿）処理実行
async function syncEpisode(fileName, btnElement, platform) {
  const originalText = btnElement.textContent;
  btnElement.textContent = '差分取得中...';
  btnElement.disabled = true;
  showMessage('loading', `「${fileName}」の現在の状態を${platform === 'narou' ? 'なろう' : 'カクヨム'}から取得しています...`);

  try {
    // 1. Dry Run リクエスト送信
    const resDry = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: fileName, filename: fileName, platform: platform, dryRun: true })
    });

    const dataDry = await resDry.json();
    if (!resDry.ok) {
        throw new Error(dataDry.error || 'Dry Run リクエストに失敗しました');
    }
    
    // JSON_RESULT のパース
    let jsonResult = null;
    if (dataDry.output) {
      const match = dataDry.output.match(/JSON_RESULT:({.*})/s);
      if (match) {
        try {
          jsonResult = JSON.parse(match[1]);
        } catch(e) { console.error("JSON Parse Error:", e); }
      }
    }

    if (!jsonResult) {
      throw new Error('バックエンドから正しい結果が返されませんでした。');
    }

    const platformResult = jsonResult[platform]; // narou or kakuyomu
    
    // 新規作成時（既存エピソードがない場合）
    if (!platformResult || !platformResult.id) {
        showDiffModal(fileName, platform, '【新規追加】既存のエピソードが見つかりませんでした。\nこのまま新規に投稿しますか？', '', jsonResult.localBody, async () => {
            await executePublish(fileName, btnElement, platform, originalText);
        });
        return;
    }

    // 変更がない場合
    if (platformResult.skipped) {
        showMessage('success', `「${fileName}」は既に最新のため保存処理をスキップしました。`);
        btnElement.textContent = 'スキップ（変更なし）';
        setTimeout(() => resetBtn(btnElement, originalText), 3000);
        return;
    }

    // 差分がある場合はハイライト表示する
    const currentBodyFromSite = platformResult.currentBody || '';
    const localBodyToPublish = jsonResult.localBody || '';
    
    showDiffModal(fileName, platform, 'サイト上のテキストと手元のテキストに差異があります。\n以下の内容で上書きしますか？', currentBodyFromSite, localBodyToPublish, async () => {
        await executePublish(fileName, btnElement, platform, originalText);
    });

  } catch (err) {
    console.error(err);
    showMessage('error', `同期処理の呼び出しに失敗しました: ${err.message}`);
    btnElement.textContent = 'エラー';
    setTimeout(() => resetBtn(btnElement, originalText), 5000);
  }
}

// 実際の保存リクエストを投げる関数
async function executePublish(fileName, btnElement, platform, originalText) {
  hideDiffModal();
  btnElement.textContent = '投稿処理中...';
  btnElement.disabled = true;
  showMessage('loading', `「${fileName}」を${platform === 'narou' ? 'なろう' : 'カクヨム'}へ投稿（上書き）しています...`);

  try {
    const res = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: fileName, filename: fileName, platform: platform, dryRun: false })
    });
    
    const data = await res.json();
    if (res.ok) {
       showMessage('success', `「${fileName}」の同期が完了しました。`);
       btnElement.textContent = '完了';
       setTimeout(() => resetBtn(btnElement, originalText), 3000);
    } else {
       showMessage('error', `同期失敗: ${data.error}`);
       btnElement.textContent = '失敗';
       setTimeout(() => resetBtn(btnElement, originalText), 5000);
    }
  } catch (err) {
    console.error(err);
    showMessage('error', `投稿処理の呼び出しに失敗しました: ${err.message}`);
    btnElement.textContent = 'エラー';
    setTimeout(() => resetBtn(btnElement, originalText), 5000);
  }
}

function resetBtn(btn, originalText) {
    btn.textContent = originalText;
    btn.disabled = false;
}

// Modal UI Logic
const modal = document.getElementById('diff-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCancelModal = document.getElementById('btn-cancel-publish');
const btnConfirmModal = document.getElementById('btn-confirm-publish');
const diffContainer = document.getElementById('diff-container');
const diffMessage = document.getElementById('diff-modal-message');

let currentConfirmCallback = null;

function showDiffModal(fileName, platform, msg, oldText, newText, onConfirm) {
  const platformName = platform === 'narou' ? '小説家になろう' : 'カクヨム';
  diffMessage.textContent = `[${fileName} - ${platformName}] ${msg}`;
  
  // jsdiff を使って文字レベル/行レベルの差分を算出
  const diffResult = Diff.diffLines(oldText, newText);
  
  const fragment = document.createDocumentFragment();
  diffResult.forEach((part) => {
      const span = document.createElement('span');
      // colorize
      if (part.added) {
          span.className = 'diff-added';
          // 視認性向上のためのプレフィックス
          span.textContent = part.value.split('\n').map(l => l ? '+ ' + l : '').join('\n');
      } else if (part.removed) {
          span.className = 'diff-removed';
          span.textContent = part.value.split('\n').map(l => l ? '- ' + l : '').join('\n');
      } else {
          span.textContent = part.value;
      }
      fragment.appendChild(span);
  });
  
  diffContainer.innerHTML = '';
  diffContainer.appendChild(fragment);
  
  currentConfirmCallback = onConfirm;
  modal.classList.remove('hidden');
}

function hideDiffModal() {
  modal.classList.add('hidden');
  currentConfirmCallback = null;
  // 閉じた時点で該当ボタンのロード状態を解除したいが、
  // キャンセル時は同期ボタンのリストアが必要。
  // それは呼び出し元に戻すかここで状態管理する。今回はシンプル化のため放置（ボタンはdisabledのままになり得るため改善余地あり）
}

btnCloseModal.addEventListener('click', () => { hideDiffModal(); resetAllLoadingButtons(); });
btnCancelModal.addEventListener('click', () => { hideDiffModal(); resetAllLoadingButtons(); });

btnConfirmModal.addEventListener('click', () => {
   if (currentConfirmCallback) {
       currentConfirmCallback();
   }
});

function resetAllLoadingButtons() {
   // 全ての[処理中...]ボタンを元に戻す簡易ロジック
   document.querySelectorAll('.sync-btn:disabled').forEach(btn => {
      if (btn.textContent.includes('取得中') || btn.textContent.includes('処理中')) {
          btn.textContent = btn.dataset.originalText || '同期';
          btn.disabled = false;
      }
   });
   hideMessage();
}

// 初期読み込み
fetchData();
