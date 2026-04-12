import {WindowNames} from "./ui/WindowNames";
import {Services} from "./Services";

export class AppFlow {
    static start(): void {
        console.log("[AppFlow] start");
        Services.ui.show(WindowNames.LoadingWindow);
    }
    
    static stop(): void {
        // 未来的扩展点，可以用于一些过渡表现
        console.log("[AppFlow] stop");
    }
}


