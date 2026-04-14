import { SampleConfig, SampleData } from './SampleConfig';

let _initialized = false;

export const GameDataManager = {
    initialize(loader: (tableName: string) => unknown[]): void {
        if (_initialized) return;
        SampleConfig.initialize(loader('Sample') as SampleData[]);
        _initialized = true;
    },
    reload(loader: (tableName: string) => unknown[]): void {
        _initialized = false;
        this.initialize(loader);
    },
};
