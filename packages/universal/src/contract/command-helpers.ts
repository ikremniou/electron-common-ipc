import { IpcBusProcessType } from './ipc-bus-peer';

import type { IpcBusMessage } from './ipc-bus-message';
import type { IpcBusPeer, IpcBusTarget } from './ipc-bus-peer';

const TargetSignature = `_target_`;
const TargetMainSignature = `${TargetSignature}main_`;
const TargetProcessSignature = `${TargetSignature}proc_`;
const TargetRendererSignature = `${TargetSignature}rend_`;

const TargetSignatureLength = TargetMainSignature.length;

const TargetSignatures: Record<string, string> = {
    node: TargetProcessSignature,
    native: TargetProcessSignature,
    renderer: TargetRendererSignature,
    main: TargetMainSignature,
};

function GetTargetFromChannel(targetTypeSignature: string, ipcMessage: IpcBusMessage): IpcBusTarget | undefined {
    if (ipcMessage.channel && ipcMessage.channel.lastIndexOf(TargetSignature, 0) === 0) {
        if (ipcMessage.channel.lastIndexOf(targetTypeSignature, 0) !== 0) {
            return undefined;
        }
        const index = ipcMessage.channel.indexOf(TargetSignature, TargetSignatureLength);
        return JSON.parse(ipcMessage.channel.substr(TargetSignatureLength, index - TargetSignatureLength));
    }
    return undefined;
}

export function CreateMessageTarget(target: IpcBusPeer): IpcBusTarget {
    return target;
}

export function CreateTargetChannel(peer: IpcBusPeer, uniqueId: string): string {
    const target = CreateMessageTarget(peer);
    const targetTypeSignature = TargetSignatures[peer.type] || `_no_target_`;
    return `${targetTypeSignature}${JSON.stringify(target)}${TargetSignature}${uniqueId}`;
}

export function CreateKeyForEndpoint(endpoint: IpcBusPeer): string {
    return endpoint.id;
}

export function GetTargetMain(ipcMessage: IpcBusMessage, checkChannel: boolean = false): IpcBusTarget | undefined {
    if (ipcMessage.target) {
        return ipcMessage.target.type === IpcBusProcessType.Main ? ipcMessage.target : undefined;
    }
    if (checkChannel) {
        return GetTargetFromChannel(TargetMainSignature, ipcMessage);
    }
    return undefined;
}

export function GetTargetProcess(ipcMessage: IpcBusMessage, checkChannel: boolean = false): IpcBusTarget | undefined {
    if (ipcMessage.target) {
        return ipcMessage.target.type === IpcBusProcessType.Node || ipcMessage.target.type === IpcBusProcessType.Native
            ? ipcMessage.target
            : undefined;
    }
    if (checkChannel) {
        return GetTargetFromChannel(TargetProcessSignature, ipcMessage);
    }
    return undefined;
}

export function GetTargetRenderer(ipcMessage: IpcBusMessage, checkChannel: boolean = false): IpcBusTarget | undefined {
    if (ipcMessage.target) {
        return ipcMessage.target.type === IpcBusProcessType.Renderer ? ipcMessage.target : undefined;
    }
    if (checkChannel) {
        return GetTargetFromChannel(TargetRendererSignature, ipcMessage);
    }
    return undefined;
}
