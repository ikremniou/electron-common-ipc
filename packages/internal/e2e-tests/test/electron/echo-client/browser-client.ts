import { createWebSocketClient } from '@electron-common-ipc/web-socket-browser/lib/ws-browser-factory';

import type { ProcessMessage } from '../../suites/echo-contract';
import type { IpcBusEvent } from '@electron-common-ipc/universal';

declare global {
    interface Window {
        electronProcess: NodeJS.Process;
        ipcRenderer: Electron.IpcRenderer;
    }
}

const process = window.electronProcess;
const ipcRenderer = window.ipcRenderer;
const clientId = process.pid;
const portForClient = Number(process.argv.find((argv: string) => argv.startsWith('--port')).split('=')[1]);
const log = Boolean(process.argv.find((argv: string) => argv.startsWith('--log'))?.split('=')[1]);
const webSocketClient = createWebSocketClient();
log && console.log(`[Client:${clientId}] Client is created. Port ${portForClient}. Log: ${log}`);

function busEchoCallback(channel: string, _event: unknown, data: unknown): void {
    log && console.log(`[Client:${clientId}] Echo callback for "${channel}"`);
    webSocketClient.send(channel, data);
}

async function busEchoRequestCallback(channel: string, event: IpcBusEvent, data: unknown) {
    log && console.log(`[Client:${clientId}] Echo request callback for "${event.channel}"`);
    const response = await webSocketClient.request(channel, 2000, data);
    event.request.resolve(response.payload);
}

function hostReportCallback(event: IpcBusEvent, data: unknown): void {
    log && console.log(`[Client:${clientId}] Report callback for "${event.channel}"`);
    const message: ProcessMessage = {
        type: 'subscribe-report',
        content: {
            event,
            data,
        },
    };

    ipcRenderer.send('ack', message);
}

function requestResolveTo(resolveData: unknown, event: IpcBusEvent, data: unknown): void {
    log && console.log(`[Client:${clientId}] Request resolve to callback for "${event.channel}, ${data}"`);
    event.request.resolve(resolveData);
}

ipcRenderer.on('message', (_event, message: ProcessMessage) => {
    if (!message.type) {
        return;
    }

    log && console.log(`[Client:${clientId}] Executing "${message.type}" to "${message.channel}"`);
    switch (message.type) {
        case 'subscribe-echo':
            webSocketClient.addListener(message.channel, busEchoCallback.bind(this, message.echoChannel));
            break;
        case 'subscribe-report':
            webSocketClient.addListener(message.channel, hostReportCallback);
            break;
        case 'subscribe-echo-request':
            webSocketClient.addListener(message.channel, busEchoRequestCallback.bind(this, message.echoChannel));
            break;
        case 'unsubscribe-all':
            webSocketClient.removeAllListeners(message.channel);
            break;
        case 'send':
            webSocketClient.send(message.channel, message.content.data);
            break;
        case 'request-resolve':
            webSocketClient.addListener(message.channel, requestResolveTo.bind(this, message.content.data));

    }

    ipcRenderer.send('ack', 'done');
});

async function bootstrap(): Promise<void> {
    await webSocketClient.connect(portForClient, { timeoutDelay: -1 });
    ipcRenderer.send('ack', 'ready');
}

if (!isNaN(portForClient)) {
    bootstrap();
}
