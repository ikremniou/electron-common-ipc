import { convertProcessTypeToString } from '@electron-common-ipc/universal';
import { JSONParserV1 } from 'json-helpers';
import { BufferReader, IpcPacketBuffer, IpcPacketBufferList, IpcPacketHeader } from 'socket-serializer';

import { FixRawContent } from '../renderer/IpcBusRendererContent';

import type { IpcBusProcess } from '../client/IpcBusClient';
import type { IpcBusPeer } from '@electron-common-ipc/universal';
import type { IpcPacketBufferCore } from 'socket-serializer';

export const IPC_BUS_TIMEOUT = 2000; // 20000;

export function buffersToList(buffers: Buffer[]): IpcPacketBufferList {
    const header = IpcPacketHeader.ReadHeader(new BufferReader(buffers[0]));
    return new IpcPacketBufferList({
        buffers,
        ...header,
    });
}

export function fixRawData(realData: IpcPacketBufferCore.RawData): IpcPacketBufferCore {
    FixRawContent(realData);
    const ipcPacketBufferCore = realData.buffer ? new IpcPacketBuffer(realData) : new IpcPacketBufferList(realData);
    ipcPacketBufferCore.JSON = JSONParserV1;
    return ipcPacketBufferCore;
}

export function requireElectron(): typeof Electron {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const electron = require('electron');
        return electron;
    } catch (err) {
        return undefined;
    }
}

/** @internal */
export function createProcessID(peer: IpcBusPeer, ipcProcess: IpcBusProcess) {
    // static part
    let name = `${convertProcessTypeToString(peer.type)}`;
    if (ipcProcess.wcid) {
        name += `-${ipcProcess.wcid}`;
    }
    if (ipcProcess.rid && ipcProcess.rid !== ipcProcess.wcid) {
        name += `-r${ipcProcess.rid}`;
    }
    if (ipcProcess.frameid) {
        name += `-f${ipcProcess.isMainFrame ? 'm' : 's'}${ipcProcess.frameid}`;
    }
    if (ipcProcess.pid) {
        name += `-p${ipcProcess.pid}`;
    }
    return name;
}

/** @internal */
export type Arr = readonly unknown[];
/** @internal */
export function partialCall<T extends Arr, U extends Arr, R>(f: (...args: [...T, ...U]) => R, ...headArgs: T) {
    return (...tailArgs: U) => f(...headArgs, ...tailArgs);
}

export const Logger = {
    enable: false,
    service: false,
};

export function activateIpcBusTrace(enable: boolean): void {
    Logger.enable = enable;
}

export function activateServiceTrace(enable: boolean): void {
    Logger.service = enable;
}
