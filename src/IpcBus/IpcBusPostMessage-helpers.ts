import type { IpcMessagePortType, IpcBusMessagePort } from './IpcBusClient';
import type { IpcBusMessage } from './IpcBusCommand';
import { SerializeMessage } from './IpcBusUtils';

export function CastToMessagePort(port: IpcMessagePortType): IpcBusMessagePort {
    const unknownPort = port as any;
    if (unknownPort.addEventListener && !unknownPort.addListener) {
        unknownPort.on = unknownPort.addListener = unknownPort.addEventListener;
        unknownPort.off = unknownPort.removeListener = unknownPort.addRemoveListener;
        unknownPort.once = (event: string, listener: (...args: any[]) => void) => {
            return unknownPort.addEventListener(event, listener, { once: true });
        }
    }
    else if (!unknownPort.addEventListener && unknownPort.addListener) {
        unknownPort.addEventListener = (event: string, listener: (...args: any[]) => void, options: any) => {
            if (typeof options === 'object' && options.once) {
                return unknownPort.once(event, listener);
            }
            else {
                return unknownPort.addListener(event, listener);
            }
        }
        unknownPort.removeEventListener = unknownPort.addListener;
    }
    return unknownPort as IpcBusMessagePort;
}

export class SerializeMessagePort extends SerializeMessage {

    post(port: IpcMessagePortType, ipcMessage: IpcBusMessage, args?: any[], messagePorts?: IpcMessagePortType[]): void {
        // Seems to have a bug in Electron, undefined is not supported
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
