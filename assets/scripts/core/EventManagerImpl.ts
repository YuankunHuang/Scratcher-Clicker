import { EventTarget } from 'cc';
import { IEventManager } from "./interfaces";

export class EventManagerImpl implements IEventManager {
    private _eventTarget: EventTarget = new EventTarget();
    
    on<T>(eventName: string, callback: (data: T) => void, target?: object) {
        this._eventTarget.on(eventName, callback, target);
    }
    
    off<T>(eventName: string, callback: (data: T) => void, target?: object) {
        this._eventTarget.off(eventName, callback, target);
    }
    
    emit<T>(eventName: string, data?: T) {
        this._eventTarget.emit(eventName, data);
    }
}