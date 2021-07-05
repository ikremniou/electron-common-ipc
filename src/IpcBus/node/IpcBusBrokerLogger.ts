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

    onSocketPacket(socket: net.Socket, ipcPacketBufferList: IpcPacketBufferList): void {
        const ipcCommand: IpcBusCommand = ipcPacketBufferList.parseArrayAt(0);
        const args = ipcPacketBufferList.parseArrayAt(1);
        this.addLog(socket, ipcPacketBufferList, ipcCommand, args);

        super.onSocketCommand(socket, ipcCommand, ipcPacketBufferList);
    }
}
