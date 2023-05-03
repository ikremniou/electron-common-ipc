import { fork } from 'child_process';
import { join, extname } from 'path';

import { createLogArgv } from '../utils';

import type { IpcType } from '../../ipc-type';
import type { ClientHost, ToClientProcessMessage, ToMainProcessMessage } from '../echo-contract';
import type { ChildProcess } from 'child_process';

export class NodeClientHost implements ClientHost {
    constructor(private readonly child: ChildProcess) {}

    sendCommand(message: ToClientProcessMessage): void {
        this.child.send(message);
    }

    waitForMessage(
        predicate: ToMainProcessMessage | ((mes: ToMainProcessMessage) => boolean)
    ): Promise<ToMainProcessMessage> {
        return new Promise((resolve) => {
            const messageCallback = (message: ToMainProcessMessage) => {
                if (typeof predicate === 'string') {
                    if (predicate === message || (typeof message === 'object' && message.type === predicate)) {
                        this.child.off('message', messageCallback);
                        resolve(message);
                    }
                } else if ((predicate as Function)(message)) {
                    this.child.off('message', messageCallback);
                    resolve(message);
                }
            };
            this.child.on('message', messageCallback);
        });
    }

    close(): void {
        this.child.kill('SIGTERM');
    }
}

export function sendCommand(message: ToClientProcessMessage, child: ChildProcess): void {
    child.send(message);
}

export function startClientHost(mode: IpcType, port: number, runAsNode?: boolean): Promise<ClientHost> {
    return new Promise<ClientHost>((resolve) => {
        const processArguments = createLogArgv();
        const extension = extname(__filename);
        let execArgv = undefined;
        if (extension === '.ts') {
            execArgv = ['-r', 'ts-node/register'];
        }
        const newEnv = Object.assign({}, process.env);
        newEnv.PORT = String(port);
        if (runAsNode) {
            newEnv.ELECTRON_RUN_AS_NODE = '1';
        }
        const child = fork(join(__dirname, `${mode}-bus-echo-client${extension}`), processArguments, {
            env: newEnv,
            execArgv
        });

        const readyCallback = (message: string) => {
            if (message === 'ready') {
                child.off('message', readyCallback);
                resolve(new NodeClientHost(child));
            }
        };
        child.on('message', readyCallback);
    });
}
