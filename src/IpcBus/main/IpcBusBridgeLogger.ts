import type { IpcPacketBuffer, IpcPacketBufferCore } from 'socket-serializer';

import type * as Client from '../IpcBusClient';
import type { IpcBusMessage } from '../IpcBusCommand';
import type { IpcBusLogMain } from '../log/IpcBusLogConfigMain';
import { IpcBusRendererContent } from '../renderer/IpcBusRendererContent';

import { IpcBusBridgeDispatcher, IpcBusBridgeImpl } from './IpcBusBridgeImpl';

// This class ensures the messagePorts of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusBridgeLogger extends IpcBusBridgeImpl implements IpcBusBridgeDispatcher {
    private _ipcBusLog: IpcBusLogMain;

    constructor(contextType: Client.IpcBusProcessType, ipcBusLog: IpcBusLogMain) {
        super(contextType);
        this._ipcBusLog = ipcBusLog;
    }

    override _onLogReceived(ipcMessage: IpcBusMessage, data: any) {
        if (ipcMessage.isRawData) {
            const rawData = data as IpcPacketBufferCore.RawData;
            IpcBusRendererContent.FixRawContent(rawData);
            this._ipcBusLog.addLogRawContent(ipcMessage, rawData);
        }
        else {
            const args = data as any[];
            this._ipcBusLog.addLog(ipcMessage, args);
        }
    }
    
    override _onRendererMessageReceived(ipcMessage: IpcBusMessage, data: IpcPacketBufferCore.RawData | any[], messagePorts?: Electron.MessagePortMain[]) {
        if (ipcMessage.isRawData) {
            const rawData = data as IpcPacketBufferCore.RawData;
            IpcBusRendererContent.FixRawContent(rawData);
            this._ipcBusLog.addLogRawContent(ipcMessage, rawData);
        }
        else {
            const args = data as any[];
            this._ipcBusLog.addLog(ipcMessage, args);
        }
        super._onRendererMessageReceived(ipcMessage, data, messagePorts);
    }

    override _onMainMessageReceived(ipcMessage: IpcBusMessage, data: any, messagePorts?: Electron.MessagePortMain[]) {
        this._ipcBusLog.addLog(ipcMessage, data);
        super._onMainMessageReceived(ipcMessage, data, messagePorts);
    }

    override _onSocketMessageReceived(ipcMessage: IpcBusMessage, ipcPacketBuffer: IpcPacketBuffer): boolean {
        if (this._ipcBusLog.addLogPacket(ipcMessage, ipcPacketBuffer)) {
            return super._onSocketMessageReceived(ipcMessage, ipcPacketBuffer);
        }
        return true;
    }

    override _onSocketRequestResponseReceived(ipcMessage: IpcBusMessage, ipcPacketBuffer: IpcPacketBuffer): boolean {
        if (this._ipcBusLog.addLogPacket(ipcMessage, ipcPacketBuffer)) {
            return super._onSocketRequestResponseReceived(ipcMessage, ipcPacketBuffer);
        }
        return true;
    }

}

