import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import type { Project, Asset } from '../types';

export type AspectRatio = '9:16' | '16:9' | '4:5' | '5:4';

interface ExportOptions {
  ratio: AspectRatio;
  withText: boolean;
  mode: 'zip' | 'single';
}

// 解像度定義 (短辺1080px基準)
const DIMENSIONS = {
  '9:16': { w: 1080, h: 1920 },
  '16:9': { w: 1920, h: 1080 },
  '4:5':  { w: 1080, h: 1350 },
  '5:4':  { w: 1350, h: 1080 },
};

export const generateImages = async (
  project: Project,
  assets: Asset[],
  options: ExportOptions,
  onProgress: (msg: string) => void
) => {
  const { w, h } = DIMENSIONS[options.ratio];
  const getAssetUrl = (id: string | null) => assets.find(a => a.id === id)?.url || '';
  
  // 1. コンテナ作成 (画面外)
  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed', top: '-10000px', left: '-10000px',
    width: `${w}px`, height: `${h}px`,
    backgroundColor: '#000', // 黒背景 (レターボックス用)
    fontFamily: '"Helvetica Neue", Arial, sans-serif'
  });
  document.body.appendChild(container);

  const zip = new JSZip();
  const folder = zip.folder(project.title) || zip;

  // 処理対象のページリスト (Singleモードなら表紙だけ、ZIPなら全部)
  // ※今回はシンプルに「Single=表紙」「Zip=全ページ」としますが、
  // エディタで現在表示中のページを判別するのは設計上複雑になるため、
  // 「Single = 表紙画像」として実装します。
  const targets = options.mode === 'single' 
    ? [{ type: 'cover', data: project.coverAssetId, text: project.title }] 
    : [
        { type: 'cover', data: project.coverAssetId, text: project.title },
        ...project.pages.map(p => ({ type: 'page', data: p.assignedAssetId, text: p.dialogue, num: p.pageNumber }))
      ];

  try {
    for (let i = 0; i < targets.length; i++) {
      const item = targets[i];
      const isCover = item.type === 'cover';
      const label = isCover ? 'cover' : `page_${(item as any).num.toString().padStart(2, '0')}`;
      
      onProgress(`生成中: ${label} (${i + 1}/${targets.length})`);

      const imgUrl = getAssetUrl(item.data);

      // レイアウト構築
      container.innerHTML = `
        <div style="width: 100%; height: 100%; position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden;">
          ${imgUrl 
            ? `<img src="${imgUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />` 
            : '<div style="color: #666; font-size: 40px;">NO IMAGE</div>'
          }

          ${options.withText ? `
            <div style="
              position: absolute; bottom: 10%; left: 50%; transform: translateX(-50%);
              width: 90%; text-align: center;
              text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
            ">
              <p style="
                color: white; font-size: 48px; font-weight: bold; margin: 0; line-height: 1.4;
                background: rgba(0,0,0,0.6); padding: 20px; border-radius: 16px; border: 2px solid rgba(255,255,255,0.3);
                display: inline-block;
              ">
                ${item.text || ''}
              </p>
            </div>
          ` : ''}
        </div>
      `;

      // 画像読み込み待機
      const images = container.querySelectorAll('img');
      await Promise.all(Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
      }));

      // 撮影
      const canvas = await html2canvas(container, {
        scale: 1, // 解像度はコンテナサイズで担保済み
        useCORS: true,
        logging: false,
      });

      // Blob化
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if (!blob) continue;

      if (options.mode === 'single') {
        saveAs(blob, `${project.title}_${label}.jpg`);
      } else {
        folder.file(`${label}.jpg`, blob);
      }
    }

    // ZIP保存
    if (options.mode === 'zip') {
      onProgress('圧縮中...');
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `${project.title}_images.zip`);
    }

  } catch (e) {
    console.error(e);
    alert('画像生成に失敗しました');
  } finally {
    document.body.removeChild(container);
  }
};