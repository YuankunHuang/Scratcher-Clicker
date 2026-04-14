import { _decorator, Component, Enum, Sprite, UITransform } from 'cc';

const { ccclass, property, executeInEditMode } = _decorator;

// ─── 枚举 ─────────────────────────────────────────────────────────────────────

export enum ProgressFillMode {
    /**
     * 通过缩放 fillSprite 节点的 UITransform.contentSize.width/height 实现填充。
     * fillSprite 需为普通 Simple/Sliced Sprite。
     */
    ResizeWidth  = 0,
    /**
     * 通过 Sprite.fillRange 实现填充（需在编辑器中将 Sprite Type 设为 FILLED）。
     * 支持任意填充方向（由 Sprite 的 fillType 和 fillStart 控制）。
     */
    SpriteFilled = 1,
}
Enum(ProgressFillMode);

// ─── 组件 ─────────────────────────────────────────────────────────────────────

/**
 * YKHProgressBar
 *
 * 进度条组件，支持两种填充模式和平滑动画。
 *
 * 使用步骤：
 *  1. 在节点树中创建 "Background" 节点 + "Fill" 子节点。
 *  2. 将 Fill 节点上的 Sprite 组件拖入 fillSprite 属性。
 *  3. 选择 fillMode：
 *     - ResizeWidth：Fill Sprite 保持 Simple/Sliced，Layout 通过缩放宽度实现进度。
 *     - SpriteFilled：将 Sprite Type 设为 FILLED，进度条通过 fillRange 控制。
 *  4. 代码中通过 progressBar.progress = 0.5 设置进度（0~1）。
 *
 * 注意：ResizeWidth 模式下，Fill 节点的 anchor 应为 (0, 0.5)（左对齐），
 * 且 position.x 应为 Fill 起始 X（通常为 -backgroundWidth/2）。
 */
@ccclass('YKHProgressBar')
@executeInEditMode
export class YKHProgressBar extends Component {

    // ── 属性 ────────────────────────────────────────────────────────────────

    @property({ type: Sprite, tooltip: '填充条 Sprite（将 Fill 节点上的 Sprite 拖入）' })
    fillSprite: Sprite = null!;

    @property({ type: Enum(ProgressFillMode) })
    fillMode: ProgressFillMode = ProgressFillMode.ResizeWidth;

    @property({
        tooltip: '动画时长（秒）。0 = 立即跳变，>0 = 线性动画过渡。',
        min: 0,
    })
    animationDuration: number = 0;

    // ── 私有状态 ─────────────────────────────────────────────────────────────

    /** ResizeWidth 模式下的满进度宽度（onLoad 时从 UITransform 读取并缓存）。 */
    private _fullWidth: number = 0;

    /** 当前显示的进度值（动画过程中在 [0,1] 内变化）。 */
    private _current: number = 0;

    /** 目标进度值。 */
    private _target: number = 0;

    /** 动画计时器：已经过时间（秒）。 */
    private _animTime: number = 0;

    /** 动画起点值（每次新 set 时记录）。 */
    private _animFrom: number = 0;

    private _isAnimating: boolean = false;

    // ── 生命周期 ─────────────────────────────────────────────────────────────

    onLoad(): void {
        if (this.fillSprite && this.fillMode === ProgressFillMode.ResizeWidth) {
            const uit = this.fillSprite.getComponent(UITransform);
            if (uit) this._fullWidth = uit.contentSize.width;
        }
    }

    onDisable(): void {
        if (this._isAnimating) {
            this._isAnimating = false;
            this.unschedule(this._animTick);
        }
    }

    // ── 公开 API ─────────────────────────────────────────────────────────────

    /** 获取当前目标进度（0~1）。 */
    get progress(): number { return this._target; }

    /**
     * 设置进度（0~1）。
     * 若 animationDuration > 0，以线性动画过渡到目标值。
     */
    set progress(v: number) {
        const clamped = Math.max(0, Math.min(1, v));
        this._target  = clamped;

        if (this.animationDuration <= 0) {
            // 立即跳变
            if (this._isAnimating) {
                this._isAnimating = false;
                this.unschedule(this._animTick);
            }
            this._current = clamped;
            this._applyProgress();
            return;
        }

        // 启动（或重启）动画
        this._animFrom = this._current;
        this._animTime = 0;
        if (!this._isAnimating) {
            this._isAnimating = true;
            this.schedule(this._animTick);
        }
    }

    /** 无动画立即设置进度。 */
    setProgressImmediate(v: number): void {
        const clamped = Math.max(0, Math.min(1, v));
        if (this._isAnimating) {
            this._isAnimating = false;
            this.unschedule(this._animTick);
        }
        this._current = this._target = clamped;
        this._applyProgress();
    }

    // ── 动画帧 ───────────────────────────────────────────────────────────────

    private readonly _animTick = (dt: number): void => {
        this._animTime += dt;
        const t = Math.min(this._animTime / this.animationDuration, 1);
        this._current = this._animFrom + (this._target - this._animFrom) * t;
        this._applyProgress();

        if (t >= 1) {
            this._isAnimating = false;
            this.unschedule(this._animTick);
        }
    };

    // ── 渲染应用 ─────────────────────────────────────────────────────────────

    private _applyProgress(): void {
        if (!this.fillSprite) return;

        if (this.fillMode === ProgressFillMode.ResizeWidth) {
            const uit = this.fillSprite.getComponent(UITransform);
            if (uit) uit.setContentSize(this._fullWidth * this._current, uit.contentSize.height);
        } else {
            this.fillSprite.fillRange = this._current;
        }
    }
}
