// manual/layout.js

function renderFooter(index) {
    return `
        <div class="slide-footer">
            <div class="footer-left">Kisaragi System Inc. | 介護DX導入提案書</div>
            <div class="footer-right">Page ${index + 1}</div>
        </div>`;
}

function renderImage(slide, index) {
    if (!slide.img && !window.isEditMode) return '';
    const imgSrc = slide.img || ''; 
    let attrs = '';
    let style = !imgSrc ? 'min-height: 200px; background: #eee;' : '';
    
    if (window.isEditMode) {
        attrs = `onclick="startImageEdit(event, ${index})" title="クリックして画像を差し替え"`;
        style += 'cursor: pointer; border: 3px dashed #ffb74d;'; 
    }
    return `<div class="image-box"><img src="${imgSrc}" style="${style}" ${attrs} onerror="this.style.display='none';"></div>`;
}

const LayoutRenderer = {
    'cover': function(slide, index) {
        return `
        <div class="slide-body layout-cover">
            <div class="cover-content">
                <div class="cover-title" ${window.getEditAttrs(index, 'title')}>${slide.title.replace(/\\n/g, '<br>')}</div>
                <div class="cover-subtitle" ${window.getEditAttrs(index, 'subtitle')}>${slide.subtitle.replace(/\\n/g, '<br>')}</div>
            </div>
        </div>`;
    },

    'chapter': function(slide, index) {
        return `
        <div class="slide-body layout-chapter">
            <div class="chapter-content">
                <h1 ${window.getEditAttrs(index, 'title')}>${slide.title}</h1>
                <p ${window.getEditAttrs(index, 'desc')}>${slide.desc || ''}</p>
                <div class="chapter-deco"></div>
            </div>
        </div>
        ${renderFooter(index)}`;
    },

    'big-number': function(slide, index) {
        return `
        <div class="slide-header">
            <div class="header-text">
                <span class="chapter-badge">${slide.chapter}</span>
                <h2 class="slide-title" ${window.getEditAttrs(index, 'title')}>${slide.title}</h2>
            </div>
        </div>
        <div class="slide-body" style="text-align:center;">
            <div class="big-number-content" style="font-size: 32px; font-weight: bold; line-height: 1.4; margin-bottom: 40px;" ${window.getEditAttrs(index, 'mainText')}>
                ${slide.mainText}
            </div>
            <div class="big-number-sub" style="font-size: 18px; color: #666; background: #f5f5f5; display: inline-block; padding: 20px 40px; border-radius: 50px;" ${window.getEditAttrs(index, 'subText')}>
                ${slide.subText}
            </div>
        </div>
        ${renderFooter(index)}`;
    },

    'message': function(slide, index) {
        return `
        <div class="slide-header">
            <div class="header-text">
                <span class="chapter-badge">${slide.chapter}</span>
                <h2 class="slide-title" ${window.getEditAttrs(index, 'title')}>${slide.title}</h2>
            </div>
        </div>
        <div class="slide-body">
            <div class="message-box" style="font-size: 20px; line-height: 2.0; text-align: center; color: var(--primary-dark);" ${window.getEditAttrs(index, 'text')}>
                ${slide.text}
            </div>
        </div>
        ${renderFooter(index)}`;
    },

    // --- Pricing Layout (注釈対応) ---
    'pricing': function(slide, index) {
        const plans = slide.plans || [];
        const plansHtml = plans.map(function(plan, pIndex) {
            const features = plan.features || [];
            const featuresHtml = features.map(function(f, fIndex) {
                return `
                <li class="feature-item">
                    <span class="feature-label" ${window.getEditAttrs(index, 'plans', pIndex, 'features', fIndex, 'label')}>${f.label}</span>
                    <span class="feature-value" ${window.getEditAttrs(index, 'plans', pIndex, 'features', fIndex, 'val')}>${f.val}</span>
                </li>`;
            }).join('');

            return `
            <div class="plan-card ${plan.highlight ? 'plan-highlight' : ''}" style="flex: 1;">
                <div class="plan-header">
                    <div class="plan-name" ${window.getEditAttrs(index, 'plans', pIndex, 'name')}>${plan.name}</div>
                    <div class="plan-price">
                        <span style="font-size: 1.2em;" ${window.getEditAttrs(index, 'plans', pIndex, 'price')}>${plan.price}</span>
                        <span style="font-size: 0.5em; font-weight:normal;" ${window.getEditAttrs(index, 'plans', pIndex, 'unit')}>${plan.unit || ''}</span>
                    </div>
                </div>
                <div class="plan-body">
                    <ul class="feature-list">
                        ${featuresHtml}
                    </ul>
                </div>
            </div>`;
        }).join('');

        // 注釈 (note) の表示
        const noteHtml = slide.note ? `<p class="pricing-note" ${window.getEditAttrs(index, 'note')}>${slide.note}</p>` : '';

        return `
        <div class="slide-header">
            <div class="header-text">
                <span class="chapter-badge">${slide.chapter}</span>
                <h2 class="slide-title" ${window.getEditAttrs(index, 'title')}>${slide.title}</h2>
            </div>
        </div>
        <div class="slide-body">
            <div class="pricing-container" style="display: flex; gap: 40px; justify-content: center; align-items: stretch;">
                ${plansHtml}
            </div>
            ${noteHtml}
        </div>
        ${renderFooter(index)}`;
    },

    'roadmap': function(slide, index) {
        const steps = slide.steps || [];
        const stepsHtml = steps.map(function(s, i) {
            return `
            <div class="step-card">
                <div class="step-icon">${i + 1}</div>
                <div class="step-content">
                    <div class="step-title" ${window.getEditAttrs(index, 'steps', i, 'title')}>${s.title}</div>
                    <div class="step-desc" ${window.getEditAttrs(index, 'steps', i, 'desc')}>${s.desc}</div>
                </div>
            </div>`;
        }).join('');

        return `
        <div class="slide-header">
            <div class="header-text">
                <span class="chapter-badge">${slide.chapter}</span>
                <h2 class="slide-title" ${window.getEditAttrs(index, 'title')}>${slide.title}</h2>
            </div>
        </div>
        <div class="slide-body">
            <p style="text-align:center; font-size: 18px; margin-bottom: 20px;" ${window.getEditAttrs(index, 'desc')}>${slide.desc}</p>
            <div class="roadmap-wrapper">
                <div class="roadmap-line"></div>
                ${stepsHtml}
            </div>
        </div>
        ${renderFooter(index)}`;
    },

    'impact': function(slide, index) {
        return `
        <div class="slide-header">
            <div class="header-text">
                <span class="chapter-badge">${slide.chapter}</span>
                <h2 class="slide-title" ${window.getEditAttrs(index, 'title')}>${slide.title}</h2>
            </div>
        </div>
        <div class="slide-body">
            <div class="impact-grid">
                <div class="impact-panel before">
                    <span class="impact-badge" style="background:#666;">BEFORE</span>
                    <h3 ${window.getEditAttrs(index, 'beforeTitle')}>${slide.beforeTitle}</h3>
                    <p ${window.getEditAttrs(index, 'beforeText')}>${slide.beforeText}</p>
                </div>
                <div class="impact-arrow">➡</div>
                <div class="impact-panel after">
                    <span class="impact-badge" style="background:var(--accent);">AFTER</span>
                    <h3 ${window.getEditAttrs(index, 'afterTitle')}>${slide.afterTitle}</h3>
                    <p ${window.getEditAttrs(index, 'afterText')}>${slide.afterText}</p>
                </div>
            </div>
        </div>
        ${renderFooter(index)}`;
    },

    'wide': function(slide, index) {
        const points = slide.points || [];
        const pointsHtml = points.map(function(p, i) {
            return `<div style="background:#f9f9f9; padding:20px; border-radius:8px; border-top:3px solid var(--accent);" ${window.getEditAttrs(index, 'points', i)}>${p}</div>`;
        }).join('');
        return `
        <div class="slide-header">
             <div class="header-text">
                <span class="chapter-badge">${slide.chapter}</span>
                <h2 class="slide-title" ${window.getEditAttrs(index, 'title')}>${slide.title}</h2>
            </div>
        </div>
        <div class="slide-body">
            <div style="height:50%; margin-bottom:30px;">${renderImage(slide, index)}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:20px;">${pointsHtml}</div>
        </div>
        ${renderFooter(index)}`;
    },

    'standard': function(slide, index) {
        const points = slide.points || [];
        const pointsHtml = points.map(function(p, i) {
            return `<li ${window.getEditAttrs(index, 'points', i)}>${p}</li>`;
        }).join('');
        return `
        <div class="slide-header">
            <div class="header-text">
                <span class="chapter-badge">${slide.chapter}</span>
                <h2 class="slide-title" ${window.getEditAttrs(index, 'title')}>${slide.title}</h2>
            </div>
        </div>
        <div class="slide-body">
            <div class="grid-2col">
                <div class="text-col">
                    <ul class="point-list">${pointsHtml}</ul>
                </div>
                <div class="img-col">
                    ${renderImage(slide, index)}
                </div>
            </div>
        </div>
        ${renderFooter(index)}`;
    }
};

LayoutRenderer.render = function(slide, index) {
    if (slide.type === 'main-cover' || slide.type === 'chapter-cover') {
        const layout = slide.type === 'main-cover' ? 'cover' : 'chapter';
        return LayoutRenderer[layout](slide, index);
    }
    const layout = slide.layout || 'standard';
    if (LayoutRenderer[layout]) {
        return LayoutRenderer[layout](slide, index);
    }
    return LayoutRenderer['standard'](slide, index);
};
