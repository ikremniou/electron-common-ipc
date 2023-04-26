import { ipcRenderer } from 'electron';

const shouldLog = process.argv.find((arg) => arg.startsWith('--log'))?.split('=')[1] === 'true';
const clientPort = Number(process.argv.find((argv: string) => argv.startsWith('--port')).split('=')[1]);

window.e2eIpc = {
    shouldLog,
    ipcRenderer,
    port: clientPort,
    electronProcess: process,
};
