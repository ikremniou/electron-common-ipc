import type * as net from 'net';

import type { IpcPacketBuffer, IpcPacketBufferCore, IpcPacketBufferList } from 'socket-serializer';
import { WriteBuffersToSocket } from 'socket-serializer';

import type * as Client from '../client/IpcBusClient';
import * as IpcBusCommandHelpers from '../utils/IpcBusCommand-helpers';
import { IpcBusCommand, IpcBusMessage } from '../utils/IpcBusCommand';
import { IpcBusBrokerImpl } from '../node/IpcBusBrokerImpl';

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
        return IpcBusCommandHelpers.GetTargetProcess(ipcMessage) != null;
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
        throw 'TODO';
    }

    broadcastData(ipcMessage: IpcBusMessage, data: IpcPacketBuffer.RawData | any[]): boolean {
        if (ipcMessage.isRawData) {
            const rawData = data as IpcPacketBuffer.RawData;
            if (rawData.buffer) {
                return this.broadcastBuffers(ipcMessage, [rawData.buffer]);
            }
            else {
                return this.broadcastBuffers(ipcMessage, rawData.buffers);
            }
        }
        throw 'not supported';
    }

    broadcastPacket(ipcMessage: IpcBusMessage, ipcPacketBufferCore: IpcPacketBufferCore): boolean {
        return this.broadcastBuffers(ipcMessage, ipcPacketBufferCore.buffers);
    }

    // Come from the main bridge: main or renderer
    protected broadcastBuffers(ipcMessage: IpcBusMessage, buffers: Buffer[]): boolean {
        const target = IpcBusCommandHelpers.GetTargetProcess(ipcMessage);
        if (target) {
            const endpoint = this._endpoints.get(target.process.pid);
            if (endpoint) {
                WriteBuffersToSocket(endpoint.socket, buffers);
                return true;
            }
        }
        if (ipcMessage.kind === IpcBusCommand.Kind.SendMessage) {
            // this._subscriptions.pushResponseChannel have been done in the base class when getting socket
            this._subscriptions.forEachChannel(ipcMessage.channel, (connData) => {
                WriteBuffersToSocket(connData.data.socket, buffers);
            });
        }
        return false;
    }

    protected override _reset(closeServer: boolean) {
        super._reset(closeServer);
        this._bridge._onSocketClosed();
    }

    protected override broadcastCommandToBridge(ipcCommand: IpcBusCommand): void {
        this._bridge._onSocketCommandReceived(ipcCommand);
    }

    protected override broadcastToBridgeRequestResponse(socket: net.Socket, ipcMessage: IpcBusMessage, ipcPacketBufferList: IpcPacketBufferList) {
        this._bridge._onSocketRequestResponseReceived(ipcMessage, ipcPacketBufferList);
    }

    protected override broadcastToBridgeMessage(socket: net.Socket, ipcMessage: IpcBusMessage, ipcPacketBufferList: IpcPacketBufferList) {
        this._bridge._onSocketMessageReceived(ipcMessage, ipcPacketBufferList);
    }
}
