import {IDisposable, ISaveManager} from './interfaces';
import { sys } from 'cc';
import {SaveData, GameData, DEFAULT_SAVE_DATA} from "../data/GameData";

const SAVE_KEY = 'scratcher_clicker_save';

export class SaveManagerImpl implements ISaveManager, IDisposable {
    load(): void {
        const raw = sys.localStorage.getItem(SAVE_KEY);
        if (!raw) {
            console.log('[SaveManager] No save found, using defaults.');
            return;
        }
        
        try {
            const parsed = JSON.parse(raw) as Partial<SaveData>;
            // 用DEFAULT_SAVE_DATA兜底，防止存档字段缺失
            GameData.instance.deserialize({ ...DEFAULT_SAVE_DATA, ...parsed });
            console.log(`[SaveManager] Save loaded.`);
        } catch (e) {
            console.error('[SaveManager] Save data corrupted, resetting.', e);
        }
    }

    save(): void {
        const data = GameData.instance.serialize();
        sys.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    }

    get<T>(key: string, defaultVal: T): T {
        const raw = sys.localStorage.getItem(key);
        if (raw == null) return defaultVal;
        try { return JSON.parse(raw) as T; }
        catch (e) { return defaultVal; }
    }

    set<T>(key: string, val: T): void {
        sys.localStorage.setItem(key, JSON.stringify(val));
    }
    
    dispose() {
        this.save();
    }
}