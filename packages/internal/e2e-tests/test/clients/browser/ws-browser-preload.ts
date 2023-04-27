import { ipcRenderer } from 'electron';

const shouldLog = process.argv.find((arg) => arg.startsWith('--log'))?.split('=')[1] === 'true';
const clientPort = Number(process.argv.find((argv: string) => argv.startsWith('--port')).split('=')[1]);

window.e2eIpc = {
    shouldLog,
    rendererOn: (channel, listener) => ipcRenderer.on(channel, listener),
    rendererSend: (channel, ...args) => ipcRenderer.send(channel, ...args),
    port: clientPort,
    electronProcess: process,
};
