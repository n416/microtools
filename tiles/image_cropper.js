/**
 * Geometric Pattern Generator Pro
 * 高機能画像クロッパー (image_cropper.js)
 * パン（ドラッグ）およびズーム（ホイール・ピンチ）に対応した画像トリミング機能を提供します。
 */

class ImageCropper {
  /**
   * @param {HTMLElement} container - クロッパーを描画するコンテナ要素
   * @param {Function} onCrop - トリミングが更新された（操作完了時）のコールバック。引数に DataURL (JPEG) を渡す。
   */
  constructor(container, onCrop) {
    this.container = container;
    this.onCrop = onCrop;

    // コンテナのスタイル設定
    this.container.style.position = 'relative';
    this.container.style.overflow = 'hidden';
    this.container.style.userSelect = 'none';
    this.container.style.touchAction = 'none'; // ブラウザのデフォルトのスクロールやズームを無効化

    // 描画用キャンバス
    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);

    // 状態
    this.image = null;
    this.targetAspectRatio = 1.0;

    // 変形パラメータ
    this.scale = 1.0;
    this.minScale = 1.0;
    this.offsetX = 0;
    this.offsetY = 0;

    // イベント制御用
    this.pointers = new Map(); // アクティブなポインター (id -> {x, y})
    this.isDragging = false;
    this.lastPinchDistance = null;
    this.lastPinchCenter = null;

    // イベントのバインド
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
    this.handleResize = this.handleResize.bind(this);

    this.attachEvents();
  }

  attachEvents() {
    this.container.addEventListener('pointerdown', this.handlePointerDown);
    this.container.addEventListener('pointermove', this.handlePointerMove);
    this.container.addEventListener('pointerup', this.handlePointerUp);
    this.container.addEventListener('pointercancel', this.handlePointerUp);
    this.container.addEventListener('pointerleave', this.handlePointerUp);
    this.container.addEventListener('wheel', this.handleWheel, { passive: false });
    window.addEventListener('resize', this.handleResize);
  }

  destroy() {
    this.container.removeEventListener('pointerdown', this.handlePointerDown);
    this.container.removeEventListener('pointermove', this.handlePointerMove);
    this.container.removeEventListener('pointerup', this.handlePointerUp);
    this.container.removeEventListener('pointercancel', this.handlePointerUp);
    this.container.removeEventListener('pointerleave', this.handlePointerUp);
    this.container.removeEventListener('wheel', this.handleWheel);
    window.removeEventListener('resize', this.handleResize);
    this.container.innerHTML = '';
  }

  /**
   * 画像と目標アスペクト比を設定して初期化する
   * @param {string} imageUrl - 画像のURL (DataURL等)
   * @param {number} aspectRatio - グリッドのアスペクト比 (cols / rows)
   */
  setImage(imageUrl, aspectRatio) {
    this.targetAspectRatio = aspectRatio;
    this.updateContainerSize();

    if (!imageUrl) {
      this.image = null;
      this.clearCanvas();
      return;
    }

    const img = new Image();
    img.onload = () => {
      this.image = img;
      this.initTransform();
      this.draw();
      this.emitCrop();
    };
    img.src = imageUrl;
  }

  /**
   * コンテナ自体のサイズをアスペクト比に合わせて更新する
   */
  updateContainerSize() {
    // 親要素が .preview-square-container 等で領域を制限している場合、
    // 内接するように自身 (this.container) のサイズを計算する
    const parent = this.container.parentElement;
    if (parent && parent.classList.contains('preview-square-container')) {
      const pw = parent.clientWidth;
      const ph = parent.clientHeight;
      if (pw > 0 && ph > 0) {
        if (this.targetAspectRatio >= 1) { // Landscape or Square
          let w = pw;
          let h = pw / this.targetAspectRatio;
          // はみ出る場合は枠に合わせる
          if (h > ph) {
            h = ph;
            w = ph * this.targetAspectRatio;
          }
          this.container.style.width = w + 'px';
          this.container.style.height = h + 'px';
        } else { // Portrait
          let h = ph;
          let w = ph * this.targetAspectRatio;
          // はみ出る場合は枠に合わせる
          if (w > pw) {
            w = pw;
            h = pw / this.targetAspectRatio;
          }
          this.container.style.width = w + 'px';
          this.container.style.height = h + 'px';
        }
        this.container.style.aspectRatio = 'unset'; // CSSのaspect-ratioへの依存を解除
        return;
      }
    }
    this.container.style.aspectRatio = this.targetAspectRatio.toString();
  }

  /**
   * キャンバスのサイズをコンテナに合わせる
   */
  handleResize() {
    this.updateContainerSize();
    if (!this.image) return;
    const rect = this.container.getBoundingClientRect();
    if (this.canvas.width !== Math.round(rect.width) || this.canvas.height !== Math.round(rect.height)) {
      this.initTransform(); // サイズが変わったらリセット
      this.draw();
      this.emitCrop();
    }
  }

  clearCanvas() {
    this.canvas.width = this.container.clientWidth;
    this.canvas.height = this.container.clientHeight;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * 画像が枠に収まる最小スケール（Cover制約）を計算し、初期状態を中央にセットする
   */
  initTransform() {
    const rect = this.container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    this.canvas.width = rect.width;
    this.canvas.height = rect.height;

    // 画像がコンテナを完全に覆う (object-fit: cover 相当) 最小のスケールを計算
    const scaleX = this.canvas.width / this.image.width;
    const scaleY = this.canvas.height / this.image.height;
    this.minScale = Math.max(scaleX, scaleY);

    // 初期スケールは最小スケール
    this.scale = this.minScale;

    // 中央に配置
    this.offsetX = (this.canvas.width - this.image.width * this.scale) / 2;
    this.offsetY = (this.canvas.height - this.image.height * this.scale) / 2;
  }

  /**
   * 余白ができないように scale と offset を制限（Clamp）する
   */
  clampTransform() {
    if (!this.image) return;

    // スケールの制約
    if (this.scale < this.minScale) {
      this.scale = this.minScale;
    }
    // 最大スケールは適当に制限（例えば最小の5倍）
    const maxScale = Math.max(this.minScale * 5, 2.0);
    if (this.scale > maxScale) {
      this.scale = maxScale;
    }

    // オフセットの制約 (画像がキャンバスの枠より内側に入らないようにする)
    const imgDrawWidth = this.image.width * this.scale;
    const imgDrawHeight = this.image.height * this.scale;

    // X軸の制約
    if (imgDrawWidth <= this.canvas.width) {
      this.offsetX = (this.canvas.width - imgDrawWidth) / 2;
    } else {
      if (this.offsetX > 0) this.offsetX = 0;
      if (this.offsetX < this.canvas.width - imgDrawWidth) {
        this.offsetX = this.canvas.width - imgDrawWidth;
      }
    }

    // Y軸の制約
    if (imgDrawHeight <= this.canvas.height) {
      this.offsetY = (this.canvas.height - imgDrawHeight) / 2;
    } else {
      if (this.offsetY > 0) this.offsetY = 0;
      if (this.offsetY < this.canvas.height - imgDrawHeight) {
        this.offsetY = this.canvas.height - imgDrawHeight;
      }
    }
  }

  /**
   * 現在の変換パラメータで描画する
   */
  draw() {
    if (!this.image) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(
      this.image,
      0, 0, this.image.width, this.image.height,
      this.offsetX, this.offsetY, this.image.width * this.scale, this.image.height * this.scale
    );
  }

  // ---------- イベントハンドラ ----------

  handlePointerDown(e) {
    if (!this.image) return;
    this.container.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.pointers.size === 1) {
      this.isDragging = true;
    } else if (this.pointers.size === 2) {
      this.isDragging = false;
      this.initPinch();
    }
  }

  handlePointerMove(e) {
    if (!this.image || !this.pointers.has(e.pointerId)) return;

    // ポインターの位置を更新
    const prevPos = this.pointers.get(e.pointerId);
    const currPos = { x: e.clientX, y: e.clientY };
    this.pointers.set(e.pointerId, currPos);

    if (this.pointers.size === 1 && this.isDragging) {
      // 1本指パン（ドラッグ）
      const dx = currPos.x - prevPos.x;
      const dy = currPos.y - prevPos.y;

      this.offsetX += dx;
      this.offsetY += dy;

      this.clampTransform();
      this.draw();
    } else if (this.pointers.size === 2) {
      // 2本指ピンチズーム＆パン
      const pts = Array.from(this.pointers.values());
      const p1 = pts[0];
      const p2 = pts[1];

      const currentDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const currentCenter = {
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2
      };

      if (this.lastPinchDistance !== null && this.lastPinchCenter !== null) {
        // スケールの変動
        const scaleDiff = currentDistance / this.lastPinchDistance;
        const newScale = this.scale * scaleDiff;

        // ピンチ中心座標（コンテナ相対）
        const rect = this.container.getBoundingClientRect();
        const centerX = currentCenter.x - rect.left;
        const centerY = currentCenter.y - rect.top;

        this.applyZoom(newScale, centerX, centerY);

        // パンの変動 (2本指の重心移動)
        const dx = currentCenter.x - this.lastPinchCenter.x;
        const dy = currentCenter.y - this.lastPinchCenter.y;
        this.offsetX += dx;
        this.offsetY += dy;

        this.clampTransform();
        this.draw();
      }

      this.lastPinchDistance = currentDistance;
      this.lastPinchCenter = currentCenter;
    }
  }

  handlePointerUp(e) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);

    if (this.pointers.size < 2) {
      this.lastPinchDistance = null;
      this.lastPinchCenter = null;
    }

    if (this.pointers.size === 1) {
      this.isDragging = true; // 2本指から1本指に戻った場合はドラッグ再開
    } else if (this.pointers.size === 0) {
      this.isDragging = false;
      // 操作が完了した時点でトリミング結果を出力
      if (this.image) {
        this.emitCrop();
      }
    }
  }

  initPinch() {
    const pts = Array.from(this.pointers.values());
    this.lastPinchDistance = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    this.lastPinchCenter = {
      x: (pts[0].x + pts[1].x) / 2,
      y: (pts[0].y + pts[1].y) / 2
    };
  }

  handleWheel(e) {
    if (!this.image) return;
    e.preventDefault(); // デフォルトのスクロールを防止

    const rect = this.container.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    // スクロール量に応じたズーム係数 (0.1%刻みなど)
    const zoomFactor = -e.deltaY > 0 ? 1.05 : 0.95;
    const newScale = this.scale * zoomFactor;

    this.applyZoom(newScale, cursorX, cursorY);
    this.clampTransform();
    this.draw();

    // ホイール操作は連続するため、完了検知にデバウンスを入れるか、
    // シンプルに毎回トリミングを出力する (今回は簡略化のため毎回出力)
    clearTimeout(this.wheelTimeout);
    this.wheelTimeout = setTimeout(() => {
      this.emitCrop();
    }, 200);
  }

  /**
   * 特定の点を中心にズームを適用する
   */
  applyZoom(newScale, centerX, centerY) {
    // ズーム前の中央点に対する画像のローカル座標
    const localX = (centerX - this.offsetX) / this.scale;
    const localY = (centerY - this.offsetY) / this.scale;

    this.scale = newScale;

    // ズーム後のオフセットを計算 (ローカル座標が同じ画面位置になるように逆算)
    this.offsetX = centerX - localX * this.scale;
    this.offsetY = centerY - localY * this.scale;
  }

  /**
   * 現在の表示状態を元に、トリミングされた画像データを生成してコールバックを呼ぶ
   */
  emitCrop() {
    if (!this.image || !this.onCrop) return;

    // 出力用キャンバス（解像度を高めるため、表示キャンバスのサイズに依存させず、
    // ある程度基準となる解像度（例えば長辺1000px等）で作成するか、
    // 今回はビューポートのサイズを出力サイズとして使用する）
    const targetWidth = this.canvas.width;
    const targetHeight = this.canvas.height;

    // プレビューコンテナのサイズが小さすぎる場合は、最低解像度を確保する
    const renderScale = Math.max(1.0, 800 / Math.max(targetWidth, targetHeight));

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = targetWidth * renderScale;
    outputCanvas.height = targetHeight * renderScale;
    const ctx = outputCanvas.getContext('2d');

    ctx.drawImage(
      this.image,
      0, 0, this.image.width, this.image.height,
      this.offsetX * renderScale, this.offsetY * renderScale,
      this.image.width * this.scale * renderScale, this.image.height * this.scale * renderScale
    );

    const dataUrl = outputCanvas.toDataURL('image/jpeg', 0.85);
    this.onCrop(dataUrl);
  }
}

// グローバルに露出
window.ImageCropper = ImageCropper;
