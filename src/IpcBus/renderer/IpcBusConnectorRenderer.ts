/// <reference types='electron' />

import * as assert from 'assert';
import type { EventEmitter } from 'events';

import * as IpcBusUtils from '../IpcBusUtils';
import * as IpcBusCommandHelpers from '../IpcBusCommand-helpers';
import type * as Client from '../IpcBusClient';
import type { IpcBusMessage } from '../IpcBusCommand';
import { IpcBusCommand } from '../IpcBusCommand';
import type { IpcBusConnector } from '../IpcBusConnector';
import { IpcBusConnectorImpl } from '../IpcBusConnectorImpl';

import { IpcBusRendererContent } from './IpcBusRendererContent';
import type { QueryStateConnector } from '../IpcBusQueryState';

export const IPCBUS_TRANSPORT_RENDERER_HANDSHAKE = 'ECIPC:IpcBusRenderer:Handshake';
export const IPCBUS_TRANSPORT_RENDERER_COMMAND = 'ECIPC:IpcBusRenderer:RendererCommand';
export const IPCBUS_TRANSPORT_RENDERER_MESSAGE = 'ECIPC:IpcBusRenderer:RendererMessage';
export const IPCBUS_TRANSPORT_RENDERER_LOGROUNDTRIP = 'ECIPC:IpcBusRenderer:RendererLogRoundtrip';

export interface IpcWindow extends EventEmitter {
    send(channel: string, ...args: any[]): void;
    sendTo(webContentsId: number, channel: string, ...args: any[]): void;
    postMessage(channel: string, message: any, messagePorts?: MessagePort[]): void;
}

// Implementation for renderer process
/** @internal */
export class IpcBusConnectorRenderer extends IpcBusConnectorImpl {
    private _ipcWindow: IpcWindow;
    private _messageBag: IpcBusCommandHelpers.SmartMessageBag;
    private _messageChannel: MessageChannel;
    private _commandChannel: MessageChannel;

    constructor(contextType: Client.IpcBusProcessType, isMainFrame: boolean, ipcWindow: IpcWindow) {
        assert(contextType === 'renderer', `IpcBusTransportWindow: contextType must not be a ${contextType}`);
        super(contextType);
        this._ipcWindow = ipcWindow;
        this._peerProcess.process.isMainFrame = isMainFrame;
        this._messageBag = new IpcBusCommandHelpers.SmartMessageBag();

        this.onPortMessageReceived = this.onPortMessageReceived.bind(this);
        this.onPortCommandReceived = this.onPortCommandReceived.bind(this);
        this.onIPCMessageReceived = this.onIPCMessageReceived.bind(this);
        this.onIPCCommandReceived = this.onIPCCommandReceived.bind(this);
    }

    isTarget(ipcMessage: IpcBusMessage): boolean {
        const target = IpcBusCommandHelpers.GetTargetRenderer(ipcMessage);
        return (target
                && (target.process.pid == this._peerProcess.process.pid)
                && (target.process.wcid == this._peerProcess.process.wcid)
                && (target.process.frameid == this._peerProcess.process.frameid));
    }

    protected override onConnectorBeforeShutdown() {
        super.onConnectorBeforeShutdown();
        this._ipcWindow.removeListener(IPCBUS_TRANSPORT_RENDERER_MESSAGE, this.onIPCMessageReceived);
        this._ipcWindow.removeListener(IPCBUS_TRANSPORT_RENDERER_COMMAND, this.onIPCCommandReceived);

        if (this._messageChannel) {
            this._messageChannel.port1.removeEventListener('message', this.onPortMessageReceived);
            this._messageChannel.port1.close();
            this._messageChannel = null;

            this._commandChannel.port1.removeEventListener('message', this.onPortCommandReceived);
            this._commandChannel.port1.close();
            this._commandChannel = null;
        }
    }

    protected onIPCMessageReceived(event: Electron.IpcRendererEvent, ipcMessage: IpcBusMessage, data: any) {
        if (ipcMessage.rawData) {
            // Electron IPC "corrupts" Buffer to a Uint8Array
            IpcBusRendererContent.FixRawContent(data);
            this._client.onConnectorRawDataReceived(ipcMessage, data);
        }
        else {
            this._client.onConnectorArgsReceived(ipcMessage, data);
        }
    }

    protected onPortMessageReceived(event?: MessageEvent) {
        const [ipcMessage, data] = event.data;
        if (ipcMessage.rawData) {
            // Electron IPC "corrupts" Buffer to a Uint8Array
            IpcBusRendererContent.FixRawContent(data);
            this._client.onConnectorRawDataReceived(ipcMessage, data, event.ports);
        }
        else {
            this._client.onConnectorArgsReceived(ipcMessage, data, event.ports);
        }
    }

    protected onIPCCommandReceived(event: Electron.IpcRendererEvent, ipcCommand: IpcBusCommand) {
        this.onCommandReceived(ipcCommand);
    }

    protected onPortCommandReceived(event?: MessageEvent) {
        const ipcCommand = event.data as IpcBusCommand;
        this.onCommandReceived(ipcCommand);
    }

    override onCommandReceived(ipcCommand: IpcBusCommand): void {
        switch (ipcCommand.kind) {
            case IpcBusCommand.Kind.QueryState: {
                const queryState: QueryStateConnector = {
                    type: 'connector-renderer',
                    process: this._peerProcess.process,
                    peerProcess: this._peerProcess,
                }
                this.postCommand({
                    kind: IpcBusCommand.Kind.QueryStateResponse,
                    data: {
                        id: ipcCommand.channel,
                        queryState
                    }
                } as any);
                break;
            }
        }
        super.onCommandReceived(ipcCommand);
    }

    protected onIPCHandshake(client: IpcBusConnector.Client, options: Client.IpcBusClient.ConnectOptions): Promise<IpcBusConnector.Handshake> {
        return new Promise<IpcBusConnector.Handshake>((resolve, reject) => {
            // Do not type timer as it may differ between node and browser api, let compiler and browserify deal with.
            let timer: NodeJS.Timer;
            const onHandshake = (event: Electron.IpcRendererEvent, handshake: IpcBusConnector.Handshake) => {
                clearTimeout(timer);
                this._ipcWindow.addListener(IPCBUS_TRANSPORT_RENDERER_MESSAGE, this.onIPCMessageReceived);
                this._ipcWindow.addListener(IPCBUS_TRANSPORT_RENDERER_COMMAND, this.onIPCCommandReceived);

                this.addClient(client);

                // We have to keep the reference untouched as used by client
                this._peerProcess.process = Object.assign(this._peerProcess.process, handshake.process);
                this._log.level = handshake.logLevel;
                this.onConnectorHandshake();
                resolve(handshake);
            };

            // Below zero = infinite
            options = IpcBusUtils.CheckConnectOptions(options);
            if (options.timeoutDelay >= 0) {
                timer = setTimeout(() => {
                    timer = null;
                    this._ipcWindow.removeListener(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, onHandshake);
                    reject('timeout');
                }, options.timeoutDelay);
            }
            const ipcCommand = { 
                peer: this._peerProcess 
            };
            this._ipcWindow.once(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, onHandshake);
            this._ipcWindow.send(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, ipcCommand);
        });
    }

    protected onPortHandshake(client: IpcBusConnector.Client, options: Client.IpcBusClient.ConnectOptions): Promise<IpcBusConnector.Handshake> {
        return new Promise<IpcBusConnector.Handshake>((resolve, reject) => {
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
                const handshake = event.data as IpcBusConnector.Handshake;

                // We have to keep the reference untouched as used by client
                this._peerProcess.process = Object.assign(this._peerProcess.process, handshake.process);
                this._log.level = handshake.logLevel;
                this.onConnectorHandshake();
                resolve(handshake);
            };

            // Below zero = infinite
            options = IpcBusUtils.CheckConnectOptions(options);
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
            const ipcCommand = { 
                peer: this._peerProcess 
            };
            this._ipcWindow.postMessage(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, ipcCommand, [this._commandChannel.port2, this._messageChannel.port2]);
        });
    }

    /// IpcBusTrandport API
    handshake(client: IpcBusConnector.Client, options: Client.IpcBusClient.ConnectOptions): Promise<IpcBusConnector.Handshake> {
        return this._connectCloseState.connect(() => {
            // Keep IPC a primary media
            return this.onIPCHandshake(client, options);
        });
    }

    shutdown(options?: Client.IpcBusClient.CloseOptions): Promise<void> {
        return this._connectCloseState.close(() => {
            this.onConnectorBeforeShutdown();
            this.onConnectorShutdown();
            return Promise.resolve();
        });
    }

    postMessage(ipcMessage: IpcBusMessage, args?: any[], messagePorts?: ReadonlyArray<Client.IpcMessagePortType>): void {
        this._messageBag.set(ipcMessage, args);
        if (messagePorts == null) {
            const target = IpcBusCommandHelpers.GetTargetRenderer(ipcMessage, true);
            if (target && target.process.isMainFrame) {
                this._messageBag.sendIPCMessageTo(this._ipcWindow, target.process.wcid, IPCBUS_TRANSPORT_RENDERER_MESSAGE);
            }
            else {
                this._messageBag.sendIPCMessage(this._ipcWindow, IPCBUS_TRANSPORT_RENDERER_MESSAGE);
            }
            return;
        }
        this._messageBag.sendPortMessage(this._messageChannel.port1, messagePorts);
    }

    // We keep ipcCommand in plain text, once again to have master handling it easily
    postCommand(ipcCommand: IpcBusCommand): void {
        ipcCommand.peer = ipcCommand.peer || this._peerProcess;
        this._ipcWindow.send(IPCBUS_TRANSPORT_RENDERER_COMMAND, ipcCommand);
        // this._commandChannel.port1.postMessage(ipcCommand);
    }

    postLogRoundtrip(ipcMessage: IpcBusMessage, args?: any[]) {
        const ipcBusLog: IpcBusMessage = Object.assign({}, ipcMessage, { kind: IpcBusCommand.Kind.LogRoundtrip });
        ipcBusLog.stamp.kind = ipcMessage.kind;
        this._messageBag.set(ipcBusLog, args);
        this._messageBag.sendIPCMessage(this._ipcWindow, IPCBUS_TRANSPORT_RENDERER_LOGROUNDTRIP);
    }

}
