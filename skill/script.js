// --- script.js (最下部リストロジック最終修正版) ---

const skillData = [
    { id: 1000, rank: '高級', 双拳銃: 'ダブルショット', 鎌: 'クリープスラッシュ', 大剣: 'パワーアタック', 弓: 'スパイラルショット', 杖: 'ランス・オブ・スピリッツ', 鈍器: 'シールドバッシュ', 双剣: 'ラピッドアタック', 宝珠: 'ライトフォール', 御剣: 'マルチプルステップ' },
    { id: 1100, rank: '高級', 双拳銃: 'インパクトショット', 鎌: 'スピニングスウィップ', 大剣: 'ショルダーチャージ', 弓: 'ストロングショット', 杖: 'ファイヤーボール', 鈍器: 'ヘビースマッシュ', 双剣: 'ウィンドスラッシュ', 宝珠: 'リカバリー', 御剣: 'トライデントアタック' },
    { id: 1200, rank: '高級', 双拳銃: 'ー', 鎌: 'ブラッディフューリー', 大剣: 'アイアンハイド', 弓: 'ー', 杖: 'ブレイズ', 鈍器: 'グレイス・オブ・ライト', 双剣: 'ー', 宝珠: 'チャージングライト', 御剣: 'ー' }, // 空白を'ー'に置換
    { id: 2000, rank: '希少', 双拳銃: 'バックワードショット', 鎌: 'クルーエルダンス', 大剣: 'フル・レンジ・アタック', 弓: 'ネイチャーアロー', 杖: 'ブラインド', 鈍器: 'ライトニングスマッシャー', 双剣: 'フラッシュクローサー', 宝珠: 'ストレートインパクト', 御剣: 'スクリューヒット' },
    { id: 2100, rank: '希少', 双拳銃: 'クラスターボム', 鎌: 'バニッシュスラッシュ', 大剣: 'チェーンリッパー', 弓: 'トライアルオウェンス', 杖: 'ライトニングインパクト', 鈍器: 'ディヴァインリカバリー', 双剣: 'デュアルインベイル', 宝珠: 'ダークネス', 御剣: 'サンダーボルト' },
    { id: 2200, rank: '希少', 双拳銃: 'ラジアル・デス・ゾーン', 鎌: 'スウィッピングバッシュ', 大剣: 'フレイムウェーブ', 弓: 'ウェーブアロー', 杖: 'アイススピア', 鈍器: 'シールドビーム', 双剣: 'ピアッシングインパクト', 宝珠: 'レコニングピラー', 御剣: 'スピニングブレイド' },
    { id: 3100, rank: '英雄', 双拳銃: 'クリティカルショット', 鎌: 'ジャッジメントシーズ', 大剣: 'ビーストハウル', 弓: 'ブラックアウトショット', 杖: 'メテオショック', 鈍器: 'ディヴァインアイギス', 双剣: 'シリアスウーンズ', 宝珠: 'プライムプロテクト', 御剣: 'トワーリングブレイド' }, // ID 3100
    { id: 3000, rank: '英雄', 双拳銃: 'ガトリングガン', 鎌: 'ソウルクリプル', 大剣: 'ダウンフォール', 弓: 'ドッジフォーカス', 杖: 'ブラストフリーズ', 鈍器: 'セイクリッドエフェクト', 双剣: 'エネミーチェイス', 宝珠: 'シャイニングライト', 御剣: 'マジカルバリア' }, // ID 3000
    { id: 3200, rank: '英雄', 双拳銃: 'ラッシュ・オブ・デス', 鎌: 'ー', 大剣: 'ー', 弓: 'ドラスティックシューティング', 杖: 'エクスティンクションスペル', 鈍器: 'ー', 双剣: 'スウィフトブレイド', 宝珠: 'ホーリーストレングス', 御剣: 'リーサルトレイル' },
    { id: 4000, rank: '古代', 双拳銃: 'キラースピリッツ', 鎌: 'ブラッディランペイジ', 大剣: 'ビリーフ・オブ・ウォーリアー', 弓: 'スウィフトシュート', 杖: 'アウェイクンインパクト', 鈍器: 'ソウルフォースブレッシング', 双剣: 'クリムゾンポジション', 宝珠: 'アブソリュートブレッシング', 御剣: 'フォースサークル' },
    { id: 4100, rank: '古代', 双拳銃: 'ファントムシューター', 鎌: 'イグナイトクラッシュ', 大剣: 'アースクエイク', 弓: 'シューティングステラ', 杖: 'ドラゴンストライク', 鈍器: 'サクリファイスシールド', 双剣: 'フェニックススラッシュ', 宝珠: 'パワー・オブ・ダークネス', 御剣: 'フォーカスアタック' },
    { id: 4200, rank: '古代', 双拳銃: 'ブレット・オブ・フロスト', 鎌: 'ブラッディエリア', 大剣: 'ブレイドディセント', 弓: 'ツールビヨンショット', 杖: 'フェイテッドスピア', 鈍器: 'シールドインパクト', 双剣: 'アブソリュートイベイジョン', 宝珠: 'リベルフォース', 御剣: 'ボミングソード' }, // 鎌列をマッピング
    { id: 1500, rank: '高級/パッシブ', 双拳銃: 'ブレス・オブ・フォーカス', 鎌: 'レイジロア', 大剣: 'ブレイブハート', 弓: 'スナイパーブロー', 杖: 'マナドレイン', 鈍器: 'エキスパートディフェンダー', 双剣: 'ブロウアップ', 宝珠: 'フォーカス・オン・スペル', 御剣: 'コンテンプレーション' },
    { id: 1600, rank: '高級/パッシブ', 双拳銃: 'ホークアイ', 鎌: 'アキュレイトインパクト', 大剣: 'アウトバースト', 弓: 'イリュージョンステップ', 杖: 'ネイチャープロージョン', 鈍器: 'フォーカス・オン・ザ・バトル', 双剣: 'ラッキーステップ', 宝珠: 'ライトアーマー', 御剣: 'イラボレートコントロール' },
    { id: 2800, rank: '希少/パッシブ', 双拳銃: 'デュアルガンデキスパート', 鎌: 'サイズエキスパート', 大剣: 'ソードエキスパート', 弓: 'ボウエキスパート', 杖: 'スタッフエキスパート', 鈍器: 'メイスエキスパート', 双剣: 'デュアルソードエキスパート', 宝珠: 'オーブエキスパート', 御剣: 'フォースソードエキスパート' },
    { id: 2500, rank: '希少/パッシブ', 双拳銃: 'オーバーヒット', 鎌: 'レンジァヴォイド', 大剣: 'ラストガーディアン', 弓: 'マジカルシールド', 杖: 'スペル・オブ・ヴォイド', 鈍器: 'イベイジョン', 双剣: 'ブレイドレゾナンス', 宝珠: 'ウェザーアウェイ', 御剣: 'オーバーカム' },
    { id: 2600, rank: '希少/パッシブ', 双拳銃: 'レジストシールド', 鎌: 'ドレインブラッド', 大剣: 'ディヴァインブレイド', 弓: 'シャープアイズ', 杖: 'ファインドエゴ', 鈍器: 'リカバリーエフェクト', 双剣: 'ライズディフェンス', 宝珠: 'フォーカスライト', 御剣: 'アイアンローブ' },
    { id: 2700, rank: '希少/パッシブ', 双拳銃: 'ー', 鎌: 'コンセントレーション', 大剣: 'パームフロント', 弓: 'ストレートエイム', 杖: 'ー', 鈍器: 'ホーリープロテクト', 双剣: 'ディープピアース', 宝珠: 'ー', 御剣: 'ー' }, // 空白を'ー'に置換
    { id: 3500, rank: '英雄/パッシブ', 双拳銃: 'ウィル・オブ・リベンジ', 鎌: 'エンレイジ', 大剣: 'コンバットバスター', 弓: 'ブレス・オブ・ウィング', 杖: 'エレメンタルクエイク', 鈍器: 'メイスマスタリー', 双剣: 'エクシードマインド', 宝珠: 'スピリットインサイド', 御剣: 'スーペリアブロック' },
    { id: 3600, rank: '英雄/パッシブ', 双拳銃: 'コンバットホリック', 鎌: 'バイトイリュージョン', 大剣: 'リパルシブフォース', 弓: 'ウィンド・オブ・フォーチュン', 杖: 'クリティカルブースター', 鈍器: 'マインドコントロール', 双剣: 'ブラッドコンシューム', 宝珠: 'ギフト・オブ・グレイス', 御剣: 'インスティンクト・オブ・ファイト' },
    { id: 3700, rank: '英雄/パッシブ', 双拳銃: 'ー', 鎌: 'ブリード・トゥー・デス', 大剣: 'ウィークネスディテクション', 弓: 'スペルパニッシュメント', 杖: 'エレメンタルバッシュ', 鈍器: 'ピアースアタック', 双剣: 'エッジブレイド', 宝珠: 'ネイチャーエコー', 御剣: 'ー' }, // 空白を'ー'に置換
    { id: 3800, rank: '英雄/パッシブ', 双拳銃: 'ユニーク・デュアルガン・エキスパート', 鎌: 'ユニーク・サイズ・エキスパート', 大剣: 'ユニーク・ソード・エキスパート', 弓: 'ユニーク・ボウ・エキスパート', 杖: 'ユニーク・スタッフ・エキスパート', 鈍器: 'ユニーク・メイス・エキスパート', 双剣: 'ユニーク・デュアルソード・エキスパート', 宝珠: 'ユニーク・オーブ・エキスパート', 御剣: 'ー' }, // 空白を'ー'に置換
    { id: 4600, rank: '古代/パッシブ', 双拳銃: 'ミラーアーマー', 鎌: 'ブラッドデザイア', 大剣: 'ブレスドプロテクター', 弓: 'マナリカバリー', 杖: 'ソウルメディテーション', 鈍器: 'カルマ', 双剣: 'ディバウトブラッド', 宝珠: 'プレゼント・アン・アンフォーチュン', 御剣: 'ソード・オブ・カース' }, // ID 4600
    { id: 4500, rank: '古代/パッシブ', 双拳銃: 'カース・オブ・ウィークネス', 鎌: 'ブロークンフェイト', 大剣: 'シャイニングリカバリー', 弓: 'ウィークネスフォーカシング', 杖: 'アンプリファイヤー', 鈍器: 'アンブロークンマインド', 双剣: 'アブソリュートブレイド', 宝珠: 'イネイトガード', 御剣: 'ブリーズスペル' } // ID 4500
];


const currentJobSelect = document.getElementById('current-job');
const targetJobSelect = document.getElementById('target-job');
const currentSkillsDiv = document.getElementById('current-skills');
const transferableSkillsDiv = document.getElementById('transferable-skills');
const unownedSkillsDiv = document.getElementById('unowned-transferable-skills'); // 最下部リスト用Div
const masterCheckbox = document.getElementById('master-checkbox');
const jobNames = Object.keys(skillData[0]).filter(key => key !== 'id' && key !== 'rank');
const STORAGE_KEY = 'skillCheckerState';

// ランク名をCSSクラス名として使える形式に変換する関数
function sanitizeRankForClass(rank) {
    return rank.replace(/\//g, '-');
}

// 現在の状態をローカルストレージに保存する関数
function saveState() {
    const currentJob = currentJobSelect.value;
    const targetJob = targetJobSelect.value;
    const checkedSkillCheckboxes = currentSkillsDiv.querySelectorAll('input[type="checkbox"]:checked');
    const checkedIds = Array.from(checkedSkillCheckboxes).map(cb => parseInt(cb.value));
    const state = { currentJob: currentJob, targetJob: targetJob, checkedIds: checkedIds };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { console.error("ローカルストレージへの保存に失敗しました:", e); }
}

// ローカルストレージから状態を読み込む関数
function loadState() {
    try {
        const savedState = localStorage.getItem(STORAGE_KEY);
        if (savedState) { return JSON.parse(savedState); }
    } catch (e) {
        console.error("ローカルストレージからの読み込みに失敗しました:", e);
        localStorage.removeItem(STORAGE_KEY);
    }
    return null;
}

// 職選択のドロップダウンリストを初期化する関数
function initializeJobSelectors() {
    jobNames.forEach(job => {
        const option1 = document.createElement('option'); option1.value = job; option1.textContent = job; currentJobSelect.appendChild(option1);
        const option2 = document.createElement('option'); option2.value = job; option2.textContent = job; targetJobSelect.appendChild(option2);
    });
}

// マスターチェックボックスの状態を更新する関数
function updateMasterCheckboxState() {
    const skillCheckboxes = currentSkillsDiv.querySelectorAll('input[type="checkbox"]');
    const totalSkills = skillCheckboxes.length;
    const checkedSkills = currentSkillsDiv.querySelectorAll('input[type="checkbox"]:checked').length;
    masterCheckbox.disabled = totalSkills === 0;
    if (totalSkills > 0) {
        if (checkedSkills === totalSkills) { masterCheckbox.checked = true; masterCheckbox.indeterminate = false; }
        else if (checkedSkills === 0) { masterCheckbox.checked = false; masterCheckbox.indeterminate = false; }
        else { masterCheckbox.checked = false; masterCheckbox.indeterminate = true; }
    } else { masterCheckbox.checked = false; masterCheckbox.indeterminate = false; }
}

// 現在の職に対応するスキルリストを表示する関数
function displayCurrentSkills(savedCheckedIds = null) {
    const selectedJob = currentJobSelect.value;
    currentSkillsDiv.innerHTML = '';
    if (!selectedJob) {
        currentSkillsDiv.innerHTML = '<p>現在の職を選択してください。</p>';
        updateMasterCheckboxState(); updateTransferableSkills(); return;
    }
    const skillsForJob = skillData.filter(skill => skill[selectedJob] && skill[selectedJob] !== 'ー');
    if (skillsForJob.length === 0) {
        currentSkillsDiv.innerHTML = '<p>この職で利用可能なスキルはありません。</p>';
    } else {
        skillsForJob.forEach(skill => {
            const label = document.createElement('label');
            const rankClass = `rank-${sanitizeRankForClass(skill.rank)}`;
            label.classList.add(rankClass);
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox'; checkbox.value = skill.id; checkbox.dataset.skillName = skill[selectedJob]; checkbox.id = `skill-${skill.id}`;
            if (savedCheckedIds !== null) { checkbox.checked = savedCheckedIds.includes(skill.id); }
            else { checkbox.checked = true; } // デフォルト全チェック
            checkbox.addEventListener('change', () => { updateMasterCheckboxState(); updateTransferableSkills(); });
            label.htmlFor = `skill-${skill.id}`; label.appendChild(checkbox); label.appendChild(document.createTextNode(` ${skill[selectedJob]} (${skill.rank})`));
            currentSkillsDiv.appendChild(label);
        });
    }
    updateMasterCheckboxState(); updateTransferableSkills();
}

// マスターチェックボックス変更時の処理
function handleMasterCheckboxChange() {
    const isChecked = masterCheckbox.checked;
    const skillCheckboxes = currentSkillsDiv.querySelectorAll('input[type="checkbox"]');
    skillCheckboxes.forEach(checkbox => { checkbox.checked = isChecked; });
    masterCheckbox.indeterminate = false; // indeterminate 状態を解除
    updateTransferableSkills();
}

// 結果表示関数（最下部リストロジック最終修正）
function updateTransferableSkills() {
    const currentJob = currentJobSelect.value;
    const targetJob = targetJobSelect.value;
    transferableSkillsDiv.innerHTML = '';
    unownedSkillsDiv.innerHTML = '';

    // --- 転職後スキルリストの表示 ---
    if (!targetJob) {
        transferableSkillsDiv.innerHTML = '<p>転職後の職を選択してください。</p>';
        unownedSkillsDiv.innerHTML = '<p>現在の職と転職後の職を選択してください。</p>';
        saveState();
        return;
    }
    const targetSkillsList = document.createElement('ul');
    // 転職後に利用可能なスキルIDをセットで保持
    const transferableSkillIds = new Set();
    skillData.forEach(skill => {
        const targetSkillName = skill[targetJob];
        if (targetSkillName && targetSkillName !== 'ー') {
            transferableSkillIds.add(skill.id); // IDをセットに追加
            const li = document.createElement('li'); li.dataset.skillId = skill.id;
            const rankClass = `rank-${sanitizeRankForClass(skill.rank)}`;
            li.classList.add(rankClass);
            const targetNameSpan = document.createElement('span'); targetNameSpan.className = 'target-skill-name'; targetNameSpan.textContent = targetSkillName;
            const sourceInfoSpan = document.createElement('span'); sourceInfoSpan.className = 'source-skill-info';
            const rankSpan = document.createElement('span'); rankSpan.className = 'rank'; rankSpan.textContent = `(${skill.rank})`;
            li.appendChild(targetNameSpan); li.appendChild(sourceInfoSpan); li.appendChild(rankSpan);
            targetSkillsList.appendChild(li);
        }
    });
    if (targetSkillsList.children.length === 0) {
        transferableSkillsDiv.innerHTML = '<p>この職で利用可能なスキルはありません。</p>';
    } else {
        transferableSkillsDiv.appendChild(targetSkillsList);
    }

    // --- 所有マークと元スキル名の表示 & チェック済みID取得 ---
    let checkedSkillIds = []; // チェックされたスキルID
    const inheritedSkillIds = new Set(); // チェックから引き継がれるスキルID
    if (currentJob) {
        const checkedSkillCheckboxes = currentSkillsDiv.querySelectorAll('input[type="checkbox"]:checked');
        checkedSkillIds = Array.from(checkedSkillCheckboxes).map(cb => parseInt(cb.value));
        checkedSkillIds.forEach(skillId => {
            const skillInfo = skillData.find(skill => skill.id === skillId);
            if (skillInfo && skillInfo[targetJob] && skillInfo[targetJob] !== 'ー') {
                inheritedSkillIds.add(skillId); // 引き継がれるIDをセットに追加
                const targetLi = transferableSkillsDiv.querySelector(`li[data-skill-id="${skillId}"]`);
                if (targetLi) {
                    const sourceInfoSpan = targetLi.querySelector('.source-skill-info');
                    if (sourceInfoSpan) {
                        const sourceSkillName = skillInfo[currentJob] && skillInfo[currentJob] !== 'ー' ? skillInfo[currentJob] : '';
                        sourceInfoSpan.textContent = sourceSkillName ? `← ${sourceSkillName} (所有)` : '(所有)';
                        targetLi.classList.add('owned');
                    }
                }
            }
        });
    }

    // --- ▼▼▼ 別途習得が必要なスキル（変換元候補）リスト生成 ▼▼▼ ---
    if (currentJob && targetJob) {
        const newlyRequiredList = document.createElement('ul');

        // 転職後に利用可能だが、チェックから引き継がれないスキルIDを計算
        const differingSkillIds = new Set([...transferableSkillIds].filter(id => !inheritedSkillIds.has(id)));

        differingSkillIds.forEach(skillId => {
            const skill = skillData.find(s => s.id === skillId); // 該当スキルデータを取得
            if (!skill) return; // データ不整合の場合はスキップ

            const targetSkillName = skill[targetJob]; // 転職後のスキル名は必ず存在するはず

            const li = document.createElement('li');
            const rankClass = `rank-${sanitizeRankForClass(skill.rank)}`;
            li.classList.add(rankClass);

            // スキルヘッダー（転職後スキル名とランク）
            const headerDiv = document.createElement('div'); headerDiv.className = 'new-skill-header';
            const nameSpan = document.createElement('span'); nameSpan.className = 'target-skill-name'; nameSpan.textContent = targetSkillName;
            const rankSpanElement = document.createElement('span'); rankSpanElement.className = 'rank'; rankSpanElement.textContent = `(${skill.rank})`;
            headerDiv.appendChild(nameSpan); headerDiv.appendChild(rankSpanElement);
            li.appendChild(headerDiv);

            // 詳細情報（変換元候補スキル）
            const details = document.createElement('details');
            const summary = document.createElement('summary'); summary.textContent = '変換元の候補スキル'; // 見出し変更
            details.appendChild(summary);
            const allJobsUl = document.createElement('ul'); allJobsUl.className = 'all-jobs-list';

            // 変換元候補をリストアップ ('ー'でないものを表示)
            jobNames.forEach(job => {
                const sourceCandidateName = skill[job];
                if (sourceCandidateName && sourceCandidateName !== 'ー') { // 'ー'でないスキルのみ表示
                    const jobSkillLi = document.createElement('li');
                    const jobNameSpan = document.createElement('span'); jobNameSpan.className = 'job-name'; jobNameSpan.textContent = `${job}:`;
                    const skillNameSpan = document.createElement('span'); skillNameSpan.className = 'skill-name-detail'; skillNameSpan.textContent = sourceCandidateName;
                    jobSkillLi.appendChild(jobNameSpan); jobSkillLi.appendChild(skillNameSpan);
                    allJobsUl.appendChild(jobSkillLi);
                }
            });

            // 変換元候補がない場合のメッセージ（通常は考えにくいが一応）
            if (allJobsUl.children.length === 0) {
                const noSourceLi = document.createElement('li');
                noSourceLi.textContent = '変換元のスキルが見つかりません。';
                noSourceLi.style.fontStyle = 'italic';
                noSourceLi.style.color = '#888';
                allJobsUl.appendChild(noSourceLi);
            }

            details.appendChild(allJobsUl);
            li.appendChild(details);
            newlyRequiredList.appendChild(li);
        });

        // リストに項目があれば表示、なければメッセージ表示
        if (newlyRequiredList.children.length > 0) {
            unownedSkillsDiv.appendChild(newlyRequiredList);
        } else {
            unownedSkillsDiv.innerHTML = '<p>別途習得が必要なスキルはありません（所有スキルから全て引き継ぎ可能です）。</p>';
        }
    } else {
        unownedSkillsDiv.innerHTML = '<p>現在の職と転職後の職を選択してください。</p>';
    }
    // --- ▲▲▲ リスト生成ここまで ▲▲▲ ---

    // --- 状態をローカルストレージに保存 ---
    saveState();
}

// --- ページ初期化処理 ---
function initializePage() {
    initializeJobSelectors();
    const savedState = loadState();
    let savedCheckedIds = null;
    if (savedState) {
        if (jobNames.includes(savedState.currentJob)) { currentJobSelect.value = savedState.currentJob; }
        if (jobNames.includes(savedState.targetJob)) { targetJobSelect.value = savedState.targetJob; }
        savedCheckedIds = Array.isArray(savedState.checkedIds) ? savedState.checkedIds : [];
    }
    displayCurrentSkills(savedCheckedIds); // 初回表示（保存状態があれば適用、なければ全チェック）
    masterCheckbox.addEventListener('change', handleMasterCheckboxChange);
    currentJobSelect.addEventListener('change', () => displayCurrentSkills(null)); // 職変更時はデフォルト全チェック
    targetJobSelect.addEventListener('change', updateTransferableSkills);
}

// --- ページ読み込み完了時に初期化処理を実行 ---
document.addEventListener('DOMContentLoaded', initializePage);