import { EchoServiceClass } from './echo-contract';

import type { ToClientProcessMessage, ClientSubscribeReport, ToHostProcessMessage } from './echo-contract';
import type { IpcBusClient, IpcBusEvent, IpcBusService, IpcBusServiceProxy } from '@electron-common-ipc/universal';

export interface BootstrapContext {
    clientId: string;
    shouldLog: boolean;
    clientPort: number;
    sendBack: (mes: ToHostProcessMessage) => void;
    onMessage: (handler: (mes: ToClientProcessMessage) => void) => void;
    createBusClient(): IpcBusClient;
    createIpcBusService: (client: IpcBusClient, channel: string, instance: unknown) => IpcBusService;
    createIpcBusServiceProxy: (client: IpcBusClient, channel: string) => IpcBusServiceProxy;
}

export async function bootstrapEchoClient(ctx: BootstrapContext) {
    let echoService: IpcBusService;
    let echoServiceInstance: EchoServiceClass;
    let echoServiceProxy: IpcBusServiceProxy;

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
        const message: ClientSubscribeReport = {
            type: 'client-subscribe-report',
            event,
            data,
        };

        ctx.sendBack(message);
    }

    function requestResolveTo(resolveData: unknown, event: IpcBusEvent, data: unknown): void {
        ctx.shouldLog &&
            console.log(`[Client:${ctx.clientId}] Request resolve to callback for "${event.channel}, ${data}"`);
        event.request.resolve(resolveData);
    }

    function eventCounter(counterObject: { count: number; required: number }): void {
        counterObject.count++;
        if (counterObject.count === counterObject.required) {
            ctx.sendBack('counter-confirm');
        }
    }

    ctx.onMessage(async (message: ToClientProcessMessage) => {
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
                webSocketClient.send(message.channel, message.data);
                break;
            case 'request-resolve':
                webSocketClient.addListener(message.channel, requestResolveTo.bind(globalThis, message.data));
                break;
            case 'start-echo-service': {
                echoServiceInstance = new EchoServiceClass();
                echoService = ctx.createIpcBusService(webSocketClient, message.channel, echoServiceInstance);
                echoService.start();
                break;
            }
            case 'stop-echo-service':
                echoService.stop();
                break;
            case 'emit-echo-service-event': {
                if (!message.times) {
                    message.times = 1;
                }
                while (message.times--) {
                    echoServiceInstance.emit(message.channel, message.data);
                }
                break;
            }
            case 'start-echo-service-proxy': {
                if (echoServiceProxy) {
                    echoServiceProxy.close();
                }
                echoServiceProxy = ctx.createIpcBusServiceProxy(webSocketClient, message.channel);
                await echoServiceProxy.connect();
                if (message.counterEvents) {
                    message.counterEvents.forEach((counterEvent) => {
                        const counterObject = { count: 0, required: counterEvent[0] };
                        echoServiceProxy.on(counterEvent[1], eventCounter.bind(globalThis, counterObject));
                    });
                }
                break;
            }
            case 'stop-echo-service-proxy': {
                echoServiceProxy.close();
                break;
            }
        }

        ctx.sendBack('done');
    });

    await webSocketClient.connect(ctx.clientPort, { timeoutDelay: -1 });
    ctx.sendBack('ready');
}
