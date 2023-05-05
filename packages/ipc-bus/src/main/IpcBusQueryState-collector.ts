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
    public processes: Map<string, QueryStateBase[]>;
    protected _bridge: IpcBusBridgeImpl;
    protected _session: string;

    constructor(bridge: IpcBusBridgeImpl, private readonly _log: boolean = false) {
        this._bridge = bridge;

        this.processes = new Map();
    }

    start() {
        this.processes.clear();

        this._session = uuidProvider();
        const ipcQueryState: IpcBusCommand = {
            kind: IpcBusCommandKind.QueryState,
            channel: this._session,
        };
        const rendererQueryState = this._bridge.rendererTransport.queryState();
        this.collect({ id: this._session, queryState: rendererQueryState });
        this._bridge.rendererTransport.broadcastCommand(ipcQueryState);
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

        let processEntry = this.processes.get(queryStateResponse.queryState.contextId);
        if (!processEntry) {
            processEntry = [queryStateResponse.queryState];
            this.processes.set(queryStateResponse.queryState.contextId, processEntry);
        } else {
            processEntry.push(queryStateResponse.queryState);
        }
        this._log && console.log(`QueryState: ${JSON.stringify(queryStateResponse, undefined, 4)}`);
    }
}
