/**
 * The type of the peer process
 */
export const enum IpcBusProcessType {
    Native = 0,
    Node = 1,
    Renderer = 2,
    Worker = 3,
    Undefined = 4,
    Browser = 5,
    Main = 6,
}

export interface IpcBusProcess {
    // The process id
    pid?: number;
    // Process Electron/Chromium IPC Routing Id
    rid?: number; 
    // WebContent Id
    wcid?: number;
    // Frame id
    frameid?: number;
    isMainFrame?: boolean;
}

export interface IpcBusPeer {
    readonly id: string;
    readonly type: IpcBusProcessType;
    name?: string;
    // Kept for backward compatibility, however this
    // knowledge is excessive in the universal package.
    process?: IpcBusProcess;
}

export interface IpcBusTarget extends IpcBusPeer {}
