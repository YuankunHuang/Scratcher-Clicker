import {
    _decorator,
    Camera,
    Canvas,
    Component,
    director,
    EventTouch,
    Node,
    Sprite,
    Texture2D,
    UITransform,
    Vec2,
    Vec3,
} from 'cc';

const { ccclass, property } = _decorator;

/**
 * ScratchRenderer
 *
 * 触摸时直接在 CPU 侧 Uint8Array 写像素，uploadData 到 Texture2D 作为 scratchMaskTex。
 * 不依赖 Camera-to-RT 方案（Cocos 3.x UIStage 不会向 targetTexture 相机提交 2D drawcall）。
 *
 * 场景依赖：
 *   - dirtSprite：挂有 ScratchMaterial 的脏污层 Sprite
 *   - scratchArea：定义触摸有效区域的 UITransform
 */
@ccclass('ScratchRenderer')
export class ScratchRenderer extends Component {
    @property(UITransform) scratchArea: UITransform = null!;
    @property(Sprite)      dirtSprite: Sprite = null!;

    /** 画刷尺寸（设计空间 px） */
    @property brushSize: number = 80;
    /** 插值步长，越小笔迹越密 */
    @property minDistance: number = 10;
    /** 遮罩贴图分辨率（建议 256；越大越精细，CPU 开销越高） */
    @property maskTextureSize: number = 256;
    /** 覆盖率统计网格精度 */
    @property coverageGridSize: number = 128;

    /** 进度回调 [0, 1]，由 Controller 注册 */
    public onProgress: ((ratio: number) => void) | null = null;

    private _isActive = false;

    private _maskTex: Texture2D | null = null;
    private _maskData: Uint8Array = new Uint8Array(0);
    private _maskDirty = false;

    private _mainCam: Camera = null!;

    private readonly _screenPos = new Vec3();
    private readonly _worldPos = new Vec3();
    private readonly _localPos = new Vec3();
    private readonly _currentLocal = new Vec2();
    private readonly _lastPos = new Vec2();
    private _hasLastPos = false;

    private _coverage: Uint8Array = new Uint8Array(0);
    private _coveredCells = 0;

    private _touchTarget: Node | null = null;

    // ─── 生命周期 ────────────────────────────────────────────────────────────

    onLoad() {
        this._resolveCameras();
        this._setupCoverageGrid();
    }

    onEnable() {
        this._setupMask();

        this._touchTarget = this.scratchArea.node;
        this._touchTarget.on(Node.EventType.TOUCH_START,  this._onTouchStart,  this);
        this._touchTarget.on(Node.EventType.TOUCH_MOVE,   this._onTouchMove,   this);
        this._touchTarget.on(Node.EventType.TOUCH_END,    this._onTouchEnd,    this);
        this._touchTarget.on(Node.EventType.TOUCH_CANCEL, this._onTouchCancel, this);

        this.setActive(true); // 默认启用
        this.onProgress?.(0); // 一开始就初始化一下进度
    }

    onDisable() {
        this._touchTarget?.off(Node.EventType.TOUCH_START,  this._onTouchStart,  this);
        this._touchTarget?.off(Node.EventType.TOUCH_MOVE,   this._onTouchMove,   this);
        this._touchTarget?.off(Node.EventType.TOUCH_END,    this._onTouchEnd,    this);
        this._touchTarget?.off(Node.EventType.TOUCH_CANCEL, this._onTouchCancel, this);

        this._releaseMask();
    }

    // ─── 公开接口 ─────────────────────────────────────────────────────────────

    public resetScratch(): void {
        this._maskData.fill(0);
        this._maskTex?.uploadData(this._maskData);
        this._resetLogicState();
        this.onProgress?.(0);
    }

    public setActive(active: boolean): void {
        if (!active) this._hasLastPos = false;
        this._isActive = active;
    }

    // ─── 遮罩 Texture 管理 ───────────────────────────────────────────────────

    private _setupMask() {
        this._releaseMask();

        const size = this.maskTextureSize;
        this._maskData = new Uint8Array(size * size * 4); // RGBA，初始全黑

        const tex = new Texture2D();
        tex.reset({
            width:  size,
            height: size,
            format: Texture2D.PixelFormat.RGBA8888,
            mipmapLevel: 1,
        });
        tex.uploadData(this._maskData);
        this._maskTex = tex;

        // getMaterialInstance 在 onEnable（节点已激活）中调用，RenderData 已初始化。
        const mat = this.dirtSprite.getMaterialInstance(0);
        mat?.setProperty('scratchMaskTex', tex);
    }

    private _releaseMask() {
        this._maskTex?.destroy();
        this._maskTex = null;
        this._maskData = new Uint8Array(0);
    }

    // ─── 像素绘制 ─────────────────────────────────────────────────────────────

    /**
     * 在 scratchArea 局部坐标 (x, y) 处绘制笔刷像素到 _maskData。
     * 使用线性衰减实现软边缘，多次叠加可越擦越白。
     */
    private _paintBrush(x: number, y: number) {
        if (!this._maskTex || !this.scratchArea) return;

        const size   = this.maskTextureSize;
        const halfW  = this.scratchArea.contentSize.width  * 0.5;
        const halfH  = this.scratchArea.contentSize.height * 0.5;

        // 局部坐标 → UV [0, 1]
        const uvX = (x + halfW) / (halfW * 2);
        const uvY = (y + halfH) / (halfH * 2);

        // UV → 像素中心
        const cx = uvX * size;
        const cy = uvY * size;

        // 画刷像素半径（按贴图分辨率缩放）
        const radiusPx = (this.brushSize / (halfW * 2)) * size * 0.5;
        const radiusSq = radiusPx * radiusPx;

        const x0 = Math.max(0,        Math.floor(cx - radiusPx));
        const x1 = Math.min(size - 1, Math.ceil (cx + radiusPx));
        const y0 = Math.max(0,        Math.floor(cy - radiusPx));
        const y1 = Math.min(size - 1, Math.ceil (cy + radiusPx));

        for (let py = y0; py <= y1; py++) {
            const dy = py - cy;
            for (let px = x0; px <= x1; px++) {
                const dx = px - cx;
                const distSq = dx * dx + dy * dy;
                if (distSq > radiusSq) continue;

                const idx = (py * size + px) * 4;
                if (this._maskData[idx] >= 255) continue; // 已完全擦除

                // 线性衰减：边缘渐变
                const t = 1.0 - Math.sqrt(distSq) / radiusPx;
                const newVal = Math.min(255, this._maskData[idx] + Math.floor(t * 255));
                this._maskData[idx] = this._maskData[idx + 1] = this._maskData[idx + 2] = newVal;
                this._maskData[idx + 3] = 255;
                this._maskDirty = true;
            }
        }
    }

    // ─── 输入 & 坐标 ──────────────────────────────────────────────────────────

    private _resolveCameras() {
        let cursor: Node | null = this.scratchArea?.node ?? this.node;
        while (cursor) {
            const canvas = cursor.getComponent(Canvas);
            if (canvas) {
                const cam = (canvas as unknown as { cameraComponent?: Camera }).cameraComponent;
                if (cam) { this._mainCam = cam; return; }
            }
            cursor = cursor.parent;
        }
        const cameras = director.getScene()?.getComponentsInChildren(Camera) ?? [];
        this._mainCam = cameras[0] ?? null!;
    }

    private _screenToLocal(screenPos: Vec2): boolean {
        if (!this._mainCam || !this.scratchArea) return false;
        this._screenPos.set(screenPos.x, screenPos.y, 0);
        this._mainCam.screenToWorld(this._screenPos, this._worldPos);
        this.scratchArea.convertToNodeSpaceAR(this._worldPos, this._localPos);
        this._currentLocal.set(this._localPos.x, this._localPos.y);
        return true;
    }

    private _isOutsideDirtBounds(x: number, y: number): boolean {
        if (!this.scratchArea) return true;
        const halfW = this.scratchArea.contentSize.width  * 0.5;
        const halfH = this.scratchArea.contentSize.height * 0.5;
        const r = this.brushSize * 0.5;
        return x + r < -halfW || x - r > halfW || y + r < -halfH || y - r > halfH;
    }

    private _onTouchStart(e: EventTouch) {
        if (!this._isActive) return;
        this._hasLastPos = false;
        this._onTouchMove(e);
    }

    private _onTouchMove(e: EventTouch) {
        if (!this._isActive) return;
        if (!this._screenToLocal(e.getLocation())) return;

        const applyAt = (x: number, y: number) => {
            if (this._isOutsideDirtBounds(x, y)) return;
            this._paintBrush(x, y);
            const covered = this._markCoverage(x, y);
            this.onProgress?.(Math.min(1, covered / this._coverage.length));
        };

        if (this._hasLastPos) {
            const dx = this._currentLocal.x - this._lastPos.x;
            const dy = this._currentLocal.y - this._lastPos.y;
            const steps = Math.max(1, Math.ceil(Math.sqrt(dx * dx + dy * dy) / Math.max(1, this.minDistance)));
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                applyAt(this._lastPos.x + dx * t, this._lastPos.y + dy * t);
            }
        }

        applyAt(this._currentLocal.x, this._currentLocal.y);
        this._lastPos.set(this._currentLocal.x, this._currentLocal.y);
        this._hasLastPos = true;

        // 每次 touch move 批量写完后统一上传，避免逐笔刷多次上传
        if (this._maskDirty && this._maskTex) {
            this._maskTex.uploadData(this._maskData);
            this._maskDirty = false;
        }
    }

    private _onTouchEnd()    { this._hasLastPos = false; }
    private _onTouchCancel() { this._hasLastPos = false; }

    // ─── 覆盖率 ───────────────────────────────────────────────────────────────

    private _setupCoverageGrid() {
        const size = Math.max(1, Math.floor(this.coverageGridSize));
        this.coverageGridSize = size;
        this._coverage = new Uint8Array(size * size);
        this._coveredCells = 0;
    }

    private _resetLogicState() {
        this._hasLastPos = false;
        this._coveredCells = 0;
        this._coverage.fill(0);
        this.setActive(true);
    }

    private _markCoverage(x: number, y: number): number {
        if (!this.scratchArea || this._coverage.length === 0) return this._coveredCells;

        const grid   = this.coverageGridSize;
        const width  = this.scratchArea.contentSize.width;
        const height = this.scratchArea.contentSize.height;
        const halfW  = width  * 0.5;
        const halfH  = height * 0.5;
        const radius = this.brushSize * 0.5;
        const rSq    = radius * radius;
        const cellW  = width  / grid;
        const cellH  = height / grid;

        const minCol = Math.max(0,        Math.floor((Math.max(-halfW, x - radius) + halfW) / cellW));
        const maxCol = Math.min(grid - 1, Math.floor((Math.min( halfW, x + radius) + halfW) / cellW));
        const minRow = Math.max(0,        Math.floor((Math.max(-halfH, y - radius) + halfH) / cellH));
        const maxRow = Math.min(grid - 1, Math.floor((Math.min( halfH, y + radius) + halfH) / cellH));

        for (let row = minRow; row <= maxRow; row++) {
            const cy  = -halfH + (row + 0.5) * cellH;
            const dy2 = (cy - y) ** 2;
            for (let col = minCol; col <= maxCol; col++) {
                const cx = -halfW + (col + 0.5) * cellW;
                if ((cx - x) ** 2 + dy2 > rSq) continue;
                const idx = row * grid + col;
                if (this._coverage[idx]) continue;
                this._coverage[idx] = 1;
                this._coveredCells++;
            }
        }

        return this._coveredCells;
    }
}
