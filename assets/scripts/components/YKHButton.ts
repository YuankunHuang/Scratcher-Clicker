import { _decorator, Button, Component, EventTouch, Node } from 'cc';

const { ccclass, property, requireComponent } = _decorator;

/**
 * YKHButton
 *
 * 对 Cocos 内置 Button 的轻量封装，新增长按检测能力。
 * 依赖 Button 组件（@requireComponent 自动确保）。
 *
 * 事件说明：
 *   - YKHButton.EventType.CLICK        : 普通点击（未发生长按时触发）
 *   - YKHButton.EventType.LONG_PRESS   : 长按达到 longPressThreshold 时触发一次
 *   - YKHButton.EventType.LONG_PRESS_REPEAT : 长按期间以 longPressInterval 为间隔重复触发
 *
 * 监听方式：
 *   btn.node.on(YKHButton.EventType.CLICK, handler, this);
 *   btn.node.on(YKHButton.EventType.LONG_PRESS, handler, this);
 *
 * 注意：使用 CLICK 事件请监听 YKHButton.EventType.CLICK 而非 Button.EventType.CLICK，
 * 否则长按后松手时仍会收到原生 click 事件（本组件已将其拦截）。
 */
@ccclass('YKHButton')
@requireComponent(Button)
export class YKHButton extends Component {

    // ── 事件类型 ─────────────────────────────────────────────────────────────

    static readonly EventType = {
        /** 普通点击（未触发长按时）。 */
        CLICK:              'ykh-click',
        /** 长按时间达到 longPressThreshold 后触发（仅一次）。 */
        LONG_PRESS:         'ykh-long-press',
        /** 长按期间每隔 longPressInterval 秒重复触发（仅当 longPressInterval > 0）。 */
        LONG_PRESS_REPEAT:  'ykh-long-press-repeat',
    } as const;

    // ── 属性 ────────────────────────────────────────────────────────────────

    @property({
        tooltip: '长按触发时间（秒）。0 = 禁用长按检测。',
        min: 0,
    })
    longPressThreshold: number = 0.5;

    @property({
        tooltip: '长按期间的重复触发间隔（秒）。0 = 不重复触发。',
        min: 0,
    })
    longPressInterval: number = 0;

    // ── 私有状态 ─────────────────────────────────────────────────────────────

    private _holding:     boolean = false;
    private _longPressed: boolean = false;
    private _heldTime:    number  = 0;
    private _repeatTime:  number  = 0;

    // ── 生命周期 ─────────────────────────────────────────────────────────────

    onEnable(): void {
        this.node.on(Node.EventType.TOUCH_START,  this._onTouchStart,  this);
        this.node.on(Node.EventType.TOUCH_END,    this._onTouchEnd,    this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this._onTouchCancel, this);
        // 拦截原生 Button click，由本组件决定是否透传
        const btn = this.getComponent(Button);
        if (btn) btn.node.on(Button.EventType.CLICK, this._onNativeClick, this);
    }

    onDisable(): void {
        this.node.off(Node.EventType.TOUCH_START,  this._onTouchStart,  this);
        this.node.off(Node.EventType.TOUCH_END,    this._onTouchEnd,    this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this._onTouchCancel, this);
        const btn = this.getComponent(Button);
        if (btn) btn.node.off(Button.EventType.CLICK, this._onNativeClick, this);
        this._reset();
    }

    update(dt: number): void {
        if (!this._holding || this.longPressThreshold <= 0) return;

        this._heldTime += dt;

        // 首次触发长按
        if (!this._longPressed && this._heldTime >= this.longPressThreshold) {
            this._longPressed = true;
            this._repeatTime  = 0;
            this.node.emit(YKHButton.EventType.LONG_PRESS, this);
        }

        // 长按期间重复触发
        if (this._longPressed && this.longPressInterval > 0) {
            this._repeatTime += dt;
            while (this._repeatTime >= this.longPressInterval) {
                this._repeatTime -= this.longPressInterval;
                this.node.emit(YKHButton.EventType.LONG_PRESS_REPEAT, this);
            }
        }
    }

    // ── 触摸处理 ─────────────────────────────────────────────────────────────

    private readonly _onTouchStart = (_e: EventTouch): void => {
        this._holding     = true;
        this._longPressed = false;
        this._heldTime    = 0;
        this._repeatTime  = 0;
    };

    private readonly _onTouchEnd = (_e: EventTouch): void => {
        // 松手时若未长按，CLICK 会由 _onNativeClick 透传
        this._holding = false;
    };

    private readonly _onTouchCancel = (_e: EventTouch): void => {
        this._reset();
    };

    /**
     * 拦截原生 Button.EventType.CLICK：
     *  - 若发生过长按，吞掉 click（避免长按后误触点击逻辑）
     *  - 否则重新发出 YKHButton.EventType.CLICK
     */
    private readonly _onNativeClick = (btn: Button): void => {
        if (this._longPressed) {
            this._reset();
            return;
        }
        this._reset();
        this.node.emit(YKHButton.EventType.CLICK, btn);
    };

    private _reset(): void {
        this._holding     = false;
        this._longPressed = false;
        this._heldTime    = 0;
        this._repeatTime  = 0;
    }
}
