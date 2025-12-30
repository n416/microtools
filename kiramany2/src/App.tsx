import { useEffect, useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Lightformer } from '@react-three/drei';
import { useStore } from './store';
import { Layer2D } from './components/Layer2D';
import { Object3D } from './components/Object3D';
import { compressToEncodedStr, decompressFromEncodedStr } from './lib/share';

import { 
  Download, Zap, Palette, Move, RotateCw, Scaling, Layers, Sliders, X, ArrowLeft, ChevronUp, ChevronDown, Share2, Undo2, Redo2
} from 'lucide-react';
import './App.css';
import type { Params2D, Params3D } from './lib/math';

// --- Components: Controls (Same as before) ---
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
  <div className="controls-container animate-fade-in">
    <div className="control-section-title">Shape</div>
    <ControlRow label="Points (M)" min={0} max={20} step={1} value={params.m} onChange={(v: number) => onChange({ m: v })} />
    <ControlRow label="N1" min={0.1} max={50} value={params.n1} onChange={(v: number) => onChange({ n1: v })} />
    <ControlRow label="N2" min={0.1} max={50} value={params.n2} onChange={(v: number) => onChange({ n2: v })} />
    <ControlRow label="N3" min={0.1} max={50} value={params.n3} onChange={(v: number) => onChange({ n3: v })} />
    <div className="divider" />
    <ControlRow label="Rotate" min={0} max={6.28} value={params.rotation} onChange={(v: number) => onChange({ rotation: v })} />
    <ControlRow label="Scale" min={100} max={1000} step={10} value={params.scale} onChange={(v: number) => onChange({ scale: v })} />
    <ControlRow label="Width" min={1} max={50} value={params.lineWidth} onChange={(v: number) => onChange({ lineWidth: v })} />
    <div className="control-row"><label>Color</label><input type="color" value={params.colorHex || '#ffffff'} onChange={(e) => onChange({ colorHex: e.target.value })} /></div>
    <div className="control-row"><label>Fill</label><input type="checkbox" checked={params.isFilled} onChange={(e) => onChange({ isFilled: e.target.checked })} /></div>
  </div>
);

const Controls3D = ({ params, onChange }: { params: Params3D, onChange: (p: Partial<Params3D>) => void }) => (
  <div className="controls-container animate-fade-in">
    <div className="control-section-title">Material</div>
    <div className="control-row"><label>Type</label><select value={params.matType} onChange={(e) => onChange({ matType: e.target.value as any })} className="control-select"><option value="glass">Glass</option><option value="metal">Metal</option><option value="wire">Wire</option><option value="clay">Clay</option><option value="toon">Toon</option></select></div>
    <div className="control-row"><label>Color</label><input type="color" value={params.color} onChange={(e) => onChange({ color: e.target.value })} /></div>
    <div className="divider" />
    <ControlRow label="Scale" min={0.1} max={3} value={params.scale} onChange={(v: number) => onChange({ scale: v })} />
    <ControlRow label="M1" min={0} max={20} step={1} value={params.m1} onChange={(v: number) => onChange({ m1: v })} />
    <ControlRow label="M2" min={0} max={20} step={1} value={params.m2} onChange={(v: number) => onChange({ m2: v })} />
    <ControlRow label="N1" min={0.1} max={20} value={params.n1} onChange={(v: number) => onChange({ n1: v })} />
    <ControlRow label="N2" min={0.1} max={20} value={params.n2} onChange={(v: number) => onChange({ n2: v })} />
    <ControlRow label="N3" min={0.1} max={20} value={params.n3} onChange={(v: number) => onChange({ n3: v })} />
  </div>
);

const GeneratedEnvironment = () => (
  <Environment resolution={256}>
    <group rotation={[-Math.PI / 4, -0.3, 0]}>
        <Lightformer intensity={4} rotation-x={Math.PI / 2} position={[0, 5, -9]} scale={[10, 10, 1]} />
        <Lightformer intensity={2} rotation-y={Math.PI / 2} position={[-5, 1, -1]} scale={[10, 2, 1]} />
        <Lightformer intensity={2} rotation-y={-Math.PI / 2} position={[10, 1, 0]} scale={[20, 2, 1]} />
        <Lightformer type="ring" intensity={2} rotation-y={Math.PI / 2} position={[-0.1, -1, -5]} scale={10} />
    </group>
  </Environment>
);

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
    ctx.drawImage(canvas, 0, 0, 1024, 1024);
  });
  const link = document.createElement('a');
  link.download = `kiramany2-${Date.now()}.png`;
  link.href = finalCanvas.toDataURL('image/png');
  link.click();
};

function App() {
  const { 
    initialize,
    roll, undo, redo, past, future,
    layers2D, layers3D, 
    bgColor, setBgColor,
    isTransparent, setIsTransparent,
    selectedId, selectLayer,
    transformMode, setTransformMode,
    paletteName,
    updateLayer2D, updateLayer3D,
    loadFromShare,
    isLoading
  } = useStore();

  const [showInfo, setShowInfo] = useState(true);
  const [showStudioControls, setShowStudioControls] = useState(true);
  
  const shareCheckRef = useRef(false);

  // ★ Initialize on Mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  const selectedLayer2D = layers2D.find(l => l.id === selectedId);
  const selectedLayer3D = layers3D.find(l => l.id === selectedId);
  const isEditing = !!(selectedLayer2D || selectedLayer3D);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space' && !isEditing) {
            e.preventDefault();
            roll();
        }
        // Undo/Redo Shortcuts
        if ((e.metaKey || e.ctrlKey) && e.code === 'KeyZ') {
            e.preventDefault();
            if (e.shiftKey) redo();
            else undo();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [roll, undo, redo, isEditing]);

  // Share Logic
  useEffect(() => {
    const checkShare = async () => {
        if (shareCheckRef.current) return;
        const params = new URLSearchParams(window.location.search);
        const shareData = params.get('s');
        if (shareData) {
            shareCheckRef.current = true; 
            await new Promise(r => setTimeout(r, 300));
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();

            if (window.confirm("共有されたアイコンを読み込みますか？\n(現在の作業内容は失われます)")) {
                try {
                    const decoded = decodeURIComponent(shareData);
                    const data = await decompressFromEncodedStr(decoded);
                    loadFromShare(data);
                    window.history.replaceState({}, '', window.location.pathname);
                } catch (e) {
                    console.error("Share load error:", e);
                    alert("共有リンクの読み込みに失敗しました。");
                }
            }
        }
    };
    checkShare();
  }, [loadFromShare]);

  const handleShare = async () => {
    const state = useStore.getState();
    const data = {
        bgColor: state.bgColor,
        layers2D: state.layers2D,
        layers3D: state.layers3D,
        paletteName: state.paletteName
    };
    try {
        const encoded = await compressToEncodedStr(data);
        const urlSafe = encodeURIComponent(encoded);
        const url = `${window.location.origin}${window.location.pathname}?s=${urlSafe}`;
        navigator.clipboard.writeText(url).then(() => {
            alert("🔗 圧縮された共有URLをコピーしました！");
        });
    } catch (e) {
        console.error(e);
        alert("URLの生成に失敗しました。");
    }
  };

  const handleBackgroundClick = () => {
    if (selectedId !== null) selectLayer(null);
    else setShowStudioControls(prev => !prev);
  };
  const handleSelectObject = (id: number) => {
    selectLayer(id);
    setShowStudioControls(true);
  };

  if (isLoading) {
    return <div style={{height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'#666'}}>Loading...</div>;
  }

  return (
    <div className="app-container">
      
      {/* --- Left: Control Panel --- */}
      <div className="col-factory">
        
        {!isEditing ? (
            /* GACHA MODE */
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', textAlign: 'center' }}>
                
                <button 
                    type="button" 
                    onClick={roll} 
                    className="btn-action" 
                    style={{ 
                        width: '100%', height: 72, fontSize: '1.4rem', 
                        background: 'linear-gradient(135deg, var(--accent-color), #00d2ff)',
                        color: '#000', border: 'none',
                        boxShadow: '0 8px 24px rgba(0,255,157, 0.25)',
                        marginBottom: 16
                    }}
                >
                    <Zap size={24} fill="#000" /> ROLL
                </button>

                <div style={{display:'flex', gap: 12, marginBottom: 16, width: '100%', justifyContent:'center'}}>
                    {/* Undo / Redo Buttons */}
                    <button 
                        type="button"
                        onClick={undo}
                        disabled={past.length === 0}
                        className="icon-btn" 
                        style={{ color: past.length===0?'#333':'#fff', padding: '6px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: 20 }}
                        title="Undo (Ctrl+Z)"
                    >
                        <Undo2 size={16} />
                    </button>
                    <button 
                        type="button"
                        onClick={redo}
                        disabled={future.length === 0}
                        className="icon-btn" 
                        style={{ color: future.length===0?'#333':'#fff', padding: '6px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: 20 }}
                        title="Redo (Ctrl+Shift+Z)"
                    >
                        <Redo2 size={16} />
                    </button>

                    <div style={{width: 1, height: 20, background: '#333', margin: '4px 8px'}}></div>

                    <button 
                        type="button"
                        onClick={() => setShowInfo(!showInfo)} 
                        className="icon-btn" 
                        style={{ color: '#555', padding: '6px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: 20 }}
                        title="Toggle Info"
                    >
                        {showInfo ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    
                    <button 
                        type="button"
                        onClick={handleShare} 
                        className="icon-btn" 
                        style={{ color: 'var(--accent-color)', padding: '6px 14px', background: 'rgba(0,255,157,0.1)', borderRadius: 20, border: '1px solid rgba(0,255,157,0.3)' }}
                        title="Share URL"
                    >
                        <Share2 size={16} />
                    </button>
                </div>

                {showInfo && (
                    <div className="animate-fade-in" style={{ width: '100%', opacity: 0.8 }}>
                        <h1 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff', marginBottom: 4, letterSpacing: -1, marginTop: 0 }}>KIRAMANY<span style={{color:'var(--accent-color)'}}>2</span></h1>
                        <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: 24 }}>The Icon Gacha</p>
                        
                        <div style={{ width: '100%', marginBottom: 20, padding: 12, border: '1px solid #333', borderRadius: 8, background: 'rgba(0,0,0,0.3)' }}>
                            <div style={{fontSize:'0.7rem', color:'#888', marginBottom: 6, textTransform:'uppercase', letterSpacing:1}}>Current Palette</div>
                            <div style={{fontSize:'1.1rem', fontWeight:'bold', color: 'var(--accent-color)'}}>{paletteName}</div>
                        </div>
                    </div>
                )}
            </div>
        ) : (
            /* EDIT MODE */
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 20, paddingBottom: 10, borderBottom:'1px solid #333' }}>
                    <h3 className="panel-header" style={{margin:0, color:'#fff', display:'flex', alignItems:'center', gap: 8}}>
                        <Sliders size={16} /> Edit Layer
                    </h3>
                    <button type="button" onClick={() => selectLayer(null)} className="icon-btn" title="Close Edit">
                        <X size={18} />
                    </button>
                </div>

                <div className="tuning-scroll" style={{ flex: 1 }}>
                    {selectedLayer2D ? (
                        <Controls2D params={selectedLayer2D} onChange={(p) => updateLayer2D(selectedLayer2D.id, p)} />
                    ) : selectedLayer3D ? (
                        <Controls3D params={selectedLayer3D} onChange={(p) => updateLayer3D(selectedLayer3D.id, p)} />
                    ) : null}
                </div>
                
                <button type="button" onClick={() => selectLayer(null)} className="btn-action" style={{marginTop: 20, background: '#333', color:'#888'}}>
                    <ArrowLeft size={16} /> Back to Roll
                </button>
            </div>
        )}

      </div>

      {/* --- Center: Studio (Same) --- */}
      <div className="col-studio" onClick={handleBackgroundClick}>
        
        <div className="studio-scale-wrapper" onClick={(e) => e.stopPropagation()}>
          <div 
            id="studio-export-area" 
            className="studio-canvas-real-size" 
            style={{ 
                backgroundColor: isTransparent ? 'transparent' : bgColor,
                backgroundImage: isTransparent ? 'linear-gradient(45deg, #222 25%, transparent 25%), linear-gradient(-45deg, #222 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #222 75%), linear-gradient(-45deg, transparent 75%, #222 75%)' : 'none',
                backgroundSize: '40px 40px',
                backgroundPosition: '0 0, 0 20px, 20px -20px, -20px 0px',
                transition: 'background-color 0.3s'
            }}
          >
             <div style={{position:'absolute', inset:0, zIndex:0}}>
               {layers2D.map((layer) => <Layer2D key={layer.id} params={layer} size={1024} />)}
             </div>

             <div style={{position:'absolute', inset:0, zIndex:10}}>
               <Canvas 
                  dpr={1024 / 500} 
                  camera={{ position: [0, 0, 3.5] }} 
                  gl={{ preserveDrawingBuffer: true, alpha: true }}
                  onPointerMissed={handleBackgroundClick}
                  style={{ width: '100%', height: '100%' }}
               >
                  <GeneratedEnvironment />
                  <ambientLight intensity={0.2} />
                  <directionalLight position={[5, 10, 7.5]} intensity={3} />
                  <pointLight position={[5, 5, 5]} />
                  <pointLight position={[-5, -5, 5]} color="#ff00ff" />
                  {layers3D.map((layer) => (
                       <Object3D key={layer.id} params={layer} isSelected={selectedId === layer.id} onSelect={() => handleSelectObject(layer.id)} />
                  ))}
                  <OrbitControls makeDefault enableRotate={false} />
               </Canvas>
             </div>
          </div>
        </div>

        <div className="studio-footer" onClick={(e) => e.stopPropagation()}
          style={{ opacity: showStudioControls ? 1 : 0, pointerEvents: showStudioControls ? 'auto' : 'none', transition: 'opacity 0.2s', visibility: showStudioControls ? 'visible' : 'hidden' }}
        >
          <div className="toolbar-group">
            <button type="button" className={`icon-btn ${transformMode==='translate' ? 'active' : ''}`} onClick={() => setTransformMode('translate')} title="Move"><Move size={18} /></button>
            <button type="button" className={`icon-btn ${transformMode==='rotate' ? 'active' : ''}`} onClick={() => setTransformMode('rotate')} title="Rotate"><RotateCw size={18} /></button>
            <button type="button" className={`icon-btn ${transformMode==='scale' ? 'active' : ''}`} onClick={() => setTransformMode('scale')} title="Scale"><Scaling size={18} /></button>
          </div>
          <div className="toolbar-group">
            <div className="color-picker-wrapper">
                <Palette size={16} color="#888" />
                <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} disabled={isTransparent} />
            </div>
            <label className="toggle-label"><input type="checkbox" checked={isTransparent} onChange={(e) => setIsTransparent(e.target.checked)} /><span className="toggle-text">Transparent</span></label>
          </div>
          <button type="button" onClick={() => downloadImage('studio-export-area', bgColor, isTransparent)} className="btn-dl"><Download size={16} /> SAVE ICON</button>
        </div>
      </div>

      {/* --- Right: Layers (Same) --- */}
      <div className="col-layers">
        <h2 className="section-title"><Layers size={14}/> Composition</h2>
        <div className="layer-group">
           {layers3D.map((l) => (
               <div key={l.id} className={`layer-item ${selectedId === l.id ? 'selected' : ''}`} onClick={(e) => { e.stopPropagation(); handleSelectObject(l.id); }}>
                   <div className="layer-thumb" style={{background: l.color}}></div>
                   <div className="layer-info"><span className="layer-name">3D Object</span></div>
                   <button type="button" className="icon-btn active" style={{fontSize:10}} onClick={(e) => {e.stopPropagation(); handleSelectObject(l.id)}}>EDIT</button>
               </div>
           ))}
           {layers2D.map((l) => (
               <div key={l.id} className={`layer-item ${selectedId === l.id ? 'selected' : ''}`} onClick={(e) => { e.stopPropagation(); handleSelectObject(l.id); }}>
                   <div className="layer-thumb" style={{background: l.colorHex || '#fff'}}></div>
                   <div className="layer-info"><span className="layer-name">2D Backdrop</span></div>
                   <button type="button" className="icon-btn active" style={{fontSize:10}} onClick={(e) => {e.stopPropagation(); handleSelectObject(l.id)}}>EDIT</button>
               </div>
           ))}
        </div>
      </div>
    </div>
  )
}

export default App