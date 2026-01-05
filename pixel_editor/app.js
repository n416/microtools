/**
 * 16x16 Pixel Art Editor - Logic v16.0
 */

const CONFIG = {
    canvasSize: 16,
    baseZoom: 20,
    maxZoom: 100,
    minZoom: 2
};

const STATE = {
    zoom: 25,
    layers: [],
    activeLayerIndex: 0,
    tool: 'pen',
    color: '#3498db',
    isDrawing: false,
    startPos: { x: 0, y: 0 },
    currentPos: { x: 0, y: 0 },
    selection: null,
    floating: null,
    isMoving: false,
    dragOffset: { x: 0, y: 0 },
    history: [],
    historyIndex: -1,
    clipboard: null,
    bgImage: null,
    bgX: 0, bgY: 0, bgScale: 1.0, bgOpacity: 0.5, bgOnTop: true,
    bgEditMode: false,
    palMode: 'pick',
    bgDragStart: { x: 0, y: 0 },
    isBgDragging: false
};

const els = {
    containerArea: document.getElementById('canvasArea'),
    container: document.getElementById('canvasContainer'),
    mainCanvas: document.getElementById('mainCanvas'),
    bgCanvas: document.getElementById('bgCanvas'),
    uiCanvas: document.getElementById('uiCanvas'),
    preview: document.getElementById('previewCanvas'),
    grid: document.getElementById('gridOverlay'),
    layerList: document.getElementById('layerList'),
    palCanvas: document.getElementById('paletteCanvas'),
    colorPicker: document.getElementById('primaryColor'),
    colorHex: document.getElementById('colorHex'),
    zoomLabel: document.getElementById('zoomLabel'),
    saveName: document.getElementById('saveName'),
    fileList: document.getElementById('fileList'),
    bgOnTop: document.getElementById('bgOnTop'),
    btnBgEditMode: document.getElementById('btnBgEditMode')
};

const ctx = els.mainCanvas.getContext('2d');
const bgCtx = els.bgCanvas.getContext('2d');
const uiCtx = els.uiCanvas.getContext('2d');
const prevCtx = els.preview.getContext('2d');
const palCtx = els.palCanvas.getContext('2d', { willReadFrequently: true });

function init() {
    palCtx.fillStyle = '#ffffff';
    palCtx.fillRect(0,0,200,200);
    addLayer("Layer 1");
    window.addEventListener('resize', resizeBgCanvas);
    resizeBgCanvas();
    setupMouseEvents();
    setupToolEvents();
    setupKeyboardEvents();
    setupBackgroundEvents();
    setupPaletteEvents();
    setupLayerEvents();
    setupDB();
    saveState();
    updateZoom(0);
}

function resizeBgCanvas() {
    els.bgCanvas.width = els.containerArea.clientWidth;
    els.bgCanvas.height = els.containerArea.clientHeight;
    render();
}

function render() {
    bgCtx.clearRect(0, 0, els.bgCanvas.width, els.bgCanvas.height);
    if (STATE.bgImage) {
        els.bgCanvas.style.zIndex = STATE.bgOnTop ? 30 : 5;
        bgCtx.save();
        bgCtx.globalAlpha = STATE.bgOpacity;
        const containerRect = els.container.getBoundingClientRect();
        const areaRect = els.containerArea.getBoundingClientRect();
        const gridX = containerRect.left - areaRect.left;
        const gridY = containerRect.top - areaRect.top;
        const zoomRatio = STATE.zoom / CONFIG.baseZoom;
        const drawW = STATE.bgImage.width * STATE.bgScale * zoomRatio;
        const drawH = STATE.bgImage.height * STATE.bgScale * zoomRatio;
        const finalX = gridX + (STATE.bgX * zoomRatio);
        const finalY = gridY + (STATE.bgY * zoomRatio);
        bgCtx.drawImage(STATE.bgImage, finalX, finalY, drawW, drawH);
        bgCtx.restore();
    }

    ctx.clearRect(0, 0, CONFIG.canvasSize, CONFIG.canvasSize);
    prevCtx.clearRect(0, 0, CONFIG.canvasSize, CONFIG.canvasSize);
    for (let i = STATE.layers.length - 1; i >= 0; i--) {
        const layer = STATE.layers[i];
        if (layer.visible) {
            drawLayer(ctx, layer.data);
            drawLayer(prevCtx, layer.data);
        }
    }
    if (STATE.floating) {
        drawFloating(ctx, STATE.floating);
        drawFloating(prevCtx, STATE.floating);
    }

    uiCtx.clearRect(0, 0, els.uiCanvas.width, els.uiCanvas.height);
    if (STATE.floating) drawHighResSelection(uiCtx, STATE.floating);
    else if (STATE.selection) drawHighResSelection(uiCtx, STATE.selection);
    
    if (STATE.bgEditMode) els.containerArea.classList.add('edit-bg-mode');
    else els.containerArea.classList.remove('edit-bg-mode');
}

function drawLayer(context, grid) { for (let y=0; y<16; y++) for (let x=0; x<16; x++) if (grid[y][x]) { context.fillStyle = grid[y][x]; context.fillRect(x, y, 1, 1); } }
function drawFloating(context, floating) { const { x: fx, y: fy, w, h, data } = floating; for (let y=0; y<h; y++) for (let x=0; x<w; x++) if (data[y][x]) { context.fillStyle = data[y][x]; context.fillRect(fx + x, fy + y, 1, 1); } }
function drawHighResSelection(context, rect) { const z=STATE.zoom; context.strokeStyle='#fff'; context.lineWidth=1; context.setLineDash([4,4]); context.strokeRect(rect.x*z+0.5, rect.y*z+0.5, rect.w*z-1, rect.h*z-1); context.strokeStyle='#000'; context.lineDashOffset=4; context.strokeRect(rect.x*z+0.5, rect.y*z+0.5, rect.w*z-1, rect.h*z-1); }

function setupMouseEvents() {
    const area = els.containerArea;
    area.addEventListener('mousedown', (e) => {
        if (STATE.bgEditMode && STATE.bgImage) {
            STATE.isBgDragging = true;
            STATE.bgDragStart = { x: e.clientX, y: e.clientY };
            return;
        }
        if (e.target.closest('#canvasContainer')) {
            startDrawingAction(e);
        }
    });
    window.addEventListener('mousemove', (e) => {
        if (STATE.bgEditMode && STATE.isBgDragging && STATE.bgImage) {
            const dx = e.clientX - STATE.bgDragStart.x;
            const dy = e.clientY - STATE.bgDragStart.y;
            const zoomRatio = STATE.zoom / CONFIG.baseZoom;
            STATE.bgX += dx / zoomRatio;
            STATE.bgY += dy / zoomRatio;
            STATE.bgDragStart = { x: e.clientX, y: e.clientY };
            render();
            return;
        }
        if (STATE.isDrawing) handleMoveAction(e);
    });
    window.addEventListener('mouseup', () => {
        STATE.isBgDragging = false;
        if (STATE.isDrawing) endDrawingAction();
    });
    area.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = -Math.sign(e.deltaY);
        if (STATE.bgEditMode && STATE.bgImage) {
            const step = 0.05;
            STATE.bgScale = Math.max(0.1, STATE.bgScale + (delta * step));
            render();
        } else {
            const step = 5;
            updateZoom(delta * step);
        }
    }, { passive: false });
}

function startDrawingAction(e) {
    const pos = getCoords(e);
    if (STATE.tool === 'eyedropper') { pickColorAt(pos); return; }
    STATE.isDrawing = true; STATE.startPos = pos;
    if (STATE.tool === 'select') {
        if (hitTestSelection(pos.x, pos.y)) {
            if (!STATE.floating) liftSelectionToFloating();
            STATE.isMoving = true; STATE.dragOffset = { x: pos.x - STATE.floating.x, y: pos.y - STATE.floating.y };
            render(); return;
        }
        commitFloating(); STATE.selection = { x: pos.x, y: pos.y, w: 1, h: 1 }; STATE.isMoving = false; render(); return;
    }
    commitFloating();
    if (STATE.tool === 'fill') { floodFill(pos.x, pos.y, getActiveLayerData()[pos.y][pos.x], STATE.color); saveState(); STATE.isDrawing = false; }
    else { useTool(pos.x, pos.y); }
    render();
}

function handleMoveAction(e) {
    const pos = getCoords(e);
    if (STATE.isMoving && STATE.floating) { STATE.floating.x = pos.x - STATE.dragOffset.x; STATE.floating.y = pos.y - STATE.dragOffset.y; render(); return; }
    if (STATE.tool === 'select' && !STATE.isMoving) {
        const bx = Math.max(0, Math.min(CONFIG.canvasSize-1, Math.min(STATE.startPos.x, pos.x)));
        const by = Math.max(0, Math.min(CONFIG.canvasSize-1, Math.min(STATE.startPos.y, pos.y)));
        const ex = Math.max(STATE.startPos.x, pos.x); const ey = Math.max(STATE.startPos.y, pos.y);
        STATE.selection = { x: bx, y: by, w: Math.abs(ex-bx)+1, h: Math.abs(ey-by)+1 };
        if (STATE.selection.w > CONFIG.canvasSize - STATE.selection.x) STATE.selection.w = CONFIG.canvasSize - STATE.selection.x;
        if (STATE.selection.h > CONFIG.canvasSize - STATE.selection.y) STATE.selection.h = CONFIG.canvasSize - STATE.selection.y;
        render(); return;
    }
    useTool(pos.x, pos.y); render();
}

function endDrawingAction() {
    STATE.isDrawing = false; STATE.isMoving = false;
    if (STATE.tool === 'select') return;
    if (STATE.tool === 'line' || STATE.tool === 'ellipse') { applySnapshot(); saveState(); }
    else if (STATE.tool !== 'select') { saveState(); }
}

function pickColorAt(pos) {
    let picked = null;
    if (STATE.floating) {
        const lx = pos.x - STATE.floating.x, ly = pos.y - STATE.floating.y;
        if (lx>=0 && lx<STATE.floating.w && ly>=0 && ly<STATE.floating.h) picked = STATE.floating.data[ly][lx];
    }
    if (!picked) {
        for (const layer of STATE.layers) {
             if (layer.visible && layer.data[pos.y] && layer.data[pos.y][pos.x]) { picked = layer.data[pos.y][pos.x]; break; }
        }
    }
    if (picked) { updateColor(picked); showToast(`Picked: ${picked}`); }
}

function getCoords(e) {
    const rect = els.mainCanvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / STATE.zoom);
    const y = Math.floor((e.clientY - rect.top) / STATE.zoom);
    return { x, y };
}

function setupBackgroundEvents() {
    document.getElementById('btnBgLoad').onclick = () => document.getElementById('bgFileInput').click();
    document.getElementById('bgFileInput').onchange = (e) => {
        const file = e.target.files[0]; if(!file) return;
        const img = new Image();
        img.onload = () => { STATE.bgImage = img; STATE.bgScale = 1.0; STATE.bgX = 0; STATE.bgY = 0; STATE.bgOpacity = 0.5; document.getElementById('bgOpacity').value = 0.5; render(); };
        img.src = URL.createObjectURL(file);
    };
    document.getElementById('btnBgClear').onclick = () => { STATE.bgImage = null; render(); };
    document.getElementById('bgOpacity').oninput = (e) => { STATE.bgOpacity = parseFloat(e.target.value); render(); };
    els.bgOnTop.onchange = (e) => { STATE.bgOnTop = e.target.checked; render(); };
    els.btnBgEditMode.onclick = () => {
        STATE.bgEditMode = !STATE.bgEditMode;
        if (STATE.bgEditMode) els.btnBgEditMode.classList.add('active');
        else els.btnBgEditMode.classList.remove('active');
        render();
    };
}

function updateZoom(delta) {
    STATE.zoom = Math.max(CONFIG.minZoom, Math.min(CONFIG.maxZoom, STATE.zoom + delta));
    const size = CONFIG.canvasSize * STATE.zoom;
    els.container.style.width = size + 'px'; els.container.style.height = size + 'px';
    els.uiCanvas.width = size; els.uiCanvas.height = size;
    els.grid.style.backgroundSize = `${STATE.zoom}px ${STATE.zoom}px`;
    els.zoomLabel.textContent = Math.round(STATE.zoom/CONFIG.baseZoom*100) + '%';
    render();
}

function rgbToHex(r, g, b) { return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1); }
function updateColor(hex) { STATE.color = hex; els.colorPicker.value = hex; els.colorHex.textContent = hex; }
function createEmptyGrid() { return Array(CONFIG.canvasSize).fill(null).map(() => Array(CONFIG.canvasSize).fill(null)); }
function addLayer(name) { STATE.layers.unshift({ id: Date.now(), name: name || `Layer ${STATE.layers.length + 1}`, visible: true, data: createEmptyGrid() }); STATE.activeLayerIndex = 0; renderLayerList(); render(); }
function deleteLayer(index) { if (STATE.layers.length <= 1) return; STATE.layers.splice(index, 1); if (STATE.activeLayerIndex >= STATE.layers.length) STATE.activeLayerIndex = STATE.layers.length - 1; renderLayerList(); render(); saveState(); }
function renderLayerList() { els.layerList.innerHTML = ''; STATE.layers.forEach((layer, index) => { const li = document.createElement('li'); li.className = `layer-item ${index === STATE.activeLayerIndex ? 'active' : ''}`; const vis = document.createElement('span'); vis.className = `layer-vis material-icons ${layer.visible ? '' : 'hidden'}`; vis.textContent = layer.visible ? 'visibility' : 'visibility_off'; vis.onclick = (e) => { e.stopPropagation(); layer.visible = !layer.visible; renderLayerList(); render(); }; const name = document.createElement('span'); name.className = 'layer-name'; name.textContent = layer.name; const del = document.createElement('span'); del.className = 'layer-del material-icons'; del.textContent = 'delete'; del.onclick = (e) => { e.stopPropagation(); if(confirm(`Delete ${layer.name}?`)) deleteLayer(index); }; li.onclick = () => { STATE.activeLayerIndex = index; renderLayerList(); }; li.appendChild(vis); li.appendChild(name); li.appendChild(del); els.layerList.appendChild(li); }); }
function getActiveLayerData() { return (STATE.layers[STATE.activeLayerIndex]) ? STATE.layers[STATE.activeLayerIndex].data : null; }
function setupLayerEvents() { document.getElementById('btnAddLayer').onclick = () => { addLayer(); saveState(); }; }
function commitFloating() { if (!STATE.floating) { if (STATE.selection) STATE.selection = null; render(); return; } const targetLayer = getActiveLayerData(); if (!targetLayer) return; const { x: fx, y: fy, w, h, data } = STATE.floating; for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) { const gx = fx + x; const gy = fy + y; if (gx >= 0 && gx < CONFIG.canvasSize && gy >= 0 && gy < CONFIG.canvasSize) { if (data[y][x] !== null) targetLayer[gy][gx] = data[y][x]; } } } STATE.floating = null; STATE.selection = null; saveState(); render(); }
function useTool(x, y) { const layer = getActiveLayerData(); if (!layer || !STATE.layers[STATE.activeLayerIndex].visible) return; if (STATE.tool === 'line' || STATE.tool === 'ellipse') { const hist = STATE.history[STATE.historyIndex]; if (hist && hist[STATE.activeLayerIndex]) { const histLayerData = hist[STATE.activeLayerIndex].data; for(let r=0; r<CONFIG.canvasSize; r++) layer[r] = [...histLayerData[r]]; } let points = (STATE.tool === 'line') ? getLinePoints(STATE.startPos.x, STATE.startPos.y, x, y) : getEllipsePoints(STATE.startPos.x, STATE.startPos.y, x, y); points.forEach(p => { if(p.x>=0 && p.x<16 && p.y>=0 && p.y<16) layer[p.y][p.x] = STATE.color; }); return; } if (x >= 0 && x < CONFIG.canvasSize && y >= 0 && y < CONFIG.canvasSize) { if (STATE.tool === 'pen') layer[y][x] = STATE.color; if (STATE.tool === 'eraser') layer[y][x] = null; } }
function hitTestSelection(x, y) { const rect = STATE.floating || STATE.selection; if (!rect) return false; return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h; }
function liftSelectionToFloating() { if (!STATE.selection || STATE.floating) return; const layer = getActiveLayerData(); if(!layer) return; const { x, y, w, h } = STATE.selection; const data = []; for (let iy = 0; iy < h; iy++) { const row = []; for (let ix = 0; ix < w; ix++) { row.push(layer[y + iy][x + ix]); layer[y + iy][x + ix] = null; } data.push(row); } STATE.floating = { x, y, w, h, data }; STATE.selection = null; }
function floodFill(x, y, target, replace) { const layer = getActiveLayerData(); if(!layer || !STATE.layers[STATE.activeLayerIndex].visible) return; if (target === replace) return; const stack = [{x, y}]; while(stack.length) { const p = stack.pop(); if (p.x<0||p.x>=16||p.y<0||p.y>=16) continue; if (layer[p.y][p.x] === target) { layer[p.y][p.x] = replace; stack.push({x:p.x+1,y:p.y},{x:p.x-1,y:p.y},{x:p.x,y:p.y+1},{x:p.x,y:p.y-1}); } } }
function getLinePoints(x0, y0, x1, y1) { const points = []; const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0); const sx = (x0 < x1) ? 1 : -1, sy = (y0 < y1) ? 1 : -1; let err = dx - dy; while (true) { points.push({x: x0, y: y0}); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 > -dy) { err -= dy; x0 += sx; } if (e2 < dx) { err += dx; y0 += sy; } } return points; }
function getEllipsePoints(x0, y0, x1, y1) { const points = []; const xm = Math.min(x0, x1), xM = Math.max(x0, x1); const ym = Math.min(y0, y1), yM = Math.max(y0, y1); const xc = (xm + xM) / 2, yc = (ym + yM) / 2; const rx = (xM - xm) / 2, ry = (yM - ym) / 2; if(rx === 0 || ry === 0) return getLinePoints(x0,y0,x1,y1); const steps = 40; for (let i = 0; i <= steps; i++) { const theta = (i / steps) * 2 * Math.PI; points.push({ x: Math.round(xc + rx * Math.cos(theta)), y: Math.round(yc + ry * Math.sin(theta)) }); } return points; }
function saveState() { if (STATE.historyIndex < STATE.history.length - 1) STATE.history = STATE.history.slice(0, STATE.historyIndex + 1); STATE.history.push(JSON.parse(JSON.stringify(STATE.layers))); if (STATE.history.length > 30) STATE.history.shift(); else STATE.historyIndex++; }
function applySnapshot() {}
function undo() { if(STATE.historyIndex>0) { commitFloating(); STATE.historyIndex--; STATE.layers = JSON.parse(JSON.stringify(STATE.history[STATE.historyIndex])); if(STATE.activeLayerIndex >= STATE.layers.length) STATE.activeLayerIndex = 0; renderLayerList(); render(); } }
function redo() { if(STATE.historyIndex<STATE.history.length-1) { commitFloating(); STATE.historyIndex++; STATE.layers = JSON.parse(JSON.stringify(STATE.history[STATE.historyIndex])); renderLayerList(); render(); } }
function setupPaletteEvents() { const cvs = els.palCanvas; let pDrawing = false; document.getElementById('palModePick').onclick = (e) => { STATE.palMode = 'pick'; document.getElementById('palModePick').classList.add('active'); document.getElementById('palModeDraw').classList.remove('active'); }; document.getElementById('palModeDraw').onclick = (e) => { STATE.palMode = 'draw'; document.getElementById('palModeDraw').classList.add('active'); document.getElementById('palModePick').classList.remove('active'); }; const getPalPos = (e) => { const r = cvs.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }; cvs.addEventListener('mousedown', (e) => { pDrawing = true; handlePaletteAction(getPalPos(e)); }); window.addEventListener('mousemove', (e) => { if (!pDrawing) return; if (STATE.palMode === 'draw') { const r = cvs.getBoundingClientRect(); if (e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom) handlePaletteAction(getPalPos(e)); } }); window.addEventListener('mouseup', () => pDrawing = false); function handlePaletteAction(pos) { if (STATE.palMode === 'pick') { const data = palCtx.getImageData(pos.x, pos.y, 1, 1).data; updateColor(rgbToHex(data[0], data[1], data[2])); pDrawing = false; } else { palCtx.fillStyle = STATE.color; palCtx.beginPath(); palCtx.arc(pos.x, pos.y, 3, 0, Math.PI*2); palCtx.fill(); } } document.getElementById('btnPalSave').onclick = () => { const link = document.createElement('a'); link.download = 'palette.png'; link.href = cvs.toDataURL(); link.click(); }; document.getElementById('btnPalLoad').onclick = () => document.getElementById('palFileInput').click(); document.getElementById('palFileInput').onchange = (e) => { const file = e.target.files[0]; if(!file) return; const img = new Image(); img.onload = () => { palCtx.clearRect(0,0,200,200); palCtx.drawImage(img, 0, 0, 200, 200); }; img.src = URL.createObjectURL(file); }; document.getElementById('btnPalClear').onclick = () => { if(confirm('Clear Palette?')) { palCtx.fillStyle = '#ffffff'; palCtx.fillRect(0,0,200,200); } }; }
function copyToClipboard() { let src = null; if(STATE.floating) src = STATE.floating; else if(STATE.selection) { const l=getActiveLayerData(); const {x,y,w,h}=STATE.selection; const d=[]; for(let iy=0;iy<h;iy++){ const r=[]; for(let ix=0;ix<w;ix++) r.push(l[y+iy][x+ix]); d.push(r); } src={x,y,w,h,data:d}; } else { src={x:0,y:0,w:16,h:16,data:getActiveLayerData()}; } STATE.clipboard = JSON.parse(JSON.stringify(src)); showToast("Copied"); }
function pasteFromClipboard() { if(!STATE.clipboard) return; commitFloating(); STATE.floating = JSON.parse(JSON.stringify(STATE.clipboard)); STATE.floating.x = 0; STATE.floating.y = 0; render(); showToast("Pasted"); }
function cutToClipboard() { if(STATE.floating){copyToClipboard(); STATE.floating=null; STATE.selection=null;} else if(STATE.selection){copyToClipboard(); liftSelectionToFloating(); STATE.floating=null; STATE.selection=null;} else { copyToClipboard(); const l=getActiveLayerData(); for(let y=0;y<16;y++)for(let x=0;x<16;x++)l[y][x]=null; } saveState(); render(); showToast("Cut"); }
function deleteSelection() { if(STATE.floating){STATE.floating=null; STATE.selection=null;} else if(STATE.selection){liftSelectionToFloating(); STATE.floating=null; STATE.selection=null;} saveState(); render(); showToast("Deleted"); }
function setupToolEvents() { document.querySelectorAll('.tool-btn').forEach(btn => { btn.addEventListener('click', () => { const tool = btn.dataset.tool; if(tool){ if(STATE.tool==='select'&&tool!=='select')commitFloating(); setTool(tool); } else if(btn.id==='btnUndo') undo(); else if(btn.id==='btnRedo') redo(); }); }); els.colorPicker.addEventListener('change', (e) => updateColor(e.target.value)); 
    if(document.getElementById('btnSave')) document.getElementById('btnSave').onclick = saveToDB; 
    setupImportEvents(); 
}
function setTool(t) { STATE.tool = t; document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active')); document.querySelector(`.tool-btn[data-tool="${t}"]`).classList.add('active'); }
function setupKeyboardEvents() { document.addEventListener('keydown', (e) => { if(e.target.tagName === 'INPUT') return; const ctrl=e.ctrlKey||e.metaKey; if(e.key==='Enter')commitFloating(); if(e.key==='Escape')commitFloating(); if(e.key==='Delete'||e.key==='Backspace')deleteSelection(); if(ctrl&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();} if(ctrl&&e.key.toLowerCase()==='y'){e.preventDefault();redo();} if(ctrl&&e.key.toLowerCase()==='c'){e.preventDefault();copyToClipboard();} if(ctrl&&e.key.toLowerCase()==='v'){e.preventDefault();pasteFromClipboard();} if(ctrl&&e.key.toLowerCase()==='x'){e.preventDefault();cutToClipboard();} switch(e.key.toLowerCase()){ case 'p':setTool('pen');break; case 'e':setTool('eraser');break; case 'i':setTool('eyedropper');break; case 'f':setTool('fill');break; case 'l':setTool('line');break; case 'o':setTool('ellipse');break; case 's':setTool('select');break; } }); }
function showToast(m) { const d=document.createElement('div'); d.style.cssText="position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#222;color:#fff;padding:5px 10px;border-radius:4px;font-size:12px;opacity:0.9;z-index:9999;"; d.textContent=m; document.body.appendChild(d); setTimeout(()=>d.remove(),1500); }

function exportPNG() {
    commitFloating();
    const tmp = document.createElement('canvas');
    tmp.width = 16;
    tmp.height = 16;
    const tCtx = tmp.getContext('2d');
    
    // Draw visible layers
    for (let i = STATE.layers.length - 1; i >= 0; i--) {
        const l = STATE.layers[i];
        if (l.visible) {
            for(let y=0;y<16;y++) {
                for(let x=0;x<16;x++) {
                    if(l.data[y][x]) {
                        tCtx.fillStyle = l.data[y][x];
                        tCtx.fillRect(x,y,1,1);
                    }
                }
            }
        }
    }
    
    const url = tmp.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.download = (els.saveName.value || 'pixelart') + '.png';
    link.click();
}

function setupImportEvents() { if(document.getElementById('btnExportPNG')) document.getElementById('btnExportPNG').onclick = exportPNG; const handleFile = (file) => { if(!file) return; const img = new Image(); img.onload = () => { const tmp = document.createElement('canvas'); tmp.width = 16; tmp.height = 16; const tCtx = tmp.getContext('2d'); tCtx.drawImage(img, 0, 0, 16, 16); const pData = tCtx.getImageData(0,0,16,16).data; const newGrid = createEmptyGrid(); for(let y=0; y<16; y++) { for(let x=0; x<16; x++) { const i = (y*16 + x) * 4; if(pData[i+3] >= 10) newGrid[y][x] = rgbToHex(pData[i], pData[i+1], pData[i+2]); } } commitFloating(); if(STATE.layers[STATE.activeLayerIndex]) { STATE.layers[STATE.activeLayerIndex].data = newGrid; saveState(); render(); showToast('Imported'); } }; img.src = URL.createObjectURL(file); }; const impInput = document.getElementById('importFile'); if(impInput) impInput.onchange = (e) => handleFile(e.target.files[0]); els.uiCanvas.addEventListener('dragover', e => e.preventDefault()); els.uiCanvas.addEventListener('drop', e => { e.preventDefault(); if(e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); }); }
let db; function setupDB() { const r = indexedDB.open('PixelStudioPro', 2); r.onupgradeneeded = e => { if(!e.target.result.objectStoreNames.contains('arts')) e.target.result.createObjectStore('arts', {keyPath:'id', autoIncrement:true}); }; r.onsuccess = e => { db = e.target.result; loadFileList(); }; }
function saveToDB() { commitFloating(); const name = els.saveName.value || 'Untitled'; const tx = db.transaction(['arts'], 'readwrite'); tx.objectStore('arts').add({name, layers: STATE.layers}); tx.oncomplete = () => { els.saveName.value=''; loadFileList(); showToast('Saved'); }; }
function loadFileList() { els.fileList.innerHTML = ''; const store = db.transaction(['arts'], 'readonly').objectStore('arts'); store.openCursor().onsuccess = e => { const cursor = e.target.result; if(cursor) { const data = cursor.value; const li = document.createElement('li'); const nameSpan = document.createElement('span'); nameSpan.textContent = data.name; nameSpan.style.flexGrow = 1; const delBtn = document.createElement('span'); delBtn.textContent = '×'; delBtn.className = 'delete-btn'; li.onclick = () => loadArt(data.id); delBtn.onclick = (ev) => { ev.stopPropagation(); if(!confirm('Delete?')) return; const tx = db.transaction(['arts'],'readwrite'); tx.objectStore('arts').delete(data.id); tx.oncomplete = loadFileList; }; li.appendChild(nameSpan); li.appendChild(delBtn); els.fileList.appendChild(li); cursor.continue(); } }; }
function loadArt(id) { const tx = db.transaction(['arts'], 'readonly'); tx.objectStore('arts').get(id).onsuccess = (e) => { const data = e.target.result; if(data) { commitFloating(); if (data.layers) { STATE.layers = JSON.parse(JSON.stringify(data.layers)); } else if (data.pixels) { STATE.layers = [{ id: Date.now(), name: 'Layer 1', visible: true, data: data.pixels }]; } STATE.activeLayerIndex = 0; STATE.floating = null; STATE.selection = null; STATE.bgImage = null; saveState(); renderLayerList(); render(); showToast('Loaded'); } }; }

init();