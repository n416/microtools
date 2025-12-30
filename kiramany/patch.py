import os

# 1. src/components/Layer2D.tsx (px単位から%単位へ変更)
layer2d_tsx = """
import { useEffect, useRef } from 'react';
import { getSuperformulaPoint } from '../lib/math';
import type { Params2D } from '../lib/math';

type Props = {
  params: Params2D;
  size: number;
  isPreview?: boolean;
};

export const Layer2D = ({ params, size, isPreview = false }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, size, size);

    if (!params.visible) return;

    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(params.rotation);

    const { hue, sat, bri, isFilled, lineWidth } = params;
    const viewScale = size / 1024;

    ctx.shadowBlur = 40 * viewScale;
    ctx.shadowColor = `hsla(${hue}, ${sat}%, 50%, 0.8)`;

    ctx.beginPath();
    const steps = 360; 
    let first = true;
    for (let i = 0; i <= steps; i++) {
      const phi = (2 * Math.PI * i) / steps;
      const p = getSuperformulaPoint(phi, params);
      
      const x = p.x * viewScale;
      const y = p.y * viewScale;

      if (first) { ctx.moveTo(x, y); first = false; }
      else { ctx.lineTo(x, y); }
    }
    ctx.closePath();

    const gradSize = 300 * viewScale;

    if (isFilled) {
      ctx.fillStyle = `hsla(${hue}, ${sat}%, ${bri}%, ${isPreview ? 0.3 : 0.5})`; 
      ctx.fill();
      
      ctx.lineWidth = Math.max(1, lineWidth * viewScale * 0.5); 
      
      const grad = ctx.createLinearGradient(-gradSize, -gradSize, gradSize, gradSize);
      grad.addColorStop(0, `hsla(${hue},${sat}%,${bri}%, ${isPreview ? 0.7 : 1.0})`);
      grad.addColorStop(1, `hsla(${(hue+60)%360},${sat}%,${bri}%, ${isPreview ? 0.7 : 1.0})`);
      ctx.strokeStyle = grad;
      ctx.stroke();

    } else {
      ctx.lineWidth = Math.max(1, lineWidth * viewScale);
      
      const grad = ctx.createLinearGradient(-gradSize, -gradSize, gradSize, gradSize);
      grad.addColorStop(0, `hsla(${hue},${sat}%,${bri}%, ${isPreview ? 0.7 : 1.0})`);
      grad.addColorStop(1, `hsla(${(hue+60)%360},${sat}%,${bri}%, ${isPreview ? 0.7 : 1.0})`);
      
      ctx.strokeStyle = grad;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();
    }

    ctx.restore();
  }, [params.m, params.n1, params.n2, params.n3, params.rotation, params.hue, params.sat, params.bri, params.isFilled, params.lineWidth, params.scale, params.visible, size, isPreview]);
  
  // ★修正: 1024座標系における位置を % に変換して適用
  // これにより、画面上の表示サイズ(500px等)に関わらず、マウス移動量(App.tsxでの計算結果)と見た目の移動量が一致する
  const tx = params.position ? (params.position[0] / 1024) * 100 : 0;
  const ty = params.position ? (params.position[1] / 1024) * 100 : 0;

  return (
    <canvas 
      ref={canvasRef} 
      width={size} 
      height={size} 
      style={{
        position:'absolute', 
        top:0, 
        left:0, 
        width:'100%', 
        height:'100%', 
        pointerEvents:'none',
        transform: `translate3d(${tx}%, ${ty}%, 0)` // px -> %
      }} 
    />
  );
};
"""

# 2. src/App.tsx (PNG出力ロジックで%を解釈できるように修正)
# downloadImage関数のみを書き換えるのは難しいため、ファイル全体を更新します。
app_tsx_content = """import { useEffect, useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Lightformer } from '@react-three/drei';
import { useStore } from './store';
import { Layer2D } from './components/Layer2D';
import { Object3D } from './components/Object3D';
import { downloadSVG } from './lib/exporter';
import { encodeState } from './lib/storage';
import { 
  Eye, Trash2, Download, Zap, Plus, Palette, 
  ArrowUp, ArrowDown, Sliders, Layers, Link as LinkIcon, 
  Move, RotateCw, Scaling, X, FileJson, Dna, Share2, RotateCcw
} from 'lucide-react';
import './App.css';
import type { Params2D, Params3D } from './lib/math';

const downloadImage = (containerId: string, bgColor: string, isTransparent: boolean) => {
  const container = document.getElementById(containerId);
  if (!container) return;
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = 1024;
  finalCanvas.height = 1024;
  const ctx = finalCanvas.getContext('2d');
  if (!ctx) return;
  if (!isTransparent) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 1024, 1024);
  } else {
    ctx.clearRect(0, 0, 1024, 1024);
  }
  const canvases = container.querySelectorAll('canvas');
  canvases.forEach((canvas) => {
    // 2Dレイヤーのtransformを解析して反映する
    // Layer2Dは % 指定に変更されたため、% を px(1024ベース) に戻す処理を追加
    const transform = canvas.style.transform;
    let tx = 0, ty = 0;
    if (transform && transform.includes('translate3d')) {
        // pxの場合 (後方互換)
        let match = transform.match(/translate3d\\(([-\\d.]+)px, ([-\\d.]+)px/);
        if (match) {
            tx = parseFloat(match[1]);
            ty = parseFloat(match[2]);
        } else {
            // %の場合 (新方式)
            match = transform.match(/translate3d\\(([-\\d.]+)%, ([-\\d.]+)%/);
            if (match) {
                // 100% = 1024px
                tx = (parseFloat(match[1]) / 100) * 1024;
                ty = (parseFloat(match[2]) / 100) * 1024;
            }
        }
    }
    ctx.drawImage(canvas, tx, ty, 1024, 1024);
  });
  const link = document.createElement('a');
  link.download = `kiramany-icon-${Date.now()}.png`;
  link.href = finalCanvas.toDataURL('image/png');
  link.click();
};

const ControlRow = ({ label, value, min, max, step = 0.1, onChange }: any) => (
  <div className="control-row">
    <label>{label}</label>
    <div className="control-input-group">
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
      <span className="value-badge">{Math.round(value * 100) / 100}</span>
    </div>
  </div>
);

const Controls2D = ({ params, onChange }: { params: Params2D, onChange: (p: Partial<Params2D>) => void }) => (
  <>
    <ControlRow label="Pos X" min={-512} max={512} step={1} value={params.position ? params.position[0] : 0} onChange={(v: number) => onChange({ position: [v, params.position ? params.position[1] : 0] })} />
    <ControlRow label="Pos Y" min={-512} max={512} step={1} value={params.position ? params.position[1] : 0} onChange={(v: number) => onChange({ position: [params.position ? params.position[0] : 0, v] })} />
    <hr className="divider" />
    <ControlRow label="Points (M)" min={0} max={20} step={1} value={params.m} onChange={(v: number) => onChange({ m: v })} />
    <ControlRow label="N1" min={0.1} max={30} value={params.n1} onChange={(v: number) => onChange({ n1: v })} />
    <ControlRow label="N2" min={0.1} max={30} value={params.n2} onChange={(v: number) => onChange({ n2: v })} />
    <ControlRow label="N3" min={0.1} max={30} value={params.n3} onChange={(v: number) => onChange({ n3: v })} />
    <ControlRow label="Rotate" min={0} max={6.28} value={params.rotation} onChange={(v: number) => onChange({ rotation: v })} />
    <ControlRow label="Scale" min={100} max={1000} step={10} value={params.scale} onChange={(v: number) => onChange({ scale: v })} />
    <hr className="divider" />
    <ControlRow label="Hue" min={0} max={360} step={1} value={params.hue} onChange={(v: number) => onChange({ hue: v })} />
    <ControlRow label="Sat" min={0} max={100} step={1} value={params.sat} onChange={(v: number) => onChange({ sat: v })} />
    <ControlRow label="Width" min={1} max={50} value={params.lineWidth} onChange={(v: number) => onChange({ lineWidth: v })} />
    <div className="control-row">
        <label>Fill</label>
        <input type="checkbox" checked={params.isFilled} onChange={(e) => onChange({ isFilled: e.target.checked })} />
    </div>
  </>
);

const Controls3D = ({ params, onChange }: { params: Params3D, onChange: (p: Partial<Params3D>) => void }) => (
  <>
    <div className="control-row">
        <label>Material</label>
        <select 
            value={params.matType} 
            onChange={(e) => onChange({ matType: e.target.value as any })}
            className="control-select"
        >
            <option value="glass">Glass</option>
            <option value="metal">Metal</option>
            <option value="wire">Wire</option>
            <option value="clay">Clay</option>
            <option value="toon">Toon</option>
            <option value="normal">Normal</option>
        </select>
    </div>
    <div className="control-row">
        <label>Color</label>
        <input type="color" value={params.color} onChange={(e) => onChange({ color: e.target.value })} disabled={params.matType === 'normal'} />
    </div>
    {params.matType === 'wire' && (
        <div className="control-row">
            <label>Hide Back</label>
            <input type="checkbox" checked={params.wireOcclusion ?? false} onChange={(e) => onChange({ wireOcclusion: e.target.checked })} />
        </div>
    )}
    {params.matType === 'glass' && (
        <ControlRow label="Trans." min={0} max={1} step={0.01} value={params.transmission ?? 0.9} onChange={(v: number) => onChange({ transmission: v })} />
    )}
    <ControlRow label="Scale" min={0.1} max={3} value={params.scale} onChange={(v: number) => onChange({ scale: v })} />
    <ControlRow label="Resolution" min={4} max={128} step={1} value={params.meshResolution ?? 64} onChange={(v: number) => onChange({ meshResolution: v })} />
    <hr className="divider" />
    <ControlRow label="M1" min={0} max={20} step={1} value={params.m1} onChange={(v: number) => onChange({ m1: v })} />
    <ControlRow label="M2" min={0} max={20} step={1} value={params.m2} onChange={(v: number) => onChange({ m2: v })} />
    <ControlRow label="N1" min={0.1} max={20} value={params.n1} onChange={(v: number) => onChange({ n1: v })} />
    <ControlRow label="N2" min={0.1} max={20} value={params.n2} onChange={(v: number) => onChange({ n2: v })} />
    <ControlRow label="N3" min={0.1} max={20} value={params.n3} onChange={(v: number) => onChange({ n3: v })} />
  </>
);

const GeneratedEnvironment = () => (
  <Environment resolution={256}>
    <group rotation={[-Math.PI / 4, -0.3, 0]}>
        <Lightformer intensity={4} rotation-x={Math.PI / 2} position={[0, 5, -9]} scale={[10, 10, 1]} />
        <Lightformer intensity={2} rotation-y={Math.PI / 2} position={[-5, 1, -1]} scale={[10, 2, 1]} />
        <Lightformer intensity={2} rotation-y={Math.PI / 2} position={[-5, -1, -1]} scale={[10, 2, 1]} />
        <Lightformer intensity={2} rotation-y={-Math.PI / 2} position={[10, 1, 0]} scale={[20, 2, 1]} />
        <Lightformer type="ring" intensity={2} rotation-y={Math.PI / 2} position={[-0.1, -1, -5]} scale={10} />
    </group>
  </Environment>
);

const SceneContentFixed = () => {
    const { layers3D, selectedId, selectLayer } = useStore();
    return (
      <>
        <GeneratedEnvironment />
        <ambientLight intensity={0.2} />
        <directionalLight position={[5, 10, 7.5]} intensity={3} />
        <pointLight position={[5, 5, 5]} />
        <pointLight position={[-5, -5, 5]} color="#ff00ff" />
        <mesh visible={false} onClick={() => selectLayer(null)}><sphereGeometry args={[100,10,10]} /></mesh>
        {layers3D.map((layer) => (
             <Object3D key={layer.id} params={layer} isSelected={selectedId === layer.id} onSelect={() => selectLayer(layer.id)} />
        ))}
      </>
    );
};

function App() {
  const { 
    mode, setMode, 
    factory2D, factory3D, updateFactory2D, updateFactory3D,
    generate, keep, mutate,
    layers2D, layers3D, toggle2D, delete2D, toggle3D, delete3D,
    moveLayer2D, moveLayer3D, 
    bgColor, setBgColor,
    isTransparent, setIsTransparent,
    selectedId, selectLayer, toggleLink,
    transformMode, setTransformMode,
    updateLayer2D, updateLayer3D,
    initialize, isLoading,
    resetLayer 
  } = useStore() as any; 

  useEffect(() => {
      initialize();
  }, []);

  const selectedLayer2D = layers2D.find((l: Params2D) => l.id === selectedId);
  const selectedLayer3D = layers3D.find((l: Params3D) => l.id === selectedId);
  const isEditing = !!(selectedLayer2D || selectedLayer3D);
  const handleDownloadSVG = () => { downloadSVG(layers2D, bgColor, isTransparent, 'studio-canvas-3d'); };

  const handleShare = async () => {
      const state = { layers2D, layers3D, bgColor };
      try {
          const encoded = await encodeState(state);
          const url = `${window.location.origin}${window.location.pathname}?s=${encodeURIComponent(encoded)}`;
          await navigator.clipboard.writeText(url);
          alert("URL copied to clipboard!");
      } catch (e) {
          console.error(e);
          alert("Failed to generate share URL");
      }
  };
  
  // ★マウス操作ロジック
  const isDraggingRef = useRef(false);
  const lastPosRef = useRef({x:0, y:0});
  
  const handlePointerDown = (e: React.PointerEvent) => {
    if (selectedLayer2D && (transformMode === 'translate' || transformMode === 'rotate' || transformMode === 'scale')) {
       isDraggingRef.current = true;
       lastPosRef.current = { x: e.clientX, y: e.clientY };
       e.stopPropagation();
       (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };
  
  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDraggingRef.current && selectedLayer2D) {
       const dx = e.clientX - lastPosRef.current.x;
       const dy = e.clientY - lastPosRef.current.y;
       lastPosRef.current = { x: e.clientX, y: e.clientY };
       
       const el = document.getElementById('studio-export-area');
       const scaleFactor = el ? (1024 / el.clientWidth) : 1;

       if (transformMode === 'translate') {
           const currentPos = selectedLayer2D.position || [0, 0];
           updateLayer2D(selectedLayer2D.id, { 
               position: [
                   currentPos[0] + dx * scaleFactor, 
                   currentPos[1] + dy * scaleFactor
               ] 
           });
       } else if (transformMode === 'rotate') {
           const sensitivity = 0.01;
           updateLayer2D(selectedLayer2D.id, { 
               rotation: selectedLayer2D.rotation + dx * sensitivity 
           });
       } else if (transformMode === 'scale') {
           const sensitivity = 2.0;
           const newScale = Math.max(10, selectedLayer2D.scale - dy * sensitivity);
           updateLayer2D(selectedLayer2D.id, { 
               scale: newScale
           });
       }
    }
  };
  
  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
        isDraggingRef.current = false;
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  if (isLoading) return <div style={{height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666'}}>Loading...</div>;

  return (
    <div className="app-container">
      
      <div className="col-factory">
        <h2 className="section-title">Material Factory</h2>
        
        <div className="mode-switch">
          <button onClick={() => setMode('2D')} className={`mode-btn ${mode === '2D' ? 'active' : ''}`}>2D Shape</button>
          <button onClick={() => setMode('3D')} className={`mode-btn ${mode === '3D' ? 'active' : ''}`}>3D Object</button>
        </div>

        <div className="preview-box">
          {mode === '2D' && (
            <div style={{position:'absolute', inset:0}}>
              <Layer2D params={factory2D} size={300} isPreview />
            </div>
          )}
          {mode === '3D' && (
            <div style={{position:'absolute', inset:0}}>
               <Canvas camera={{ position: [0, 0, 3.5] }}>
                  <GeneratedEnvironment />
                  <ambientLight intensity={0.2} />
                  <directionalLight position={[5, 10, 7.5]} intensity={3} />
                  <pointLight position={[5, 5, 5]} />
                  <pointLight position={[-5, -5, 5]} color="#ff00ff" />
                  <Object3D params={factory3D} isPreview />
                  <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={2} />
               </Canvas>
            </div>
          )}
        </div>

        <div style={{display:'flex', gap: 8, marginBottom: 20}}>
            <button onClick={generate} className="btn-action btn-gen" style={{marginBottom:0, flex:1}} title="Random Generate">
                <Zap size={16} /> GEN
            </button>
            <button onClick={mutate} className="btn-action" style={{marginBottom:0, flex:1, background:'#444', color:'#aaf', border:'1px solid #556'}} title="Mutate (Evolve)">
                <Dna size={16} /> EVO
            </button>
            <button onClick={keep} className="btn-action btn-keep" style={{marginBottom:0, flex:1.5}} title="Keep to Layer">
                KEEP <Plus size={16} />
            </button>
        </div>

        <div className="tuning-panel" style={{ borderColor: isEditing ? 'var(--accent-color)' : '#333' }}>
            <h3 className="panel-header">
                <Sliders size={14}/> 
                <span style={{flex:1, marginLeft: 6}}>
                    {isEditing ? 'Editing Selection' : 'Fine Tuning (Factory)'}
                </span>
                {isEditing && (
                    <button onClick={() => selectLayer(null)} className="icon-btn" title="Close Edit">
                        <X size={14} />
                    </button>
                )}
            </h3>
            <div className="tuning-scroll">
                {isEditing ? (
                    selectedLayer2D ? (
                        <Controls2D params={selectedLayer2D} onChange={(p) => updateLayer2D(selectedLayer2D.id, p)} />
                    ) : selectedLayer3D ? (
                        <Controls3D params={selectedLayer3D} onChange={(p) => updateLayer3D(selectedLayer3D.id, p)} />
                    ) : null
                ) : (
                    mode === '2D' ? (
                        <Controls2D params={factory2D} onChange={updateFactory2D} />
                    ) : (
                        <Controls3D params={factory3D} onChange={updateFactory3D} />
                    )
                )}
            </div>
        </div>
      </div>

      <div className="col-studio" onClick={() => selectLayer(null)}>
        
        <div className="studio-scale-wrapper" onClick={(e) => e.stopPropagation()}>
          <div 
            id="studio-export-area" 
            className="studio-canvas-real-size" 
            style={{ 
                backgroundColor: isTransparent ? 'transparent' : bgColor,
                backgroundImage: isTransparent ? 'linear-gradient(45deg, #222 25%, transparent 25%), linear-gradient(-45deg, #222 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #222 75%), linear-gradient(-45deg, transparent 75%, #222 75%)' : 'none',
                backgroundSize: '40px 40px',
                backgroundPosition: '0 0, 0 20px, 20px -20px, -20px 0px',
                touchAction: 'none'
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
             <div style={{position:'absolute', inset:0, zIndex:0}}>
               {layers2D.map((layer: Params2D) => <Layer2D key={layer.id} params={layer} size={1024} />)}
             </div>

             <div id="studio-canvas-3d" style={{position:'absolute', inset:0, zIndex:10, pointerEvents: selectedLayer2D ? 'none' : 'auto'}}>
               <Canvas 
                  dpr={1024 / 500} 
                  camera={{ position: [0, 0, 3.5] }} 
                  gl={{ preserveDrawingBuffer: true, alpha: true }}
                  onPointerMissed={() => selectLayer(null)}
                  style={{ width: '100%', height: '100%' }}
               >
                  <SceneContentFixed />
                  <OrbitControls makeDefault enableRotate={false} />
               </Canvas>
             </div>
          </div>
        </div>

        <div className="studio-footer" onClick={(e) => e.stopPropagation()}>
          <div className="toolbar-group">
            <button className={`icon-btn ${transformMode==='translate' ? 'active' : ''}`} onClick={() => setTransformMode('translate')} title="Move"><Move size={18} /></button>
            <button className={`icon-btn ${transformMode==='rotate' ? 'active' : ''}`} onClick={() => setTransformMode('rotate')} title="Rotate"><RotateCw size={18} /></button>
            <button className={`icon-btn ${transformMode==='scale' ? 'active' : ''}`} onClick={() => setTransformMode('scale')} title="Scale"><Scaling size={18} /></button>
            <div style={{width: 1, height: 16, background: '#444', margin: '0 4px'}}></div>
            <button onClick={resetLayer} className="icon-btn" title="Reset Position"><RotateCcw size={18} /></button>
          </div>
          <div className="toolbar-group">
            <div className="color-picker-wrapper">
                <Palette size={16} color="#888" />
                <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} disabled={isTransparent} />
            </div>
            <label className="toggle-label">
                <input type="checkbox" checked={isTransparent} onChange={(e) => setIsTransparent(e.target.checked)} />
                <span className="toggle-text">Trans.</span>
            </label>
          </div>
          
          <button onClick={handleShare} className="icon-btn" title="Share URL" style={{padding:'8px 12px', background: 'var(--accent-color)', color: '#000'}}>
             <Share2 size={18} />
          </button>

          <button onClick={handleDownloadSVG} className="btn-dl" title="Export as SVG" style={{padding: '12px 16px'}}>
            <FileJson size={16} /> SVG
          </button>
          <button onClick={() => downloadImage('studio-export-area', bgColor, isTransparent)} className="btn-dl" title="Export as PNG">
            <Download size={16} /> PNG
          </button>
        </div>
      </div>

      <div className="col-layers">
        <h2 className="section-title"><Layers size={14}/> Layers</h2>

        <div className="layer-group">
          <h3 className="layer-group-title">Foreground (3D)</h3>
          {layers3D.length === 0 && <div className="empty-msg">No 3D objects.</div>}
          <div style={{display:'flex', flexDirection:'column-reverse'}}>
            {layers3D.map((l: Params3D, i: number) => {
              const isSelected = selectedId === l.id;
              return (
              <div 
                key={i} 
                className={`layer-item ${isSelected ? 'selected' : ''}`}
                onClick={(e) => { e.stopPropagation(); selectLayer(l.id); }}
                style={{borderColor: isSelected ? 'var(--accent-color)' : ''}}
              >
                <div className="layer-thumb">
                  <Canvas frameloop="demand" camera={{ position: [0, 0, 3] }} gl={{ alpha: true }}>
                    <GeneratedEnvironment />
                    <ambientLight intensity={0.5} />
                    <pointLight position={[5, 5, 5]} />
                    <Object3D params={l} isPreview />
                  </Canvas>
                </div>
                <div className="layer-info">
                   <span className="layer-name" style={{color: isSelected ? '#fff' : ''}}>3D Obj #{i+1}</span>
                   <div className="layer-sort-btns">
                        <button onClick={(e) => { e.stopPropagation(); moveLayer3D(i, 'up'); }} disabled={i === layers3D.length - 1}><ArrowUp size={10} /></button>
                        <button onClick={(e) => { e.stopPropagation(); moveLayer3D(i, 'down'); }} disabled={i === 0}><ArrowDown size={10} /></button>
                   </div>
                </div>
                <div className="layer-actions">
                    <button onClick={(e) => { e.stopPropagation(); toggleLink(l.id); }} className={`icon-btn ${l.linked ? 'active' : ''}`}><LinkIcon size={14} /></button>
                    <button onClick={(e) => { e.stopPropagation(); toggle3D(i); }} className={`icon-btn ${l.visible ? 'active' : ''}`}><Eye size={14} /></button>
                    <button onClick={(e) => { e.stopPropagation(); delete3D(i); }} className="icon-btn delete"><Trash2 size={14} /></button>
                </div>
              </div>
            )})}
          </div>
        </div>

        <div className="layer-group">
          <h3 className="layer-group-title">Background (2D)</h3>
          {layers2D.length === 0 && <div className="empty-msg">No 2D layers.</div>}
          <div style={{display:'flex', flexDirection:'column-reverse'}}>
            {layers2D.map((l: Params2D, i: number) => {
              const isSelected = selectedId === l.id;
              return (
              <div 
                key={i} 
                className={`layer-item ${isSelected ? 'selected' : ''}`}
                onClick={(e) => { e.stopPropagation(); selectLayer(l.id); }}
                style={{borderColor: isSelected ? 'var(--accent-color)' : ''}}
              >
                <div className="layer-thumb" style={{position: 'relative', overflow: 'hidden', background: '#000'}}>
                   <Layer2D params={l} size={32} />
                </div>
                <div className="layer-info">
                   <span className="layer-name" style={{color: isSelected ? '#fff' : ''}}>Shape #{i+1}</span>
                   <div className="layer-sort-btns">
                        <button onClick={() => moveLayer2D(i, 'up')} disabled={i === layers2D.length - 1}><ArrowUp size={10} /></button>
                        <button onClick={() => moveLayer2D(i, 'down')} disabled={i === 0}><ArrowDown size={10} /></button>
                   </div>
                </div>
                <div className="layer-actions">
                    <button onClick={() => toggle2D(i)} className={`icon-btn ${l.visible ? 'active' : ''}`}><Eye size={14} /></button>
                    <button onClick={() => delete2D(i)} className="icon-btn delete"><Trash2 size={14} /></button>
                </div>
              </div>
            )})}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
"""

def write_file(path, content):
    dir_name = os.path.dirname(path)
    if dir_name and not os.path.exists(dir_name):
        os.makedirs(dir_name, exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Updated: {path}")

write_file('src/components/Layer2D.tsx', layer2d_tsx)
write_file('src/App.tsx', app_tsx_content)