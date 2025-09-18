// --- skill_converter/script.js (更新版) ---

document.addEventListener('DOMContentLoaded', () => {
  const jobSelect = document.getElementById('job-select');
  const skillList = document.getElementById('skill-list');
  const conversionList = document.getElementById('conversion-list');
  const conversionListAnchor = document.getElementById('conversion-list-anchor');
  const backToTopLink = document.querySelector('.back-to-top a');
  const topAnchor = document.getElementById('page-top-anchor');

  const jobNames = Object.keys(skillData[0]).filter(key => !['id', 'cost', 'rank'].includes(key));

  // 職選択のプルダウンを初期化
  function initializeJobSelector() {
    jobNames.forEach(job => {
      const option = document.createElement('option');
      option.value = job;
      option.textContent = job;
      jobSelect.appendChild(option);
    });
  }

  // URLのハッシュを解析して初期状態を設定
  function applyStateFromUrl() {
    try {
      const hash = decodeURIComponent(window.location.hash.substring(1));
      if (!hash) return;

      const [job, skillId] = hash.split('/');
      if (job && jobNames.includes(job)) {
        jobSelect.value = job;
        // skillIdがあれば、スクロールも実行するようにtrueを渡す
        displaySkills(job, skillId ? parseInt(skillId, 10) : null, !!skillId);
      }
    } catch (e) {
      console.error("URLの解析に失敗しました:", e);
    }
  }

  // スキルリストを表示
  function displaySkills(job, selectedSkillId = null, shouldScrollOnLoad = false) {
    skillList.innerHTML = '';
    conversionList.innerHTML = '<li>スキルを選択してください。</li>';

    const skillsForJob = skillData.filter(skill => skill[job] && skill[job] !== 'ー');

    if (skillsForJob.length === 0) {
      skillList.innerHTML = '<li>利用可能なスキルがありません。</li>';
      return;
    }

    skillsForJob.forEach(skill => {
      const li = document.createElement('li');
      li.textContent = `${skill[job]} (${skill.rank})`;
      li.dataset.skillId = skill.id;
      li.dataset.job = job;

      const rankClass = `rank-${sanitizeRankForClass(skill.rank)}`;
      li.classList.add(rankClass);

      li.addEventListener('click', () => {
        // 他の選択済みクラスを削除
        skillList.querySelectorAll('li').forEach(item => item.classList.remove('selected'));
        li.classList.add('selected');
        displayConversions(skill.id, job);
        updateURL(job, skill.id);

        // ▼▼▼ 追加: 変換先リストにスクロール ▼▼▼
        if (conversionListAnchor) {
          conversionListAnchor.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
      skillList.appendChild(li);

      if (selectedSkillId && skill.id === selectedSkillId) {
        li.classList.add('selected');
        displayConversions(skill.id, job);
        // URLから直接読み込んだ場合もスクロール
        if (shouldScrollOnLoad && conversionListAnchor) {
          setTimeout(() => { // 描画が完了してからスクロール
            conversionListAnchor.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        }
      }
    });
  }

  // 変換先スキルリストを表示
  function displayConversions(skillId, sourceJob) {
    conversionList.innerHTML = '';
    const skillInfo = skillData.find(s => s.id === skillId);

    if (!skillInfo) return;

    let foundConversion = false;
    jobNames.forEach(targetJob => {
      if (targetJob !== sourceJob && skillInfo[targetJob] && skillInfo[targetJob] !== 'ー') {
        const li = document.createElement('li');
        const rankClass = `rank-${sanitizeRankForClass(skillInfo.rank)}`;
        li.classList.add(rankClass);
        li.innerHTML = `<span class="job-name">${targetJob}:</span> <span class="skill-name">${skillInfo[targetJob]}</span>`;
        conversionList.appendChild(li);
        foundConversion = true;
      }
    });

    if (!foundConversion) {
      conversionList.innerHTML = '<li>変換可能なスキルはありません。</li>';
    }
  }

  // ランク名をCSSクラス名として使える形式に変換
  function sanitizeRankForClass(rank) {
    return rank.replace(/\//g, '-');
  }

  // URLを更新
  function updateURL(job, skillId) {
    if (job && skillId) {
      const hash = `${job}/${skillId}`;
      if (decodeURIComponent(window.location.hash.substring(1)) !== hash) {
        window.location.hash = hash;
      }
    } else if (job) {
      if (decodeURIComponent(window.location.hash.substring(1)) !== job) {
        window.location.hash = job;
      }
    }
  }

  // --- イベントリスナー ---
  jobSelect.addEventListener('change', () => {
    const selectedJob = jobSelect.value;
    if (selectedJob) {
      displaySkills(selectedJob);
      updateURL(selectedJob);
    } else {
      skillList.innerHTML = '<li>職を選択してください。</li>';
      conversionList.innerHTML = '<li>スキルを選択してください。</li>';
      window.location.hash = '';
    }
  });

  // URLハッシュの変更を監視
  window.addEventListener('hashchange', applyStateFromUrl);

  // ▼▼▼ 追加: 戻るリンクのスムーズスクロール ▼▼▼
  if (backToTopLink && topAnchor) {
    backToTopLink.addEventListener('click', (e) => {
      e.preventDefault();
      topAnchor.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // --- 初期化処理 ---
  initializeJobSelector();
  applyStateFromUrl();
});