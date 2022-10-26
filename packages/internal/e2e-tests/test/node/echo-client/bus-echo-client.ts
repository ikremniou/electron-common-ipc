import { createWebSocketClient } from '@electron-common-ipc/web-socket';

import type { ProcessMessage } from '../../suites/echo-contract';
import type { IpcBusEvent } from '@electron-common-ipc/universal';

const portForClient = Number(process.env['PORT']);
const shouldLog = Boolean(process.env['LOG']);
const socketClient = createWebSocketClient();
shouldLog && console.log(`[Client:${process.pid}] Ws client is created.`);

function echoCallback(channel: string, _event: unknown, data: unknown): void {
    shouldLog && console.log(`[Client:${process.pid}] Echo callback for "${channel}"`);
    socketClient.send(channel, data);
}

function reportCallback(event: IpcBusEvent, data: unknown): void {
    shouldLog && console.log(`[Client:${process.pid}] Report callback for "${event.channel}"`);
    const message: ProcessMessage = {
        type: 'subscribe-report',
        content: {
            event,
            data,
        },
    };

    process.send(message);
}

async function echoRequestCallback(channel: string, event: IpcBusEvent, data: unknown) {
    shouldLog && console.log(`[Client:${process.pid}] Echo request callback for "${event.channel}"`);
    const response = await socketClient.request(channel, 2000, data);
    event.request.resolve(response.payload);
}

function requestResolveTo(resolveData: unknown, event: IpcBusEvent, data: unknown): void {
    shouldLog && console.log(`[Client:${process.pid}] Request resolve to callback for "${event.channel}, ${data}"`);
    event.request.resolve(resolveData);
}

process.on('message', (message: ProcessMessage) => {
    if (!message.type) {
        return;
    }

    shouldLog && console.log(`[Client:${process.pid}] Executing "${message.type}" to "${message.channel}"`);
    switch (message.type) {
        case 'subscribe-echo':
            socketClient.addListener(message.channel, echoCallback.bind(this, message.echoChannel));
            break;
        case 'subscribe-report':
            socketClient.addListener(message.channel, reportCallback);
            break;
        case 'subscribe-echo-request':
            socketClient.addListener(message.channel, echoRequestCallback.bind(this, message.echoChannel));
            break;
        case 'unsubscribe-all':
            socketClient.removeAllListeners(message.channel);
            break;
        case 'send':
            socketClient.send(message.channel, message.content.data);
            break;
        case 'request-resolve':
            socketClient.addListener(message.channel, requestResolveTo.bind(this, message.echoChannel));
            break;
    }

    process.send('done');
});

async function bootstrap(): Promise<void> {
    await socketClient.connect(portForClient);
    process.send('ready');
}

if (!isNaN(portForClient)) {
    bootstrap();
}
