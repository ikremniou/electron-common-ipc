import { createWebSocketBroker } from '@electron-common-ipc/web-socket';
import { fork } from 'child_process';
import { ActivateIpcBusTrace, CreateIpcBusBroker } from 'electron-common-ipc';
import { extname } from 'path';

import type { IpcBusBrokerProxy } from './broker-proxy';
import type { IpcType } from '../../compare/ipc-type';
import type { ChildProcess } from 'child_process';
import type { IpcBusBroker } from 'electron-common-ipc';

class BrokerProxy {
    private isClosed = false;

    constructor(private readonly _childProcess: ChildProcess) {}

    close() {
        if (this.isClosed) {
            return Promise.resolve();
        }

        return new Promise<void>((resolve) => {
            this.isClosed = true;
            this._childProcess.once('close', () => {
                resolve();
            });
            this._childProcess.send('close-broker');
        });
    }
}

export async function remoteNodeBrokerFactory(ipcType: IpcType, port: number): Promise<IpcBusBrokerProxy> {
    let execArgv = undefined;
    const extension = extname(__filename);
    if (extension === '.ts') {
        execArgv = ['-r', 'ts-node/register'];
    }
    const newEnv = Object.assign({}, process.env);
    newEnv.PORT = String(port);
    newEnv.IS_FORK = String(true);
    newEnv.IPC_TYPE = ipcType;
    newEnv.ELECTRON_RUN_AS_NODE = String(true);
    newEnv.LOG = process.env.LOG;
    const childProcess = fork(__filename, {
        execArgv,
        env: newEnv,
    });

    await new Promise<void>((resolve) => {
        childProcess.once('message', (message) => {
            if (message === 'started') {
                resolve();
            }
        });
    });

    return new BrokerProxy(childProcess);
}

// fork code
async function bootstrapBroker(ipcType: IpcType): Promise<void> {
    const connectPort = Number(process.env.PORT);
    let broker: IpcBusBroker;
    if (ipcType === 'eipc') {
        ActivateIpcBusTrace(Boolean(process.env.LOG));
        broker = CreateIpcBusBroker();
    } else {
        broker = createWebSocketBroker();
    }
    await broker.connect(connectPort);
    process.send('started');
    process.once('message', async (message: string) => {
        if (message === 'close-broker') {
            await broker.close();
        }
    });
}

if (process.env.IS_FORK) {
    bootstrapBroker(process.env.IPC_TYPE as IpcType);
}
