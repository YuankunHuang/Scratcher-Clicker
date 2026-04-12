import { _decorator, Button } from 'cc';
import {WindowConfig} from "../../base/WindowConfig";
const { ccclass, property } = _decorator;

@ccclass('LoadingWindowConfig')
export class LoadingWindowConfig extends WindowConfig {
    @property(Button)
    
    goBtn: Button = null!;
}


