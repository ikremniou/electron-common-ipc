import { ipcRenderer } from 'electron';
import { PreloadElectronCommonIpc } from 'electron-common-ipc/lib/index-preload';

declare global {
    interface Window {
        __electronProcess: NodeJS.Process;
        __ipcRenderer: Electron.IpcRenderer;
    }
}

window.__ipcRenderer = ipcRenderer;
window.__electronProcess = process;

PreloadElectronCommonIpc();
