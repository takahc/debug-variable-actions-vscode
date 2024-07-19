import * as vscode from 'vscode';
import { VariableViewPanel } from './panel';
import { register } from 'module';

export class VariableTracker implements vscode.DebugAdapterTracker {
    private _context: vscode.ExtensionContext;
    private _panel: VariableViewPanel | undefined;

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
    }

    public onDidSendMessage(message: any) { }

    //     public onDidSendMessage(message: any) {
    //         console.log(Object.assign({}, message));
    //         if ((message.type === 'event' && message.event === 'output') ||
    //             (message.type === 'response' && message.command === 'evaluate')) {
    //             console.log(Object.assign({}, message));
    //             if ((message.body && message.body.category === 'stdout') ||
    //                 (message.boy)) {
    //                 console.log('message.body', message.body);
    //                 if (!this._panel) {
    //                     console.log("this._panel is undefined")
    //                     this._panel = new VariableViewPanel(this._context);
    //                 }
    //                 else{
    //                     console.log("this._panel is NOT undefined")
    //                 }
    //                 console.log("this._panel.isPanelExist 1", this._panel.isPanelExist());
    //                 this._panel.render();
    //                 this._panel.showPanel(vscode.ViewColumn.Two);
    //                 console.log("this._panel.isPanelExist 2", this._panel.isPanelExist());

    //                 let variableOut = {
    //                     message,
    //                     name: message.body.variablesReference,
    //                     value: message.body.output
    //                 };

    //                 console.log("this._panel.isPanelExist 3", this._panel.isPanelExist());
    //                 console.log("posting message to panel")
    //                 this._panel.postMessage({ command: 'variable', output: variableOut });
    //                 console.log("this._panel.isPanelExist 4", this._panel.isPanelExist());
    //             }
    //         }
    //     }
}


export class VariableTrackerRegister implements vscode.DebugAdapterTrackerFactory {
    private variableTracker: VariableTracker;

    constructor(_context: vscode.ExtensionContext) {
        this.variableTracker = new VariableTracker(_context);
    }

    createDebugAdapterTracker(session: vscode.DebugSession):
        vscode.ProviderResult<vscode.DebugAdapterTracker> {
        console.log("sessoin!", session);
        return this.variableTracker;
    }

    static register(context: vscode.ExtensionContext): vscode.Disposable {
        console.log(context);
        return vscode.debug.registerDebugAdapterTrackerFactory('*', new VariableTrackerRegister(context));
    }
}
