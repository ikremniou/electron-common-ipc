import type * as net from 'net';

import type { IpcPacketBuffer, IpcPacketBufferCore, IpcPacketBufferList } from 'socket-serializer';
import { WriteBuffersToSocket } from 'socket-serializer';

import type * as Client from '../IpcBusClient';
import { IpcBusCommand, IpcBusMessage } from '../IpcBusCommand';
import { IpcBusBrokerImpl } from '../node/IpcBusBrokerImpl';
import * as IpcBusUtils from '../IpcBusUtils';

import type { IpcBusBridgeImpl, IpcBusBridgeClient } from './IpcBusBridgeImpl';

/** @internal */
export class IpcBusBrokerBridge extends IpcBusBrokerImpl implements IpcBusBridgeClient {
    private _bridge: IpcBusBridgeImpl;

    constructor(contextType: Client.IpcBusProcessType, bridge: IpcBusBridgeImpl) {
        super(contextType);

        this._bridge = bridge;
    }

    isTarget(ipcMessage: IpcBusMessage) {
        if (this._subscriptions.hasChannel(ipcMessage.channel)) {
            return true;
        }
        return IpcBusUtils.GetTargetProcess(ipcMessage) != null;
    }

    getChannels(): string[] {
        return this._subscriptions.getChannels();
    }

    broadcastConnect(options: Client.IpcBusClient.ConnectOptions): Promise<void> {
        return super.connect(options).then(() => {});
    }

    broadcastClose(options?: Client.IpcBusClient.ConnectOptions): Promise<void> {
        return super.close(options).then(() => {});
    }

    broadcastCommand(ipcCommand: IpcBusCommand): void {
        throw 'not implemented';
    }

    broadcastArgs(ipcMessage: IpcBusMessage, args: any[]): void {
        throw 'not implemented';
    }

    broadcastRawData(ipcMessage: IpcBusMessage, rawData: IpcPacketBuffer.RawData): void {
        if (rawData.buffer) {
            this.broadcastBuffers(ipcMessage, [rawData.buffer]);
        }
        else {
            this.broadcastBuffers(ipcMessage, rawData.buffers);
        }
    }

    broadcastPacket(ipcMessage: IpcBusMessage, ipcPacketBufferCore: IpcPacketBufferCore): void {
        this.broadcastBuffers(ipcMessage, ipcPacketBufferCore.buffers);
    }

    // Come from the main bridge: main or renderer
    broadcastBuffers(ipcMessage: IpcBusMessage, buffers: Buffer[]): void {
        switch (ipcMessage.kind) {
            case IpcBusCommand.Kind.SendMessage: {
                const target = IpcBusUtils.GetTargetProcess(ipcMessage);
                if (target) {
                    const endpoint = this._endpoints.get(target.pid);
                    if (endpoint) {
                        WriteBuffersToSocket(endpoint.socket, buffers);
                        return;
                    }
                }
                // this._subscriptions.pushResponseChannel have been done in the base class when getting socket
                this._subscriptions.forEachChannel(ipcMessage.channel, (connData) => {
                    WriteBuffersToSocket(connData.data.socket, buffers);
                });
                break;
            }
            case IpcBusCommand.Kind.RequestResponse: {
                const target = IpcBusUtils.GetTargetProcess(ipcMessage);
                if (target) {
                    const endpoint = this._endpoints.get(target.pid);
                    if (endpoint) {
                        WriteBuffersToSocket(endpoint.socket, buffers);
                        return;
                    }
                }
                break;
            }

            case IpcBusCommand.Kind.RequestClose:
                break;
        }
    }

    protected _reset(closeServer: boolean) {
        super._reset(closeServer);
        this._bridge._onSocketClosed();
    }

    protected broadcastToBridge(socket: net.Socket, ipcMessage: IpcBusMessage, ipcPacketBufferList: IpcPacketBufferList) {
        this._bridge._onSocketMessageReceived(ipcMessage, ipcPacketBufferList);
    }

    protected broadcastToBridgeMessage(socket: net.Socket, ipcMessage: IpcBusMessage, ipcPacketBufferList: IpcPacketBufferList) {
        this._bridge._onSocketMessageReceived(ipcMessage, ipcPacketBufferList);
    }
}
