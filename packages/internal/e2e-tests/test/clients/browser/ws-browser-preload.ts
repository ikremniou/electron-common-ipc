import { ipcRenderer } from 'electron';

declare global {
    interface Window {
        __electronProcess: NodeJS.Process;
        __ipcRenderer: Electron.IpcRenderer;
    }
}

window.__ipcRenderer = ipcRenderer;
window.__electronProcess = process;
