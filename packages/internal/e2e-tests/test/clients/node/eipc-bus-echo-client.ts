import {
    ActivateIpcBusTrace,
    CreateIpcBusClient,
    CreateIpcBusService,
    CreateIpcBusServiceProxy,
} from 'electron-common-ipc';

import { bootstrap } from './bus-echo-client-base';

const shouldLog = Boolean(process.env['LOG']);
ActivateIpcBusTrace(shouldLog);

bootstrap(CreateIpcBusClient as never, CreateIpcBusService as never, CreateIpcBusServiceProxy as never);
