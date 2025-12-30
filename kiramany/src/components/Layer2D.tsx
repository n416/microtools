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

    // ★修正: 未使用変数を削除し、描画ロジックのみ残す
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
  }, [params, size, isPreview]);

  return <canvas ref={canvasRef} width={size} height={size} style={{position:'absolute', top:0, left:0, width:'100%', height:'100%', pointerEvents:'none'}} />;
};
