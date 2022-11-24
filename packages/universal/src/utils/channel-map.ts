import { ChannelConnectionDataRef } from './channel-data-ref';

import type { Logger } from '../log/logger';

export interface ChannelConnectionData<T, K extends string | number> {
    readonly key: K;
    readonly data: T;
}

interface ChannelConnectionMapClient<T, K extends string | number> {
    channelAdded(channel: string, conn: ChannelConnectionData<T, K>): void;
    channelRemoved(channel: string, conn: ChannelConnectionData<T, K>): void;
}

interface ForEachChannelHandler<T, K extends string | number> {
    (value: ChannelConnectionData<T, K>): void;
}

/**
 * Structure
 * Channel has key
 * then list of "transports" for this channel: key + impl (socket or webContents)
 * then list of ref counted peerIds for this transport
 */
export class ChannelConnectionMap<T, K extends string | number> {
    public client: ChannelConnectionMapClient<T, K> = undefined;

    private readonly _channelsMap: Map<string, Map<K, ChannelConnectionDataRef<T, K>>>;

    constructor(private readonly _name: string, private readonly _logger?: Logger) {
        this._channelsMap = new Map<string, Map<K, ChannelConnectionDataRef<T, K>>>();
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

    addRef(channel: string, key: K, data: T, count: number = 1): number {
        this._logger && this._info(`AddRef: '${channel}': key = ${key}`);

        let connsMap = this._channelsMap.get(channel);
        if (!connsMap) {
            connsMap = this._addChannel(this.client, channel, key, data, count);
        } else {
            let connData = connsMap.get(key);
            if (!connData) {
                // This channel has NOT been already subscribed by this connection
                connData = new ChannelConnectionDataRef<T, K>(key, data, count);
                connsMap.set(key, connData);
                // Logger.enable && this._info(`AddRef: connKey = ${conn} is added`);
            } else {
                connData.addRef(count);
            }
        }
        return connsMap.size;
    }

    release(channel: string, key: K): number {
        return this._releaseChannel(channel, key, false);
    }

    releaseAll(channel: string, key: K): number {
        return this._releaseChannel(channel, key, true);
    }

    remove(key: K) {
        this._logger && this._info(`remove key = ${key}`);
        this._channelsMap.forEach((connsMap, channel) => {
            const connData = connsMap.get(key);
            if (connData) {
                this._releaseConnData(channel, connData, connsMap, true);
            }
        });
    }

    getChannelConns(channel: string): Map<K, ChannelConnectionDataRef<T, K>> {
        return this._channelsMap.get(channel);
    }

    getConns(): ChannelConnectionData<T, K>[] {
        const conns: Partial<Record<K, ChannelConnectionData<T, K>>> = {};
        this._channelsMap.forEach((connsMap) => {
            connsMap.forEach((connData) => {
                conns[connData.key] = connData;
            });
        });
        return Object.values(conns);
    }

    forEachChannel(channel: string, callback: ForEachChannelHandler<T, K>) {
        this._logger && this._info(`forEachChannel '${channel}'`);
        const connsMap = this._channelsMap.get(channel);
        if (!connsMap) {
            this._logger && this._warn(`forEachChannel: Unknown channel '${channel}' !`);
        } else {
            connsMap.forEach(callback);
        }
    }

    // forEach(callback: ChannelConnectionDataRef.ForEachHandler<T, K>) {
    //     this._logger && this._info('forEach');
    //     this._channelsMap.forEach((connsMap, channel) => {
    //         const cb = partialCall(callback, channel);
    //         connsMap.forEach(cb);
    //     });
    // } 

    private _addChannel(
        client: ChannelConnectionMapClient<T, K>,
        channel: string,
        key: K,
        data: T,
        count: number
    ): Map<K, ChannelConnectionDataRef<T, K>> {
        this._logger && this._info(`Create Channel: '${channel}', key =  ${key}`);

        const connsMap = new Map<K, ChannelConnectionDataRef<T, K>>();
        // This channel has NOT been subscribed yet, add it to the map
        this._channelsMap.set(channel, connsMap);

        const connData = new ChannelConnectionDataRef<T, K>(key, data, count);
        connsMap.set(key, connData);

        client?.channelAdded(channel, connData);
        return connsMap;
    }

    private _removeChannel(
        client: ChannelConnectionMapClient<T, K>,
        channel: string,
        conn: ChannelConnectionData<T, K>
    ): boolean {
        this._logger && this._info(`Delete Channel: '${channel}'`);

        if (this._channelsMap.delete(channel)) {
            client?.channelRemoved(channel, conn);
            return true;
        }
        return false;
    }

    private _releaseConnData(
        channel: string,
        connData: ChannelConnectionDataRef<T, K>,
        connsMap: Map<K, ChannelConnectionDataRef<T, K>>,
        releaseAll: boolean
    ): number {
        if (releaseAll) {
            connData.releaseAll();
        } else {
            connData.release();
        }
        if (connData.refCount === 0) {
            connsMap.delete(connData.key);
            // Logger.enable && this._info(`Release: conn = ${conn} is released`);
            if (connsMap.size === 0) {
                this._removeChannel(this.client, channel, connData);
            }
        }
        this._logger && this._info(`Release '${channel}': count = ${connData.refCount}`);
        return connsMap.size;
    }

    private _releaseChannel(channel: string, key: K, releaseAll: boolean): number {
        this._logger && this._info(`Release '${channel}' (${releaseAll}): key = ${key}`);
        const connsMap = this._channelsMap.get(channel);
        if (!connsMap) {
            this._logger && this._warn(`Release '${channel}': '${channel}' is unknown`);
            return 0;
        }

        const connData = connsMap.get(key);
        if (!connData) {
            this._logger && this._warn(`Release '${channel}': conn is unknown`);
            return 0;
        }
        return this._releaseConnData(channel, connData, connsMap, releaseAll);
    }

    private _info(str: string) {
        this._logger?.info(`[${this._name}] ${str}`);
    }

    private _warn(str: string) {
        this._logger?.warn(`[${this._name}] ${str}`);
    }
}
