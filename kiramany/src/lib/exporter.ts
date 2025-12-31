
import { getSuperformulaPoint } from './math';
import type { Params2D } from './math'; // ★修正: 型としてインポート

export const downloadSVG = (
  layers2D: Params2D[],
  bgColor: string,
  isTransparent: boolean,
  canvas3DId: string
) => {
  const size = 1024;

  // 1. 3Dキャンバスの画像をBase64で取得
  let bgImage = '';
  try {
    const canvas = document.querySelector(`#${canvas3DId} canvas`) as HTMLCanvasElement;
    if (canvas) {
      bgImage = canvas.toDataURL('image/png');
    }
  } catch (e) {
    console.error('Failed to capture 3D canvas', e);
  }

  // 2. 2DレイヤーをSVGパス文字列に変換
  const paths = layers2D.map((layer) => {
    if (!layer.visible) return '';

    const steps = 360; 
    let d = '';
    
    const cosR = Math.cos(layer.rotation);
    const sinR = Math.sin(layer.rotation);
    const center = size / 2;
    const [tx, ty] = layer.position || [0, 0];

    for (let i = 0; i <= steps; i++) {
      const phi = (2 * Math.PI * i) / steps;
      const p = getSuperformulaPoint(phi, layer);
      
      const rx = p.x * cosR - p.y * sinR;
      const ry = p.x * sinR + p.y * cosR;

      const x = center + rx + tx;
      const y = center + ry + ty;

      if (i === 0) d += `M ${x.toFixed(2)} ${y.toFixed(2)}`;
      else d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    d += ' Z';

    const strokeColor = `hsl(${layer.hue}, ${layer.sat}%, ${layer.bri}%)`;
    const fillColor = layer.isFilled ? `hsl(${layer.hue}, ${layer.sat}%, ${layer.bri}%, 0.5)` : 'none';
    
    return `<path 
      d="${d}" 
      stroke="${strokeColor}" 
      stroke-width="${Math.max(1, layer.lineWidth)}" 
      fill="${fillColor}" 
      stroke-linecap="round" 
      stroke-linejoin="round"
      opacity="0.9"
    />`;
  }).join('\n');

  // 3. SVG全体の組み立て
  const bgRect = isTransparent ? '' : `<rect width="100%" height="100%" fill="${bgColor}" />`;
  
  const bgImageTag = bgImage 
    ? `<image href="${bgImage}" x="0" y="0" width="${size}" height="${size}" />` 
    : '';

  const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <style>
      /* 必要に応じてスタイル定義 */
    </style>
  </defs>
  ${bgRect}
  ${bgImageTag}
  <g id="layers-2d">
    ${paths}
  </g>
</svg>
`.trim();

  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `superformula-${Date.now()}.svg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
