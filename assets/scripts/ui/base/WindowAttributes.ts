export enum WindowLayer {
    Normal = 'Layer_Normal', // 普通可入栈窗（绝大部分）
    Dialog = 'Layer_Dialog', // 非全屏对话窗
    Popup = 'Layer_Popup', // Tooltip轻提示窗
    Top = 'Layer_Top', // 特殊强制置顶窗（e.g. ClientMsgWindow）
}

export interface WindowAttributes {
    readonly prefabPath: string; // resources下的相对prefab路径
    readonly layer: WindowLayer; // Layer分类
    readonly stackable: boolean; // 是否入栈,false=不入栈
    readonly showMask: boolean; // 是否在下方生成遮罩
    readonly maskClickClose: boolean; // 点击遮罩后是否关闭窗口（依赖showMask为true）
    readonly blurBackground: boolean; // 是否模糊后方内容
    readonly destroyOnCovered: boolean; // 是否用完即弃
}

export const DEFAULT_WINDOW_ATTRIBUTES: Readonly<WindowAttributes> = {
    prefabPath: "",
    layer: WindowLayer.Normal,
    stackable: true,
    showMask: true,
    maskClickClose: true,
    blurBackground: false,
    destroyOnCovered: false,
};