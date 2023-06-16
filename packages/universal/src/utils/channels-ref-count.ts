interface ChannelRefCount {
    channel: string;
    refCount: number;
}

export class ChannelsRefCount {
    private readonly _channelsMap: Map<string, ChannelRefCount>;

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
        if (!channelRefCount) {
            channelRefCount = { channel, refCount: 1 };
            this._channelsMap.set(channel, channelRefCount);
        } else {
            ++channelRefCount.refCount;
        }
        return channelRefCount.refCount;
    }

    release(channel: string) {
        const channelRefCount = this._channelsMap.get(channel);
        if (!channelRefCount) {
            return 0;
            // Logger.enable && this._warn(`Release '${channel}': peerId #${peerId} is unknown`);
        }
        // This connection has subscribed to this channel
        if (--channelRefCount.refCount <= 0) {
            // The connection is no more referenced
            this._channelsMap.delete(channel);
            // Logger.enable && this._info(`Release: peerId #${peerId} is released`);
        }
        return channelRefCount.refCount;
    }

    has(channel: string): boolean {
        return this._channelsMap.has(channel);
    }

    get(channel: string): number {
        const channelRefCount = this._channelsMap.get(channel);
        return channelRefCount ? channelRefCount.refCount : 0;
    }

    clear(): void {
        this._channelsMap.clear();
    }
}
