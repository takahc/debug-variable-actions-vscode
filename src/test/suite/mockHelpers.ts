import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Creates a minimal mock of vscode.DebugSession.
 * customRequestHandler receives (command, args) and returns a Promise.
 */
export function createMockSession(
    customRequestHandler: (command: string, args: any) => Promise<any>
): vscode.DebugSession {
    return {
        id: 'test-session-' + Math.random().toString(36).slice(2),
        name: 'Test Session',
        type: 'cppdbg',
        workspaceFolder: undefined,
        configuration: { type: 'cppdbg', name: 'Test', request: 'launch' },
        customRequest: customRequestHandler,
    } as unknown as vscode.DebugSession;
}

/**
 * Creates a minimal mock of vscode.ExtensionContext backed by a real temp directory.
 * Each call returns a fresh unique directory so tests stay isolated.
 */
export function createMockContext(): vscode.ExtensionContext {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsc-img-test-'));
    const storageUri = vscode.Uri.file(tmpDir);
    return {
        storageUri,
        globalStorageUri: storageUri,
    } as unknown as vscode.ExtensionContext;
}
