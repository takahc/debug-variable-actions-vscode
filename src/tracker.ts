import * as vscode from 'vscode';
import { VariableViewPanel } from './panel';
import { DebugSessionTracker } from './variable/debugSessionTracker';
import { DebugVariable } from './variable/debugVariable';
import { VariableTypeFactory } from './variable/variableTypeFactory';
import { ImageVariable } from './variable/imageVariable';

export class VariableTracker implements vscode.DebugAdapterTracker {
    private _context: vscode.ExtensionContext;
    private _panel: VariableViewPanel | undefined;
    private _sessionTracker: DebugSessionTracker | undefined;

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
    }

    public async onDidSendMessage(message: any) {
        // console.log("onDidSendMessage", Object.assign({}, message));

        if (message.type === 'event' && message.event === 'stopped') {
            const enable = await vscode.workspace.getConfiguration().get('debug-variable-actions.config.enable');
            if (enable) {
                await this.procImagePanel(message);
            } else {
                console.log("debug-variable-actions.config.enable is", enable);
            }
        }
    }

    async procImagePanel(message: any) {
        await this.initializeImagePanel();
        const sessionTracker = this.setupSessionTracker(message);
        const variables = await this.fetchVariables(sessionTracker, message);
        const imageMetaWides = await this.processImageVariables(sessionTracker);
        await this.renderImagePanel(imageMetaWides, message);
    }

    private async initializeImagePanel(): Promise<void> {
        VariableTypeFactory.loadSettings();
        VariableViewPanel.render(this._context);
        VariableViewPanel.sendInstanceMessage("WAIT FOR IMAGES...");
    }

    private setupSessionTracker(message: any): DebugSessionTracker {
        const session = vscode.debug.activeDebugSession;
        DebugSessionTracker.newSessionTracker(this._context, session!);
        const sessionTracker = DebugSessionTracker.currentTracker!;
        DebugSessionTracker.breakCount++;
        return sessionTracker;
    }

    private async fetchVariables(sessionTracker: DebugSessionTracker, message: any): Promise<DebugVariable[]> {
        const threadId = message.body.threadId;
        console.log("fetchLocalVariablesInFirstFrame", sessionTracker);
        
        const thread = sessionTracker.addThread(threadId, [], message.body);
        const variables = await thread.fetchLocalVariablesInFirstFrame();
        console.log("fetchLocalVariablesInFirstFrame", variables);

        const values: any = [];
        variables.forEach((variable: DebugVariable) => {
            values.push(variable.getVariableValuesAsDict());
        });
        console.log("values", values);

        const allVariables = sessionTracker.gatherAllVariables();
        console.log(allVariables);

        return variables;
    }

    private async processImageVariables(sessionTracker: DebugSessionTracker): Promise<any[]> {
        const imageVariables: ImageVariable[] = sessionTracker.gatherImageVariables();
        console.log(imageVariables);

        const imageMetaWides = [];
        for (const imageVariable of imageVariables) {
            imageVariable.updateImageInfo();
            imageVariable.updateBinaryInfo();
            const metaWide = await imageVariable.toFile();
            if (metaWide) {
                imageMetaWides.push(metaWide);
            }
        }

        return imageMetaWides;
    }

    private async renderImagePanel(imageMetaWides: any[], message: any): Promise<void> {
        console.log("rendering panel");
        VariableViewPanel.render(this._context, "image-panel");
        const panel = VariableViewPanel.currentPanel;
        
        if (panel) {
            this.setImageWebUrls(panel, imageMetaWides);
            this.displayImages(panel, imageMetaWides, message);
            console.log("DONE!!");
        } else {
            console.log("panel is undefined");
        }

        console.log("DONE!!!!!!!!!!!");
        VariableViewPanel.postMessage({ command: "capture" });
        VariableViewPanel.sendInstanceMessage("DONE!");
    }

    private setImageWebUrls(panel: VariableViewPanel, imageMetaWides: any[]): void {
        for (const metaWide of imageMetaWides) {
            metaWide.imageWebUrl = panel.getWebViewUrlString(vscode.Uri.file(metaWide.vscode.filePath));
        }
        console.log("imageMetaWides", imageMetaWides);
    }

    private displayImages(panel: VariableViewPanel, imageMetaWides: any[], message: any): void {
        console.log("showing images on panel", panel);
        const workspaceFolders = vscode.workspace.workspaceFolders;
        
        panel.postMessage({
            command: "images",
            metas: imageMetaWides,
            breakpointMeta: message.body,
            vscodeMeta: { workspaceFolders }
        });
        panel.showPanel();
    }
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
        DebugSessionTracker.breakCount = 0; // FIXME: It should better to manage not by a static.
        return this.variableTracker;
    }

    static register(context: vscode.ExtensionContext): vscode.Disposable {
        console.log(context);
        return vscode.debug.registerDebugAdapterTrackerFactory('*', new VariableTrackerRegister(context));
    }
}
