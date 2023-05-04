import type { IpcBusPeer } from '@electron-common-ipc/universal';

// Special channels
export const IPCBUS_CHANNEL = '/electron-ipc-bus';
export const IPCBUS_CHANNEL_QUERY_STATE = `${IPCBUS_CHANNEL}/queryState`;

export interface IpcBusProcessContext {
    wcid?: number; // WebContent Id
    frameid?: number; // Frame Id
    isMainFrame?: boolean;
}

export interface IpcBusProcess extends IpcBusProcessContext {
    pid: number; // Process Id
    rid?: number; // Process Electron/Chromium IPC Routing Id
}

export interface IpcBusProcessPeer extends IpcBusPeer {
    process: IpcBusProcess;
}
