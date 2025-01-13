import * as vscode from 'vscode';

import { DebugAdapterTrackerEx } from './debugAdapterTrackerEx';
import { DebugSessionTracker } from '../debugger/debugSessionTracker';

export class DebugAdapterTrackerRegister implements vscode.DebugAdapterTrackerFactory {
    private debugAdapterTracker: DebugAdapterTrackerEx;
    public readonly context: vscode.ExtensionContext;

    constructor(_context: vscode.ExtensionContext) {
        this.debugAdapterTracker = new DebugAdapterTrackerEx(_context);
        this.context = _context;
    }

    createDebugAdapterTracker(session: vscode.DebugSession):
        vscode.ProviderResult<vscode.DebugAdapterTracker> {
        console.log("sessoin!", session);
        const tracker = DebugSessionTracker.newSessionTracker(this.context, session);
        DebugSessionTracker.breakCount = 0; // FIXME: It should better to manage not by a static.
        this.debugAdapterTracker.breakpoints = [];
        return this.debugAdapterTracker;
    }

    static register(context: vscode.ExtensionContext): vscode.Disposable {
        console.log(context);
        return vscode.debug.registerDebugAdapterTrackerFactory('*', new DebugAdapterTrackerRegister(context));
    }
}
