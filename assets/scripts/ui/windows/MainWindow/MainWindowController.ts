import {Button} from 'cc';
import {WindowControllerBase} from "../../base/WindowControllerBase";
import {WindowNames} from "../../../ui/WindowNames";
import {windowController} from "../../../ui/registry/WindowRegistry";
import {WindowLayer} from "../../base/WindowAttributes";
import {MainWindowConfig} from "./MainWindowConfig";
import {MainWindowData} from "./MainWindowData";
import {GameManager} from "db://assets/scripts/GameManager";

@windowController(WindowNames.MainWindow, {
    prefabPath: 'prefabs/ui/windows/MainWindow/MainWindow',
    showMask: false,
})
export class MainWindowController extends WindowControllerBase<MainWindowConfig, MainWindowData> {
    protected onInit(): void {
        console.log("[MainWindowController] onInit.");
        this._config.restartBtn.node.on(Button.EventType.CLICK, this._onRestartBtnClick, this);
    }
    
    protected onPreShow() {
        console.log("[MainWindowController] onPreShow");
    }
    
    protected onShow() {
        console.log("[MainWindowController] onShow");
    }
    
    protected onPreHide() {
        console.log("[MainWindowController] onPreHide");
    }
    
    protected onHide() {
        console.log("[MainWindowController] onHide");
    }
    
    protected onDispose() {
        console.log("[MainWindowController] onDispose");
        this._config.restartBtn.node.targetOff(this);
    }
    
    private _onRestartBtnClick(): void {
        console.log("[MainWindowController] onRestartBtnClick");
        GameManager.instance.restart();
    }
}


