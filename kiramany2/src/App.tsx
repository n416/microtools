import { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Lightformer } from '@react-three/drei';
import { useStore } from './store';
import { Layer2D } from './components/Layer2D';
import { Object3D } from './components/Object3D';

import { 
  Download, Zap, Palette, Move, RotateCw, Scaling, Layers
} from 'lucide-react';
import './App.css';

// --- Components ---
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
    paletteName
  } = useStore();

  // Space key to Roll
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
            e.preventDefault();
            roll();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [roll]);

  return (
    <div className="app-container">
      
      {/* --- Left: Control Panel --- */}
      <div className="col-factory" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
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

        <div style={{marginTop: 'auto', width: '100%'}}>
           {/* Minimal layer list could go here if needed */}
        </div>
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

      {/* --- Right: Minimal Layer List --- */}
      <div className="col-layers">
        <h2 className="section-title"><Layers size={14}/> Composition</h2>
        <div className="layer-group">
           {layers3D.map((l) => (
               <div key={l.id} className={`layer-item ${selectedId === l.id ? 'selected' : ''}`} onClick={() => selectLayer(l.id)}>
                   <div className="layer-thumb" style={{background: l.color}}></div>
                   <div className="layer-info"><span className="layer-name">3D Object</span></div>
               </div>
           ))}
           {layers2D.map((l) => (
               <div key={l.id} className={`layer-item ${selectedId === l.id ? 'selected' : ''}`} onClick={() => selectLayer(l.id)}>
                   <div className="layer-thumb" style={{background: l.colorHex || '#fff'}}></div>
                   <div className="layer-info"><span className="layer-name">2D Backdrop</span></div>
               </div>
           ))}
        </div>
        <div style={{padding: 20, color: '#666', fontSize: '0.8rem', fontStyle:'italic', textAlign:'center'}}>
            Click objects in the center to move/rotate.
        </div>
      </div>
    </div>
  )
}

export default App