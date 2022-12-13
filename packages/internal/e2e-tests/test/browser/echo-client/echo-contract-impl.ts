import { BrowserWindow } from 'electron';
import * as path from 'path';

import type { ClientHost, ProcessMessage } from '../../utilities/echo-contract';

const isLogEnabled = false;
export class ElectronClientHost implements ClientHost {
    private readonly _delayed: Function[] = [];

    constructor(private _browserWindow?: BrowserWindow) {}

    sendCommand(command: ProcessMessage): void {
        isLogEnabled && console.log(`[MainHost] Sending command ${command}`);
        this._browserWindow.webContents.send('message', command);
    }

    waitForMessage(predicate: string | ((mes: ProcessMessage) => boolean)): Promise<void> {
        isLogEnabled && console.log(`[MainHost][Wait] Start for message ${predicate}`);
        return new Promise((resolve) => {
            const listener = (_event: Electron.Event, channel: string, message: unknown) => {
                /** 
                * As we are communicating via different IPC it is possible for this ack
                * message arrive before Broker will have an valid addListener entry, so we delay
                * the resolve of the ack response to make sure that want happen
                */
                const delayedResolve = () => {
                    this._delayed.push(resolve);
                    setTimeout(() => {
                        isLogEnabled && console.log(`[MainHost][Wait] Resolved ${message}`);
                        this._delayed.forEach(func => func());
                        this._delayed.length = 0;
                    }, 10);
                };
                if (channel === 'ack') {
                    isLogEnabled && console.log(`[MainHost][Wait] Got message ${message}`);
                    if (typeof predicate === 'string' && predicate === message) {
                        this._browserWindow?.webContents.off('ipc-message', listener);
                        delayedResolve();
                    } else if ((predicate as Function)(message)) {
                        this._browserWindow?.webContents.off('ipc-message', listener);
                        delayedResolve();
                    }
                } else {
                    throw new Error(`Not supported channel ${channel} received`);
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

export async function startClientHost(port: number): Promise<ClientHost> {
    const browserWindow = new BrowserWindow({
        show: true,
        webPreferences: {
            contextIsolation: false,
            additionalArguments: [`--port=${port}`, `--log=${isLogEnabled}`],
            preload: path.join(__dirname, 'browser-preload.bundle.js'),
        },
    });

    const loadWindow = browserWindow.loadFile(path.join(__dirname, 'browser-index.html'));
    const windowHost = new ElectronClientHost(browserWindow);
    await windowHost.waitForMessage('ready');
    await loadWindow;
    return windowHost;
}
