import { Logger, partialCall } from './IpcBusUtils';

// Structure
// Channel has key
// then list of "transports" for this channel: key + implem (socket or webContents)
// then list of ref counted peerIds for this transport

/** @internal */
export interface ChannelConnectionData<T, K extends string | number> {
    readonly key: K;
    readonly data: T;
}

/** @internal */
export class ChannelConnectionDataRef<T, K extends string | number> implements ChannelConnectionData<T, K> {
    readonly key: K;
    readonly data: T;

    private _refCount: number;

    constructor(key: K, data: T, count: number) {
        this.key = key;
        this.data = data;
        this._refCount = (count == null) ? 1 : count;
    }

    get refCount(): number {
        return this._refCount;
    }

    addRef(count: number): number {
        const refCount = (count == null) ? 1 : count;
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

/** @internal */
export interface ChannelConnectionMapClient<T, K extends string | number> {
    channelAdded(channel: string, conn: ChannelConnectionData<T, K>): void;
    channelRemoved(channel: string, conn: ChannelConnectionData<T, K>): void;
}

/** @internal */
export class ChannelConnectionMap<T, K extends string | number> {
    private _name: string;
    private _channelsMap: Map<string, Map<K, ChannelConnectionDataRef<T, K>>>;

    public client: ChannelConnectionMapClient<T, K>;

    constructor(name: string, client?: ChannelConnectionMapClient<T, K>) {
        this._name = name;
        this.client = client;
        this._channelsMap = new Map<string, Map<K, ChannelConnectionDataRef<T, K>>>();
    }

    private _info(str: string) {
        Logger.enable && Logger.info(`[${this._name}] ${str}`);
    }

    private _warn(str: string) {
        Logger.enable && Logger.warn(`[${this._name}] ${str}`);
    }

    hasChannel(channel: string): boolean {
        return this._channelsMap.has(channel);
    }

    getChannels(): string[] {
        const channels = Array.from(this._channelsMap.keys());
        return channels;
    }

    getChannelsCount(): number {
        return this._channelsMap.size;
    }

    clear() {
        this._channelsMap.clear();
    }

    addRefs(channels: string[], key: K, data: T): void {
        for (let i = 0, l = channels.length; i < l; ++i) {
            this.addRef(channels[i], key, data);
        }
    }

    releases(channels: string[], key: K): void {
        for (let i = 0, l = channels.length; i < l; ++i) {
            this.release(channels[i], key);
        }
    }

    protected _addChannel(client: ChannelConnectionMapClient<T, K>, channel: string, key: K, data: T, count: number): Map<K, ChannelConnectionDataRef<T, K>> {
        Logger.enable && this._info(`SetChannel: '${channel}', key =  ${key}`);

        const connsMap = new Map<K, ChannelConnectionDataRef<T, K>>();
        // This channel has NOT been subscribed yet, add it to the map
        this._channelsMap.set(channel, connsMap);

        const connData = new ChannelConnectionDataRef<T, K>(key, data, count);
        connsMap.set(key, connData);

        if (client) client.channelAdded(channel, connData);

        return connsMap;
    }

    private _removeChannel(client: ChannelConnectionMapClient<T, K>, channel: string, conn: ChannelConnectionData<T, K>): boolean {
        if (this._channelsMap.delete(channel)) {
            if (client) client.channelRemoved(channel, conn);
            return true;
        }
        return false;
    }

    addRefCount(channel: string, key: K, data: T, count: number): number {
        Logger.enable && this._info(`AddRef: '${channel}': key = ${key}`);

        let connsMap = this._channelsMap.get(channel);
        if (connsMap == null) {
            connsMap = this._addChannel(this.client, channel, key, data, count);
        }
        else {
            let connData = connsMap.get(key);
            if (connData == null) {
                // This channel has NOT been already subscribed by this connection
                connData = new ChannelConnectionDataRef<T, K>(key, data, count);
                connsMap.set(key, connData);
                // Logger.enable && this._info(`AddRef: connKey = ${conn} is added`);
            }
            else {
                connData.addRef(count);
            }
        }
        return connsMap.size;
    }

    addRef(channel: string, key: K, data: T): number {
        return this.addRefCount(channel, key, data, 1);
    }

    private _releaseConnData(channel: string, connData: ChannelConnectionDataRef<T, K>, connsMap: Map<K, ChannelConnectionDataRef<T, K>>, allRef: boolean): number {
        if (allRef) {
            connData.releaseAll();
        }
        else {
            connData.release();
        }
        if (connData.refCount === 0) {
            connsMap.delete(connData.key);
            // Logger.enable && this._info(`Release: conn = ${conn} is released`);
            if (connsMap.size === 0) {
                this._removeChannel(this.client, channel, connData);
            }
        }
        Logger.enable && this._info(`Release '${channel}': count = ${connData.refCount}`);
        return connsMap.size;
    }

    private _releaseChannel(channel: string, key: K, allRef: boolean): number {
        Logger.enable && this._info(`Release '${channel}' (${allRef}): key = ${key}`);
        const connsMap = this._channelsMap.get(channel);
        if (connsMap == null) {
            Logger.enable && this._warn(`Release '${channel}': '${channel}' is unknown`);
            return 0;
        }
        else {
            const connData = connsMap.get(key);
            if (connData == null) {
                Logger.enable && this._warn(`Release '${channel}': conn is unknown`);
                return 0;
            }
            return this._releaseConnData(channel, connData, connsMap, allRef);
        }
    }

    release(channel: string, key: K): number {
        return this._releaseChannel(channel, key, false);
    }

    releaseAll(channel: string, key: K): number {
        return this._releaseChannel(channel, key, true);
    }

    releaseKey(key: K) {
        Logger.enable && this._info(`removePeer: key = ${key}`);
        this._channelsMap.forEach((connsMap, channel) => {
            const connData = connsMap.get(key);
            this._releaseConnData(channel, connData, connsMap, true);
        });
    }

    // removeConnection(conn: T) {
    //     // We can not use _getKey as it may access a property which is no more accessible when the 'conn' is destroyed
    //     this._channelsMap.forEach((connsMap, channel) => {
    //         connsMap.forEach((connData) => {
    //             if (connData.data === conn) {
    //                 this._releaseConnData(channel, connData, connsMap, null, true);
    //             }
    //         });
    //     });
    // }

    removeKey(key: K) {
        Logger.enable && this._info(`removeKey: key = ${key}`);
        this._channelsMap.forEach((connsMap, channel) => {
            const connData = connsMap.get(key);
            if (connData) {
                this._releaseConnData(channel, connData, connsMap, true);
            }
        });
    }

    // forEachConnection(callback: ChannelConnectionMap.ForEachHandler<T1>) {
    //     const connections = new Map<T1, ChannelConnectionMap.ConnectionData<T1>>();
    //     this._channelsMap.forEach((connsMap, channel) => {
    //         connsMap.forEach((connData, connKey) => {
    //             connections.set(connData.conn, connData);
    //         });
    //     });
    //     connections.forEach((connData, connKey) => {
    //         callback(connData, '');
    //     });
    // }

    getChannelConns(channel: string): Map<K, ChannelConnectionDataRef<T, K>> {
        return this._channelsMap.get(channel);
    }

    // getEndpoints(): IpcBusEndpoint[] {
    //     const endpoints: Record<number, IpcBusEndpoint> = {};
    //     this._channelsMap.forEach((connsMap) => {
    //         connsMap.forEach((connData) => {
    //             endpoints[peerRefCount.endpoint.id] = peerRefCount.endpoint;
    //         });
    //     });
    //     return Object.values(endpoints);
    // }

    getConns(): ChannelConnectionData<T, K>[] {
        // @ts-ignore really an edge case for the compiler that has not been implemented
        const conns: Record<K, ChannelConnectionData<T, K>> = {};
        this._channelsMap.forEach((connsMap) => {
            connsMap.forEach((connData) => {
                conns[connData.key] = connData;
            });
        });
        return Object.values(conns);
    }

    forEachChannel(channel: string, callback: ChannelConnectionDataRef.ForEachChannelHandler<T, K>) {
        Logger.enable && this._info(`forEachChannel '${channel}'`);
        const connsMap = this._channelsMap.get(channel);
        if (connsMap == null) {
            Logger.enable && this._warn(`forEachChannel: Unknown channel '${channel}' !`);
        }
        else {
            connsMap.forEach(callback);
        }
    }

    forEach(callback: ChannelConnectionDataRef.ForEachHandler<T, K>) {
        Logger.enable && this._info('forEach');
        this._channelsMap.forEach((connsMap, channel) => {
            const cb = partialCall(callback, channel);
            connsMap.forEach(cb);
        });
    }
}

/** @internal */
export namespace ChannelConnectionDataRef {
    /** @internal */
    export interface RefCount<T> {
        data: T;
        refCount: number;
    }

    /** @internal */
    export interface ForEachChannelHandler<T, K extends string | number> {
        (value: ChannelConnectionData<T, K>): void;
    };

    /** @internal */
    export interface ForEachHandler<T, K extends string | number> {
        (channel: string, value: ChannelConnectionData<T, K>): void;
    };
};

/** @internal */
interface ChannelRefCount {
    channel: string;
    refCount: number;
}

/** @internal */
export class ChannelsRefCount {
    private _channelsMap: Map<string, ChannelRefCount>;

    constructor() {
        this._channelsMap = new Map();
    }

    getChannels(): string[] {
        const channels = Array.from(this._channelsMap.keys());
        return channels;
    }

    push(channel: string) {
        this._channelsMap.set(channel, { channel, refCount: -1 });
    }

    pop(channel: string): boolean {
        return this._channelsMap.delete(channel);
    }

    addRefs(channels: string[]): void {
        for (let i = 0, l = channels.length; i < l; ++i) {
            this.addRef(channels[i]);
        }
    }

    addRef(channel: string): number {
        let channelRefCount = this._channelsMap.get(channel);
        if (channelRefCount == null) {
            channelRefCount = { channel, refCount: 1 };
            this._channelsMap.set(channel, channelRefCount);
        }
        else {
            ++channelRefCount.refCount;
        }
        return channelRefCount.refCount;
    }

    release(channel: string) {
        const channelRefCount = this._channelsMap.get(channel);
        if (channelRefCount == null) {
            return 0;
            // Logger.enable && this._warn(`Release '${channel}': peerId #${peerId} is unknown`);
        }
        else {
            // This connection has subscribed to this channel
            if (--channelRefCount.refCount <= 0) {
                // The connection is no more referenced
                this._channelsMap.delete(channel);
                // Logger.enable && this._info(`Release: peerId #${peerId} is released`);
            }
            return channelRefCount.refCount;
        }
    }

    has(channel: string): boolean {
        return (this._channelsMap.get(channel) != null);
    }

    get(channel: string): number {
        const channelRefCount = this._channelsMap.get(channel);
        return channelRefCount ? channelRefCount.refCount : 0;
    }

    clear(): void {
        this._channelsMap.clear();
    }
}

