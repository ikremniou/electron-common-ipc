import type * as net from 'net';

import type { IpcPacketBufferCore, IpcPacketBufferList } from 'socket-serializer';

import type * as Client from '../IpcBusClient';

import type { IpcBusCommand } from '../IpcBusCommand';

import { IpcBusBrokerImpl } from './IpcBusBrokerImpl';

/** @internal */
export abstract class IpcBusBrokerLogger extends IpcBusBrokerImpl {
    constructor(contextType: Client.IpcBusProcessType) {
        super(contextType);
    }

    protected abstract addLog(socket: net.Socket, ipcPacketBufferCore: IpcPacketBufferCore, ipcCommand: IpcBusCommand, args: any[]): void;

    override onSocketData(socket: net.Socket, ipcCommand: IpcBusCommand, ipcPacketBufferList: IpcPacketBufferList): void {
        const args = ipcPacketBufferList.parseArrayAt(1);
        this.addLog(socket, ipcPacketBufferList, ipcCommand, args);

        super.onSocketData(socket, ipcCommand, ipcPacketBufferList);
    }
}
