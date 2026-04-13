import { Button } from 'cc';
import { WindowControllerBase } from "../../base/WindowControllerBase";
import { WindowNames } from "../../../ui/WindowNames";
import { windowController } from "../../../ui/registry/WindowRegistry";
import { WindowLayer } from "../../base/WindowAttributes";
import { DemoWindowConfig } from "./DemoWindowConfig";
import { DemoWindowData } from "./DemoWindowData";
import {Services} from "../../../Services";

@windowController(WindowNames.DemoWindow, {
    prefabPath: 'prefabs/ui/windows/DemoWindow/DemoWindow',
    showMask: true,
    maskClickClose: false,
})
export class DemoWindowController extends WindowControllerBase<DemoWindowConfig, DemoWindowData> {
    protected onInit(): void {
        console.log("[DemoWindowController] onInit");
        this._config.backBtn.node.on(Button.EventType.CLICK, this._onBackBtnClick, this);
    }

    protected onPreShow(): void {
        console.log("[DemoWindowController] onPreShow");
        this._config.scratchRenderer.onProgress = this._onScratchProgress;
    }
    
    protected onShow(): void {
        console.log("[DemoWindowController] onShow");
    }

    protected onPreHide(): void {
        console.log("[DemoWindowController] onPreHide");
        this._config.scratchRenderer.onProgress = null;
    }

    protected onHide(): void {
        console.log("[DemoWindowController] onHide");
    }

    protected onDispose(): void {
        console.log("[DemoWindowController] onDispose");
        this._config.backBtn.node.targetOff(this);
    }
    
    private _onBackBtnClick(): void {
        console.log("[DemoWindowController] onBackBtnClick");
        Services.ui.goBack();
    }
    
    // TS的this规范：跨脚本this无法传递。需要用lambda箭头表达式来定义。
    private _onScratchProgress = (ratio: number): void => {
        const percent = Math.floor(ratio * 100);
        this._config.progressLabel.string = `Cleaned: ${percent}%`;
        
        if (ratio >= 0.9) {
            this._onScratchComplete();
        }
    }
    
    private _onScratchComplete(): void {
        console.log("[DemoWindowController] onScratchComplete");
        this._config.scratchRenderer.setActive(false);
        Services.ui.show(WindowNames.ConfirmWindow, {
            content: 'Congratulations!',
            onConfirm: () => {
                this._config.scratchRenderer.resetScratch();
            },
        });
    }
}
