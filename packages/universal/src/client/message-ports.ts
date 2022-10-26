// TODO_IK: I would prefer to move the notion of the message ports out of the
// universal package as it looks like not a "universal" API. Maybe we should think on
// extending the client on the electron-common-ipc side like IpcBusClientEx or better to
// extend the IpcBusCommand to provide arbitrary data in header...

interface MessageEvent {
    data: unknown;
    ports: unknown[];
}

interface MessagePortEventMap {
    message: MessageEvent;
    messageerror: MessageEvent;
    close: Function;
}

interface IpcBusMessagePortPost {
    postMessage(message: unknown, messagePorts?: Transferable[]): void;
}

interface ElectronMessagePort {
    // Docs: https://electronjs.org/docs/api/message-port-main
    on(event: 'close', listener: Function): this;
    on(event: 'message', listener: (messageEvent: MessageEvent) => void): this;
    once(event: 'close', listener: Function): this;
    once(event: 'message', listener: (messageEvent: MessageEvent) => void): this;
    addListener(event: 'close', listener: Function): this;
    addListener(event: 'message', listener: (messageEvent: MessageEvent) => void): this;
    removeListener(event: 'close', listener: Function): this;
    removeListener(event: 'message', listener: (messageEvent: MessageEvent) => void): this;

    close(): void;
    postMessage(message: unknown, transfer?: ElectronMessagePort[]): void;
    start(): void;
}

interface BrowserMessagePort extends MessagePort {}

/**
 * In order to ensure a common interface in Web/Electron/Node.js, we use an 'union' interface of
 * EventTarget
 * EventEmitter
 * MessagePort
 * MessagePortMain
 * Docs: https://electronjs.org/docs/api/message-port-main
 * */
export interface IpcBusMessagePort extends IpcBusMessagePortPost {
    on<K extends keyof MessagePortEventMap>(event: K, listener: (messageEvent: MessagePortEventMap[K]) => void): this;
    off<K extends keyof MessagePortEventMap>(event: K, listener: (messageEvent: MessagePortEventMap[K]) => void): this;
    once<K extends keyof MessagePortEventMap>(event: K, listener: (messageEvent: MessagePortEventMap[K]) => void): this;
    addListener<K extends keyof MessagePortEventMap>(
        event: K,
        listener: (messageEvent: MessagePortEventMap[K]) => void
    ): this;
    removeListener<K extends keyof MessagePortEventMap>(
        event: K,
        listener: (messageEvent: MessagePortEventMap[K]) => void
    ): this;

    addEventListener<K extends keyof MessagePortEventMap>(
        type: K,
        listener: (this: MessagePort, ev: MessagePortEventMap[K]) => unknown,
        options?: boolean | AddEventListenerOptions
    ): void;
    addEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
    ): void;
    removeEventListener<K extends keyof MessagePortEventMap>(
        type: K,
        listener: (this: MessagePort, ev: MessagePortEventMap[K]) => unknown,
        options?: boolean | EventListenerOptions
    ): void;
    removeEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | EventListenerOptions
    ): void;

    start(): void;
    close(): void;
}

export type BusMessagePort = IpcBusMessagePort | BrowserMessagePort | ElectronMessagePort;

// TODO_IK: During the refactoring notices multiple errors(wrong method names/remove & add mismatch). Is it working?
// Maybe implementing some facade classes will be better case.
export function CastToMessagePort(port: BusMessagePort): IpcBusMessagePort {
    const browserPortLike = port as BrowserMessagePort;
    const electronPortLike = port as ElectronMessagePort;
    const busPortLike = port as IpcBusMessagePort;

    if (browserPortLike.addEventListener && !electronPortLike.addListener) {
        busPortLike.on = busPortLike.addListener = browserPortLike.addEventListener as typeof busPortLike.on;
        busPortLike.off = busPortLike.removeListener = browserPortLike.removeEventListener as typeof busPortLike.off;
        busPortLike.once = (event: keyof MessagePortEventMap, listener: Function) => {
            browserPortLike.addEventListener(event, listener as EventListenerOrEventListenerObject, { once: true });
            return busPortLike;
        };
        return busPortLike;
    }

    if (!browserPortLike.addEventListener && electronPortLike.addListener) {
        busPortLike.addEventListener = (event: string, listener: (...args: any[]) => void, options: unknown) => {
            if (typeof options === 'object' && (options as AddEventListenerOptions).once) {
                return electronPortLike.once(event as 'message', listener);
            }

            return electronPortLike.addListener(event as 'message', listener);
        };
        busPortLike.removeEventListener = electronPortLike.addListener as typeof busPortLike.removeEventListener;
        return busPortLike;
    }

    return busPortLike;
}
