export enum ServiceConstants {
    IPCBUS_SERVICE_WRAPPER_EVENT = 'service-wrapper-event',
    // Special call handlers
    IPCBUS_SERVICE_CALL_GETSTATUS = '__getServiceStatus',

    IPCBUS_SERVICE_ADD_LISTENER = '_addListener',
    IPCBUS_SERVICE_REMOVE_LISTENER = '_removeListener',

    IPCBUS_SERVICE_EVENT_START = 'service-event-start',
    IPCBUS_SERVICE_EVENT_STOP = 'service-event-stop',

    IPCBUS_CHANNEL = '/electron-ipc-bus',

}
