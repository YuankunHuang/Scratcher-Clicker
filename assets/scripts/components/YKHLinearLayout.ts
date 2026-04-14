import { _decorator, Component, Enum, Node, UITransform } from 'cc';
import { YKHLayoutElement } from './YKHLayoutElement';

const { ccclass, property, executeInEditMode } = _decorator;

export enum UpdateMode {
    Auto   = 0,
    Manual = 1,
}
Enum(UpdateMode);

export enum LinearAlignment {
    Start  = 0,
    Center = 1,
    End    = 2,
}
Enum(LinearAlignment);

interface ChildInfo {
    node:     Node;
    cuit:     UITransform | null;
    flexGrow: number;
    w: number;
    h: number;
}

const _childBuf: ChildInfo[] = [];

/**
 * YKHLinearLayout（基类）
 *
 * @executeInEditMode 保证编辑器中实时预览。
 * 子类通过 _isHorizontal 默认值区分方向。
 *
 * forceExpandChild: 子节点均分主轴空间（spacing 不受影响），交叉轴撑满。
 *                   子节点可通过 YKHLayoutElement.flexGrow 控制分配比例。
 * followChildSize:  Layout 自身 contentSize 随子节点总尺寸自动收缩/扩展。
 * 两者互斥——forceExpandChild 优先级更高。
 *
 * 约定：子节点 anchor 应为 (0.5, 0.5)。
 */
@ccclass('YKHLinearLayout')
@executeInEditMode
export class YKHLinearLayout extends Component {

    @property({ type: Enum(UpdateMode), tooltip: 'Auto: 属性变化自动重排；Manual: 手动调 refresh()' })
    updateMode: UpdateMode = UpdateMode.Auto;

    @property({ type: Enum(LinearAlignment), tooltip: '交叉轴对齐方式' })
    alignment: LinearAlignment = LinearAlignment.Start;

    @property({ tooltip: '相邻子元素间距（px）' })
    spacing: number = 0;

    @property paddingLeft:   number = 0;
    @property paddingRight:  number = 0;
    @property paddingTop:    number = 0;
    @property paddingBottom: number = 0;

    @property({ tooltip: '子节点均分主轴空间，交叉轴撑满（与 followChildSize 互斥）' })
    forceExpandChild: boolean = false;

    @property({ tooltip: 'Layout 尺寸跟随子节点总尺寸（与 forceExpandChild 互斥）' })
    followChildSize: boolean = false;

    @property({ tooltip: '排列方向反转（H: 右→左；V: 下→上）' })
    reverseDirection: boolean = false;

    @property({ serializable: true, visible: false })
    protected _isHorizontal: boolean = true;

    private _layoutDirty: boolean = true;
    private _boundChildren: Set<Node> = new Set();

    // ── 生命周期 ─────────────────────────────────────────────────────────────

    onEnable(): void {
        this._bindSelf();
        if (this.updateMode === UpdateMode.Auto) {
            this._bindAllChildren();
        }
        this._layoutDirty = true;
    }

    onDisable(): void {
        this._unbindSelf();
        this._unbindAllChildren();
        this._layoutDirty = false;
    }

    /**
     * 每帧检查脏标记并执行布局。
     * 编辑器模式下 scheduleOnce 不可靠，用 update 轮询是最稳定的方案。
     */
    update(): void {
        if (this._layoutDirty) {
            this._layoutDirty = false;
            this._doLayout();
        }
    }

    // ── 公开 API ─────────────────────────────────────────────────────────────

    /** 立即执行一次布局（无论 updateMode）。 */
    refresh(): void {
        this._doLayout();
    }

    // ── 自身事件绑定（监听属性变化 + 子节点增删） ────────────────────────────

    private _bindSelf(): void {
        this.node.on(Node.EventType.CHILD_ADDED,   this._onChildChanged, this);
        this.node.on(Node.EventType.CHILD_REMOVED, this._onChildChanged, this);
        this.node.on(Node.EventType.CHILD_ORDER_CHANGED, this._markDirty, this);
        this.node.on(Node.EventType.SIZE_CHANGED,  this._markDirty, this);
    }

    private _unbindSelf(): void {
        this.node.off(Node.EventType.CHILD_ADDED,   this._onChildChanged, this);
        this.node.off(Node.EventType.CHILD_REMOVED, this._onChildChanged, this);
        this.node.off(Node.EventType.CHILD_ORDER_CHANGED, this._markDirty, this);
        this.node.off(Node.EventType.SIZE_CHANGED,  this._markDirty, this);
    }

    // ── 子节点事件绑定 ───────────────────────────────────────────────────────

    private readonly _onChildChanged = (child: Node): void => {
        this._unbindAllChildren();
        if (this.updateMode === UpdateMode.Auto) {
            this._bindAllChildren();
        }
        this._markDirty();
    };

    private readonly _markDirty = (): void => {
        this._layoutDirty = true;
    };

    private _bindAllChildren(): void {
        for (const child of this.node.children) this._bindChild(child);
    }

    private _unbindAllChildren(): void {
        for (const child of this._boundChildren) this._unbindChild(child);
        this._boundChildren.clear();
    }

    private _bindChild(child: Node): void {
        if (this._boundChildren.has(child)) return;
        this._boundChildren.add(child);
        child.on(Node.EventType.ACTIVE_IN_HIERARCHY_CHANGED, this._markDirty, this);
        child.on(Node.EventType.SIZE_CHANGED, this._markDirty, this);
    }

    private _unbindChild(child: Node): void {
        if (!this._boundChildren.has(child)) return;
        this._boundChildren.delete(child);
        child.off(Node.EventType.ACTIVE_IN_HIERARCHY_CHANGED, this._markDirty, this);
        child.off(Node.EventType.SIZE_CHANGED, this._markDirty, this);
    }

    // ── 核心布局 ─────────────────────────────────────────────────────────────

    private _doLayout(): void {
        const uit = this.getComponent(UITransform);
        if (!uit) return;

        _childBuf.length = 0;
        for (const child of this.node.children) {
            if (!child.active) continue;
            const el   = child.getComponent(YKHLayoutElement);
            if (el?.ignoreLayout) continue;
            const cuit = child.getComponent(UITransform);
            _childBuf.push({
                node:     child,
                cuit,
                flexGrow: el?.flexGrow ?? 0,
                w: (el && el.preferredWidth  >= 0) ? el.preferredWidth  : (cuit?.contentSize.width  ?? 0),
                h: (el && el.preferredHeight >= 0) ? el.preferredHeight : (cuit?.contentSize.height ?? 0),
            });
        }

        const n = _childBuf.length;
        if (n === 0) return;

        const W = uit.contentSize.width;
        const H = uit.contentSize.height;

        if (this._isHorizontal) {
            this._layoutH(uit, W, H, n);
        } else {
            this._layoutV(uit, W, H, n);
        }
    }

    // ── 水平布局 ─────────────────────────────────────────────────────────────

    private _layoutH(uit: UITransform, W: number, H: number, n: number): void {
        const ax = uit.anchorX;
        const ay = uit.anchorY;
        const availW = W - this.paddingLeft - this.paddingRight;
        const availH = H - this.paddingTop  - this.paddingBottom;
        const totalSpacing = this.spacing * (n - 1);

        if (this.forceExpandChild) {
            const distributable = availW - totalSpacing;
            let totalFlex = 0;
            for (let i = 0; i < n; i++) {
                totalFlex += (_childBuf[i].flexGrow > 0) ? _childBuf[i].flexGrow : 1;
            }
            for (let i = 0; i < n; i++) {
                const c = _childBuf[i];
                const flex = (c.flexGrow > 0) ? c.flexGrow : 1;
                c.w = Math.max(0, distributable * flex / totalFlex);
                c.h = availH;
            }
        } else if (this.followChildSize) {
            let totalW = totalSpacing + this.paddingLeft + this.paddingRight;
            for (let i = 0; i < n; i++) totalW += _childBuf[i].w;
            uit.setContentSize(totalW, H);
            W = totalW;
        }

        // 左边界 = -W * anchorX，右边界 = W * (1 - anchorX)
        const left = -W * ax + this.paddingLeft;
        const right = W * (1 - ax) - this.paddingRight;
        // 交叉轴边界
        const top    =  H * (1 - ay) - this.paddingTop;
        const bottom = -H * ay       + this.paddingBottom;

        if (!this.reverseDirection) {
            let cursor = left;
            for (let i = 0; i < n; i++) {
                const c = _childBuf[i];
                c.node.setPosition(cursor + c.w / 2, this._crossY(c.h, top, bottom), 0);
                if (this.forceExpandChild && c.cuit) c.cuit.setContentSize(c.w, c.h);
                cursor += c.w + this.spacing;
            }
        } else {
            let cursor = right;
            for (let i = 0; i < n; i++) {
                const c = _childBuf[i];
                c.node.setPosition(cursor - c.w / 2, this._crossY(c.h, top, bottom), 0);
                if (this.forceExpandChild && c.cuit) c.cuit.setContentSize(c.w, c.h);
                cursor -= c.w + this.spacing;
            }
        }
    }

    // ── 垂直布局 ─────────────────────────────────────────────────────────────

    private _layoutV(uit: UITransform, W: number, H: number, n: number): void {
        const ax = uit.anchorX;
        const ay = uit.anchorY;
        const availW = W - this.paddingLeft - this.paddingRight;
        const availH = H - this.paddingTop  - this.paddingBottom;
        const totalSpacing = this.spacing * (n - 1);

        if (this.forceExpandChild) {
            const distributable = availH - totalSpacing;
            let totalFlex = 0;
            for (let i = 0; i < n; i++) {
                totalFlex += (_childBuf[i].flexGrow > 0) ? _childBuf[i].flexGrow : 1;
            }
            for (let i = 0; i < n; i++) {
                const c = _childBuf[i];
                const flex = (c.flexGrow > 0) ? c.flexGrow : 1;
                c.h = Math.max(0, distributable * flex / totalFlex);
                c.w = availW;
            }
        } else if (this.followChildSize) {
            let totalH = totalSpacing + this.paddingTop + this.paddingBottom;
            for (let i = 0; i < n; i++) totalH += _childBuf[i].h;
            uit.setContentSize(W, totalH);
            H = totalH;
        }

        const top    =  H * (1 - ay) - this.paddingTop;
        const bottom = -H * ay       + this.paddingBottom;
        const left   = -W * ax       + this.paddingLeft;
        const right  =  W * (1 - ax) - this.paddingRight;

        if (!this.reverseDirection) {
            let cursor = top;
            for (let i = 0; i < n; i++) {
                const c = _childBuf[i];
                c.node.setPosition(this._crossX(c.w, left, right), cursor - c.h / 2, 0);
                if (this.forceExpandChild && c.cuit) c.cuit.setContentSize(c.w, c.h);
                cursor -= c.h + this.spacing;
            }
        } else {
            let cursor = bottom;
            for (let i = 0; i < n; i++) {
                const c = _childBuf[i];
                c.node.setPosition(this._crossX(c.w, left, right), cursor + c.h / 2, 0);
                if (this.forceExpandChild && c.cuit) c.cuit.setContentSize(c.w, c.h);
                cursor += c.h + this.spacing;
            }
        }
    }

    // ── 交叉轴坐标 ───────────────────────────────────────────────────────────

    /** 水平布局的交叉轴（Y）定位：top/bottom 已包含 anchor 偏移和 padding。 */
    private _crossY(childH: number, top: number, bottom: number): number {
        switch (this.alignment) {
            case LinearAlignment.Start:  return top    - childH / 2;
            case LinearAlignment.End:    return bottom + childH / 2;
            default:                     return (top + bottom) / 2;
        }
    }

    /** 垂直布局的交叉轴（X）定位：left/right 已包含 anchor 偏移和 padding。 */
    private _crossX(childW: number, left: number, right: number): number {
        switch (this.alignment) {
            case LinearAlignment.Start:  return left  + childW / 2;
            case LinearAlignment.End:    return right - childW / 2;
            default:                     return (left + right) / 2;
        }
    }
}
