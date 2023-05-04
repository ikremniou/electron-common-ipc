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

export interface IpcBusPeer {
    readonly id: string;
    type: IpcBusProcessType;
    name?: string;
}

export interface IpcBusTarget extends IpcBusPeer {}
