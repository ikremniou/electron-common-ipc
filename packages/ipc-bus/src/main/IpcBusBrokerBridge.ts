import { BrokerImpl, IpcBusCommandKind } from '@electron-common-ipc/universal';

import { NetBrokerServerFactory } from '../node/NetBrokerServerFactory';
import { buffersToList } from '../utils';
import { GetTargetProcess } from '../utils/IpcBusCommand-helpers';

import type { IpcBusBridgeImpl, IpcBusBridgeClient } from './IpcBusBridgeImpl';
import type {
    IpcBusProcessType,
    Logger,
    ClientConnectOptions,
    IpcBusCommand,
    IpcBusMessage,
    QueryStateBase,
} from '@electron-common-ipc/universal';
import type { Socket } from 'net';
import type { IpcPacketBuffer, IpcPacketBufferCore, IpcPacketBufferList } from 'socket-serializer';

/** @internal */
export class IpcBusBrokerBridge extends BrokerImpl implements IpcBusBridgeClient {
    private readonly _bridge: IpcBusBridgeImpl;

    constructor(contextType: IpcBusProcessType, bridge: IpcBusBridgeImpl, logger?: Logger) {
        super(new NetBrokerServerFactory(logger), contextType, logger);
        this._bridge = bridge;
    }

    queryState(): QueryStateBase {
        return super._queryState();
    }

    isTarget(ipcMessage: IpcBusMessage) {
        if (this._subscriptions.hasChannel(ipcMessage.channel)) {
            return true;
        }
        return GetTargetProcess(ipcMessage) !== null;
    }

    getChannels(): string[] {
        return this._subscriptions.getChannels();
    }

    broadcastConnect(options: ClientConnectOptions): Promise<void> {
        return super.connect(options).then(() => {});
    }

    broadcastClose(options?: ClientConnectOptions): Promise<void> {
        return super.close(options).then(() => {});
    }

    broadcastCommand(_ipcCommand: IpcBusCommand): void {
        throw 'TODO';
    }

    broadcastData(ipcMessage: IpcBusMessage, data: IpcPacketBuffer.RawData | unknown[]): boolean {
        if (ipcMessage.isRawData) {
            const rawData = data as IpcPacketBuffer.RawData;
            if (rawData.buffer) {
                return this.broadcastBuffers(ipcMessage, [rawData.buffer]);
            }

            return this.broadcastBuffers(ipcMessage, rawData.buffers);
        }
        throw 'not supported';
    }

    broadcastPacket(ipcMessage: IpcBusMessage, ipcPacketBufferCore: IpcPacketBufferCore): boolean {
        return this.broadcastBuffers(ipcMessage, ipcPacketBufferCore.buffers);
    }

    // Come from the main bridge: main or renderer
    protected broadcastBuffers(ipcMessage: IpcBusMessage, buffers: Buffer[]): boolean {
        const target = GetTargetProcess(ipcMessage);
        if (target) {
            const endpoint = this._endpoints.get(target.id);
            if (endpoint) {
                endpoint.socket.send(buffersToList(buffers));
                return true;
            }
        }
        if (ipcMessage.kind === IpcBusCommandKind.SendMessage) {
            // this._subscriptions.pushResponseChannel have been done in the base class when getting socket
            this._subscriptions.forEachChannel(ipcMessage.channel, (connData) => {
                connData.data.socket.send(buffersToList(buffers));
            });
        }
        return false;
    }

    protected override _reset() {
        super._reset();
        this._bridge._onSocketClosed();
    }

    protected override broadcastCommandToBridge(ipcCommand: IpcBusCommand): void {
        this._bridge._onSocketCommandReceived(ipcCommand);
    }

    protected override broadcastToBridgeRequestResponse(
        _socket: Socket,
        ipcMessage: IpcBusMessage,
        ipcPacketBufferList: IpcPacketBufferList
    ) {
        this._bridge._onSocketRequestResponseReceived(ipcMessage, ipcPacketBufferList);
    }

    protected override broadcastToBridgeMessage(
        _socket: Socket,
        ipcMessage: IpcBusMessage,
        ipcPacketBufferList: IpcPacketBufferList
    ) {
        this._bridge._onSocketMessageReceived(ipcMessage, ipcPacketBufferList);
    }
}
