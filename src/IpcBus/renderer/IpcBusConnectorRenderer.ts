import * as assert from 'assert';
import type { EventEmitter } from 'events';

import { IpcPacketBuffer } from 'socket-serializer';
import { JSONParserV1 } from 'json-helpers';

import * as IpcBusUtils from '../IpcBusUtils';
import type * as Client from '../IpcBusClient';
import type { IpcBusCommand, IpcBusMessage } from '../IpcBusCommand';
import type { IpcBusConnector } from '../IpcBusConnector';
import { IpcBusConnectorImpl } from '../IpcBusConnectorImpl';

import { IpcBusRendererContent } from './IpcBusRendererContent';

export const IPCBUS_TRANSPORT_RENDERER_HANDSHAKE = 'ECIPC:IpcBusRenderer:Handshake';

export interface IpcWindow extends EventEmitter {
    send(channel: string, ...args: any[]): void;
    sendTo(webContentsId: number, channel: string, ...args: any[]): void;
    postMessage(channel: string, message: any, messagePorts?: MessagePort[]): void;
}

// Implementation for renderer process
/** @internal */
export class IpcBusConnectorRenderer extends IpcBusConnectorImpl {
    private _ipcWindow: IpcWindow;
    private _packetOut: IpcPacketBuffer;
    private _messageChannel: MessageChannel;
    private _commandChannel: MessageChannel;

    constructor(contextType: Client.IpcBusProcessType, isMainFrame: boolean, ipcWindow: IpcWindow) {
        assert(contextType === 'renderer', `IpcBusTransportWindow: contextType must not be a ${contextType}`);
        super(contextType);
        this._ipcWindow = ipcWindow;
        this._peerProcess.process.isMainFrame = isMainFrame;
        this._packetOut = new IpcPacketBuffer();
        this._packetOut.JSON = JSONParserV1;

        this.onMessageReceived = this.onMessageReceived.bind(this);
        this.onCommandReceived = this.onCommandReceived.bind(this);
    }

    isTarget(ipcMessage: IpcBusMessage): boolean {
        const target = IpcBusUtils.GetTargetRenderer(ipcMessage);
        return (target
                && (target.process.wcid == this._peerProcess.process.wcid)
                && (target.process.frameid == this._peerProcess.process.frameid));
    }

    protected override onConnectorBeforeShutdown() {
        super.onConnectorBeforeShutdown();
        if (this._messageChannel) {
            this._messageChannel.port1.removeEventListener('message', this.onMessageReceived);
            this._messageChannel.port1.close();
            this._messageChannel = null;

            this._commandChannel.port1.removeEventListener('message', this.onCommandReceived);
            this._commandChannel.port1.close();
            this._commandChannel = null;
        }
    }

    protected onMessageReceived(event?: MessageEvent) {
        const ipcPorts = event.ports ? event.ports.map(IpcBusUtils.CastToMessagePort): undefined;
        const [ipcMessage, data] = event.data;
        if (ipcMessage.rawData) {
            IpcBusRendererContent.FixRawContent(data);
            this._client.onConnectorRawDataReceived(ipcMessage, data, ipcPorts);
        }
        else {
            this._client.onConnectorArgsReceived(ipcMessage, data, ipcPorts);
        }
    }

    protected onCommandReceived(event?: MessageEvent) {
        // const ipcCommand = event.data as IpcBusCommand;
    }

    /// IpcBusTrandport API
    handshake(client: IpcBusConnector.Client, options: Client.IpcBusClient.ConnectOptions): Promise<IpcBusConnector.Handshake> {
        return this._connectCloseState.connect(() => {
            return new Promise<IpcBusConnector.Handshake>((resolve, reject) => {
                // Do not type timer as it may differ between node and browser api, let compiler and browserify deal with.
                let timer: NodeJS.Timer;
                const onHandshake = (event: MessageEvent) => {
                    clearTimeout(timer);
                    this._commandChannel.port1.addEventListener('message', this.onCommandReceived);
                    this._commandChannel.port1.removeEventListener('message', onHandshake);
                
                    this._messageChannel.port1.addEventListener('message', this.onMessageReceived);
                    this._messageChannel.port1.start();

                    this.addClient(client);
                    const handshake = event.data as IpcBusConnector.Handshake;
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
        });
    }

    shutdown(options?: Client.IpcBusClient.CloseOptions): Promise<void> {
        return this._connectCloseState.close(() => {
            this.onConnectorBeforeShutdown();
            this.onConnectorShutdown();
            return Promise.resolve();
        });
    }

    postMessage(ipcMessage: IpcBusMessage, args?: any[], ipcPorts?: Client.IpcBusMessagePort[]): void {
        try {
            this._messageChannel.port1.postMessage([ipcMessage, args], (ipcPorts as any) as MessagePort[]);
        }
        catch (err) {
            // maybe an arg does not supporting Electron serialization !
            ipcMessage.rawData = true;
            JSONParserV1.install();
            this._packetOut.serialize([ipcMessage, args]);
            JSONParserV1.uninstall();
            const rawData = this._packetOut.getRawData();
            this._messageChannel.port1.postMessage([ipcMessage, rawData], (ipcPorts as any) as MessagePort[]);
        }
    }

    // We keep ipcCommand in plain text, once again to have master handling it easily
    postCommand(ipcCommand: IpcBusCommand): void {
        ipcCommand.peer = ipcCommand.peer || this._peerProcess;
        this._commandChannel.port1.postMessage(ipcCommand);
    }
}
