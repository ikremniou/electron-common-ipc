export const Logger = {
    enable: false,
    service: false,
};

export function activateIpcBusTrace(enable: boolean): void {
    Logger.enable = enable;
}

export function activateServiceTrace(enable: boolean): void {
    Logger.service = enable;
}
