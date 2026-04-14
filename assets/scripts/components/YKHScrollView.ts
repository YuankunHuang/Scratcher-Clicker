import { _decorator, Component, Enum, EventTouch, Node, UITransform, Vec2 } from 'cc';

const { ccclass, property } = _decorator;

export enum ScrollDirection {
    Vertical   = 0,
    Horizontal = 1,
    Both       = 2,
}
Enum(ScrollDirection);

const ELASTIC_MAX_DIST = 150;
const VEL_THRESHOLD    = 2;
const VEL_EMA          = 0.25;
const DRAG_THRESHOLD   = 8;

/**
 * YKHScrollView
 *
 * 极简滑动容器。无 ScrollBar，无背景。
 *
 * 推荐节点结构：
 *   [ScrollView Node]  ← 挂此组件 + UITransform（定义可触摸/可视区域）
 *     └── [Viewport]   ← Widget 拉伸填满 + Mask（裁剪）
 *           └── [Content]  ← 拖入 content 属性；可挂 YKH*Layout
 *
 * 交互策略：
 *   所有触摸事件正常传播给子节点。
 *   当判定为拖动（移动 >= 8px）时，向触摸目标 emit TOUCH_CANCEL 让其恢复状态，
 *   后续 move/end 阻止传播，子节点不再收到。
 */
@ccclass('YKHScrollView')
export class YKHScrollView extends Component {

    @property({ type: Node, tooltip: '内容节点' })
    content: Node = null!;

    @property({ type: Enum(ScrollDirection) })
    direction: ScrollDirection = ScrollDirection.Vertical;

    @property elastic: boolean = true;
    @property inertia: boolean = true;

    @property({ range: [0, 1], slide: true, tooltip: '惯性衰减：值越大滑越远' })
    decelerationRate: number = 0.95;

    @property({ min: 1, tooltip: '回弹速度（越大越快）' })
    bounceSpeed: number = 16;

    private _basePos:   Vec2 = new Vec2();
    private _offset:    Vec2 = new Vec2();
    private _maxScroll: Vec2 = new Vec2();
    private _velocity:  Vec2 = new Vec2();
    private _prevTouch: Vec2 = new Vec2();
    private _currTouch: Vec2 = new Vec2();

    private _touching:      boolean = false;
    private _scrolling:     boolean = false;
    private _decelerating:  boolean = false;
    private _bouncing:      boolean = false;
    private _totalDragDist: number  = 0;
    /** 触摸最初命中的节点（用于在进入滚动模式时向其发送 cancel）。 */
    private _touchTarget: Node | null = null;
    /** 正在向子节点 emit cancel，防止自己的 _onEnd 响应。 */
    private _emittingCancel: boolean = false;

    // ── 生命周期 ─────────────────────────────────────────────────────────────

    onEnable(): void {
        if (!this.content) return;
        this._basePos.set(this.content.position.x, this.content.position.y);
        this._offset.set(0, 0);
        this._velocity.set(0, 0);
        this._calcMaxScroll();

        this.node.on(Node.EventType.TOUCH_START,  this._onStart,  this, true);
        this.node.on(Node.EventType.TOUCH_MOVE,   this._onMove,   this, true);
        this.node.on(Node.EventType.TOUCH_END,    this._onEnd,    this, true);
        this.node.on(Node.EventType.TOUCH_CANCEL, this._onEnd,    this, true);
    }

    onDisable(): void {
        this.node.off(Node.EventType.TOUCH_START,  this._onStart,  this, true);
        this.node.off(Node.EventType.TOUCH_MOVE,   this._onMove,   this, true);
        this.node.off(Node.EventType.TOUCH_END,    this._onEnd,    this, true);
        this.node.off(Node.EventType.TOUCH_CANCEL, this._onEnd,    this, true);
        this._touching = this._scrolling = this._decelerating = this._bouncing = false;
        this._touchTarget = null;
    }

    update(dt: number): void {
        if (this._scrolling) return;
        if (this._decelerating) this._tickInertia(dt);
        if (this._bouncing)     this._tickBounce(dt);
    }

    // ── 公开 API ─────────────────────────────────────────────────────────────

    refreshLimits(): void { this._calcMaxScroll(); }

    scrollTo(x: number, y: number): void {
        this._offset.x = this._clamp(x, 0, this._maxScroll.x);
        this._offset.y = this._clamp(y, 0, this._maxScroll.y);
        this._apply();
    }

    // ── 触摸 ─────────────────────────────────────────────────────────────────

    private readonly _onStart = (e: EventTouch): void => {
        this._touching      = true;
        this._scrolling     = false;
        this._decelerating  = false;
        this._bouncing      = false;
        this._totalDragDist = 0;
        this._touchTarget   = e.target as Node | null;
        this._velocity.set(0, 0);
        e.getUILocation(this._prevTouch);
        // 不阻止传播——子节点（Button 等）正常收到 start
    };

    private readonly _onMove = (e: EventTouch): void => {
        if (!this._touching) return;

        e.getUILocation(this._currTouch);
        const dx = this._currTouch.x - this._prevTouch.x;
        const dy = this._currTouch.y - this._prevTouch.y;
        this._prevTouch.set(this._currTouch.x, this._currTouch.y);

        this._totalDragDist += Math.abs(dx) + Math.abs(dy);

        if (!this._scrolling) {
            if (this._totalDragDist < DRAG_THRESHOLD) return;
            this._scrolling = true;
            this._cancelTouchTarget(e);
        }

        e.propagationStopped = true;

        if (this.direction !== ScrollDirection.Horizontal) this._offset.y += dy;
        if (this.direction !== ScrollDirection.Vertical)   this._offset.x -= dx;

        const fps = 60;
        this._velocity.x = this._velocity.x * (1 - VEL_EMA) + (-dx) * fps * VEL_EMA;
        this._velocity.y = this._velocity.y * (1 - VEL_EMA) + dy    * fps * VEL_EMA;

        this._apply();
    };

    private readonly _onEnd = (e: EventTouch): void => {
        if (this._emittingCancel) return;
        if (!this._touching) return;
        this._touching = false;
        this._touchTarget = null;

        if (this._scrolling) {
            e.propagationStopped = true;
            this._scrolling = false;
            if (this._outOfBounds()) {
                this._bouncing = true;
            } else if (this.inertia && this._velMag() > VEL_THRESHOLD) {
                this._decelerating = true;
            }
        }
        // 未滚动 = 点击：不阻止传播，子节点正常收到 end → click
    };

    /**
     * 进入滚动模式时，向触摸命中的目标节点 emit TOUCH_CANCEL。
     * 这让任何监听了 cancel 的组件（Button、Toggle、自定义组件……）恢复状态。
     * 用 emit 而非 dispatchEvent，事件只触发在目标节点自身，不冒泡。
     */
    private _cancelTouchTarget(currentEvent: EventTouch): void {
        const target = this._touchTarget;
        if (!target) return;
        this._emittingCancel = true;
        target.emit(Node.EventType.TOUCH_CANCEL, currentEvent);
        this._emittingCancel = false;
    }

    // ── 惯性 ─────────────────────────────────────────────────────────────────

    private _tickInertia(dt: number): void {
        const decay = Math.max(0, 1 - (1 - this.decelerationRate) * dt * 60);

        if (this.direction !== ScrollDirection.Horizontal) {
            this._offset.y += this._velocity.y * dt;
            this._velocity.y *= decay;
        }
        if (this.direction !== ScrollDirection.Vertical) {
            this._offset.x += this._velocity.x * dt;
            this._velocity.x *= decay;
        }
        this._apply();

        if (this._outOfBounds()) {
            this._decelerating = false;
            this._bouncing     = true;
            this._velocity.set(0, 0);
        } else if (this._velMag() < VEL_THRESHOLD) {
            this._decelerating = false;
        }
    }

    private _tickBounce(dt: number): void {
        const tx = this._clamp(this._offset.x, 0, this._maxScroll.x);
        const ty = this._clamp(this._offset.y, 0, this._maxScroll.y);
        const t  = 1 - Math.exp(-this.bounceSpeed * dt);

        if (this.direction !== ScrollDirection.Horizontal) {
            this._offset.y += (ty - this._offset.y) * t;
        }
        if (this.direction !== ScrollDirection.Vertical) {
            this._offset.x += (tx - this._offset.x) * t;
        }
        this._apply();

        if (Math.abs(this._offset.x - tx) < 0.5 && Math.abs(this._offset.y - ty) < 0.5) {
            this._offset.x = tx;
            this._offset.y = ty;
            this._bouncing = false;
            this._apply();
        }
    }

    // ── 辅助 ─────────────────────────────────────────────────────────────────

    private _calcMaxScroll(): void {
        if (!this.content) return;
        const vuit = this.getComponent(UITransform);
        const cuit = this.content.getComponent(UITransform);
        if (!vuit || !cuit) return;
        this._maxScroll.x = Math.max(0, cuit.contentSize.width  - vuit.contentSize.width);
        this._maxScroll.y = Math.max(0, cuit.contentSize.height - vuit.contentSize.height);
    }

    private _apply(): void {
        if (!this.content) return;
        const vx = this.elastic ? this._visualOffset(this._offset.x, this._maxScroll.x) : this._clamp(this._offset.x, 0, this._maxScroll.x);
        const vy = this.elastic ? this._visualOffset(this._offset.y, this._maxScroll.y) : this._clamp(this._offset.y, 0, this._maxScroll.y);
        this.content.setPosition(
            this._basePos.x - vx,
            this._basePos.y + vy,
            0,
        );
    }

    private _visualOffset(offset: number, max: number): number {
        if (offset >= 0 && offset <= max) return offset;
        if (offset < 0) {
            const d = -offset;
            return -(ELASTIC_MAX_DIST * d / (d + ELASTIC_MAX_DIST));
        }
        const d = offset - max;
        return max + ELASTIC_MAX_DIST * d / (d + ELASTIC_MAX_DIST);
    }

    private _clamp(v: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, v));
    }

    private _outOfBounds(): boolean {
        return this._offset.x < 0 || this._offset.x > this._maxScroll.x
            || this._offset.y < 0 || this._offset.y > this._maxScroll.y;
    }

    private _velMag(): number {
        return Math.sqrt(this._velocity.x * this._velocity.x + this._velocity.y * this._velocity.y);
    }
}
