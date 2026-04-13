import { Button } from 'cc';
import { WindowControllerBase } from "../../base/WindowControllerBase";
import { WindowNames } from "../../../ui/WindowNames";
import { windowController } from "../../../ui/registry/WindowRegistry";
import { WindowLayer } from "../../base/WindowAttributes";
import { ConfirmWindowConfig } from "./ConfirmWindowConfig";
import { ConfirmWindowData } from "./ConfirmWindowData";
import {Services} from "db://assets/scripts/Services";

@windowController(WindowNames.ConfirmWindow, {
    prefabPath: 'prefabs/ui/windows/ConfirmWindow/ConfirmWindow',
    isTransparent: true,
    blurBackground: true,
    maskClickClose: false,
})
export class ConfirmWindowController extends WindowControllerBase<ConfirmWindowConfig, ConfirmWindowData> {
    protected onInit(): void {
        this._config.confirmBtn.node.on(Button.EventType.CLICK, this._onConfirmBtnClick, this);
    }

    protected onPreShow(): void {}

    protected onShow(): void {
        this._config.contentLabel.string = this._data.content;
    }

    protected onPreHide(): void {}

    protected onHide(): void {}

    protected onDispose(): void {
        this._config.confirmBtn.node.targetOff(this);
    }
    
    private _onConfirmBtnClick(): void {
        Services.ui.goBack();
        this._data.onConfirm?.();
    }
}
