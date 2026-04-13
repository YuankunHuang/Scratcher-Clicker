import {Button} from 'cc';
import {WindowControllerBase} from "../../base/WindowControllerBase";
import {WindowNames} from "../../../ui/WindowNames";
import {windowController} from "../../../ui/registry/WindowRegistry";
import {WindowLayer} from "../../base/WindowAttributes";
import {LoginWindowConfig} from "./LoginWindowConfig";
import {LoginWindowData} from "./LoginWindowData";
import {Services} from "../../../../scripts/Services";

@windowController(WindowNames.LoginWindow, {
    prefabPath: 'prefabs/ui/windows/LoginWindow/LoginWindow',
    maskClickClose: false,
    destroyOnCovered: true,
})
export class LoginWindowController extends WindowControllerBase<LoginWindowConfig, LoginWindowData> {
    protected onInit(): void {
        console.log("[LoginWindowController] onInit.");
        this._config.loginBtn.node.on(Button.EventType.CLICK, this._onLoginBtnClick, this);
    }
    
    protected onPreShow() {
        console.log("[LoginWindowController] onPreShow");
    }
    
    protected onShow() {
        console.log("[LoginWindowController] onShow");
    }
    
    protected onPreHide() {
        console.log("[LoginWindowController] onPreHide");
    }
    
    protected onHide() {
        console.log("[LoginWindowController] onHide");
    }
    
    protected onDispose() {
        console.log("[LoginWindowController] onDispose");
        this._config.loginBtn.node.targetOff(this);
    }
    
    private _onLoginBtnClick(): void {
        console.log("[LoginWindowController] onLoginBtnClick");
        Services.ui.show(WindowNames.MainWindow);
    }
}


