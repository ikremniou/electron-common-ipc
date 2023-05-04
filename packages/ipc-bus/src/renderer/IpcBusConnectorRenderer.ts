/// <reference types='electron' />

import { CheckConnectOptions, IpcBusConnectorImpl } from '@electron-common-ipc/universal';
import * as queueMicrotask from 'queue-microtask';

import { fixRawData } from '../utils';
import { GetTargetRenderer, SmartMessageBag } from '../utils/IpcBusCommand-helpers';

import type { IpcBusProcessPeer } from '../client/IpcBusClient';
import type {
    IpcBusProcessType,
    UuidProvider,
    IpcBusMessage,
    ConnectorHandshake,
    IpcBusConnectorClient,
    ClientConnectOptions,
    IpcBusCommand,
    BusMessagePort,
} from '@electron-common-ipc/universal';
import type { EventEmitter } from 'events';
import type { IpcPacketBufferCore } from 'socket-serializer';

export const IPCBUS_TRANSPORT_RENDERER_HANDSHAKE = 'ECIPC:IpcBusRenderer:Handshake';
export const IPCBUS_TRANSPORT_RENDERER_COMMAND = 'ECIPC:IpcBusRenderer:RendererCommand';
export const IPCBUS_TRANSPORT_RENDERER_MESSAGE = 'ECIPC:IpcBusRenderer:RendererMessage';
export const IPCBUS_TRANSPORT_RENDERER_LOGROUNDTRIP = 'ECIPC:IpcBusRenderer:RendererLogRoundtrip';

export interface IpcWindow extends EventEmitter {
    send(channel: string, ...args: any[]): void;
    sendTo(webContentsId: number, channel: string, ...args: any[]): void;
    postMessage(channel: string, message: unknown, messagePorts?: MessagePort[]): void;
}

// Implementation for renderer process
/** @internal */
export class IpcBusConnectorRenderer extends IpcBusConnectorImpl {
    private readonly _ipcWindow: IpcWindow;
    private readonly _messageBag: SmartMessageBag;
    private _messageChannel: MessageChannel;
    private _commandChannel: MessageChannel;

    constructor(uuid: UuidProvider, contextType: IpcBusProcessType, isMainFrame: boolean, ipcWindow: IpcWindow) {
        // assert(contextType === 'renderer', `IpcBusTransportWindow: contextType must not be a ${contextType}`);
        super(uuid, contextType, 'connector-renderer');
        this._ipcWindow = ipcWindow;

        const rendererPeer = this._peer as IpcBusProcessPeer;
        rendererPeer.process = { isMainFrame: isMainFrame, pid: -1 };
        this._messageBag = new SmartMessageBag();

        this.onPortMessageReceived = this.onPortMessageReceived.bind(this);
        this.onPortCommandReceived = this.onPortCommandReceived.bind(this);
        this.onIPCMessageReceived = this.onIPCMessageReceived.bind(this);
        this.onIPCCommandReceived = this.onIPCCommandReceived.bind(this);
    }

    isTarget(ipcMessage: IpcBusMessage): boolean {
        return this.peer.id === ipcMessage.peer?.id;
    }

    /// IpcBusTrandport API
    handshake(client: IpcBusConnectorClient, options: ClientConnectOptions): Promise<ConnectorHandshake> {
        return this._connectCloseState.connect(() => {
            // Keep IPC as primary media
            return this.onIPCHandshake(client, options);
        });
    }

    shutdown(): Promise<void> {
        return this._connectCloseState.close(() => {
            this.onConnectorBeforeShutdown();
            this.onConnectorShutdown();
            return Promise.resolve();
        });
    }

    postMessage(ipcMessage: IpcBusMessage, args?: unknown[], messagePorts?: ReadonlyArray<BusMessagePort>): void {
        this._messageBag.set(ipcMessage, args);
        if (!messagePorts) {
            const target = GetTargetRenderer(ipcMessage, true);
            if (target && target.process.isMainFrame) {
                this._messageBag.sendIPCMessageTo(
                    this._ipcWindow,
                    target.process.wcid,
                    IPCBUS_TRANSPORT_RENDERER_MESSAGE
                );
            } else {
                this._messageBag.sendIPCMessage(this._ipcWindow, IPCBUS_TRANSPORT_RENDERER_MESSAGE);
            }
            return;
        }
        this._messageBag.sendPortMessage(this._messageChannel.port1, messagePorts);
    }

    // We keep ipcCommand in plain text, once again to have master handling it easily
    postCommand(ipcCommand: IpcBusCommand): void {
        ipcCommand.peer = ipcCommand.peer || this._peer;
        this._ipcWindow.send(IPCBUS_TRANSPORT_RENDERER_COMMAND, ipcCommand);
        // this._commandChannel.port1.postMessage(ipcCommand);
    }

    postLogRoundtrip(ipcMessage: IpcBusMessage, args?: unknown[]) {
        this._messageBag.set(ipcMessage, args);
        this._messageBag.sendIPCMessage(this._ipcWindow, IPCBUS_TRANSPORT_RENDERER_LOGROUNDTRIP);
    }

    protected override onConnectorBeforeShutdown() {
        super.onConnectorBeforeShutdown();
        this._ipcWindow.removeListener(IPCBUS_TRANSPORT_RENDERER_MESSAGE, this.onIPCMessageReceived);
        this._ipcWindow.removeListener(IPCBUS_TRANSPORT_RENDERER_COMMAND, this.onIPCCommandReceived);

        if (this._messageChannel) {
            this._messageChannel.port1.removeEventListener('message', this.onPortMessageReceived);
            this._messageChannel.port1.close();
            this._messageChannel = null;
        }
        if (this._commandChannel) {
            this._commandChannel.port1.removeEventListener('message', this.onPortCommandReceived);
            this._commandChannel.port1.close();
            this._commandChannel = null;
        }
    }

    protected onIPCMessageReceived(event: Electron.IpcRendererEvent, ipcMessage: IpcBusMessage, data: unknown) {
        // It may happen Electron is breaking the JS context when messages are emitted very fast
        // especially when processing of each takes time. So delay the code excecuted for an event.
        queueMicrotask(() => {
            if (ipcMessage.isRawData) {
                // Electron IPC "corrupts" Buffer to a Uint8Array
                const ipcPacketBufferCore = fixRawData(data as IpcPacketBufferCore.RawData);
                this._client.onConnectorPacketReceived(ipcMessage, ipcPacketBufferCore);
            } else {
                this._client.onConnectorArgsReceived(ipcMessage, data as unknown[]);
            }
        });
    }

    protected onPortMessageReceived(event: MessageEvent) {
        queueMicrotask(() => {
            const [ipcMessage, data] = event.data;
            if (ipcMessage.isRawData) {
                // Electron IPC "corrupts" Buffer to a Uint8Array
                const ipcPacketBufferCore = fixRawData(data as IpcPacketBufferCore.RawData);
                this._client.onConnectorPacketReceived(ipcMessage, ipcPacketBufferCore, event.ports);
            } else {
                this._client.onConnectorArgsReceived(ipcMessage, data, event.ports);
            }
        });
    }

    protected onIPCCommandReceived(_event: Electron.IpcRendererEvent, ipcCommand: IpcBusCommand) {
        this._client.onConnectorCommandBase(ipcCommand);
    }

    protected onPortCommandReceived(event: MessageEvent) {
        const ipcCommand = event.data as IpcBusCommand;
        this._client.onConnectorCommandBase(ipcCommand);
    }

    protected onIPCHandshake(
        client: IpcBusConnectorClient,
        options: ClientConnectOptions
    ): Promise<ConnectorHandshake> {
        return new Promise<ConnectorHandshake>((resolve, reject) => {
            // Do not type timer as it may differ between node and browser api, let compiler and browserify deal with.
            let timer: NodeJS.Timer;
            const onHandshake = (_event: Electron.IpcRendererEvent, handshake: ConnectorHandshake) => {
                clearTimeout(timer);
                this._ipcWindow.addListener(IPCBUS_TRANSPORT_RENDERER_MESSAGE, this.onIPCMessageReceived);
                this._ipcWindow.addListener(IPCBUS_TRANSPORT_RENDERER_COMMAND, this.onIPCCommandReceived);

                this.addClient(client);

                this._messageChannel.port1.addEventListener('message', this.onPortMessageReceived);
                this._messageChannel.port1.start();

                // We have to keep the reference untouched as used by client
                const peerProcess = this._peer as IpcBusProcessPeer;
                const handshakeProcess = handshake.peer as IpcBusProcessPeer;
                peerProcess.process = Object.assign(peerProcess.process, handshakeProcess.process);
                this.onConnectorHandshake();
                resolve(handshake);
            };

            // Below zero = infinite
            options = CheckConnectOptions(options);
            if (options.timeoutDelay >= 0) {
                timer = setTimeout(() => {
                    timer = null;
                    this._ipcWindow.removeListener(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, onHandshake);
                    reject('timeout');
                }, options.timeoutDelay);
            }

            this._messageChannel = new MessageChannel();
            this._ipcWindow.once(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, onHandshake);
            this._ipcWindow.postMessage(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, { peer: this.peer }, [
                this._messageChannel.port2,
            ]);
        });
    }

    protected onPortHandshake(
        client: IpcBusConnectorClient,
        options: ClientConnectOptions
    ): Promise<ConnectorHandshake> {
        return new Promise<ConnectorHandshake>((resolve, reject) => {
            // Do not type timer as it may differ between node and browser api, let compiler and browserify deal with.
            let timer: NodeJS.Timer;
            const onHandshake = (event: MessageEvent) => {
                clearTimeout(timer);
                this._ipcWindow.addListener(IPCBUS_TRANSPORT_RENDERER_MESSAGE, this.onIPCMessageReceived);

                this._commandChannel.port1.addEventListener('message', this.onPortCommandReceived);
                this._commandChannel.port1.removeEventListener('message', onHandshake);

                this._messageChannel.port1.addEventListener('message', this.onPortMessageReceived);
                this._messageChannel.port1.start();

                this.addClient(client);
                const handshake = event.data as ConnectorHandshake;

                // We have to keep the reference untouched as used by client
                // TODO_IK_2: check peerProcess
                // this._peerProcess.process = Object.assign(this._peerProcess.process, handshake.process);
                this.onConnectorHandshake();
                resolve(handshake);
            };

            // Below zero = infinite
            options = CheckConnectOptions(options);
            if (options.timeoutDelay >= 0) {
                timer = setTimeout(() => {
                    timer = null;
                    this._commandChannel.port1.removeEventListener('message', onHandshake);
                    reject('timeout');
                }, options.timeoutDelay);
            }
            this._messageChannel = new MessageChannel();

            this._commandChannel = new MessageChannel();
            this._commandChannel.port1.addEventListener('message', onHandshake);
            this._commandChannel.port1.start();
            this._ipcWindow.postMessage(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, { peer: this.peer }, [
                this._messageChannel.port2,
                this._commandChannel.port2,
            ]);
        });
    }
}
