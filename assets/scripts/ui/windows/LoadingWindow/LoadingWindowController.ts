import {Button} from 'cc';
import {WindowControllerBase} from "../../base/WindowControllerBase";
import {WindowNames} from "../../../ui/WindowNames";
import {windowController} from "../../../ui/registry/WindowRegistry";
import {WindowLayer} from "../../base/WindowAttributes";
import {LoadingWindowConfig} from "./LoadingWindowConfig";
import {LoadingWindowData} from "./LoadingWindowData";
import {Services} from "../../../Services";

@windowController(WindowNames.LoadingWindow, {
    prefabPath: 'prefabs/ui/windows/LoadingWindow/LoadingWindow',
    maskClickClose: false,
    destroyOnCovered: true
})
export class LoadingWindowController extends WindowControllerBase<LoadingWindowConfig, LoadingWindowData> {
    protected onInit(): void {
        console.log("[LoadingWindowController] onInit.");
        this._config.goBtn.node.on(Button.EventType.CLICK, this._onGoBtnClick, this);
    }
    
    protected onPreShow() {
        console.log("[LoadingWindowController] onPreShow");
    }
    
    protected onShow() {
        console.log("[LoadingWindowController] onShow");
    }
    
    protected onPreHide() {
        console.log("[LoadingWindowController] onPreHide");
    }
    
    protected onHide() {
        console.log("[LoadingWindowController] onHide");
    }
    
    protected onDispose() {
        console.log("[LoadingWindowController] onDispose");
        this._config.goBtn.node.targetOff(this);
    }
    
    private _onGoBtnClick(): void {
        console.log("[LoadingWindowController] onGoBtnClick");
        Services.ui.show(WindowNames.LoginWindow);
    } 
}


