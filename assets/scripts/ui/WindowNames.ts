export const WindowNames = {
    LoadingWindow: 'LoadingWindow',
    LoginWindow: 'LoginWindow',
    MainWindow: 'MainWindow',
    ClientMsgWindow: 'ClientMsgWindow',} as const;

// 类型约束：外部传key时只能传合法值，杜绝手写字符串
export type WindowName = typeof WindowNames[keyof typeof WindowNames];