
export interface DirectorTerm {
  id: string;
  label: string;
  description: string;
}

// 🎥 Camera Work: Movement
export const CAMERA_MOVEMENTS: DirectorTerm[] = [
  { 
    id: 'FIX', 
    label: 'FIX (固定)', 
    description: 'カメラを固定して撮影する手法。被写体を動かさずにその場で撮影する。' 
  },
  { 
    id: 'ZOOM_IN', 
    label: 'ZOOM IN', 
    description: 'レンズの焦点を変えて被写体に近づく（心理的な注目・緊張感）。' 
  },
  { 
    id: 'ZOOM_OUT', 
    label: 'ZOOM OUT', 
    description: 'レンズの焦点を変えて被写体から離れる（状況説明・開放感）。' 
  },
  { 
    id: 'PAN', 
    label: 'PAN (左右)', 
    description: 'カメラを水平（左右）に振る技法。視線の移動や広がりを表現。' 
  },
  { 
    id: 'TILT', 
    label: 'TILT (上下)', 
    description: 'カメラを垂直（上下）に振る技法。高さや被写体の全身を表現。' 
  },
  { 
    id: 'DOLLY_IN', 
    label: 'DOLLY IN', 
    description: '台車等でカメラごと被写体に近づく。背景の遠近感が変化し、没入感を生む。' 
  },
  { 
    id: 'DOLLY_OUT', 
    label: 'DOLLY OUT', 
    description: '台車等でカメラごと被写体から遠ざかる。孤立感や終焉を演出。' 
  },
  { 
    id: 'TRACKING', 
    label: 'TRACKING (追尾)', 
    description: '被写体の動きに合わせて並行移動する。歩行シーンなどで多用される。' 
  },
  { 
    id: 'ARC', 
    label: 'ARC (回り込み)', 
    description: '被写体の周囲を円を描くように回り込む。状況の劇的な変化や混乱を表現。' 
  },
  { 
    id: 'CRANE', 
    label: 'CRANE', 
    description: '高い位置から低い位置へ（またはその逆に）大きく移動させるダイナミックな撮影。' 
  },
  { 
    id: 'HANDHELD', 
    label: 'HANDHELD', 
    description: '手持ち撮影。手ブレによるリアリティや臨場感、不安定な心情を強調。' 
  },
  { 
    id: 'STEADICAM', 
    label: 'STEADICAM', 
    description: '手持ちだが揺れを抑え、滑らかに移動する。浮遊感のある長回しなどに適する。' 
  },
];

// 🎥 Camera Work: Shot Size
export const SHOT_SIZES: DirectorTerm[] = [
  { 
    id: 'EXTREME_CLOSE_UP', 
    label: 'Extreme Close-Up', 
    description: '目元や指先など細部の強調。強い感情や重要な手がかりを示す。' 
  },
  { 
    id: 'CLOSE_UP', 
    label: 'Close-Up', 
    description: '顔や小物を画面いっぱいに映す。キャラクターの感情を明確に伝える。' 
  },
  { 
    id: 'MEDIUM_SHOT', 
    label: 'Medium Shot', 
    description: '腰から上。人物の表情とアクション、周囲の環境をバランスよく捉える。' 
  },
  { 
    id: 'WIDE_SHOT', 
    label: 'Wide Shot', 
    description: '全身や風景。位置関係や状況全体を説明する際に使用。' 
  },
];

// 🎥 Camera Work: Angle & Composition
export const ANGLES: DirectorTerm[] = [
  { 
    id: 'EYE_LEVEL', 
    label: 'Eye Level', 
    description: '通常の視点。客観的でフラットな印象を与える。' 
  },
  { 
    id: 'LOW_ANGLE', 
    label: 'Low Angle', 
    description: '下から見上げる。被写体の威厳、力強さ、あるいは恐怖感を強調する。' 
  },
  { 
    id: 'HIGH_ANGLE', 
    label: 'High Angle', 
    description: '上から見下ろす。被写体の弱さ、孤独、あるいは状況の俯瞰を表す。' 
  },
  { 
    id: 'OVER_THE_SHOULDER', 
    label: 'Over The Shoulder', 
    description: '一方の肩越しにもう一方を撮影する。対話シーンの基本アングル。' 
  },
  { 
    id: 'POV', 
    label: 'POV (主観)', 
    description: '被写体の視点から見た映像。キャラクター体験への強い没入感を生む。' 
  },
];

// 🎥 Camera Work: Focus
export const FOCUS_TYPES: DirectorTerm[] = [
  { 
    id: 'RACK_FOCUS', 
    label: 'Rack Focus', 
    description: '撮影中にピント位置を変える。視線をAからBへ意図的に誘導する。' 
  },
  { 
    id: 'DEEP_FOCUS', 
    label: 'Deep Focus', 
    description: '手前から奥まで全ての要素にピントを合わせる。画面全体の情報を等価に見せる。' 
  },
  {
    id: 'SHALLOW_FOCUS',
    label: 'Shallow Focus',
    description: '背景をぼかし、被写体だけを強調する（ボケ味）。'
  }
];

// 🎭 Acting & Emotion
export const EMOTIONS: DirectorTerm[] = [
  { id: 'Happy', label: 'Happy/Joy', description: '笑顔、喜び、明るい雰囲気' },
  { id: 'Sad', label: 'Sad/Crying', description: '悲しみ、涙、憂鬱' },
  { id: 'Angry', label: 'Angry', description: '怒り、激昂、敵意' },
  { id: 'Surprised', label: 'Surprised', description: '驚き、衝撃' },
  { id: 'Scared', label: 'Scared/Fear', description: '恐怖、怯え' },
  { id: 'Serious', label: 'Serious', description: '真剣、シリアス' },
];

// ⏰ Time & Atmosphere
export const LIGHTING_TYPES: DirectorTerm[] = [
  { id: 'Natural', label: 'Natural Light', description: '自然光。リアリティのある日常的な光。' },
  { id: 'Cinematic', label: 'Cinematic', description: '映画的でドラマチックな陰影のある照明。' },
  { id: 'GoldenHour', label: 'Golden Hour', description: '夕暮れや夜明けの温かく美しい光。' },
  { id: 'Neon', label: 'Neon/Cyberpunk', description: 'ネオンサインなど人工的な光。近未来的。' },
  { id: 'Dark', label: 'Dark/Horror', description: '暗闇、ローキー照明。恐怖や不安を煽る。' },
];
