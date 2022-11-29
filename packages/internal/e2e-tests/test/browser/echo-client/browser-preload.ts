import { ipcRenderer } from 'electron';

declare global {
    interface Window {
        electronProcess: NodeJS.Process;
        ipcRenderer: Electron.IpcRenderer;
    }
}

window.ipcRenderer = ipcRenderer;
window.electronProcess = process;
