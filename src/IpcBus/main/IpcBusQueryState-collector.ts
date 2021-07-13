import { IpcBusCommand } from '../IpcBusCommand';
import type { IpcBusConnector } from '../IpcBusConnector';
import type { QueryStateResponse } from '../IpcBusQueryState';
import * as IpcBusUtils from '../IpcBusUtils';

import type { IpcBusBridgeImpl } from './IpcBusBridgeImpl';

export class IpcBusQueryStateManager {
    protected _bridge: IpcBusBridgeImpl;
    protected _session: string;

    protected _processes: Map<string, any>;

    constructor(bridge: IpcBusBridgeImpl) {
        this._bridge = bridge;

        this._processes = new Map();
    }

    start() {
        this._processes.clear();

        this._session = IpcBusUtils.CreateUniqId();
        const ipcQueryState: IpcBusCommand = {
            kind: IpcBusCommand.Kind.QueryState,
            channel: this._session
        };
        const rendererQueryState = this._bridge.rendererTransport.queryState();
        this.collect({ id: this._session, queryState: rendererQueryState });
        this._bridge.rendererTransport.broadcastCommand(ipcQueryState);
        const mainQueryState = this._bridge.mainTransport.queryState();
        this.collect({ id: this._session, queryState: mainQueryState });
        ((this._bridge.mainTransport as any) as IpcBusConnector.Client).onCommandReceived(ipcQueryState);
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

        const processID = IpcBusUtils.CreateProcessID(queryStateResponse.queryState.process);
        let processEntry = this._processes.get(processID);
        if (processEntry == null) {
            processEntry = [queryStateResponse.queryState];
            this._processes.set(processID, processEntry);
        }
        else {
            processEntry.push(queryStateResponse.queryState);
        }
        console.log(`QueryState: ${JSON.stringify(queryStateResponse)}`);
    }
}