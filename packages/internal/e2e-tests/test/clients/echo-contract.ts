import { EventEmitter } from 'events';

import type { IpcBusEvent } from '@electron-common-ipc/universal';

export interface MessageContent {
    event?: IpcBusEvent;
    data: unknown;
}

/**
 * Subscribes to the channel and when message arrives to the echo channel it transmitted to the echo channel
 */
export interface SubscribeEcho {
    type: 'subscribe-echo';
    channel: string;
    echoChannel: string;
}

/**
 * Subscribes to the specified channel. And reports back via command IPC the data sent to the channel.
 */
export interface SubscribeReport {
    type: 'subscribe-report';
    channel: string;
}

/**
 * Similar to the {@link SubscribeEcho} except the request method are used to send data to the echo channel.
 * Request will be resolved only when echo channel sends the response back to the client.
 * [h] (command)-> [c] (echo request)-> [h] (echo response)-> [c] (channel response)-> [h]
 */
export interface SubscribeEchoRequest {
    type: 'subscribe-echo-request';
    channel: string;
    echoChannel: string;
}

/**
 * Unsubscribes from all listeners on the specified channel.
 */
export interface UnsubscribeAll {
    type: 'unsubscribe-all';
    channel: string;
}

/**
 * Subscribe to the channel and resolves all the requests instantly with the content.data;
 */
export interface RequestResolve {
    type: 'request-resolve';
    channel: string;
    data: unknown;
}

/**
 * Creates an echo service on the channel using {@link EchoServiceClass} instance
 */
export interface StartEchoService {
    type: 'start-echo-service';
    /**
     * Channel that will host service.
     */
    channel: string;
}

/**
 * Stops the echo service started with {@link StartEchoService}
 */
export interface StopEchoService {
    type: 'stop-echo-service';
    channel: string;
}

/**
 * Emits an echo event on the service started with {@link StartEchoService}
 */
export interface EmitEchoServiceEvent {
    type: 'emit-echo-service-event';
    /**
     * The name of the event to emit
     */
    channel: string;
    /**
     * The data to emit
     */
    data: unknown;
    /**
     * Number of times this event will be emitted
     */
    times?: number;
}

/**
 * Sends message via child client
 */
export interface SendMessage {
    type: 'send';
    /**
     * Channel to use to send the message
     */
    channel: string;
    /**
     * Data to transmit
     */
    data: unknown;
}

/**
 * Starts the echo service proxy on the specified channel
 */
export interface StartEchoServiceProxy {
    type: 'start-echo-service-proxy';
    channel: string;
    /**
     * The service proxy will subscribe to counter events.
     * If counter is reached the event limit it will signal 'counter-limit' message.
     * [0] is the counter value. [1] is the event name
     */
    counterEvents?: [number, string][];
}

/**
 * Stops service echo proxy started by {@link StartEchoServiceProxy}
 */
export interface StopEchoServiceProxy {
    type: 'stop-echo-service-proxy';
    channel: string;
}

export type ToClientProcessMessage =
    | SubscribeEcho
    | SubscribeEchoRequest
    | SubscribeReport
    | UnsubscribeAll
    | RequestResolve
    | EmitEchoServiceEvent
    | StartEchoService
    | StopEchoService
    | SendMessage
    | StartEchoServiceProxy
    | StopEchoServiceProxy;

/**
 * The contract to report back messages subscribed via {@link SubscribeReport}
 */
export interface ClientSubscribeReport {
    type: 'client-subscribe-report';
    event: IpcBusEvent;
    data: unknown;
}

export type ToHostProcessMessage = 'ready' | 'done' | 'counter-confirm' | ClientSubscribeReport;

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
    sendCommand(command: ToClientProcessMessage): void;
    /**
     * Waits for the message to be received by the current host form the client host
     * @param process The client host to send command to
     * @param predicate Message to wait from client host or predicate function
     */
    waitForMessage(predicate: ToHostProcessMessage | ((mes: ToHostProcessMessage) => boolean)): Promise<void>;
    /**
     * Shuts down client host
     */
    close(): void;
}
