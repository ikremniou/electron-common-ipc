import { EchoServiceClass } from './echo-contract';

import type { ToClientProcessMessage, ClientSubscribeReport, ToMainProcessMessage } from './echo-contract';
import type {
    BusServiceOptions,
    IpcBusClient,
    IpcBusEvent,
    IpcBusService,
    IpcBusServiceProxy,
} from '@electron-common-ipc/universal';

export interface BootstrapContext {
    clientId: string;
    shouldLog: boolean;
    clientPort: number;
    sendBack: (mes: ToMainProcessMessage) => void;
    onMessage: (handler: (mes: ToClientProcessMessage) => void) => void;
    createBusClient(): IpcBusClient;
    createIpcBusService: (
        client: IpcBusClient,
        channel: string,
        instance: unknown,
        options?: BusServiceOptions
    ) => IpcBusService;
    createIpcBusServiceProxy: (client: IpcBusClient, channel: string) => IpcBusServiceProxy;
}

/**
 * Create the infrastructure to handle commands from the consumers
 * @param ctx The context to bootstrap host with
 * @returns The cleanup function that can be used to cleanup IpcBusClients
 */
export async function bootstrapEchoHost(ctx: BootstrapContext): Promise<CallableFunction> {
    // TODO: make the services not singleton, and use Map with message.channel
    let echoService: IpcBusService;
    let echoServiceInstance: EchoServiceClass;
    let echoServiceProxy: IpcBusServiceProxy;
    const busClients = new Map<string, IpcBusClient>();
    const mainClient = ctx.createBusClient();

    ctx.shouldLog &&
        console.log(`[Client:${ctx.clientId}] Client is created. Port ${ctx.clientPort}. Log: ${ctx.shouldLog}`);

    function busEchoCallback(busClient: IpcBusClient, channel: string, _event: unknown, data: unknown): void {
        ctx.shouldLog && console.log(`[Client:${ctx.clientId}] Echo callback for "${channel}"`);
        busClient.send(channel, data);
    }

    async function busEchoRequestCallback(busClient: IpcBusClient, channel: string, event: IpcBusEvent, data: unknown) {
        ctx.shouldLog && console.log(`[Client:${ctx.clientId}] Echo request callback for "${event.channel}"`);
        const response = await busClient.request(channel, 2000, data);
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

    function eventCounter(counterObject: { count: number; required: number }, data: unknown): void {
        counterObject.count++;
        const eventsLeft = counterObject.required - counterObject.count;
        ctx.shouldLog && console.log(`[Client:${ctx.clientId}][EventCounter] Got event. ${eventsLeft} event left`);
        if (eventsLeft === 0) {
            ctx.shouldLog && console.log(`[Client:${ctx.clientId}][EventCounter] Confirm. Data: ${data}`);
            ctx.sendBack({ type: 'counter-confirm', lastEventData: data });
        }
    }

    ctx.onMessage(async (message: ToClientProcessMessage) => {
        if (!message.type) {
            return;
        }

        const realClient = message.client ? busClients.get(message.client) : mainClient;
        ctx.shouldLog && console.log(`[Client:${ctx.clientId}] Executing "${message.type}" to "${message.channel}"`);
        switch (message.type) {
            case 'subscribe-echo':
                realClient.addListener(
                    message.channel,
                    busEchoCallback.bind(globalThis, realClient, message.echoChannel)
                );
                break;
            case 'subscribe-report':
                realClient.addListener(message.channel, hostReportCallback);
                break;
            case 'subscribe-echo-request':
                realClient.addListener(
                    message.channel,
                    busEchoRequestCallback.bind(globalThis, realClient, message.echoChannel)
                );
                break;
            case 'unsubscribe-all':
                realClient.removeAllListeners(message.channel);
                break;
            case 'send':
                realClient.send(message.channel, message.data);
                break;
            case 'request-resolve':
                realClient.addListener(message.channel, requestResolveTo.bind(globalThis, message.data));
                break;
            case 'start-echo-service': {
                echoServiceInstance = new EchoServiceClass();
                echoService = ctx.createIpcBusService(
                    realClient,
                    message.channel,
                    echoServiceInstance,
                    message.options
                );
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
                    echoServiceInstance.emit(message.event, message.data);
                }
                break;
            }
            case 'start-echo-service-proxy': {
                if (echoServiceProxy) {
                    echoServiceProxy.close();
                }
                echoServiceProxy = ctx.createIpcBusServiceProxy(realClient, message.channel);
                await echoServiceProxy.connect();
                if (message.counterEvents) {
                    message.counterEvents.forEach((counterEvent) => {
                        const counterObject = { count: 0, required: counterEvent[0] };
                        ctx.shouldLog &&
                            console.log(
                                `[Client:${ctx.clientId}] Proxy '${message.channel}' subscribed to ${counterEvent[1]}` +
                                    ` and will fire 'confirm-counter' after ${counterObject.required} events`
                            );
                        echoServiceProxy.on(counterEvent[1], eventCounter.bind(globalThis, counterObject));
                    });
                }
                break;
            }
            case 'call-on-echo-service-proxy': {
                const echoWrapper: EchoServiceClass = echoServiceProxy.getWrapper();
                await echoWrapper.echoMethod(message.data);
                break;
            }
            case 'stop-echo-service-proxy': {
                echoServiceProxy.close();
                break;
            }
            case 'start-new-client': {
                const client = ctx.createBusClient();
                await client.connect(ctx.clientPort, { peerName: message.channel });
                busClients.set(message.channel, client);
                break;
            }
            case 'stop-client': {
                const maybeClient = busClients.get(message.channel);
                await maybeClient?.close();
                busClients.delete(message.channel);
                break;
            }
        }

        ctx.sendBack('done');
    });

    // eslint-disable-next-line no-debugger
    // debugger;
    await mainClient.connect(ctx.clientPort, { timeoutDelay: -1 });
    ctx.sendBack('ready');
    return () => {
        mainClient.close();
        busClients.forEach((client) => client.close());
    };
}
