import { IpcBusBridgeImpl } from './IpcBusBridgeImpl';
import { FixRawContent } from '../renderer/IpcBusRendererContent';

import type { IpcBusBridgeDispatcher } from './IpcBusBridgeImpl';
import type { IpcBusLogMain } from '../log/IpcBusLogConfig-main';
import type {
    IpcBusMessage,
    IpcBusProcessType,
    Logger,
    MessageStamp,
    UuidProvider,
} from '@electron-common-ipc/universal';
import type { IpcPacketBuffer, IpcPacketBufferCore } from 'socket-serializer';

// This class ensures the messagePorts of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusBridgeLogger extends IpcBusBridgeImpl implements IpcBusBridgeDispatcher {
    private readonly _ipcBusLog: IpcBusLogMain;

    constructor(
        contextType: IpcBusProcessType,
        ipcBusLog: IpcBusLogMain,
        uuid: UuidProvider,
        stamp?: MessageStamp,
        logger?: Logger
    ) {
        super(contextType, uuid, stamp, logger);
        this._ipcBusLog = ipcBusLog;
    }

    override _onRendererLogReceived(ipcMessage: IpcBusMessage, data: IpcPacketBufferCore.RawData | unknown[]): void {
        if (ipcMessage.isRawData) {
            const rawData = data as IpcPacketBufferCore.RawData;
            FixRawContent(rawData);
            this._ipcBusLog.addLogRawContent(ipcMessage, rawData);
        } else {
            const args = data as unknown[];
            this._ipcBusLog.addLog(ipcMessage, args);
        }
    }

    override _onRendererMessageReceived(
        ipcMessage: IpcBusMessage,
        data: IpcPacketBufferCore.RawData | unknown[],
        messagePorts?: Electron.MessagePortMain[]
    ) {
        if (ipcMessage.isRawData) {
            const rawData = data as IpcPacketBufferCore.RawData;
            FixRawContent(rawData);
            this._ipcBusLog.addLogRawContent(ipcMessage, rawData);
        } else {
            const args = data as unknown[];
            this._ipcBusLog.addLog(ipcMessage, args);
        }
        super._onRendererMessageReceived(ipcMessage, data, messagePorts);
    }

    override _onMainLogReceived(ipcMessage: IpcBusMessage, args: unknown[]): void {
        this._ipcBusLog.addLog(ipcMessage, args);
    }

    override _onMainMessageReceived(
        ipcMessage: IpcBusMessage,
        args: unknown[],
        messagePorts?: Electron.MessagePortMain[]
    ) {
        this._ipcBusLog.addLog(ipcMessage, args);
        super._onMainMessageReceived(ipcMessage, args, messagePorts);
    }

    override _onSocketLogReceived(ipcMessage: IpcBusMessage, ipcPacketBuffer: IpcPacketBuffer): void {
        this._ipcBusLog.addLogPacket(ipcMessage, ipcPacketBuffer);
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
