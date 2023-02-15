import type { IpcBusCommand } from '../contract/ipc-bus-command';
import type { IpcPacketBufferList } from 'socket-serializer-ik';

/**
 * Abstraction of the socket client for broker. Can be Net.Socket, WebSocket or WebRTC
 */
export interface SocketClient {
    /**
     * Send buffer list of the socket connection
     * @param bufferList The buffer list to send to the socket
     */
    send(bufferList: IpcPacketBufferList): void;
    /**
     * Subscribes to the socket client event using callbacks(not using emitter for performance)
     * @param onSocketData The callback triggered when socket received data
     * @param onSocketError The callback triggered when socket reported an error
     * @param onSocketClose The callback triggered when socket is closed
     */
    subscribe(
        onSocketData: (
            socket: SocketClient,
            ipcCommand: IpcBusCommand,
            ipcBusBufferList: IpcPacketBufferList
        ) => void,
        onSocketError: (socket: SocketClient, error: Error) => void,
        onSocketClose: (socket: SocketClient) => void
    ): void;
    /**
     * Releases the connection
     */
    release(): void;
    /**
     * Can be implemented to address correct logging messages
     */
    [Symbol.toPrimitive]?(): string;
}
