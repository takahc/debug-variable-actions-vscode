import * as vscode from 'vscode';

import { VariableTracker } from './variableTracker';
import { DebugSessionTracker } from '../debugger/debugSessionTracker';

export class VariableTrackerRegister implements vscode.DebugAdapterTrackerFactory {
    private variableTracker: VariableTracker;
    public readonly context: vscode.ExtensionContext;

    constructor(_context: vscode.ExtensionContext) {
        this.variableTracker = new VariableTracker(_context);
        this.context = _context;
    }

    createDebugAdapterTracker(session: vscode.DebugSession):
        vscode.ProviderResult<vscode.DebugAdapterTracker> {
        console.log("sessoin!", session);
        const tracker = DebugSessionTracker.newSessionTracker(this.context, session);
        DebugSessionTracker.breakCount = 0; // FIXME: It should better to manage not by a static.
        this.variableTracker.breakpoints = [];
        return this.variableTracker;
    }

    static register(context: vscode.ExtensionContext): vscode.Disposable {
        console.log(context);
        return vscode.debug.registerDebugAdapterTrackerFactory('*', new VariableTrackerRegister(context));
    }
}
