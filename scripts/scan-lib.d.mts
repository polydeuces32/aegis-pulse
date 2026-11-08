export function parseDevKey(envText: string | null | undefined): string;
export function loadDevKey(envFile: string): { present: boolean; key: string };
export function walk(dir: string): Generator<string>;
export function findKeyLeaks(root: string, key: string, except?: string[]): string[];
export interface SecretPattern { name: string; js: RegExp; ere: string }
export const SECRET_PATTERNS: SecretPattern[];
export function findSecretPatterns(root: string, files: string[], skipFiles?: string[]): Array<{ file: string; pattern: string }>;
export function secretPatternsEre(): string;
