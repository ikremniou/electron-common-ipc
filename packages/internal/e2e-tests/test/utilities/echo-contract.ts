import { EventEmitter } from 'events';

import type { IpcBusEvent } from '@electron-common-ipc/universal';

export interface MessageContent {
    event?: IpcBusEvent;
    data: unknown;
}

export interface ProcessMessage {
    type:
        | 'subscribe-echo'
        | 'subscribe-report'
        | 'subscribe-echo-request'
        | 'unsubscribe-all'
        | 'request-resolve'
        | 'start-echo-service'
        | 'stop-echo-service'
        | 'emit-echo-service-event'
        | 'send';
    channel?: string;
    echoChannel?: string;
    content?: MessageContent;
}

export class EchoServiceClass extends EventEmitter {
    echoMethod(args: unknown[]): Promise<unknown[]> {
        return Promise.resolve(args);
    }
}

export interface ClientHost {
    /**
     * Sends command to the client host. Host must support ProcessMessage contract
     * @param child Child host to send command to
     * @param command Command to send to the client host
     */
    sendCommand(command: ProcessMessage): void;
    /**
     * Waits for the message to be received by the current host form the client host
     * @param process The client host to send command to
     * @param predicate Message to wait from client host or predicate function
     */
    waitForMessage(predicate: string | ((mes: ProcessMessage) => boolean)): Promise<void>;
    /**
     * Shuts down client host
     */
    close(): void;
}
