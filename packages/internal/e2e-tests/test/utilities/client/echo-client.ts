import { EventEmitter } from 'events';

import { EchoServiceClass } from '../echo-contract';

import type { ProcessMessage } from '../echo-contract';
import type { createIpcBusService, IpcBusClient, IpcBusEvent, IpcBusService } from '@electron-common-ipc/universal';

export interface BootstrapContext {
    clientId: string;
    shouldLog: boolean;
    clientPort: number;
    sendBack: (mes: ProcessMessage | string) => void;
    onMessage: (handler: (mes: ProcessMessage) => void) => void;
    createBusClient(): IpcBusClient;
    createIpcBusService: typeof createIpcBusService;
}

export async function bootstrapEchoClient(ctx: BootstrapContext) {
    let echoService: IpcBusService;
    let echoServiceInstance: EchoServiceClass;
    const webSocketClient = ctx.createBusClient();
    ctx.shouldLog &&
        console.log(`[Client:${ctx.clientId}] Client is created. Port ${ctx.clientPort}. Log: ${ctx.shouldLog}`);

    function busEchoCallback(channel: string, _event: unknown, data: unknown): void {
        ctx.shouldLog && console.log(`[Client:${ctx.clientId}] Echo callback for "${channel}"`);
        webSocketClient.send(channel, data);
    }

    async function busEchoRequestCallback(channel: string, event: IpcBusEvent, data: unknown) {
        ctx.shouldLog && console.log(`[Client:${ctx.clientId}] Echo request callback for "${event.channel}"`);
        const response = await webSocketClient.request(channel, 2000, data);
        event.request.resolve(response.payload);
    }

    function hostReportCallback(event: IpcBusEvent, data: unknown): void {
        ctx.shouldLog && console.log(`[Client:${ctx.clientId}] Report callback for "${event.channel}"`);
        const message: ProcessMessage = {
            type: 'subscribe-report',
            content: {
                event,
                data,
            },
        };

        ctx.sendBack(message);
    }

    function requestResolveTo(resolveData: unknown, event: IpcBusEvent, data: unknown): void {
        ctx.shouldLog &&
            console.log(`[Client:${ctx.clientId}] Request resolve to callback for "${event.channel}, ${data}"`);
        event.request.resolve(resolveData);
    }

    ctx.onMessage((message: ProcessMessage) => {
        if (!message.type) {
            return;
        }

        ctx.shouldLog && console.log(`[Client:${ctx.clientId}] Executing "${message.type}" to "${message.channel}"`);
        switch (message.type) {
            case 'subscribe-echo':
                webSocketClient.addListener(message.channel, busEchoCallback.bind(globalThis, message.echoChannel));
                break;
            case 'subscribe-report':
                webSocketClient.addListener(message.channel, hostReportCallback);
                break;
            case 'subscribe-echo-request':
                webSocketClient.addListener(
                    message.channel,
                    busEchoRequestCallback.bind(globalThis, message.echoChannel)
                );
                break;
            case 'unsubscribe-all':
                webSocketClient.removeAllListeners(message.channel);
                break;
            case 'send':
                webSocketClient.send(message.channel, message.content.data);
                break;
            case 'request-resolve':
                webSocketClient.addListener(message.channel, requestResolveTo.bind(globalThis, message.content.data));
                break;
            case 'start-echo-service': {
                echoServiceInstance = new EchoServiceClass();
                echoService = ctx.createIpcBusService(
                    webSocketClient,
                    message.channel,
                    echoServiceInstance,
                    EventEmitter.prototype
                );
                echoService.start();
                break;
            }
            case 'stop-echo-service':
                echoService.stop();
                break;
            case 'emit-echo-service-event':
                echoServiceInstance.emit(message.channel, message.content.data);
                break;
        }

        ctx.sendBack('done');
    });

    await webSocketClient.connect(ctx.clientPort, { timeoutDelay: -1 });
    ctx.sendBack('ready');
}
