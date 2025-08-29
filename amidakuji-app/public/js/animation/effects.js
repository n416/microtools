// パーティクルや紙吹雪などの視覚効果に関するロジック
import {animator} from './core.js';

export class Particle {
  constructor(x, y, color, type = 'trail') {
    this.x = x;
    this.y = y;
    this.color = color;
    this.type = type;
    this.size = Math.random() * 2 + 1;
    this.alpha = 1;
    if (type === 'spark') {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 1;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.life = 30;
    } else {
      this.vx = (Math.random() - 0.5) * 0.5;
      this.vy = (Math.random() - 0.5) * 0.5;
      this.life = 50;
    }
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
    if (this.life < 20) {
      this.alpha = this.life / 20;
    }
  }
  draw(ctx) {
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

export function createSparks(x, y, color) {
  for (let i = 0; i < 20; i++) {
    animator.particles.push(new Particle(x, y, color, 'spark'));
  }
}

export function celebrate(originX, color) {
  const container = animator.context.canvas.closest('.canvas-panzoom-container');
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const x = (rect.left + originX) / window.innerWidth;
  // confetti({particleCount: 100, spread: 70, origin: {x: x, y: 0.8}, colors: [color, '#ffffff']});
}