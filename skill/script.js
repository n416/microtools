// --- script.js ---
// スキルデータは skill-data.js（skill_converter と共用）から読み込む

const currentJobSelect = document.getElementById('current-job');
const targetJobSelect = document.getElementById('target-job');
const currentSkillsDiv = document.getElementById('current-skills');
const transferableSkillsDiv = document.getElementById('transferable-skills');
const unownedSkillsDiv = document.getElementById('unowned-transferable-skills');
const masterCheckbox = document.getElementById('master-checkbox');
// jobNames は skillData から 'id', 'rank', 'cost' を除外して動的に生成
const jobNames = Object.keys(skillData[0]).filter(key => key !== 'id' && key !== 'rank' && key !== 'cost');
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
    currentJobSelect.innerHTML = '<option value="">選択してください</option>';
    targetJobSelect.innerHTML = '<option value="">選択してください</option>';
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
            const rankClass = `rank-${sanitizeRankForClass(skill.rank)}`; label.classList.add(rankClass);
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
    masterCheckbox.indeterminate = false;
    updateTransferableSkills();
}

// 結果表示関数（コスト表示追加）
function updateTransferableSkills() {
    const currentJob = currentJobSelect.value;
    const targetJob = targetJobSelect.value;
    transferableSkillsDiv.innerHTML = '';
    unownedSkillsDiv.innerHTML = '';

    // --- 転職後スキルリストの表示 ---
    if (!targetJob) {
        transferableSkillsDiv.innerHTML = '<p>転職後の職を選択してください。</p>';
        unownedSkillsDiv.innerHTML = '<p>現在の職と転職後の職を選択してください。</p>';
        saveState(); return;
    }
    const targetSkillsList = document.createElement('ul');
    const transferableSkillIds = new Set();
    let totalCost = 0; // 合計コスト初期化

    skillData.forEach(skill => {
        const targetSkillName = skill[targetJob];
        if (targetSkillName && targetSkillName !== 'ー') {
            transferableSkillIds.add(skill.id);
            totalCost += skill.cost || 0; // コストを加算 (存在しない場合は0)

            const li = document.createElement('li'); li.dataset.skillId = skill.id;
            const rankClass = `rank-${sanitizeRankForClass(skill.rank)}`; li.classList.add(rankClass);

            const targetNameSpan = document.createElement('span'); targetNameSpan.className = 'target-skill-name'; targetNameSpan.textContent = targetSkillName;
            const sourceInfoSpan = document.createElement('span'); sourceInfoSpan.className = 'source-skill-info';
            const rankSpan = document.createElement('span'); rankSpan.className = 'rank'; rankSpan.textContent = `(${skill.rank})`;
            // ▼▼▼ 個別コスト表示用Span ▼▼▼
            const costSpan = document.createElement('span');
            costSpan.className = 'cost';
            costSpan.textContent = `(${skill.cost || 0}`;
            // ▲▲▲ 個別コスト表示用Span ▲▲▲

            li.appendChild(targetNameSpan); li.appendChild(sourceInfoSpan);
            li.appendChild(rankSpan);
            li.appendChild(costSpan); // コスト表示を追加
            targetSkillsList.appendChild(li);
        }
    });

    if (targetSkillsList.children.length === 0) { transferableSkillsDiv.innerHTML = '<p>この職で利用可能なスキルはありません。</p>'; }
    else {
        // ▼▼▼ 合計コスト表示 ▼▼▼
        const totalCostDiv = document.createElement('div');
        totalCostDiv.className = 'total-cost';
        totalCostDiv.textContent = `合計必要ジェム: ${totalCost}`;
        transferableSkillsDiv.appendChild(totalCostDiv);
        // ▲▲▲ 合計コスト表示 ▲▲▲
        transferableSkillsDiv.appendChild(targetSkillsList);
    }

    // --- 所有マークと元スキル名の表示 ---
    let checkedSkillIds = [];
    const inheritedSkillIds = new Set();
    if (currentJob) {
        const checkedSkillCheckboxes = currentSkillsDiv.querySelectorAll('input[type="checkbox"]:checked');
        checkedSkillIds = Array.from(checkedSkillCheckboxes).map(cb => parseInt(cb.value));
        checkedSkillIds.forEach(skillId => {
            const skillInfo = skillData.find(skill => skill.id === skillId);
            if (skillInfo && skillInfo[targetJob] && skillInfo[targetJob] !== 'ー') {
                inheritedSkillIds.add(skillId);
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

    // --- 別途習得が必要なスキル（変換元候補）リスト生成 ---
    if (currentJob && targetJob) {
        const newlyRequiredList = document.createElement('ul');
        const differingSkillIds = new Set([...transferableSkillIds].filter(id => !inheritedSkillIds.has(id)));

        differingSkillIds.forEach(skillId => {
            const skill = skillData.find(s => s.id === skillId);
            if (!skill) return;
            const targetSkillName = skill[targetJob];
            const li = document.createElement('li');
            const rankClass = `rank-${sanitizeRankForClass(skill.rank)}`; li.classList.add(rankClass);
            const headerDiv = document.createElement('div'); headerDiv.className = 'new-skill-header';
            const nameSpan = document.createElement('span'); nameSpan.className = 'target-skill-name'; nameSpan.textContent = targetSkillName;
            const rankSpanElement = document.createElement('span'); rankSpanElement.className = 'rank'; rankSpanElement.textContent = `(${skill.rank})`;
            headerDiv.appendChild(nameSpan); headerDiv.appendChild(rankSpanElement);
            li.appendChild(headerDiv);
            const details = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = '変換元の候補スキル'; details.appendChild(summary);
            const allJobsUl = document.createElement('ul'); allJobsUl.className = 'all-jobs-list';
            let sourceExists = false;
            jobNames.forEach(job => {
                const sourceCandidateName = skill[job];
                if (sourceCandidateName && sourceCandidateName !== 'ー') {
                    sourceExists = true;
                    const jobSkillLi = document.createElement('li');
                    const jobNameSpan = document.createElement('span'); jobNameSpan.className = 'job-name'; jobNameSpan.textContent = `${job}:`;
                    const skillNameSpan = document.createElement('span'); skillNameSpan.className = 'skill-name-detail'; skillNameSpan.textContent = sourceCandidateName;
                    jobSkillLi.appendChild(jobNameSpan); jobSkillLi.appendChild(skillNameSpan);
                    allJobsUl.appendChild(jobSkillLi);
                }
            });
            if (!sourceExists) {
                const noSourceLi = document.createElement('li'); noSourceLi.textContent = '変換元の候補スキルはありません。';
                noSourceLi.style.fontStyle = 'italic'; noSourceLi.style.color = '#888';
                allJobsUl.appendChild(noSourceLi);
            }
            details.appendChild(allJobsUl); li.appendChild(details); newlyRequiredList.appendChild(li);
        });
        if (newlyRequiredList.children.length > 0) { unownedSkillsDiv.appendChild(newlyRequiredList); }
        else { unownedSkillsDiv.innerHTML = '<p>別途習得が必要なスキルはありません（所有スキルから全て引き継ぎ可能です）。</p>'; }
    } else { unownedSkillsDiv.innerHTML = '<p>現在の職と転職後の職を選択してください。</p>'; }

    // --- 状態をローカルストレージに保存 ---
    saveState();
}

// --- ページ初期化処理 ---
function initializePage() {
    // skillData が確定しているので、jobNames もここで確定
    const currentJobNames = Object.keys(skillData[0]).filter(key => key !== 'id' && key !== 'rank' && key !== 'cost');
    // jobNames を更新して initializeJobSelectors で使う (グローバルスコープだが初期化時なのでOK)
    // Note: If jobNames was const, this would need a different approach, but it's declared with let/var implicitly here.
    window.jobNames = currentJobNames; // 明示的にグローバルに再代入 (より安全)

    initializeJobSelectors(); // 更新された jobNames でドロップダウン初期化
    const savedState = loadState();
    let savedCheckedIds = null;
    if (savedState) {
        // 保存された値が現在の jobNames に含まれるか確認
        if (jobNames.includes(savedState.currentJob)) { currentJobSelect.value = savedState.currentJob; }
        if (jobNames.includes(savedState.targetJob)) { targetJobSelect.value = savedState.targetJob; }
        savedCheckedIds = Array.isArray(savedState.checkedIds) ? savedState.checkedIds : [];
    }
    displayCurrentSkills(savedCheckedIds);
    masterCheckbox.addEventListener('change', handleMasterCheckboxChange);
    currentJobSelect.addEventListener('change', () => displayCurrentSkills(null));
    targetJobSelect.addEventListener('change', updateTransferableSkills);
}

// --- ページ読み込み完了時に初期化処理を実行 ---
document.addEventListener('DOMContentLoaded', initializePage);