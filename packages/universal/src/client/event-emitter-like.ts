interface CommonEmitter {
    eventNames(): (symbol | string)[];
    listenerCount(eventName: string): number;
    setMaxListeners(maxListeners: number): void;
    listeners(eventName: string): Function[]; 
}

export interface ChannelEmitterLike<Listener> extends CommonEmitter {
    
    emit(channel: string, ...args: any[]): boolean;

    addListener(channel: string, listener: Listener): ChannelEmitterLike<Listener>;
    removeListener(channel: string, listener: Listener): ChannelEmitterLike<Listener>;
    removeAllListeners(channel?: string): ChannelEmitterLike<Listener>;

    on(channel: string, listener: Listener): ChannelEmitterLike<Listener>;
    once(channel: string, listener: Listener): ChannelEmitterLike<Listener>;
    off(channel: string, listener: Listener): ChannelEmitterLike<Listener>;

    prependListener(channel: string, listener: Listener): ChannelEmitterLike<Listener>;
    prependOnceListener(channel: string, listener: Listener): ChannelEmitterLike<Listener>;
}

export interface EventEmitterLike<Listener> extends CommonEmitter {
    emit(event: string, ...args: any[]): boolean;

    addListener(event: string, listener: Listener): ChannelEmitterLike<Listener>;
    removeListener(event: string, listener: Listener): ChannelEmitterLike<Listener>;
    removeAllListeners(event?: string): ChannelEmitterLike<Listener>;

    on(event: string, listener: Listener): ChannelEmitterLike<Listener>;
    once(event: string, listener: Listener): ChannelEmitterLike<Listener>;
    off(event: string, listener: Listener): ChannelEmitterLike<Listener>;

    prependListener(event: string, listener: Listener): ChannelEmitterLike<Listener>;
    prependOnceListener(event: string, listener: Listener): ChannelEmitterLike<Listener>;
}


