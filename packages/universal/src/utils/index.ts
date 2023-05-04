import { IpcBusProcessType } from '../contract/ipc-bus-peer';

import type { IpcConnectOptions, IpcTimeoutOptions } from '../client/ipc-connect-options';
import type { IpcBusPeer } from '../contract/ipc-bus-peer';

/* 
This number is used to the javascript context.
We cannot introduce the notion of the process into
Universal library, so we will use this contextId
*/
const executionContextId = String(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));

const enum Constants {
    IpcBusTimeout = 2000,
}

const enum Win32Pipes {
    Prefix1 = '\\\\.\\pipe',
    Prefix2 = '\\\\?\\pipe',
}

// https://nodejs.org/api/net.html#net_ipc_support
function cleanPipeName(str: string) {
    if (process.platform === 'win32') {
        if (str.lastIndexOf(Win32Pipes.Prefix1, 0) === -1 && str.lastIndexOf(Win32Pipes.Prefix2, 0) === -1) {
            str = str.replace(/^\//, '');
            str = str.replace(/\//g, '-');
            str = Win32Pipes.Prefix1 + '\\' + str;
        }
    }
    return str;
}

export function isBridgeTarget(target: IpcBusPeer): boolean {
    if (target.type === IpcBusProcessType.Main || target.type === IpcBusProcessType.Renderer) {
        return true;
    }
    return false;
}

export function convertProcessTypeToString(type: IpcBusProcessType): string {
    switch (type) {
        case IpcBusProcessType.Browser:
            return 'Browser';
        case IpcBusProcessType.Main:
            return 'Main';
        case IpcBusProcessType.Native:
            return 'Native';
        case IpcBusProcessType.Node:
            return 'Node';
        case IpcBusProcessType.Renderer:
            return 'Renderer';
        case IpcBusProcessType.Undefined:
            return 'Undefined';
        case IpcBusProcessType.Worker:
            return 'Worker';
        default:
            return 'Unknown';
    }
}

export function createContextId(type: IpcBusProcessType): string {
    return `${convertProcessTypeToString(type)}-${executionContextId}`;
}

export function CheckChannel(channel: unknown): string {
    switch (typeof channel) {
        case 'string':
            return channel;
        case 'undefined':
            return 'undefined';
        default:
            if (channel === null) {
                return 'null';
            }
            return channel.toString();
    }
}

export function CheckTimeoutOptions(val?: IpcTimeoutOptions): IpcTimeoutOptions {
    val = val || { timeoutDelay: Constants.IpcBusTimeout };

    if (val.timeoutDelay === undefined) {
        val.timeoutDelay = Constants.IpcBusTimeout;
    }

    return val;
}

export function CheckTimeout(val: string | number | Record<'timeoutDelay', number>): number {
    const parseVal = parseFloat(val as string);
    if (!isNaN(parseVal)) {
        return parseVal;
    }

    return Constants.IpcBusTimeout;
}

export function CheckConnectOptions<T extends IpcConnectOptions>(
    arg1?: T | string | number,
    arg2?: T | string,
    arg3?: T
): T {
    // A port number : 59233, 42153
    // A port number + hostname : 59233, '127.0.0.1'
    const options: T = (
        typeof arg1 === 'object' ? arg1 : typeof arg2 === 'object' ? arg2 : typeof arg3 === 'object' ? arg3 : {}
    ) as T;
    if (Number(arg1) >= 0) {
        options.port = Number(arg1);
        options.host = typeof arg2 === 'string' ? arg2 : undefined;
    } else if (typeof arg1 === 'string') {
        try {
            // First check if it is a valid URL
            const url = new URL(arg1);
            options.host = url.hostname;
            options.port = Number(url.port);
        } catch {
            // A 'hostname:port' pattern : 'localhost:8082'
            const parts = arg1.split(':');
            if (parts.length === 2 && Number(parts[1]) >= 0) {
                options.port = Number(parts[1]);
                options.host = parts[0];
            } else {
                options.path = arg1;
            }
        }
    }
    // A path : '//local-ipc'
    // An IpcNetOptions object similar to NodeJS.net.ListenOptions
    if (options.path) {
        options.path = cleanPipeName(options.path);
    }
    if (options.timeoutDelay === undefined) {
        options.timeoutDelay = Constants.IpcBusTimeout;
    }
    // do no return a 'null' options
    return Object.assign({}, options);
}
