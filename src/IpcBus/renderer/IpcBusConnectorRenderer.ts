import * as assert from 'assert';
import type { EventEmitter } from 'events';

import { IpcPacketBuffer } from 'socket-serializer';
import { JSONParserV1 } from 'json-helpers';

import * as IpcBusUtils from '../IpcBusUtils';
import type * as Client from '../IpcBusClient';
import type { IpcBusCommand } from '../IpcBusCommand';
import type { IpcBusConnector } from '../IpcBusConnector';
import { IpcBusConnectorImpl } from '../IpcBusConnectorImpl';

import { IpcBusRendererContent } from './IpcBusRendererContent';

export const IPCBUS_TRANSPORT_RENDERER_HANDSHAKE = 'ECIPC:IpcBusRenderer:Handshake';
export const IPCBUS_TRANSPORT_RENDERER_COMMAND_RAWDATA = 'ECIPC:IpcBusRenderer:CommandRawData';
export const IPCBUS_TRANSPORT_RENDERER_COMMAND_ARGS = 'ECIPC:IpcBusRenderer:CommandArgs';

export interface IpcWindow extends EventEmitter {
    send(channel: string, ...args: any[]): void;
    sendTo(webContentsId: number, channel: string, ...args: any[]): void;
}

// Implementation for renderer process
/** @internal */
export class IpcBusConnectorRenderer extends IpcBusConnectorImpl {
    private _ipcWindow: IpcWindow;
    private _onIpcEventRawDataReceived: (...args: any[]) => void;
    private _onIpcEventArgsReceived: (...args: any[]) => void;
    private _useElectronSerialization: boolean;
    // private _useIPCFrameAPI: boolean;
    private _packetOut: IpcPacketBuffer;

    constructor(contextType: Client.IpcBusProcessType, isMainFrame: boolean, ipcWindow: IpcWindow) {
        assert(contextType === 'renderer', `IpcBusTransportWindow: contextType must not be a ${contextType}`);
        super(contextType);
        this._ipcWindow = ipcWindow;
        this._peer.process.isMainFrame = isMainFrame;
        this._packetOut = new IpcPacketBuffer();
        this._packetOut.JSON = JSONParserV1;

        // WE MUST NOT CLEAN-UP IPC ON THIS EVENT AS SOME APPS ARE STILL SENDING MESSAGES AT THIS STAGE.
        // window.addEventListener('beforeunload', (event: BeforeUnloadEvent) => {
            // console.log(`IPCBUS-'beforeunload'`);
            // this.onConnectorBeforeShutdown();
            // this.onConnectorShutdown();
        // });
        // window.addEventListener('pagehide', (event: PageTransitionEvent) => {
        //     // console.log(`IPCBUS-'pagehide'`);
        //     if (event.persisted) {
        //     }
        //     else {
        //         // this.onConnectorBeforeShutdown();
        //         // this.onConnectorShutdown();
        //     }
        // });
        // window.addEventListener('unload', (event: BeforeUnloadEvent) => {
            // console.log(`IPCBUS-'unload'`);
            // setTimeout(() => {
            //     this.onConnectorBeforeShutdown();
            //     this.onConnectorShutdown();
            // }, 1);
        // });
    }

    isTarget(ipcBusCommand: IpcBusCommand): boolean {
        const target = IpcBusUtils.GetTarget(ipcBusCommand);
        return (target
                && (target.type == this._peer.process.type)
                && (target.wcid == this._peer.process.wcid)
                && (target.frameid == this._peer.process.frameid));
    }

    protected onConnectorBeforeShutdown() {
        super.onConnectorBeforeShutdown();
        if (this._onIpcEventRawDataReceived) {
            this._ipcWindow.removeListener(IPCBUS_TRANSPORT_RENDERER_COMMAND_RAWDATA, this._onIpcEventRawDataReceived);
            this._ipcWindow.removeListener(IPCBUS_TRANSPORT_RENDERER_COMMAND_ARGS, this._onIpcEventArgsReceived);
            this._onIpcEventRawDataReceived = null;
            this._onIpcEventArgsReceived = null;
        }
    }

    protected _onConnect(eventOrPeer: any, peerOrArgs: Client.IpcBusPeer | IpcBusConnector.Handshake, handshakeArg: IpcBusConnector.Handshake): IpcBusConnector.Handshake {
        // IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport:Window] _onConnect`);
        // if (this._onIpcEventRawDataReceived) {
        //     this._ipcWindow.removeListener(IPCBUS_TRANSPORT_RENDERER_COMMAND_RAWDATA, this._onIpcEventRawDataReceived);
        //     this._ipcWindow.removeListener(IPCBUS_TRANSPORT_RENDERER_COMMAND_ARGS, this._onIpcEventArgsReceived);
        // }
        let handshake: IpcBusConnector.Handshake;
        // In sandbox mode, 1st parameter is no more the event, but directly arguments !!!
        if (handshakeArg) {
            // IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBusTransport:Window] Sandbox off listening for #${this._messageId}`);
            handshake = handshakeArg;
            this._onIpcEventRawDataReceived = (event, ipcBusCommand, rawData) => {
                IpcBusRendererContent.FixRawContent(rawData);
                this._client.onConnectorRawDataReceived(ipcBusCommand, rawData);
            };
            this._onIpcEventArgsReceived = (event, ipcBusCommand, args) => {
                this._client.onConnectorArgsReceived(ipcBusCommand, args);
            };
        }
        else {
            handshake = peerOrArgs as IpcBusConnector.Handshake;
            this._onIpcEventRawDataReceived = (ipcBusCommand, rawData) => {
                IpcBusRendererContent.FixRawContent(rawData);
                this._client.onConnectorRawDataReceived(ipcBusCommand, rawData);
            };
            this._onIpcEventArgsReceived = (ipcBusCommand, args) => {
                this._client.onConnectorArgsReceived(ipcBusCommand, args);
            };
        }
        // console.warn(`ElectronCommonIpc:handshake${JSON.stringify(handshake)}`);
        this._useElectronSerialization = handshake.useIPCNativeSerialization;
        // this._useIPCFrameAPI = handshake.useIPCFrameAPI;
        // Keep the this._peer.process ref intact as shared with client peers
        this._peer.process = Object.assign(this._peer.process, handshake.process);
        this._log.level = handshake.logLevel;
        this._ipcWindow.addListener(IPCBUS_TRANSPORT_RENDERER_COMMAND_RAWDATA, this._onIpcEventRawDataReceived);
        this._ipcWindow.addListener(IPCBUS_TRANSPORT_RENDERER_COMMAND_ARGS, this._onIpcEventArgsReceived);

        this.onConnectorHandshake();

        return handshake;
    };

    /// IpcBusTrandport API
    handshake(client: IpcBusConnector.Client, options: Client.IpcBusClient.ConnectOptions): Promise<IpcBusConnector.Handshake> {
        return this._connectCloseState.connect(() => {
            return new Promise<IpcBusConnector.Handshake>((resolve, reject) => {
                // Do not type timer as it may differ between node and browser api, let compiler and browserify deal with.
                let timer: NodeJS.Timer;
                const onIpcConnect = (eventOrPeer: any, peerOrArgs: Client.IpcBusPeer | IpcBusConnector.Handshake, handshakeArg: IpcBusConnector.Handshake) => {
                    clearTimeout(timer);
                    this._ipcWindow.removeListener(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, onIpcConnect);
                    this.addClient(client);

                    const handshake = this._onConnect(eventOrPeer, peerOrArgs, handshakeArg);
                    resolve(handshake);
                };

                // Below zero = infinite
                options = IpcBusUtils.CheckConnectOptions(options);
                if (options.timeoutDelay >= 0) {
                    timer = setTimeout(() => {
                        timer = null;
                        this._ipcWindow.removeListener(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, onIpcConnect);
                        reject('timeout');
                    }, options.timeoutDelay);
                }
                // We wait for the bridge confirmation
                this._ipcWindow.addListener(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, onIpcConnect);
                this._ipcWindow.send(IPCBUS_TRANSPORT_RENDERER_HANDSHAKE, this._peer);
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

    postMessage(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        const target = IpcBusUtils.GetTarget(ipcBusCommand);
        if (this._useElectronSerialization) {
            try {
                if (target && (target.type === this._peer.process.type) && target.isMainFrame) {
                    this._ipcWindow.sendTo(target.wcid, IPCBUS_TRANSPORT_RENDERER_COMMAND_ARGS, ipcBusCommand, args);
                }
                else {
                    this._ipcWindow.send(IPCBUS_TRANSPORT_RENDERER_COMMAND_ARGS, ipcBusCommand, args);
                }
               return;
            }
            catch (err) {
                // maybe an arg does not supporting Electron serialization !
            }
        }
        JSONParserV1.install();
        this._packetOut.serialize([ipcBusCommand, args]);
        JSONParserV1.uninstall();
        const rawData = this._packetOut.getRawData();
        if (target && (target.type === this._peer.process.type) && target.isMainFrame) {
            this._ipcWindow.sendTo(target.wcid, IPCBUS_TRANSPORT_RENDERER_COMMAND_RAWDATA, ipcBusCommand, rawData);
        }
        else {
            this._ipcWindow.send(IPCBUS_TRANSPORT_RENDERER_COMMAND_RAWDATA, ipcBusCommand, rawData);
        }
    }

    // We serialize in renderer process to save master CPU.
    // We keep ipcBusCommand in plain text, once again to have master handling it easily
    postCommand(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        ipcBusCommand.peer = this._peer;
        if (this._useElectronSerialization) {
            try {
                this._ipcWindow.send(IPCBUS_TRANSPORT_RENDERER_COMMAND_ARGS, ipcBusCommand, args);
                return;
            }
            catch (err) {
                // maybe an object does not supporting Electron serialization !
            }
        }
        JSONParserV1.install();
        this._packetOut.serialize([ipcBusCommand, args]);
        JSONParserV1.uninstall();
        const rawData = this._packetOut.getRawData();
        this._ipcWindow.send(IPCBUS_TRANSPORT_RENDERER_COMMAND_RAWDATA, ipcBusCommand, rawData);
    }

    postBuffers(buffers: Buffer[]) {
        throw 'not implemented';
    }
}
