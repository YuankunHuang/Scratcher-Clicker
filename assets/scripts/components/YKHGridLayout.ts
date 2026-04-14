import { _decorator, Component, Enum, Node, Size, UITransform } from 'cc';
import { YKHLayoutElement } from './YKHLayoutElement';

const { ccclass, property, executeInEditMode } = _decorator;

export enum GridUpdateMode {
    Auto   = 0,
    Manual = 1,
}
Enum(GridUpdateMode);

export enum GridStartCorner {
    TopLeft     = 0,
    TopRight    = 1,
    BottomLeft  = 2,
    BottomRight = 3,
}
Enum(GridStartCorner);

export enum GridStartAxis {
    Horizontal = 0,
    Vertical   = 1,
}
Enum(GridStartAxis);

export enum GridConstraint {
    Flexible         = 0,
    FixedColumnCount = 1,
    FixedRowCount    = 2,
}
Enum(GridConstraint);

/**
 * YKHGridLayout
 *
 * 网格布局。@executeInEditMode 保证编辑器中实时预览。
 *
 * startCorner:  第一个元素放在哪个角
 * startAxis:    Horizontal = 先填满一行再换行；Vertical = 先填满一列再换列
 * constraint:   Flexible = 按容器宽度自动算列数；FixedColumnCount / FixedRowCount = 固定
 * followChildSize: Layout contentSize 自动适配实际行列数
 *
 * 约定：子节点 anchor 应为 (0.5, 0.5)。
 */
@ccclass('YKHGridLayout')
@executeInEditMode
export class YKHGridLayout extends Component {

    @property({ type: Enum(GridUpdateMode) })
    updateMode: GridUpdateMode = GridUpdateMode.Auto;

    @property({ type: Enum(GridStartCorner), tooltip: '第一个元素的起始角' })
    startCorner: GridStartCorner = GridStartCorner.TopLeft;

    @property({ type: Enum(GridStartAxis), tooltip: 'Horizontal: 先填行；Vertical: 先填列' })
    startAxis: GridStartAxis = GridStartAxis.Horizontal;

    @property({ tooltip: '每个格子尺寸（px）' })
    cellSize: Size = new Size(100, 100);

    @property({ tooltip: '列间距（px）' })
    spacingX: number = 0;

    @property({ tooltip: '行间距（px）' })
    spacingY: number = 0;

    @property paddingLeft:   number = 0;
    @property paddingRight:  number = 0;
    @property paddingTop:    number = 0;
    @property paddingBottom: number = 0;

    @property({ type: Enum(GridConstraint), tooltip: 'Flexible: 按宽度自动算列数；Fixed*: 固定行/列数' })
    constraint: GridConstraint = GridConstraint.Flexible;

    @property({ tooltip: 'constraint 不为 Flexible 时的固定数量' })
    constraintCount: number = 2;

    @property({ tooltip: 'Layout contentSize 根据实际行列数自动计算' })
    followChildSize: boolean = false;

    private _layoutDirty: boolean = true;
    private _boundChildren: Set<Node> = new Set();

    // ── 生命周期 ─────────────────────────────────────────────────────────────

    onEnable(): void {
        this._bindSelf();
        if (this.updateMode === GridUpdateMode.Auto) {
            this._bindAllChildren();
        }
        this._layoutDirty = true;
    }

    onDisable(): void {
        this._unbindSelf();
        this._unbindAllChildren();
        this._layoutDirty = false;
    }

    update(): void {
        if (this._layoutDirty) {
            this._layoutDirty = false;
            this._doLayout();
        }
    }

    // ── 公开 API ─────────────────────────────────────────────────────────────

    refresh(): void {
        this._doLayout();
    }

    // ── 事件绑定 ─────────────────────────────────────────────────────────────

    private readonly _markDirty = (): void => { this._layoutDirty = true; };

    private readonly _onChildChanged = (): void => {
        this._unbindAllChildren();
        if (this.updateMode === GridUpdateMode.Auto) this._bindAllChildren();
        this._markDirty();
    };

    private _bindSelf(): void {
        this.node.on(Node.EventType.CHILD_ADDED,         this._onChildChanged, this);
        this.node.on(Node.EventType.CHILD_REMOVED,       this._onChildChanged, this);
        this.node.on(Node.EventType.CHILD_ORDER_CHANGED, this._markDirty, this);
        this.node.on(Node.EventType.SIZE_CHANGED,        this._markDirty, this);
    }

    private _unbindSelf(): void {
        this.node.off(Node.EventType.CHILD_ADDED,         this._onChildChanged, this);
        this.node.off(Node.EventType.CHILD_REMOVED,       this._onChildChanged, this);
        this.node.off(Node.EventType.CHILD_ORDER_CHANGED, this._markDirty, this);
        this.node.off(Node.EventType.SIZE_CHANGED,        this._markDirty, this);
    }

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
    }

    private _unbindChild(child: Node): void {
        if (!this._boundChildren.has(child)) return;
        this._boundChildren.delete(child);
        child.off(Node.EventType.ACTIVE_IN_HIERARCHY_CHANGED, this._markDirty, this);
    }

    // ── 核心布局 ─────────────────────────────────────────────────────────────

    private _doLayout(): void {
        const uit = this.getComponent(UITransform);
        if (!uit) return;

        const children: Node[] = [];
        for (const child of this.node.children) {
            if (!child.active) continue;
            const el = child.getComponent(YKHLayoutElement);
            if (el?.ignoreLayout) continue;
            children.push(child);
        }

        const count = children.length;
        if (count === 0) return;

        const cellW = this.cellSize.width;
        const cellH = this.cellSize.height;
        let W = uit.contentSize.width;
        let H = uit.contentSize.height;
        const availW = W - this.paddingLeft - this.paddingRight;

        // ── 计算行列数 ───────────────────────────────────────────────────────
        let numCols: number;
        let numRows: number;

        switch (this.constraint) {
            case GridConstraint.FixedColumnCount:
                numCols = Math.max(1, this.constraintCount);
                numRows = Math.ceil(count / numCols);
                break;
            case GridConstraint.FixedRowCount:
                numRows = Math.max(1, this.constraintCount);
                numCols = Math.ceil(count / numRows);
                break;
            default:
                numCols = Math.max(1, Math.floor((availW + this.spacingX) / (cellW + this.spacingX)));
                numRows = Math.ceil(count / numCols);
                break;
        }

        // ── followChildSize ──────────────────────────────────────────────────
        if (this.followChildSize) {
            W = numCols * cellW + (numCols - 1) * this.spacingX + this.paddingLeft + this.paddingRight;
            H = numRows * cellH + (numRows - 1) * this.spacingY + this.paddingTop  + this.paddingBottom;
            uit.setContentSize(W, H);
        }

        // ── 起始角决定排列方向（考虑 anchor 偏移） ────────────────────────────

        const ax = uit.anchorX;
        const ay = uit.anchorY;

        const isLeft = (this.startCorner === GridStartCorner.TopLeft
                     || this.startCorner === GridStartCorner.BottomLeft);
        const isTop  = (this.startCorner === GridStartCorner.TopLeft
                     || this.startCorner === GridStartCorner.TopRight);

        const x0 = isLeft
            ? -W * ax       + this.paddingLeft  + cellW / 2
            :  W * (1 - ax) - this.paddingRight - cellW / 2;
        const y0 = isTop
            ?  H * (1 - ay) - this.paddingTop    - cellH / 2
            : -H * ay       + this.paddingBottom + cellH / 2;

        const colStep = (isLeft ? 1 : -1) * (cellW + this.spacingX);
        const rowStep = (isTop ? -1 : 1)  * (cellH + this.spacingY);

        for (let i = 0; i < count; i++) {
            let row: number;
            let col: number;

            if (this.startAxis === GridStartAxis.Horizontal) {
                col = i % numCols;
                row = Math.floor(i / numCols);
            } else {
                row = i % numRows;
                col = Math.floor(i / numRows);
            }

            children[i].setPosition(
                x0 + col * colStep,
                y0 + row * rowStep,
                0,
            );

            const cuit = children[i].getComponent(UITransform);
            if (cuit) cuit.setContentSize(cellW, cellH);
        }
    }
}
