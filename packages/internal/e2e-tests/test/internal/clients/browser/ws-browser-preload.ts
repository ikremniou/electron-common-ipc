import { ipcRenderer } from 'electron';

import { isLogEnabled } from '../utils';

const shouldLog = isLogEnabled();
const clientPort = Number(process.argv.find((argv: string) => argv.startsWith('--port')).split('=')[1]);

window.e2eIpc = {
    shouldLog,
    rendererOn: (channel, listener) => ipcRenderer.on(channel, listener),
    rendererSend: (channel, ...args) => ipcRenderer.send(channel, ...args),
    port: clientPort,
    electronProcess: process,
};
