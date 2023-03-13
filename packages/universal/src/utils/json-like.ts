export interface JsonLike {
    stringify(value: unknown, replacer?: (key: string, value: unknown) => unknown, space?: string | number): string;
    parse(text: string, reviver?: (key: string, value: unknown) => unknown): unknown;
    install?(): void;
    uninstall?(): void;
}
