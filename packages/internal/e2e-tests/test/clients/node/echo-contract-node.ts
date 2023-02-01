import { fork } from 'child_process';
import { join, extname } from 'path';

import type { IpcType } from '../../compare/ipc-type';
import type { ClientHost, ToClientProcessMessage, ToHostProcessMessage } from '../echo-contract';
import type { ChildProcess } from 'child_process';

export class NodeClientHost implements ClientHost {
    constructor(private readonly child: ChildProcess) {}

    sendCommand(message: ToClientProcessMessage): void {
        this.child.send(message);
    }

    waitForMessage(predicate: ToHostProcessMessage | ((mes: ToHostProcessMessage) => boolean)): Promise<void> {
        return new Promise((resolve) => {
            const messageCallback = (message: ToHostProcessMessage | string) => {
                if (typeof message === 'string' && predicate === message) {
                    this.child.off('message', messageCallback);
                    resolve();
                } else if ((predicate as Function)(message)) {
                    this.child.off('message', messageCallback);
                    resolve();
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
        let execArgv = undefined;
        const extension = extname(__filename);
        if (extension === '.ts') {
            execArgv = ['-r', 'ts-node/register'];
        }
        const newEnv = Object.assign({}, process.env);
        newEnv.PORT = String(port);
        if (runAsNode) {
            newEnv.ELECTRON_RUN_AS_NODE = '1';
        }
        const child = fork(join(__dirname, `${mode}-bus-echo-client${extension}`), {
            env: newEnv,
            execArgv,
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
