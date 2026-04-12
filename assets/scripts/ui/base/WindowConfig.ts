import { _decorator, Component } from 'cc';
const { ccclass, property } = _decorator;

/*
 * 作为基类，会被所有窗口Config继承，可以随时添加通用扩展功能和@property
 */
@ccclass('WindowConfig')
export class WindowConfig extends Component {
}