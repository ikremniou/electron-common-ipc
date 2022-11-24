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

// /**
//  * Information that is relative to Electron renderer process only
//  */
// export interface IpcBusProcessContext {
//     /**
//      * WebContents Id
//      */
//     wcid?: number;
//     /**
//      * Frame id
//      */
//     frameId?: number;
//     isMainFrame?: boolean;
// }

// export interface IpcBusProcess extends IpcBusProcessContext {
//     /**
//      * Type of the process
//      */
//     type: IpcBusProcessType;
//     /**
//      * Process Id
//      */
//     pid: number;
//     /**
//      * Process Electron/Chromium IPC Routing Id
//      */
//     rid?: number;
// }

// export interface IpcBusPeerProcess {
//     process: IpcBusProcess;
// }

export interface IpcBusPeer {
    readonly id: string;
    type: IpcBusProcessType;
    name?: string;
}

export interface IpcBusTarget extends IpcBusPeer {}
