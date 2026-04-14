export interface SampleData {
    readonly iD: number;
    readonly name: string;
    readonly type: SampleType;
    readonly level: number;
    readonly cost: number;
    readonly openTime: string;
    readonly closeTime: string;
}

const _all: SampleData[] = [];
const _byId = new Map<number, SampleData>();

export const SampleConfig = {
    initialize(rows: SampleData[]): void {
        _all.length = 0;
        _byId.clear();
        for (const row of rows) {
            _all.push(row);
            _byId.set(row.id, row);
        }
    },
    getById(id: number): SampleData | undefined { return _byId.get(id); },
    getAll(): readonly SampleData[] { return _all; },
    get count(): number { return _all.length; },
};
