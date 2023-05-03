import { BrowserWindow } from 'electron';
import * as path from 'path';

import { createLogArgv, isLogEnabled } from '../utils';

import type { IpcType } from '../../ipc-type';
import type { ClientHost, ToClientProcessMessage, ToMainProcessMessage } from '../echo-contract';

const shouldLog = isLogEnabled();
export class ElectronClientHost implements ClientHost {
    private readonly _delayed: Function[] = [];

    constructor(private _browserWindow?: BrowserWindow) {}

    sendCommand(command: ToClientProcessMessage): void {
        shouldLog && console.log(`[MainHost] Sending command ${command}`);
        this._browserWindow.webContents.send('message', command);
    }

    waitForMessage(
        predicate: ToMainProcessMessage | ((mes: ToMainProcessMessage) => boolean)
    ): Promise<ToMainProcessMessage> {
        shouldLog && console.log(`[MainHost][Wait] Start for message ${predicate}`);
        return new Promise((resolve) => {
            const listener = (_event: Electron.Event, channel: string, message: unknown) => {
                /**
                 * As we are communicating via different IPC it is possible for this ack
                 * message arrive before Broker will have an valid addListener entry, so we delay
                 * the resolve of the ack response to make sure that want happen
                 */
                const delayedResolve = (message: unknown) => {
                    this._delayed.push(resolve);
                    setTimeout(() => {
                        shouldLog && console.log(`[MainHost][Wait] Resolved ${message}`);
                        this._delayed.forEach((func) => func(message));
                        this._delayed.length = 0;
                    }, 10);
                };
                if (channel === 'ack') {
                    shouldLog && console.log(`[MainHost][Wait] Got message ${message}`);
                    if (typeof predicate === 'string') {
                        if (predicate === message || (message as { type: string }).type === predicate) {
                            this._browserWindow?.webContents.off('ipc-message', listener);
                            delayedResolve(message);
                        }
                    } else if (typeof predicate === 'function' && predicate(message as ToMainProcessMessage)) {
                        this._browserWindow?.webContents.off('ipc-message', listener);
                        delayedResolve(message);
                    }
                }
            };
            this._browserWindow.webContents.on('ipc-message', listener);
        });
    }

    close(): void {
        this._browserWindow?.close();
        this._browserWindow = undefined;
    }
}

export async function startClientHost(mode: IpcType, port: number, contextIsolation: boolean): Promise<ClientHost> {
    const execArgv = createLogArgv();
    execArgv.push(`--port=${port}`, `--e2e-isolate=${contextIsolation}`);
    const browserWindow = new BrowserWindow({
        show: isLogEnabled(),
        webPreferences: {
            contextIsolation: contextIsolation,
            additionalArguments: execArgv,
            preload: path.join(__dirname, `${mode}-browser-preload.bundle.js`),
        },
    });

    const loadWindow = browserWindow.loadFile(path.join(__dirname, `${mode}-browser-index.html`));
    const windowHost = new ElectronClientHost(browserWindow);
    await windowHost.waitForMessage('ready');
    await loadWindow;
    return windowHost;
}
