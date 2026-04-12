import { _decorator, Button } from 'cc';
import {WindowConfig} from "../../base/WindowConfig";
const { ccclass, property } = _decorator;

@ccclass('LoginWindowConfig')
export class LoginWindowConfig extends WindowConfig {
    @property(Button)
    loginBtn: Button = null!;
}


