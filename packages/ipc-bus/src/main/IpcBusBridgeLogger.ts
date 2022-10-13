import type { IpcPacketBuffer, IpcPacketBufferCore } from 'socket-serializer';

import type * as Client from '../client/IpcBusClient';
import type { IpcBusMessage } from '../utils/IpcBusCommand';
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

    override _onRendererLogReceived(ipcMessage: IpcBusMessage, data: IpcPacketBufferCore.RawData | any[]): void {
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

    override _onMainLogReceived(ipcMessage: IpcBusMessage, args: any[]): void {
        this._ipcBusLog.addLog(ipcMessage, args);
    }

    override _onMainMessageReceived(ipcMessage: IpcBusMessage, args: any[], messagePorts?: Electron.MessagePortMain[]) {
        this._ipcBusLog.addLog(ipcMessage, args);
        super._onMainMessageReceived(ipcMessage, args, messagePorts);
    }

    override _onSocketLogReceived(ipcMessage: IpcBusMessage, ipcPacketBuffer: IpcPacketBuffer): void {
        this._ipcBusLog.addLogPacket(ipcMessage, ipcPacketBuffer)
    };

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

