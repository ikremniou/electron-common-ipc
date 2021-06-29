// import * as uuid from 'uuid';
import * as shortid from 'shortid';

import type { IpcConnectOptions, IpcBusProcess, IpcBusPeer } from './IpcBusClient';
import type { IpcBusMessage, IpcBusTarget } from './IpcBusCommand';

export const IPC_BUS_TIMEOUT = 2000;// 20000;

const win32prefix1 = '\\\\.\\pipe';
const win32prefix2 = '\\\\?\\pipe';


export type Arr = readonly unknown[];
export function partialCall<T extends Arr, U extends Arr, R>(f: (...args: [...T, ...U]) => R, ...headArgs: T) {
    return (...tailArgs: U) => f(...headArgs, ...tailArgs)
}


// https://nodejs.org/api/net.html#net_ipc_support
function CleanPipeName(str: string) {
    if (process.platform === 'win32') {
        if ((str.lastIndexOf(win32prefix1, 0) === -1) && (str.lastIndexOf(win32prefix2, 0) === -1)) {
            str = str.replace(/^\//, '');
            str = str.replace(/\//g, '-');
            str = win32prefix1 + '\\' + str;
        }
    }
    return str;
}

const TargetSignature = `__target`;
const TargetMainSignature     = `${TargetSignature}:main_`;
const TargetProcessSignature  = `${TargetSignature}:proc_`;
const TargetRendererSignature = `${TargetSignature}:rend_`;

const TargetSignatureLength = TargetMainSignature.length;

export function GetTargetMain(ipcMessage: IpcBusMessage, parse: boolean = false): IpcBusTarget | null {
    if (ipcMessage.target) {
        return (ipcMessage.target.type === 'main') ? ipcMessage.target : null;
    }
    if (ipcMessage.channel && (ipcMessage.channel.lastIndexOf(TargetMainSignature, 0) === 0)) {
        if (parse) {
            const index = ipcMessage.channel.indexOf(TargetSignature, TargetSignatureLength);
            return JSON.parse(ipcMessage.channel.substr(TargetSignatureLength, index - TargetSignatureLength));
        }
        return {} as IpcBusTarget;
    }
    return null;
}

export function GetTargetProcess(ipcMessage: IpcBusMessage, parse: boolean = false): IpcBusTarget | null {
    if (ipcMessage.target) {
        return ((ipcMessage.target.type === 'node' || ipcMessage.target.type === 'native')) ? ipcMessage.target : null;
    }
    if (ipcMessage.channel && (ipcMessage.channel.lastIndexOf(TargetProcessSignature, 0) === 0)) {
        if (parse) {
            const index = ipcMessage.channel.indexOf(TargetSignature, TargetSignatureLength);
            return JSON.parse(ipcMessage.channel.substr(TargetSignatureLength, index - TargetSignatureLength));
        }
        return {} as IpcBusTarget;
    }
    return null;
}

export function GetTargetRenderer(ipcBusMessage: IpcBusMessage, parse: boolean = false): IpcBusTarget | null {
    if (ipcBusMessage.target) {
        return (ipcBusMessage.target.type === 'renderer') ? ipcBusMessage.target : null;
    }
    if (ipcBusMessage.channel && (ipcBusMessage.channel.lastIndexOf(TargetRendererSignature, 0) === 0)) {
        if (parse) {
            const index = ipcBusMessage.channel.indexOf(TargetSignature, TargetSignatureLength);
            return JSON.parse(ipcBusMessage.channel.substr(TargetSignatureLength, index - TargetSignatureLength));
        }
        return {} as IpcBusTarget;
    }
    return null;
}

export function CreateKeyForEndpoint(endpoint: IpcBusProcess | IpcBusProcess): number {
    if (endpoint.wcid && endpoint.frameid) {
        return (endpoint.wcid << 8) + endpoint.frameid;
    }
    else {
        return endpoint.pid;
    }
}

export function GetTarget(ipcMessage: IpcBusMessage): IpcBusTarget | null {
    if (ipcMessage.target) {
        return ipcMessage.target;
    }
    if (ipcMessage.channel && ipcMessage.channel.lastIndexOf(TargetSignature, 0) == 0) {
        const index = ipcMessage.channel.indexOf(TargetSignature, TargetSignatureLength);
        return JSON.parse(ipcMessage.channel.substr(TargetSignatureLength, index - TargetSignatureLength));
    }
    return null;
}

export function CreateTargetChannel(peer: IpcBusPeer): string {
    const target = CreateTarget(peer);
    let prefix: string;
    switch (peer.process.type) {
        case 'native':
        case 'node':
            prefix = `${TargetProcessSignature}_${JSON.stringify(target)}${TargetSignature}`;
            break;
        case 'renderer':
            prefix = `${TargetRendererSignature}_${JSON.stringify(target)}${TargetSignature}`;
            break;
        case 'main':
            prefix = `${TargetMainSignature}_${JSON.stringify(target)}${TargetSignature}`;
            break;
        case 'worker':
        case 'undefined':
        default:
            prefix = `${peer.process.type}_`;
            break;
    }
    return `${prefix}${CreateUniqId()}`;
}

export function CreateTarget(peerOrProcess: IpcBusPeer | IpcBusProcess | undefined): IpcBusTarget {
    if (peerOrProcess == null) {
        return undefined;
    }
    if ((peerOrProcess as any).process) {
        const peer = peerOrProcess as IpcBusPeer;
        return {
            ...peer.process,
            peerid: peer.id
        };
    }
    else {
        const process = peerOrProcess as IpcBusProcess;
        return {
            ...process
        };
    }
}

export function CheckChannel(channel: any): string {
    switch (typeof channel) {
        case 'string':
            break;
        case 'undefined':
            channel = 'undefined';
            break;
        default:
            if (channel === null) {
                channel = 'null';
            }
            else {
                channel = channel.toString();
            }
            break;
    }
    return channel;
}

export function checkTimeout(val: any): number {
    const parseVal = parseFloat(val);
    if (parseVal == val) {
        return parseVal;
    }
    else {
        return IPC_BUS_TIMEOUT;
    }
}

export function CheckConnectOptions<T extends IpcConnectOptions>(arg1: T | string | number, arg2?: T | string, arg3?: T): T | null {
    // A port number : 59233, 42153
    // A port number + hostname : 59233, '127.0.0.1'
    const options: T = (typeof arg1 === 'object' ? arg1 : typeof arg2 === 'object' ? arg2 : typeof arg3 === 'object' ? arg3 : {}) as T;
    if (Number(arg1) >= 0) {
        options.port = Number(arg1);
        options.host = typeof arg2 === 'string' ? arg2 : undefined;
    }
    // A 'hostname:port' pattern : 'localhost:8082'
    // A path : '//local-ipc'
    else if (typeof arg1 === 'string') {
        const parts = arg1.split(':');
        if ((parts.length === 2) && (Number(parts[1]) >= 0)) {
            options.port = Number(parts[1]);
            options.host = parts[0];
        }
        else {
            options.path = arg1;
        }
    }
    // An IpcNetOptions object similar to NodeJS.net.ListenOptions
    if (options.path) {
        options.path = CleanPipeName(options.path);
    }
    if (options.timeoutDelay == null) {
        options.timeoutDelay = IPC_BUS_TIMEOUT;
    }
    return options;
}

// let uniqNumber = 0;
// const padding = '0000000000'
// const paddingLength = padding.length;
// export function CreateUniqId(): string {
//     // ++uniqNumber;
//     // return (padding + uniqNumber.toString()).substr(-paddingLength);
//     // return uuid.v1();
//     return shortid.generate();
// }
shortid.characters('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ#&')
export function CreateUniqId(): string {
    return shortid.generate();
}

export function BinarySearch<T>(array: T[], target: T, compareFn: (l: T, r: T) => number) {
    let left = 0;  // inclusive
    let right = array.length;  // exclusive
    while (left < right) {
        let middle = (left + right) >> 1;
        const compareResult = compareFn(target, array[middle]);
        if (compareResult > 0) {
            left = middle + 1;
        }
        else if (compareResult < 0) {
            right = middle;
        }
        else {
            return middle;
        }
    }
    // left is the insertion point if not found
    return -left - 1;
};


/** @internal */
export class Logger {
    static enable: boolean = false;
    static service: boolean = false;
    // static logFile: string;

    static info(msg: string) {
        console.log(msg);
    }

    static warn(msg: string) {
        console.warn(msg);
    }

    static error(msg: string) {
        console.error(msg);
    }

};

export function ActivateIpcBusTrace(enable: boolean): void {
    Logger.enable = enable;
}

export function ActivateServiceTrace(enable: boolean): void {
    Logger.service = enable;
}


export class ConnectCloseState<T> {
    protected _waitForConnected: Promise<T>;
    protected _waitForClosed: Promise<void>;
    protected _connected: boolean;
    // protected _t: T | null;

    constructor() {
        this.shutdown();
    }

    get connected(): boolean {
        return this._connected;
    }

    // get value(): T {
    //     return this._t;
    // }

    connect(cb: () => Promise<T>): Promise<T> {
        if (this._waitForConnected == null) {
            this._waitForConnected = this._waitForClosed
            .then(() => {
                return cb();
            })
            .then((t) => {
                // this._t = t;
                this._connected = true;
                return t;
            })
            .catch((err) => {
                this._waitForConnected = null;
                throw err;
            });
        }
        return this._waitForConnected;
    }

    close(cb: () => Promise<void>): Promise<void> {
        if (this._waitForConnected) {
            const waitForConnected = this._waitForConnected;
            this._waitForConnected = null;
            this._waitForClosed = waitForConnected
            .then(() => {
                // this._t = null;
                this._connected = false;
                return cb();
            });
        }
        return this._waitForClosed;
    }

    shutdown() {
        this._waitForConnected = null;
        // this._t = null;
        this._waitForClosed = Promise.resolve();
        this._connected = false;
    }
}

