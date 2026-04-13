import { _decorator, Label, Button } from 'cc';
import { WindowConfig } from '../../base/WindowConfig';
import {ScratchRenderer} from "../../../gameplay/ScratchRenderer";
const { ccclass, property } = _decorator;

@ccclass('DemoWindowConfig')
export class DemoWindowConfig extends WindowConfig {
    
    @property(Label) progressLabel: Label = null!;
    @property(Button) backBtn: Button = null!;
    @property(ScratchRenderer) scratchRenderer: ScratchRenderer = null!;
}
