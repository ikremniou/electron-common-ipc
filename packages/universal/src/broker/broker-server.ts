import type { BrokerCloseOptions } from './broker';
import type { SocketClient } from './socket-client';

export interface BrokerServer {
    close(options?: BrokerCloseOptions): Promise<void>;

    subscribe(
        onClose: () => void,
        onError: (error: Error) => void,
        onConnection: (client: SocketClient) => void): void;
    unsubscribe(): void;
}
