import type { ChannelConnectionData } from './channel-map';

export class ChannelConnectionDataRef<T, K extends string | number> implements ChannelConnectionData<T, K> {
    readonly key: K;
    readonly data: T;

    private _refCount: number;

    constructor(key: K, data: T, count: number) {
        this.key = key;
        this.data = data;
        this._refCount = count ?? 1;
    }

    get refCount(): number {
        return this._refCount;
    }

    addRef(count: number): number {
        const refCount = count ?? 1;
        this._refCount += refCount;
        return refCount;
    }

    release() {
        return --this._refCount;
    }

    releaseAll() {
        this._refCount = 0;
    }
}
