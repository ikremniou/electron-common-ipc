import { createIpcBusService, createWebSocketClient } from '@electron-common-ipc/web-socket';

import { bootstrapEchoClient } from '../../utilities/client/echo-client';

const clientId = String(process.pid);
const clientPort = Number(process.env['PORT']);
const shouldLog = Boolean(process.env['LOG']);
const sendBack = (message: unknown) => {
    process.send(message);
};
const onMessage = (handler: (...args: any[]) => void) => {
    process.on('message', handler);
};

bootstrapEchoClient({
    clientId,
    shouldLog,
    clientPort,
    onMessage,
    sendBack,
    createBusClient: createWebSocketClient,
    createIpcBusService
});
