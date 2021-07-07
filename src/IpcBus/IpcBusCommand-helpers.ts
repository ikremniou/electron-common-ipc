import { JSONParserV1 } from 'json-helpers';
import { IpcPacketBuffer, Writer } from 'socket-serializer';

import type { IpcBusMessagePortPost, IpcBusPeer, IpcBusPeerProcess, IpcMessagePortType } from './IpcBusClient';
import type { IpcBusCommand, IpcBusMessage, IpcBusTarget } from './IpcBusCommand';
import { CreateUniqId } from './IpcBusUtils';

const TargetSignature = `_target_`;
const TargetMainSignature     = `${TargetSignature}main_`;
const TargetProcessSignature  = `${TargetSignature}proc_`;
const TargetRendererSignature = `${TargetSignature}rend_`;

const TargetSignatureLength = TargetMainSignature.length;

const TargetSignatures: any = {
    'node': TargetProcessSignature,
    'native': TargetProcessSignature,
    'renderer': TargetRendererSignature,
    'main': TargetMainSignature
};

function _GetTargetFromChannel(targetTypeSignature: string, ipcMessage: IpcBusMessage): IpcBusTarget | null {
    if (ipcMessage.channel && (ipcMessage.channel.lastIndexOf(TargetSignature, 0) === 0)) {
        if (ipcMessage.channel.lastIndexOf(targetTypeSignature, 0) !== 0) {
            return null;
        }
        const index = ipcMessage.channel.indexOf(TargetSignature, TargetSignatureLength);
        return JSON.parse(ipcMessage.channel.substr(TargetSignatureLength, index - TargetSignatureLength));
    }
    return null;
}

export function GetTargetMain(ipcMessage: IpcBusMessage, checkChannel: boolean = false): IpcBusTarget | null {
    if (ipcMessage.target) {
        return (ipcMessage.target.process.type === 'main') ? ipcMessage.target : null;
    }
    if (checkChannel) {
        return _GetTargetFromChannel(TargetMainSignature, ipcMessage);
    }
    return null;
}

export function GetTargetProcess(ipcMessage: IpcBusMessage, checkChannel: boolean = false): IpcBusTarget | null {
    if (ipcMessage.target) {
        return ((ipcMessage.target.process.type === 'node') || (ipcMessage.target.process.type === 'native')) ? ipcMessage.target : null;
    }
    if (checkChannel) {
        return _GetTargetFromChannel(TargetProcessSignature, ipcMessage);
    }
    return null;
}

export function GetTargetRenderer(ipcMessage: IpcBusMessage, checkChannel: boolean = false): IpcBusTarget | null {
    if (ipcMessage.target) {
        return (ipcMessage.target.process.type === 'renderer') ? ipcMessage.target : null;
    }
    if (checkChannel) {
        return _GetTargetFromChannel(TargetRendererSignature, ipcMessage);
    }
    return null;
}

export function CreateKeyForEndpoint(endpoint: IpcBusPeer | IpcBusPeerProcess): number {
    if (endpoint.process.wcid && endpoint.process.frameid) {
        return (endpoint.process.wcid << 8) + endpoint.process.frameid;
    }
    else {
        return endpoint.process.pid;
    }
}

export function CreateTargetChannel(peer: IpcBusPeer): string {
    const target = CreateMessageTarget(peer);
    const targetTypeSignature = TargetSignatures[peer.process.type] || `_no_target_`;
    return `${targetTypeSignature}${JSON.stringify(target)}${TargetSignature}${CreateUniqId()}`;
}

export function CreateMessageTarget(target: IpcBusPeer | IpcBusPeerProcess | undefined): IpcBusTarget {
    if (target == null) {
        return undefined;
    }
    const messageTarget: IpcBusTarget = { process: target.process };
    if ((target as any).id) {
        const peer = target as IpcBusPeer;
        messageTarget.peerid = peer.id;
    }
    return messageTarget;
}

export class SerializeMessage {
    private _packetOut: IpcPacketBuffer;

    constructor() {
        this._packetOut = new IpcPacketBuffer();
        this._packetOut.JSON = JSONParserV1;
    }

    serialize(ipcMessage: IpcBusMessage, args?: any[]): IpcPacketBuffer | null {
        // args does not supporting Electron serialization !
        if (!ipcMessage.rawData) {
            ipcMessage.rawData = true;
            JSONParserV1.install();
            this._packetOut.serialize([ipcMessage, args]);
            JSONParserV1.uninstall();
            return this._packetOut;
        }
        return null;
    }

    writeMessage(writer: Writer, ipcMessage: IpcBusMessage, args?: any[]) {
        ipcMessage.rawData = true;
        this._packetOut.write(writer, [ipcMessage, args]);
    }

    writeCommand(writer: Writer, ipcCommand: IpcBusCommand) {
        this._packetOut.write(writer, [ipcCommand]);
    }

    postMessage(port: IpcBusMessagePortPost, ipcMessage: IpcBusMessage, args?: any[], messagePorts?: ReadonlyArray<IpcMessagePortType>): void {
        // Seems to have a bug in Electron, undefined is not supported for messagePorts !
        messagePorts = messagePorts || [];
        try {
            port.postMessage([ipcMessage, args], messagePorts as any);
        }
        catch (err) {
            // maybe an arg does not supporting Electron serialization !
            const packet = this.serialize(ipcMessage, args);
            const rawData = packet.getRawData();
            port.postMessage([ipcMessage, rawData], messagePorts as any);
        }
    }
}