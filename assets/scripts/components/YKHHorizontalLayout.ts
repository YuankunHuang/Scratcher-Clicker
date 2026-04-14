import { _decorator } from 'cc';
import { YKHLinearLayout } from './YKHLinearLayout';

const { ccclass, executeInEditMode } = _decorator;

@ccclass('YKHHorizontalLayout')
@executeInEditMode
export class YKHHorizontalLayout extends YKHLinearLayout {
    protected _isHorizontal: boolean = true;
}
