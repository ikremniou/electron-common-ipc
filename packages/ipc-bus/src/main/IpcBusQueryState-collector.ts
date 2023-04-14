import { IpcBusCommandKind } from '@electron-common-ipc/universal';

import { uuidProvider } from '../utils/uuid';

import type { IpcBusBridgeImpl } from './IpcBusBridgeImpl';
import type {
    IpcBusCommand,
    IpcBusConnectorClient,
    QueryStateBase,
    QueryStateResponse,
} from '@electron-common-ipc/universal';

export class IpcBusQueryStateManager {
    protected _bridge: IpcBusBridgeImpl;
    protected _session: string;

    protected _processes: Map<string, QueryStateBase[]>;

    constructor(bridge: IpcBusBridgeImpl) {
        this._bridge = bridge;

        this._processes = new Map();
    }

    start() {
        this._processes.clear();

        this._session = uuidProvider();
        const ipcQueryState: IpcBusCommand = {
            kind: IpcBusCommandKind.QueryState,
            channel: this._session,
        };
        const rendererQueryState = this._bridge.rendererTransport.queryState();
        this.collect({ id: this._session, queryState: rendererQueryState });
        this._bridge.rendererTransport.broadcastCommand(ipcQueryState);
        const mainQueryState = this._bridge.mainTransport.queryState();
        this.collect({ id: this._session, queryState: mainQueryState });
        (this._bridge.mainTransport as unknown as IpcBusConnectorClient).onConnectorCommandBase(ipcQueryState);
        if (this._bridge.socketTransport) {
            const socketQueryState = this._bridge.socketTransport.queryState();
            this.collect({ id: this._session, queryState: socketQueryState });
            this._bridge.socketTransport.broadcastCommand(ipcQueryState);
        }
    }

    collect(queryStateResponse: QueryStateResponse) {
        if (queryStateResponse.id !== this._session) {
            return;
        }

        let processEntry = this._processes.get(queryStateResponse.queryState.contextId);
        if (!processEntry) {
            processEntry = [queryStateResponse.queryState];
            this._processes.set(queryStateResponse.queryState.contextId, processEntry);
        } else {
            processEntry.push(queryStateResponse.queryState);
        }
        console.log(`QueryState: ${JSON.stringify(queryStateResponse, null, 4)}`);
    }
}
