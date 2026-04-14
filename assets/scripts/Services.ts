import { IAssetManager, IAudioManager, IEventManager, ISaveManager, IUIManager } from "./core/interfaces";
import { ServiceLocator, Tokens } from "./core/ServiceLocator";

export const Services = {
    get ui():    IUIManager    { return ServiceLocator.get(Tokens.UI);    },
    get audio(): IAudioManager { return ServiceLocator.get(Tokens.Audio); },
    get event(): IEventManager { return ServiceLocator.get(Tokens.Event); },
    get save():  ISaveManager  { return ServiceLocator.get(Tokens.Save);  },
    get asset(): IAssetManager { return ServiceLocator.get(Tokens.Asset); },
};