import { customAlphabet } from 'nanoid';

const UuidAlphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%^&(){}[]<>~';
export const uuidProvider = customAlphabet(UuidAlphabet, 10);
