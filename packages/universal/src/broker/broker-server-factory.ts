import type { BrokerConnectOptions } from './broker';
import type { BrokerServer } from './broker-server';

export interface BrokerServerFactory {
    create(options: BrokerConnectOptions): Promise<BrokerServer>;
}
