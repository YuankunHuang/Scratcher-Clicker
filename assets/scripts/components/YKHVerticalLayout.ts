import { _decorator } from 'cc';
import { YKHLinearLayout } from './YKHLinearLayout';

const { ccclass, executeInEditMode } = _decorator;

@ccclass('YKHVerticalLayout')
@executeInEditMode
export class YKHVerticalLayout extends YKHLinearLayout {
    protected _isHorizontal: boolean = false;
}
