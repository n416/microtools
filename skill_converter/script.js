// --- skill_converter_v6/script.js (変更なし) ---

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM要素 ---
    const accordionContainer = document.getElementById('accordion-container');

    // --- データと状態管理 ---
    const PRICE_LOGS_STORAGE_KEY = 'skillPriceLogsV6';
    let priceLogs = JSON.parse(localStorage.getItem(PRICE_LOGS_STORAGE_KEY)) || {};
    const jobNames = Object.keys(skillData[0]).filter(key => !['id', 'cost', 'rank'].includes(key));
    const serverConfig = { servers: ['kiki', 'anica', 'hugo'], numbers: [1, 2, 3, 4, 5] };

    // --- 初期化 ---
    function initialize() {
        renderJobAccordions();
    }
    
    // --- 親アコーディオンの高さ調整 ---
    function adjustParentHeight(element) {
        let parentContent = element.closest('.list-content');
        while (parentContent) {
            const currentParent = parentContent; 
            setTimeout(() => {
                if (currentParent && currentParent.parentElement && currentParent.parentElement.classList.contains('open')) {
                    currentParent.style.maxHeight = currentParent.scrollHeight + "px";
                }
            }, 300);
            parentContent = currentParent.parentElement.closest('.list-content');
        }
    }

    // --- アコーディオン描画 ---
    function renderJobAccordions() {
        accordionContainer.innerHTML = '';
        const jobListGroup = document.createElement('div');
        jobListGroup.className = 'list-group';

        jobNames.forEach(job => {
            const jobItem = createListItem('job', job);
            jobListGroup.appendChild(jobItem);

            const header = jobItem.querySelector('.list-header');
            header.addEventListener('click', () => {
                const content = jobItem.querySelector('.list-content');
                if (jobItem.classList.toggle('open')) {
                    if (!content.hasChildNodes()) {
                        renderSkillList(job, content);
                    }
                    content.style.maxHeight = content.scrollHeight + "px";
                } else {
                    content.style.maxHeight = null;
                }
            });
        });
        accordionContainer.appendChild(jobListGroup);
    }

    function renderSkillList(job, container) {
        container.innerHTML = '';
        const skillsForJob = skillData.filter(s => s[job] && s[job] !== 'ー');
        skillsForJob.forEach(skill => {
            const skillItem = createListItem('skill', skill[job], skill.rank, job, skill.id);
            container.appendChild(skillItem);

            const header = skillItem.querySelector('.list-header');
            header.addEventListener('click', (e) => {
                e.stopPropagation();
                const content = skillItem.querySelector('.list-content');
                if (skillItem.classList.toggle('open')) {
                    if (!content.hasChildNodes()) {
                        renderSkillDetail(skill, job, content);
                    }
                    content.style.maxHeight = content.scrollHeight + "px";
                    adjustParentHeight(content);
                } else {
                    content.style.maxHeight = null;
                }
            });
        });
    }

    function renderSkillDetail(skill, job, container) {
        const mainSkillName = skill[job];
        const allRelated = getAllRelatedSkills(skill.id);
        const otherSkills = allRelated.filter(s => s.name !== mainSkillName);

        container.innerHTML = `
            <div class="skill-detail-content">
                ${createPriceLoggerHTML(mainSkillName)}
                <div class="related-skills-section">
                    <h4>関連スキル</h4>
                    <div class="list-group related-skills-list">
                        ${otherSkills.length > 0 ? otherSkills.map(s => createListItem('related', s.name, s.rank, s.job, s.id).outerHTML).join('') : '<p class="placeholder">関連スキルはありません。</p>'}
                    </div>
                </div>
            </div>
        `;
        setupPriceLogger(container.querySelector('.price-logger'));

        container.querySelectorAll('.list-related').forEach(relatedAccordion => {
            const header = relatedAccordion.querySelector('.list-header');
            const content = relatedAccordion.querySelector('.list-content');
            const relatedSkillName = relatedAccordion.dataset.skillName;

            header.addEventListener('click', (e) => {
                e.stopPropagation();
                if(relatedAccordion.classList.toggle('open')) {
                    if (!content.hasChildNodes()) {
                        content.innerHTML = createPriceLoggerHTML(relatedSkillName);
                        setupPriceLogger(content.querySelector('.price-logger'));
                    }
                    content.style.maxHeight = content.scrollHeight + "px";
                    adjustParentHeight(content);
                } else {
                    content.style.maxHeight = null;
                }
            });
        });
    }
    
    // --- HTML生成ヘルパー ---
    function createListItem(type, title, rank = null, job = null, skillId = null) {
        const element = document.createElement('div');
        let titleHtml = `<span class="header-title">${title}</span>`;
        if (type === 'related') {
            titleHtml = `<div class="related-skill-item">
                            <span class="job-name">${job}:</span>
                            <span class="header-title">${title}</span>
                         </div>`;
        }
        
        element.className = `list-item list-${type}`;
        if (rank) element.classList.add(`rank-${sanitizeRankForClass(rank)}`);
        if (skillId) element.dataset.skillId = skillId;
        element.dataset.skillName = title;

        element.innerHTML = `
            <div class="list-header">
                ${titleHtml}
                <div class="header-meta">
                    <span class="price-range"></span>
                    <span class="list-chevron"></span>
                </div>
            </div>
            <div class="list-content"></div>
        `;

        if(type === 'skill' || type === 'related'){
            updatePriceRangeDisplay(title, element);
        }

        return element;
    }

    function createPriceLoggerHTML(skillName) {
        return `<div class="price-logger" data-skill-name="${skillName}">
                    <h4>価格を記録</h4>
                    <div class="price-section"></div>
                    <div class="price-log-container" style="display: none;"></div>
                </div>`;
    }

    function getAllRelatedSkills(skillId) {
        const skills = [];
        const targetSkill = skillData.find(s => s.id === skillId);
        if(!targetSkill) return [];
        jobNames.forEach(job => {
            if(targetSkill[job] && targetSkill[job] !== 'ー') {
                skills.push({id: targetSkill.id, job, name: targetSkill[job], rank: targetSkill.rank});
            }
        });
        return skills;
    }

    function updatePriceRangeDisplay(skillName, listItemElement) {
        const logs = priceLogs[skillName];
        const rangeElement = listItemElement.querySelector('.price-range');
        if (!rangeElement) return;

        if (logs && logs.length > 0) {
            const prices = logs.map(log => log.price);
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            rangeElement.textContent = `${minPrice.toLocaleString()}～${maxPrice.toLocaleString()} G`;
        } else {
            rangeElement.textContent = '';
        }
    }
    
    // --- 価格記録UI ---
    function setupPriceLogger(loggerElement) {
        if (!loggerElement) return;
        const skillName = loggerElement.dataset.skillName;
        const priceSection = loggerElement.querySelector('.price-section');
        const logContainer = loggerElement.querySelector('.price-log-container');
        if (!priceSection || !logContainer) return;

        const logs = priceLogs[skillName] || [];
        const latestLog = logs.length > 0 ? logs[0] : {};
        const serverOptions = serverConfig.servers.map(s => `<option value="${s}" ${latestLog.server === s ? 'selected' : ''}>${s}</option>`).join('');
        const numberOptions = serverConfig.numbers.map(n => `<option value="${n}" ${latestLog.number == n ? 'selected' : ''}>${n}</option>`).join('');
        
        priceSection.innerHTML = `
            <input type="number" class="price-input" placeholder="価格" value="${latestLog.price || ''}">
            <select class="server-select">${serverOptions}</select>
            <select class="number-select">${numberOptions}</select>
            <button class="save-price-btn">保存</button>
            <button class="show-log-btn">履歴</button>
        `;
        
        const priceInput = priceSection.querySelector('.price-input');
        const serverSelect = priceSection.querySelector('.server-select');
        const numberSelect = priceSection.querySelector('.number-select');
        const saveBtn = priceSection.querySelector('.save-price-btn');
        const logBtn = priceSection.querySelector('.show-log-btn');

        saveBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const price = parseInt(priceInput.value, 10);
            if (!isNaN(price) && price >= 0) {
                const newLog = { price, server: serverSelect.value, number: parseInt(numberSelect.value, 10), date: new Date().toISOString() };
                if (!priceLogs[skillName]) priceLogs[skillName] = [];
                priceLogs[skillName].unshift(newLog);
                localStorage.setItem(PRICE_LOGS_STORAGE_KEY, JSON.stringify(priceLogs));
                renderPriceLog(skillName, logContainer);
                saveBtn.textContent = '保存済!';
                
                document.querySelectorAll(`.list-item[data-skill-name="${skillName}"]`).forEach(item => {
                    updatePriceRangeDisplay(skillName, item);
                });

                setTimeout(() => { saveBtn.textContent = '保存'; }, 1500);
            } else {
                alert('有効な価格を入力してください。');
            }
        });

        logBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            logContainer.style.display = logContainer.style.display === 'none' ? 'block' : 'none';
            if (logContainer.style.display === 'block') {
                renderPriceLog(skillName, logContainer);
            }
            adjustParentHeight(logContainer);
        });
    }

    function renderPriceLog(skillName, container) {
        container.innerHTML = '';
        const logs = priceLogs[skillName] || [];
        if (logs.length === 0) {
            container.innerHTML = '<p class="no-log">価格履歴はありません。</p>';
            return;
        }
        const logList = document.createElement('ul');
        logs.forEach((log, index) => {
            const logItem = document.createElement('li');
            logItem.className = 'log-entry';
            const date = new Date(log.date);
            const formattedDate = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            logItem.innerHTML = `<div class="log-details"><span class="log-price">${log.price.toLocaleString()} G</span><span class="log-location">${log.server || ''}-${log.number || ''}</span></div><div class="log-meta"><span class="log-date">${formattedDate}</span><button class="delete-log-btn" data-index="${index}">×</button></div>`;
            logList.appendChild(logItem);
        });
        container.appendChild(logList);
        container.querySelectorAll('.delete-log-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('この履歴を削除しますか？')) {
                    const indexToDelete = parseInt(btn.dataset.index, 10);
                    priceLogs[skillName].splice(indexToDelete, 1);
                    localStorage.setItem(PRICE_LOGS_STORAGE_KEY, JSON.stringify(priceLogs));
                    renderPriceLog(skillName, container);
                    
                    document.querySelectorAll(`.list-item[data-skill-name="${skillName}"]`).forEach(item => {
                        updatePriceRangeDisplay(skillName, item);
                    });

                    adjustParentHeight(container);
                }
            });
        });
    }

    function sanitizeRankForClass(rank) {
        return rank ? rank.replace(/\//g, '-') : '';
    }

    initialize();
});