import {
    ActivateIpcBusTrace,
    CreateIpcBusClient,
    CreateIpcBusService,
    CreateIpcBusServiceProxy,
} from 'electron-common-ipc';

import { bootstrap } from './browser-client-base';

const shouldLog =
    window.__electronProcess.argv.find((argv: string) => argv.startsWith('--log'))?.split('=')[1] === 'true';
ActivateIpcBusTrace(shouldLog);
bootstrap(CreateIpcBusClient as never, CreateIpcBusService as never, CreateIpcBusServiceProxy as never);
