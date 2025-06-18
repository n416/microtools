// ===================================================
// 1. 初期設定と変数定義
// ===================================================
paper.setup(document.getElementById('myCanvas'));

// ===================================================
// ★★★ パラメータ調整エリア ★★★
// ===================================================
const params = {
    minPointDistance: 5,
    smoothingFactor: 0.2,
    thicknessSmoothingFactor: 0.3,
    minThickness: 1,
    maxThickness: 30,
    thicknessSensitivity: 0.5,
    catmullRomFactor: 0.5,
    simplifyTolerance: 1.0,
    pathGenerationSteps: 80,
    inkDepletionRate: 0.0015,
};

// ===================================================
// 内部で使用する変数
// ===================================================
let drawingData = [];
let livePathGroup = null;
let smoothedVelocity = 0;
let currentThickness;
let strokes = [];
let activeStrokeObject = null;
let editPath = null;
let dragTarget = null;
let undoStack = [];
let redoStack = [];
let beforeState = null;
let isDrawing = false;
let inkAmount = 1.0;
let drawingColor = new paper.Color(0, 0, 0, 1);

// ===================================================
// UI要素の取得
// ===================================================
const drawModeBtn = document.getElementById('drawModeBtn');
const editModeBtn = document.getElementById('editModeBtn');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const simplifyBtn = document.getElementById('simplifyBtn');
const colorPicker = document.getElementById('colorPicker');
const opacitySlider = document.getElementById('opacitySlider');

// ===================================================
// 色と濃さの更新処理
// ===================================================
function updateDrawingColor() {
    const hexColor = colorPicker.value;
    const opacity = parseInt(opacitySlider.value) / 100;
    drawingColor = new paper.Color(hexColor);
    drawingColor.alpha = opacity;

    if (activeStrokeObject) {
        activeStrokeObject.color = drawingColor.clone();
        regenerateStrokeVisual(activeStrokeObject);
    }
}
colorPicker.addEventListener('input', updateDrawingColor);
opacitySlider.addEventListener('input', updateDrawingColor);

// ===================================================
// 描画ツール (Draw Tool)
// ===================================================
const drawTool = new paper.Tool();

drawTool.onMouseDown = function (event) {
    drawingData = [];
    smoothedVelocity = 0;
    currentThickness = params.maxThickness;
    livePathGroup = new paper.Group();
    isDrawing = true;
    inkAmount = 1.0; 
};

drawTool.onMouseDrag = function(event) {
    if (!isDrawing) return;

    if (drawingData.length === 0) {
        const startThickness = params.maxThickness * inkAmount;
        drawingData.push({ point: event.lastPoint, thickness: startThickness });
    }

    const distance = event.delta.length;
    inkAmount -= distance * params.inkDepletionRate;
    inkAmount = Math.max(0, inkAmount);

    const instantaneousVelocity = event.delta.length;
    smoothedVelocity = (smoothedVelocity * (1 - params.smoothingFactor)) + (instantaneousVelocity * params.smoothingFactor);
    let targetThickness = params.maxThickness - (smoothedVelocity * params.thicknessSensitivity);
    targetThickness = Math.max(params.minThickness, Math.min(targetThickness, params.maxThickness));
    currentThickness = (currentThickness * (1 - params.thicknessSmoothingFactor))
                     + (targetThickness * params.thicknessSmoothingFactor);

    let finalThickness = currentThickness * inkAmount;
    finalThickness = Math.max(params.minThickness, finalThickness);

    const liveSegment = new paper.Path.Line({
        from: event.lastPoint,
        to: event.point,
        strokeColor: drawingColor,
        strokeWidth: finalThickness,
        strokeCap: 'round'
    });
    livePathGroup.addChild(liveSegment);

    const lastDataPoint = drawingData[drawingData.length - 1].point;
    if (event.point.getDistance(lastDataPoint) > params.minPointDistance) {
        drawingData.push({ point: event.point, thickness: finalThickness });
    }
};

drawTool.onMouseUp = function (event) {
    if (!isDrawing) return;
    isDrawing = false;

    if (livePathGroup) {
        livePathGroup.remove();
        livePathGroup = null;
    }

    if (drawingData.length === 0) {
        drawingData.push({ point: event.point, thickness: params.maxThickness });
    }
    
    if (drawingData.length < 3) return;

    const newStrokeObject = {
        visual: null,
        data: drawingData,
        color: drawingColor.clone()
    };
    const visualPath = regenerateStrokeVisual(newStrokeObject);
    if (visualPath) {
        newStrokeObject.visual = visualPath;
        strokes.push(newStrokeObject);
        pushToUndoStack({
            type: 'add',
            target: newStrokeObject
        });
    }
};

// ===================================================
// 編集ツール (Edit Tool)
// ===================================================
const editTool = new paper.Tool();
editTool.onMouseDown = function (event) {
    dragTarget = null;
    beforeState = null;
    let hitResult = paper.project.hitTest(event.point, { segments: true, tolerance: 5 });
    if (hitResult && hitResult.item.data && hitResult.item.data.isEditPath) {
        dragTarget = hitResult.segment;
        beforeState = { data: cloneData(activeStrokeObject.data), color: activeStrokeObject.color.clone() };
        return;
    }
    hitResult = paper.project.hitTest(event.point, { fill: true, tolerance: 5 });
    clearEditState();
    if (hitResult) {
        const clickedVisual = hitResult.item;
        activeStrokeObject = strokes.find(s => s.visual === clickedVisual);
        if (activeStrokeObject) {
            dragTarget = activeStrokeObject.visual;
            beforeState = { data: cloneData(activeStrokeObject.data), color: activeStrokeObject.color.clone() };
            showEditPathFor(activeStrokeObject);
            colorPicker.value = activeStrokeObject.color.toCSS(true);
            opacitySlider.value = activeStrokeObject.color.alpha * 100;
        }
    }
};

editTool.onMouseDrag = function (event) {
    if (!dragTarget) return;
    
    if (dragTarget instanceof paper.Segment) {
        dragTarget.point = dragTarget.point.add(event.delta);

        const newPoints = editPath.segments.map(s => s.point);
        const sourceData = beforeState.data;
        const newData = [];
        newPoints.forEach(p => {
            let closestDistance = Infinity, closestThickness = sourceData[0].thickness;
            sourceData.forEach(d => {
                const dPoint = new paper.Point(d.point.x, d.point.y);
                const distance = p.getDistance(dPoint, true);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestThickness = d.thickness;
                }
            });
            newData.push({ point: new paper.Point(p.x, p.y), thickness: closestThickness });
        });
        activeStrokeObject.data = newData;
        
        regenerateStrokeVisual(activeStrokeObject);

    } else if (dragTarget instanceof paper.Path) {
        const delta = event.delta;
        activeStrokeObject.visual.position = activeStrokeObject.visual.position.add(delta);
        activeStrokeObject.data.forEach(d => { d.point = d.point.add(delta); });
        if (editPath) { editPath.position = editPath.position.add(delta); }
    }
};

editTool.onMouseUp = function (event) {
    if (!activeStrokeObject || !beforeState) return;

    const afterState = { data: cloneData(activeStrokeObject.data), color: activeStrokeObject.color.clone() };
    const isChanged = JSON.stringify(beforeState) !== JSON.stringify(afterState);

    if(isChanged){
        pushToUndoStack({
            type: 'transform',
            target: activeStrokeObject,
            before: beforeState,
            after: afterState
        });
    }

    dragTarget = null;
    beforeState = null;
};


// ===================================================
// ヘルパー関数
// ===================================================
function regenerateStrokeVisual(strokeObject) {
    if (strokeObject.visual) { strokeObject.visual.remove(); }
    const drawingData = strokeObject.data;
    const strokeColor = strokeObject.color; 

    if (!drawingData || drawingData.length < 3) return null;
    const centerPoints = drawingData.map(d => new paper.Point(d.point));
    const centerLine = new paper.Path(centerPoints);
    centerLine.smooth({ type: 'catmull-rom', factor: params.catmullRomFactor });

    if (centerLine.length < params.minPointDistance) {
        const dot = new paper.Path.Circle({ center: drawingData[0].point, radius: drawingData[0].thickness / 2 || params.minThickness });
        dot.fillColor = strokeColor;
        strokeObject.visual = dot;
        centerLine.remove();
        return dot;
    }

    const outlinePoints1 = [], outlinePoints2 = [];
    for (let i = 0; i <= params.pathGenerationSteps; i++) {
        const offset = i / params.pathGenerationSteps * centerLine.length;
        const point = centerLine.getPointAt(offset);
        const normal = centerLine.getNormalAt(offset);
        const dataIndex = Math.min(Math.floor(i / params.pathGenerationSteps * (drawingData.length - 1)), drawingData.length - 1);
        const thickness = drawingData[dataIndex].thickness;
        if (point && normal) {
            outlinePoints1.push(point.add(normal.multiply(thickness / 2)));
            outlinePoints2.push(point.subtract(normal.multiply(thickness / 2)));
        }
    }

    if (outlinePoints1.length === 0) { centerLine.remove(); return null; }
    const finalPath = new paper.Path();
    finalPath.addSegments(outlinePoints1);
    const endPoint = outlinePoints2[outlinePoints2.length - 1];
    const throughPointEnd = centerLine.lastSegment.point.add(centerLine.getTangentAt(centerLine.length).multiply(drawingData[drawingData.length - 1].thickness));
    finalPath.arcTo(throughPointEnd, endPoint);
    finalPath.addSegments(outlinePoints2.reverse());
    const startPoint = outlinePoints1[0];
    const throughPointStart = centerLine.firstSegment.point.subtract(centerLine.getTangentAt(0).multiply(drawingData[0].thickness));
    finalPath.arcTo(throughPointStart, startPoint);
    finalPath.closed = true;
    finalPath.fillColor = strokeColor;
    finalPath.simplify(params.simplifyTolerance);
    strokeObject.visual = finalPath;
    centerLine.remove();
    return finalPath;
}

function clearEditState() {
    if (activeStrokeObject && activeStrokeObject.visual) {
        activeStrokeObject.visual.opacity = 1;
        activeStrokeObject.visual.selected = false;
    }
    if (editPath) { editPath.remove(); editPath = null; }
    activeStrokeObject = null;
    simplifyBtn.disabled = true;
}
function showEditPathFor(strokeObject) {
    strokeObject.visual.opacity = 0.4;
    const centerPoints = strokeObject.data.map(d => new paper.Point(d.point.x, d.point.y));
    editPath = new paper.Path(centerPoints);
    editPath.strokeColor = '#009dec';
    editPath.strokeWidth = 2;
    editPath.fullySelected = true;
    editPath.data.isEditPath = true;
    simplifyBtn.disabled = false;
}
function cloneData(data) {
    return data.map(d => ({
        point: new paper.Point(d.point.x, d.point.y),
        thickness: d.thickness
    }));
}

function loadStrokesFromData(strokesData) {
    try {
        clearEditState();
        paper.project.clear();
        strokes = [];
        undoStack = [];
        redoStack = [];
        updateUndoRedoButtons();

        strokesData.forEach(strokeDataItem => {
            const restoredData = strokeDataItem.path.map(d => ({
                point: new paper.Point(d[0], d[1]),
                thickness: d[2]
            }));
            const restoredColor = new paper.Color(
                strokeDataItem.color.r,
                strokeDataItem.color.g,
                strokeDataItem.color.b,
                strokeDataItem.color.a
            );

            const newStrokeObject = {
                visual: null,
                data: restoredData,
                color: restoredColor
            };
            const visualPath = regenerateStrokeVisual(newStrokeObject);
            if (visualPath) {
                newStrokeObject.visual = visualPath;
                strokes.push(newStrokeObject);
            }
        });

        paper.view.draw();
    } catch (error) {
        alert('作品データの読み込みに失敗しました。データが破損している可能性があります。');
        console.error("Error loading strokes from data:", error);
    }
}

// ===================================================
// Undo/Redo と モード切替
// ===================================================
function updateUndoRedoButtons() {
    undoBtn.disabled = undoStack.length === 0;
    redoBtn.disabled = redoStack.length === 0;
}
function pushToUndoStack(action) {
    undoStack.push(action);
    redoStack = [];
    updateUndoRedoButtons();
}
function undo() {
    if (undoStack.length === 0) return;
    const action = undoStack.pop();
    clearEditState();
    switch (action.type) {
        case 'add':
            action.target.visual.remove();
            const index = strokes.indexOf(action.target);
            if (index > -1) strokes.splice(index, 1);
            break;
        case 'transform':
            action.target.data = action.before.data.map(d => ({ point: new paper.Point(d.point.x, d.point.y), thickness: d.thickness }));
            action.target.color = new paper.Color(action.before.color.red, action.before.color.green, action.before.color.blue, action.before.color.alpha);
            regenerateStrokeVisual(action.target);
            break;
    }
    redoStack.push(action);
    updateUndoRedoButtons();
}
function redo() {
    if (redoStack.length === 0) return;
    const action = redoStack.pop();
    clearEditState();
    let targetStroke = action.target;
    switch (action.type) {
        case 'add':
            strokes.push(targetStroke);
            const revivedVisual = regenerateStrokeVisual(targetStroke);
            if(revivedVisual) targetStroke.visual = revivedVisual;
            break;
        case 'transform':
            targetStroke.data = action.after.data.map(d => ({ point: new paper.Point(d.point.x, d.point.y), thickness: d.thickness }));
            targetStroke.color = new paper.Color(action.after.color.red, action.after.color.green, action.after.color.blue, action.after.color.alpha);
            regenerateStrokeVisual(targetStroke);
            break;
    }
    undoStack.push(action);
    updateUndoRedoButtons();
}

function setMode(mode) {
    clearEditState();
    
    drawModeBtn.classList.remove('active-mode');
    editModeBtn.classList.remove('active-mode');

    if (mode === 'draw') { 
        drawTool.activate(); 
        drawModeBtn.classList.add('active-mode');
    }
    else if (mode === 'edit') { 
        editTool.activate(); 
        editModeBtn.classList.add('active-mode');
    }
}

drawModeBtn.addEventListener('click', () => setMode('draw'));
editModeBtn.addEventListener('click', () => setMode('edit'));
editModeBtn.disabled = false;
undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);

simplifyBtn.addEventListener('click', () => {
    if (!activeStrokeObject || !editPath || editPath.segments.length < 3) return;

    const beforeState = { data: cloneData(activeStrokeObject.data), color: activeStrokeObject.color.clone() };

    for (let i = editPath.segments.length - 2; i > 0; i -= 2) {
        editPath.removeSegment(i);
    }

    const newPoints = editPath.segments.map(s => s.point);
    const originalData = beforeState.data;
    const newData = [];
    newPoints.forEach(p => {
        let closestDistance = Infinity, closestThickness = originalData[0].thickness;
        const pPoint = new paper.Point(p.x, p.y);
        originalData.forEach(d => {
            const dPoint = new paper.Point(d.point.x, d.point.y);
            const distance = pPoint.getDistance(dPoint, true);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestThickness = d.thickness;
            }
        });
        newData.push({ point: new paper.Point(p.x, p.y), thickness: closestThickness });
    });
    activeStrokeObject.data = newData;

    regenerateStrokeVisual(activeStrokeObject);
    editPath.fullySelected = true;

    pushToUndoStack({
        type: 'transform',
        target: activeStrokeObject,
        before: beforeState,
        after: { data: cloneData(newData), color: activeStrokeObject.color.clone() }
    });
});


// --- UI要素の取得 ---
const shareBtn = document.getElementById('shareBtn');
const URL_LENGTH_LIMIT = 8000;

// --- 「共有」ボタンのクリック処理 ---
shareBtn.addEventListener('click', () => {
    if (strokes.length === 0) {
        alert('共有する作品がありません。');
        return;
    }

    const exportableData = strokes.map(stroke => {
        return {
            path: stroke.data.map(d => [
                Math.round(d.point.x),
                Math.round(d.point.y),
                Math.round(d.thickness * 10) / 10
            ]),
            color: {
                r: stroke.color.red,
                g: stroke.color.green,
                b: stroke.color.blue,
                a: stroke.color.alpha,
            }
        };
    });
    const jsonString = JSON.stringify(exportableData);
    const encodedData = encodeURIComponent(jsonString);
    const url = `${window.location.origin}${window.location.pathname}?data=${encodedData}`;

    if (url.length > URL_LENGTH_LIMIT) {
        alert('この作品は複雑すぎて共有できません。下部の共有コードを使うか、パスを減らしてください');
        return;
    }

    navigator.clipboard.writeText(url).then(() => {
        alert('共有用URLをクリップボードにコピーしました。');
    }).catch(err => {
        alert('クリップボードへのコピーに失敗しました。');
        console.error('Failed to copy URL: ', err);
    });
});


// --- ページ読み込み時のURLチェック処理 ---
window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const dataFromUrl = urlParams.get('data');

    if (dataFromUrl) {
        const confirmed = window.confirm("共有された作品を読み込みますか？\n（現在編集中の内容は失われます）");
        const cleanUrl = window.location.pathname;
        history.replaceState({}, document.title, cleanUrl);

        if (confirmed) {
            try {
                const jsonString = decodeURIComponent(dataFromUrl);
                const importedStrokesData = JSON.parse(jsonString);
                loadStrokesFromData(importedStrokesData);
            } catch (e) {
                alert('URLからのデータ読み込みに失敗しました。');
                console.error(e);
            }
        }
    }
});

// バイナリデータ(Uint8Array)をBase64文字列に変換
function uint8ArrayToBase64(uint8Array) {
    let binaryString = '';
    for (let i = 0; i < uint8Array.length; i++) {
        binaryString += String.fromCharCode(uint8Array[i]);
    }
    return window.btoa(binaryString);
}

// Base64文字列をバイナリデータ(Uint8Array)に変換
function base64ToUint8Array(base64String) {
    const binaryString = window.atob(base64String);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}


// --- UI要素の取得 ---
const generateCodeBtn = document.getElementById('generateCodeBtn');
const loadCodeBtn = document.getElementById('loadCodeBtn');
const shareDataTextbox = document.getElementById('shareDataTextbox');


// --- 「共有コードを生成」ボタンの処理 ---
generateCodeBtn.addEventListener('click', () => {
    if (strokes.length === 0) {
        alert('共有する作品がありません。');
        return;
    }

    try {
        const exportableData = strokes.map(stroke => {
            return {
                path: stroke.data.map(d => [
                    Math.round(d.point.x),
                    Math.round(d.point.y),
                    Math.round(d.thickness * 10) / 10
                ]),
                color: {
                    r: stroke.color.red,
                    g: stroke.color.green,
                    b: stroke.color.blue,
                    a: stroke.color.alpha,
                }
            };
        });
        // ★★★【バグ修正】★★★
        // 変数名を修正 (exportable.data -> exportableData)
        const jsonString = JSON.stringify(exportableData);
        const compressedData = pako.deflate(jsonString);
        const base64String = uint8ArrayToBase64(compressedData);
        shareDataTextbox.value = base64String;
        shareDataTextbox.select();
        alert('共有コードを生成しました。テキストボックスからコピーしてください。');

    } catch (error) {
        alert('コードの生成に失敗しました。');
        console.error('Code generation failed:', error);
    }
});


// --- 「コードから読込」ボタンの処理 ---
loadCodeBtn.addEventListener('click', () => {
    const code = shareDataTextbox.value.trim();
    if (code === '') {
        alert('テキストボックスに共有コードを貼り付けてください。');
        return;
    }

    if (!window.confirm('現在の作品は破棄されます。よろしいですか？')) {
        return;
    }

    try {
        const compressedData = base64ToUint8Array(code);
        const jsonString = pako.inflate(compressedData, { to: 'string' });
        const importedStrokesData = JSON.parse(jsonString);
        
        const formattedData = importedStrokesData.map(item => {
            if (item.path && item.color) {
                return item; 
            }
            return {
                path: Array.isArray(item) ? item : [],
                color: { r: 0, g: 0, b: 0, a: 1 } 
            }
        });

        loadStrokesFromData(formattedData);

        shareDataTextbox.value = '';
        alert('作品を読み込みました。');

    } catch (error) {
        alert('コードの読み込みに失敗しました。コードが破損しているか、形式が正しくありません。');
        console.error('Code loading failed:', error);
    }
});

// 初期化
setMode('draw');
updateUndoRedoButtons();
updateDrawingColor();