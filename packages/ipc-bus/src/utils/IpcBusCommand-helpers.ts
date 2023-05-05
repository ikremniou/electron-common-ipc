import { IpcBusProcessType } from '@electron-common-ipc/universal';
import { JSONParserV1 } from 'json-helpers';
import { IpcPacketBuffer } from 'socket-serializer';

import { uuidProvider } from './uuid';

import type { BusMessagePort, IpcBusMessage, IpcBusCommand, IpcBusPeer } from '@electron-common-ipc/universal';
import type { Writer } from 'socket-serializer';

const TargetSignature = `_target_`;
const TargetMainSignature = `${TargetSignature}main_`;
const TargetProcessSignature = `${TargetSignature}proc_`;
const TargetRendererSignature = `${TargetSignature}rend_`;

const TargetSignatureLength = TargetMainSignature.length;

const TargetSignatures = {
    [IpcBusProcessType.Node]: TargetProcessSignature,
    [IpcBusProcessType.Native]: TargetProcessSignature,
    [IpcBusProcessType.Renderer]: TargetRendererSignature,
    [IpcBusProcessType.Main]: TargetMainSignature,
};

function _GetTargetFromChannel(targetTypeSignature: string, ipcMessage: IpcBusMessage): IpcBusPeer {
    if (ipcMessage.channel && ipcMessage.channel.lastIndexOf(TargetSignature, 0) === 0) {
        if (ipcMessage.channel.lastIndexOf(targetTypeSignature, 0) !== 0) {
            return null;
        }
        const index = ipcMessage.channel.indexOf(TargetSignature, TargetSignatureLength);
        return JSON.parse(ipcMessage.channel.substr(TargetSignatureLength, index - TargetSignatureLength));
    }
    return null;
}

export function GetTargetMain(ipcMessage: IpcBusMessage, checkChannel: boolean = false): IpcBusPeer {
    if (ipcMessage.target) {
        return ipcMessage.target.type === IpcBusProcessType.Main ? ipcMessage.target : undefined;
    }
    if (checkChannel) {
        return _GetTargetFromChannel(TargetMainSignature, ipcMessage);
    }
    return undefined;
}

export function GetTargetProcess(ipcMessage: IpcBusMessage, checkChannel: boolean = false): IpcBusPeer {
    if (ipcMessage.target) {
        return ipcMessage.target.type === IpcBusProcessType.Node || ipcMessage.target.type === IpcBusProcessType.Native
            ? ipcMessage.target
            : undefined;
    }
    if (checkChannel) {
        return _GetTargetFromChannel(TargetProcessSignature, ipcMessage);
    }
    return undefined;
}

export function GetTargetRenderer(ipcMessage: IpcBusMessage, checkChannel: boolean = false): IpcBusPeer {
    if (ipcMessage.target) {
        return ipcMessage.target.type === IpcBusProcessType.Renderer
            ? (ipcMessage.target)
            : undefined;
    }
    if (checkChannel) {
        return _GetTargetFromChannel(TargetRendererSignature, ipcMessage);
    }
    return undefined;
}

export function CreateKeyForEndpoint(endpoint: IpcBusPeer): string {
    if (endpoint.process?.wcid && endpoint.process?.frameid) {
        return `wcid-${(endpoint.process.wcid << 8) + endpoint.process.frameid}`;
    }

    return endpoint.id;
}

export function CreateTargetChannel(peer: IpcBusPeer): string {
    const targetTypeSignature = TargetSignatures[peer.type as never] || `_no_target_`;
    return `${targetTypeSignature}${JSON.stringify(peer)}${TargetSignature}${uuidProvider()}`;
}

export class SerializeMessage {
    private readonly _packetOut: IpcPacketBuffer;

    constructor() {
        this._packetOut = new IpcPacketBuffer();
        this._packetOut.JSON = JSONParserV1;
    }

    serialize(ipcMessage: IpcBusMessage, args?: unknown[]): IpcPacketBuffer | undefined {
        // args does not supporting Electron serialization !
        if (!ipcMessage.isRawData) {
            ipcMessage.isRawData = true;
            JSONParserV1.install();
            this._packetOut.serialize([ipcMessage, args]);
            JSONParserV1.uninstall();
            return this._packetOut;
        }
        return undefined;
    }

    writeMessage(writer: Writer, ipcMessage: IpcBusMessage, args?: unknown[]) {
        // Args will be serialized by packetOut
        ipcMessage.isRawData = true;
        this._packetOut.write(writer, [ipcMessage, args]);
    }

    writeCommand(writer: Writer, ipcCommand: IpcBusCommand) {
        this._packetOut.write(writer, [ipcCommand]);
    }
}

export interface IpcInterface {
    send(channel: string, ...args: unknown[]): void;
    sendTo(webContentsId: number, channel: string, ...args: unknown[]): void;
}

export interface PortInterface {
    postMessage(message: unknown, messagePorts?: Transferable[]): void;
}

export class SmartMessageBag {
    private readonly _packetOut: IpcPacketBuffer;
    private _ipcMessage: IpcBusMessage;
    private _data: unknown;
    private _rawData: unknown;
    private _supportStructureClone: boolean | undefined;

    constructor() {
        this._packetOut = new IpcPacketBuffer();
        this._packetOut.JSON = JSONParserV1;
    }

    set(ipcMessage: IpcBusMessage, data: unknown) {
        this._ipcMessage = ipcMessage;
        this._supportStructureClone = undefined;
        if (this._ipcMessage.isRawData) {
            this._rawData = data;
            this._data = undefined;
        } else {
            this._data = data;
            this._rawData = undefined;
        }
    }

    serialize(ipcMessage: IpcBusMessage, args?: unknown[]): IpcPacketBuffer | undefined {
        // args does not supporting Electron serialization !
        if (!ipcMessage.isRawData) {
            ipcMessage.isRawData = true;
            JSONParserV1.install();
            this._packetOut.serialize([ipcMessage, args]);
            JSONParserV1.uninstall();
            return this._packetOut;
        }
        return null;
    }

    writeMessage(writer: Writer, ipcMessage: IpcBusMessage, args?: unknown[]) {
        if (this._rawData) {
            this._packetOut.write(writer, this._rawData);
        } else {
            ipcMessage.isRawData = true;
            this._packetOut.write(writer, [ipcMessage, args]);
            ipcMessage.isRawData = false;
        }
    }

    writeCommand(writer: Writer, ipcCommand: IpcBusCommand) {
        this._packetOut.write(writer, [ipcCommand]);
    }

    sendIPCMessage(ipc: IpcInterface, channel: string): void {
        if (this._data) {
            if (this._supportStructureClone !== false) {
                try {
                    ipc.send(channel, this._ipcMessage, this._data);
                    this._supportStructureClone = true;
                    return;
                } catch (err) {
                    this._supportStructureClone = false;
                }
            }
        }
        this._ipcMessage.isRawData = true;
        if (!this._rawData) {
            // maybe an arg does not supporting Electron serialization !
            JSONParserV1.install();
            this._packetOut.serialize([this._ipcMessage, this._data]);
            JSONParserV1.uninstall();
            this._rawData = this._packetOut.getRawData();
        }
        ipc.send(channel, this._ipcMessage, this._rawData);
        this._ipcMessage.isRawData = false;
    }

    sendIPCMessageTo(ipc: IpcInterface, wcid: number, channel: string): void {
        if (this._data) {
            if (this._supportStructureClone !== false) {
                try {
                    ipc.sendTo(wcid, channel, this._ipcMessage, this._data);
                    this._supportStructureClone = true;
                    return;
                } catch (err) {
                    this._supportStructureClone = false;
                }
            }
        }
        this._ipcMessage.isRawData = true;
        if (!this._rawData) {
            // maybe an arg does not supporting Electron serialization !
            JSONParserV1.install();
            this._packetOut.serialize([this._ipcMessage, this._data]);
            JSONParserV1.uninstall();
            this._rawData = this._packetOut.getRawData();
        }
        ipc.sendTo(wcid, channel, this._ipcMessage, this._rawData);
        this._ipcMessage.isRawData = false;
    }

    sendPortMessage(port: PortInterface, messagePorts?: ReadonlyArray<BusMessagePort>): void {
        // Seems to have a bug in Electron, undefined is not supported for messagePorts !
        // messagePorts = messagePorts || [];
        if (this._data) {
            if (this._supportStructureClone !== false) {
                try {
                    port.postMessage([this._ipcMessage, this._data], messagePorts as Transferable[]);
                    this._supportStructureClone = true;
                    return;
                } catch (err) {
                    this._supportStructureClone = false;
                }
            }
        }
        this._ipcMessage.isRawData = true;
        if (!this._rawData) {
            // maybe an arg does not supporting Electron serialization !
            JSONParserV1.install();
            this._packetOut.serialize([this._ipcMessage, this._data]);
            JSONParserV1.uninstall();
            this._rawData = this._packetOut.getRawData();
        }
        port.postMessage([this._ipcMessage, this._rawData], messagePorts as Transferable[]);
        this._ipcMessage.isRawData = false;
    }
}
