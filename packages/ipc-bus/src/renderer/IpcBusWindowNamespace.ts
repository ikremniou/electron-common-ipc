export const ElectronCommonIpcNamespace = 'ElectronCommonIpc';

export function isIpcAvailable(): boolean {
    try {
        const windowLocal = window;
        const electronCommonIpcSpace = windowLocal[ElectronCommonIpcNamespace];
        return electronCommonIpcSpace !== undefined;
    } catch {
        return false;
    }
}
