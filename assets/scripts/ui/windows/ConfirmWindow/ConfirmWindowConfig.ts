import { Label, Button } from 'cc';
import { _decorator } from 'cc';
import { WindowConfig } from '../../base/WindowConfig';
const { ccclass, property } = _decorator;

@ccclass('ConfirmWindowConfig')
export class ConfirmWindowConfig extends WindowConfig {
    @property(Button) confirmBtn: Button = null!;
    @property(Label) contentLabel: Label = null!;
}
