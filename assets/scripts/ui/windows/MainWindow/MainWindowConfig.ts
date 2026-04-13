import { _decorator, Label, Button } from 'cc';
import {WindowConfig} from "../../base/WindowConfig";
const { ccclass, property } = _decorator;

@ccclass('MainWindowConfig')
export class MainWindowConfig extends WindowConfig {
    @property(Label) coinLabel: Label = null!;
    @property(Button) restartBtn: Button = null!;
    @property(Button) demoBtn: Button = null!;
}


