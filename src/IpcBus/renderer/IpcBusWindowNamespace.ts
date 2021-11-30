export const ElectronCommonIpcNamespace = 'ElectronCommonIpc';

export function IsElectronCommonIpcAvailable(): boolean {
    try {
        const windowLocal = window as any;
        const electronCommonIpcSpace = windowLocal[ElectronCommonIpcNamespace];
        return (electronCommonIpcSpace != null);
    }
    catch (err) {
    }
    return false;
}


