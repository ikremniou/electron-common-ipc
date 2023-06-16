/// <reference types='electron' />

import { IpcBusCommandKind, IpcBusConnectorImpl, IpcBusTransportMulti } from '@electron-common-ipc/universal';

import { GetTargetMain } from '../utils/IpcBusCommand-helpers';

import type { IpcBusBridgeImpl } from './IpcBusBridgeImpl';
import type {
    ClientCloseOptions,
    ClientConnectOptions,
    ConnectorHandshake,
    IpcBusCommand,
    IpcBusConnectorClient,
    IpcBusMessage,
    IpcBusProcessType,
    UuidProvider,
    IpcBusPeer,
} from '@electron-common-ipc/universal';

export class IpcBusBridgeConnectorMain extends IpcBusConnectorImpl {
    protected _bridge: IpcBusBridgeImpl;

    constructor(uuid: UuidProvider, contextType: IpcBusProcessType, bridge: IpcBusBridgeImpl) {
        super(uuid, contextType, 'connector-main');
        this._bridge = bridge;
    }

    isTarget(ipcMessage: IpcBusMessage): boolean {
        return GetTargetMain(ipcMessage) !== undefined;
    }

    protected override handshakeInternal(
        _client: IpcBusConnectorClient,
        peer: IpcBusPeer,
        _options: ClientConnectOptions
    ): Promise<ConnectorHandshake> {
        const handshake: ConnectorHandshake = {
            peer,
        };
        return Promise.resolve(handshake);
    }

    protected override shutdownInternal(_options: ClientCloseOptions): Promise<void> {
        return Promise.resolve();
    }

    postMessage(ipcMessage: IpcBusMessage, args: unknown[], messagePorts?: Electron.MessagePortMain[]): void {
        // ipcMessage.process = this._process;
        // Seems to have a bug in Electron, undefined is not supported
        // messagePorts = messagePorts || [];
        this._bridge._onMainMessageReceived(ipcMessage, args, messagePorts);
    }

    postCommand(ipcCommand: IpcBusCommand): void {
        switch (ipcCommand.kind) {
            case IpcBusCommandKind.RemoveChannelAllListeners:
            case IpcBusCommandKind.RemoveListeners:
                throw 'IpcBusTransportMultiImpl - should not happen';

            case IpcBusCommandKind.AddChannelListener:
            case IpcBusCommandKind.RemoveChannelListener:
                this._bridge._onBridgeChannelChanged(ipcCommand);
                break;

            case IpcBusCommandKind.QueryState:
            case IpcBusCommandKind.QueryStateResponse:
                this._bridge._onMainCommandReceived(ipcCommand);
                break;
        }
    }

    postLogRoundtrip(ipcMessage: IpcBusMessage, args?: undefined[]) {
        this._bridge._onMainLogReceived(ipcMessage, args);
    }
}

export class IpcBusBridgeTransportMain extends IpcBusTransportMulti {}
