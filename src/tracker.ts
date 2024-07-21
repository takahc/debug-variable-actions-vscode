import * as vscode from 'vscode';
import { VariableViewPanel } from './panel';
import { register } from 'module';

import { DebugSessionTracker } from './variable/debugSessionTracker';
import { DebugVariable } from './variable/debugVariable';

export class VariableTracker implements vscode.DebugAdapterTracker {
    private _context: vscode.ExtensionContext;
    private _panel: VariableViewPanel | undefined;

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
    }

    async proc(message: any) {
        const session = vscode.debug.activeDebugSession;
        let sessionTracker = DebugSessionTracker.newSessionTracker(this._context, session!);
        sessionTracker.breakCount++;
        const threadId = message.body.threadId;

        // const stackTrace = await session?.customRequest('stackTrace', { threadId });
        // const frameId = stackTrace.stackFrames[0].id;
        // const scopes = await session?.customRequest('scopes', { frameId });

        // console.log(frameId);
        // console.log(stackTrace);
        // console.log("scopes", scopes);
        // for (const scope of scopes.scopes) {
        //     const variables = await session?.customRequest('variables', { variablesReference: scope.variablesReference });
        //     console.log(variables);
        //     // Here you can process the variables as needed
        // }

        console.log("fetchLocalVariablesInFirstFrame", sessionTracker);
        const thread = sessionTracker.addThread(threadId, [], message.body);
        const variables = await thread.fetchLocalVariablesInFirstFrame();
        console.log("fetchLocalVariablesInFirstFrame", variables);

        let values: any = [];
        variables.forEach((variable: DebugVariable) => {
            values.push(variable.getVariableValuesAsDict());
        });
        console.log("values", values);

        const allVariables = sessionTracker.gatherAllVariables();
        console.log(allVariables);

        const imageVariables = sessionTracker.gatherImageVariables();
        console.log(imageVariables);

        for (const imageVariable of imageVariables) {
            await imageVariable.toFile();
            // imageVariable.toFile();

        }

        console.log("DONE!!");

        let wahat = 3;

    }

    public async onDidSendMessage(message: any) {
        // console.log("onDidSendMessage", Object.assign({}, message));

        if (message.type === 'event' && message.event === 'stopped') {
            await this.proc(message);

            console.log("DONE!!!!!!!!!!!");

        }

    }

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
    public readonly context: vscode.ExtensionContext;

    constructor(_context: vscode.ExtensionContext) {
        this.variableTracker = new VariableTracker(_context);
        this.context = _context;
    }

    createDebugAdapterTracker(session: vscode.DebugSession):
        vscode.ProviderResult<vscode.DebugAdapterTracker> {
        console.log("sessoin!", session);
        DebugSessionTracker.newSessionTracker(this.context, session);
        return this.variableTracker;
    }

    static register(context: vscode.ExtensionContext): vscode.Disposable {
        console.log(context);
        return vscode.debug.registerDebugAdapterTrackerFactory('*', new VariableTrackerRegister(context));
    }
}
