import type { IpcPacketBuffer } from 'socket-serializer';

import type * as Client from '../IpcBusClient';
import type { IpcBusCommand, IpcBusMessage } from '../IpcBusCommand';
import type { IpcBusLogMain } from '../log/IpcBusLogConfigMain';
import type { IpcBusRendererContent } from '../renderer/IpcBusRendererContent';

import { IpcBusBridgeImpl } from './IpcBusBridgeImpl';

// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusBridgeLogger extends IpcBusBridgeImpl {
    private _ipcBusLog: IpcBusLogMain;

    constructor(contextType: Client.IpcBusProcessType, ipcBusLog: IpcBusLogMain) {
        super(contextType);
        this._ipcBusLog = ipcBusLog;
    }

    addLog(command: IpcBusCommand, args: any[], payload?: number): boolean {
        return this._ipcBusLog.addLog(command, args);
    }

    addLogRawContent(ipcCommand: IpcBusCommand, IpcBusRendererContent: IpcBusRendererContent): boolean {
        return this._ipcBusLog.addLogRawContent(ipcCommand, IpcBusRendererContent);
    }

    addLogPacket(ipcCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer): boolean {
        return this._ipcBusLog.addLogPacket(ipcCommand, ipcPacketBuffer);
    }
    
    // _onRendererArgsReceived(ipcCommand: IpcBusCommand, args: any[]) {
    //     if (this._ipcBusLog.addLog(ipcCommand, args)) {
    //         super._onRendererArgsReceived(ipcCommand, args);
    //     }
    // }

    _onRendererContentReceived(ipcMessage: IpcBusMessage, IpcBusRendererContent: IpcBusRendererContent) {
        if (this._ipcBusLog.addLogRawContent(ipcMessage, IpcBusRendererContent)) {
            super._onRendererContentReceived(ipcMessage, IpcBusRendererContent);
        }
    }

    _onMainMessageReceived(ipcMessage: IpcBusMessage, args?: any[]) {
        if (this._ipcBusLog.addLog(ipcMessage, args)) {
            super._onMainMessageReceived(ipcMessage, args);
        }
    }

    _onSocketMessageReceived(ipcMessage: IpcBusMessage, ipcPacketBuffer: IpcPacketBuffer) {
        if (this._ipcBusLog.addLogPacket(ipcMessage, ipcPacketBuffer)) {
            super._onSocketMessageReceived(ipcMessage, ipcPacketBuffer);
        }
    }

}

