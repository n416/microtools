import { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Lightformer } from '@react-three/drei';
import { useStore } from './store';
import { Layer2D } from './components/Layer2D';
import { Object3D } from './components/Object3D';

import { 
  Download, Zap, Palette, Move, RotateCw, Scaling, Layers, Sliders, X, ArrowLeft
} from 'lucide-react';
import './App.css';
import type { Params2D, Params3D } from './lib/math';

// --- Components: Controls ---

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
    <div className="control-section-title">Transform</div>
    <ControlRow label="Rotate" min={0} max={6.28} value={params.rotation} onChange={(v: number) => onChange({ rotation: v })} />
    <ControlRow label="Scale" min={100} max={1000} step={10} value={params.scale} onChange={(v: number) => onChange({ scale: v })} />
    <ControlRow label="Width" min={1} max={50} value={params.lineWidth} onChange={(v: number) => onChange({ lineWidth: v })} />
    
    <div className="divider" />
    <div className="control-section-title">Style</div>
    <div className="control-row">
        <label>Color</label>
        <input type="color" value={params.colorHex || '#ffffff'} onChange={(e) => onChange({ colorHex: e.target.value })} />
    </div>
    <div className="control-row">
        <label>Fill</label>
        <input type="checkbox" checked={params.isFilled} onChange={(e) => onChange({ isFilled: e.target.checked })} />
    </div>
  </div>
);

const Controls3D = ({ params, onChange }: { params: Params3D, onChange: (p: Partial<Params3D>) => void }) => (
  <div className="controls-container animate-fade-in">
    <div className="control-section-title">Material</div>
    <div className="control-row">
        <label>Type</label>
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
        </select>
    </div>
    <div className="control-row">
        <label>Color</label>
        <input type="color" value={params.color} onChange={(e) => onChange({ color: e.target.value })} />
    </div>
    
    <div className="divider" />
    <div className="control-section-title">Geometry</div>
    <ControlRow label="Scale" min={0.1} max={3} value={params.scale} onChange={(v: number) => onChange({ scale: v })} />
    <ControlRow label="M1" min={0} max={20} step={1} value={params.m1} onChange={(v: number) => onChange({ m1: v })} />
    <ControlRow label="M2" min={0} max={20} step={1} value={params.m2} onChange={(v: number) => onChange({ m2: v })} />
    <ControlRow label="N1" min={0.1} max={20} value={params.n1} onChange={(v: number) => onChange({ n1: v })} />
    <ControlRow label="N2" min={0.1} max={20} value={params.n2} onChange={(v: number) => onChange({ n2: v })} />
    <ControlRow label="N3" min={0.1} max={20} value={params.n3} onChange={(v: number) => onChange({ n3: v })} />
  </div>
);

// --- Components: Environment & Utils ---

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
    roll,
    layers2D, layers3D, 
    bgColor, setBgColor,
    isTransparent, setIsTransparent,
    selectedId, selectLayer,
    transformMode, setTransformMode,
    paletteName,
    updateLayer2D, updateLayer3D
  } = useStore();

  const selectedLayer2D = layers2D.find(l => l.id === selectedId);
  const selectedLayer3D = layers3D.find(l => l.id === selectedId);
  const isEditing = !!(selectedLayer2D || selectedLayer3D);

  // Space key to Roll (only if not editing)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space' && !isEditing) {
            e.preventDefault();
            roll();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [roll, isEditing]);

  return (
    <div className="app-container">
      
      {/* --- Left: Control Panel (Switchable) --- */}
      <div className="col-factory">
        
        {!isEditing ? (
            /* GACHA MODE */
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff', marginBottom: 4, letterSpacing: -1 }}>KIRAMANY<span style={{color:'var(--accent-color)'}}>2</span></h1>
                <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: 40 }}>The Icon Gacha</p>
                
                <div style={{ width: '100%', marginBottom: 40 }}>
                    <div style={{fontSize:'0.75rem', color:'#888', marginBottom: 8, textTransform:'uppercase', letterSpacing:1}}>Current Palette</div>
                    <div style={{fontSize:'1.2rem', fontWeight:'bold', color: 'var(--accent-color)'}}>{paletteName}</div>
                </div>

                <button 
                    onClick={roll} 
                    className="btn-action" 
                    style={{ 
                        width: '100%', height: 80, fontSize: '1.5rem', 
                        background: 'linear-gradient(135deg, var(--accent-color), #00d2ff)',
                        color: '#000', border: 'none',
                        boxShadow: '0 10px 30px rgba(0,255,157, 0.3)'
                    }}
                >
                    <Zap size={24} fill="#000" /> ROLL
                </button>
                <p style={{fontSize:'0.7rem', color:'#555', marginTop: 12}}>Press SPACE to reroll</p>
                <p style={{fontSize:'0.7rem', color:'#444', marginTop: 40}}>Click objects to Edit</p>
            </div>
        ) : (
            /* EDIT MODE */
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 20, paddingBottom: 10, borderBottom:'1px solid #333' }}>
                    <h3 className="panel-header" style={{margin:0, color:'#fff', display:'flex', alignItems:'center', gap: 8}}>
                        <Sliders size={16} /> Edit Layer
                    </h3>
                    <button onClick={() => selectLayer(null)} className="icon-btn" title="Close Edit">
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
                
                <button onClick={() => selectLayer(null)} className="btn-action" style={{marginTop: 20, background: '#333', color:'#888'}}>
                    <ArrowLeft size={16} /> Back to Roll
                </button>
            </div>
        )}

      </div>

      {/* --- Center: Studio --- */}
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
                  onPointerMissed={() => selectLayer(null)}
                  style={{ width: '100%', height: '100%' }}
               >
                  <GeneratedEnvironment />
                  <ambientLight intensity={0.2} />
                  <directionalLight position={[5, 10, 7.5]} intensity={3} />
                  <pointLight position={[5, 5, 5]} />
                  <pointLight position={[-5, -5, 5]} color="#ff00ff" />
                  
                  {layers3D.map((layer) => (
                       <Object3D 
                          key={layer.id} 
                          params={layer} 
                          isSelected={selectedId === layer.id} 
                          onSelect={() => selectLayer(layer.id)} 
                       />
                  ))}
                  
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
          </div>
          <div className="toolbar-group">
            <div className="color-picker-wrapper">
                <Palette size={16} color="#888" />
                <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} disabled={isTransparent} />
            </div>
            <label className="toggle-label">
                <input type="checkbox" checked={isTransparent} onChange={(e) => setIsTransparent(e.target.checked)} />
                <span className="toggle-text">Transparent</span>
            </label>
          </div>
          <button onClick={() => downloadImage('studio-export-area', bgColor, isTransparent)} className="btn-dl">
            <Download size={16} /> SAVE ICON
          </button>
        </div>
      </div>

      {/* --- Right: Composition Layers --- */}
      <div className="col-layers">
        <h2 className="section-title"><Layers size={14}/> Composition</h2>
        <div className="layer-group">
           {layers3D.map((l) => (
               <div key={l.id} className={`layer-item ${selectedId === l.id ? 'selected' : ''}`} onClick={(e) => { e.stopPropagation(); selectLayer(l.id); }}>
                   <div className="layer-thumb" style={{background: l.color}}></div>
                   <div className="layer-info"><span className="layer-name">3D Object</span></div>
                   <button className="icon-btn active" style={{fontSize:10}} onClick={(e) => {e.stopPropagation(); selectLayer(l.id)}}>EDIT</button>
               </div>
           ))}
           {layers2D.map((l) => (
               <div key={l.id} className={`layer-item ${selectedId === l.id ? 'selected' : ''}`} onClick={(e) => { e.stopPropagation(); selectLayer(l.id); }}>
                   <div className="layer-thumb" style={{background: l.colorHex || '#fff'}}></div>
                   <div className="layer-info"><span className="layer-name">2D Backdrop</span></div>
                   <button className="icon-btn active" style={{fontSize:10}} onClick={(e) => {e.stopPropagation(); selectLayer(l.id)}}>EDIT</button>
               </div>
           ))}
        </div>
      </div>
    </div>
  )
}

export default App