import { _decorator, Component } from 'cc';

const { ccclass, property } = _decorator;

/**
 * YKHLayoutElement
 *
 * 挂在需要参与 YKH 布局系统的子节点上，为父级 Layout 组件提供每个子节点的独立尺寸偏好。
 * 类比 Unity 的 LayoutElement。
 *
 * 父级 Layout 在遍历子节点时调用 getComponent(YKHLayoutElement) 读取，
 * 本组件自身不执行任何布局计算。
 *
 * 使用约定：子节点 anchor 应为 (0.5, 0.5)（YKH Layout 系列的统一约定）。
 */
@ccclass('YKHLayoutElement')
export class YKHLayoutElement extends Component {

    /** 覆盖主轴宽度。-1 = 使用 UITransform.contentSize.width。 */
    @property preferredWidth: number = -1;

    /** 覆盖主轴高度。-1 = 使用 UITransform.contentSize.height。 */
    @property preferredHeight: number = -1;

    /**
     * 弹性伸展比例。
     * 仅当父级 Layout.forceExpandChild = true 时生效。
     * 0 = 不参与弹性分配，使用固定尺寸。
     * >0 = 按比例瓜分主轴剩余空间（类似 CSS flex-grow）。
     */
    @property flexGrow: number = 0;

    /**
     * 当为 true 时，此节点对父级 Layout 不可见（不占位、不参与排列）。
     * 等价于将节点移出布局流，但不影响节点本身的 active 状态。
     */
    @property ignoreLayout: boolean = false;
}
