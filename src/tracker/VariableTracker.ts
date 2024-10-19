import * as vscode from 'vscode';
import * as fs from 'fs';
import { VariableViewPanel } from '../panel/VariableViewPanel';
import { DebugSessionTracker } from '../debugger/DebugSessionTracker';
import { VariableTypeFactory } from '../debugger/variable/VariableTypeFactory';
import { ImageVariable } from '../debugger/variable/ImageVariable';

export class VariableTracker implements vscode.DebugAdapterTracker {
    private _context: vscode.ExtensionContext;
    private _panel: VariableViewPanel | undefined;
    public breakpoints: any[] = [];

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
    }

    public async onDidSendMessage(message: any) {
        console.log("onDidSendMessage", { ...message });

        if (message.type === 'event' && message.event === 'stopped') {
            const enable = vscode.workspace.getConfiguration().get<boolean>('debug-variable-actions.config.enable');
            if (!enable) {
                console.log("debug-variable-actions.config.enable is disabled");
                return;
            }

            const renderMode = vscode.workspace.getConfiguration().get<string>('debug-variable-actions.config.render-mode');
            switch (renderMode) {
                case 'panel':
                    await this.procImagePanel(message);
                    break;
                case 'panel-vue':
                    await this.procImagePanelVue(message);
                    break;
                case 'stack-vue':
                    await this.procImageStack(message);
                    break;
                default:
                    console.log(`Unknown render mode: ${renderMode}`);
                    return;
            }

            this.saveBreakpoints();

            if (DebugSessionTracker.autoContinueEnable) {
                await this.autoContinueIfNeeded();
            }
        }
    }

    private saveBreakpoints() {
        const tracker = DebugSessionTracker.currentTracker;
        if (tracker) {
            const breakpointsPath = vscode.Uri.joinPath(tracker.saveDirUri, 'breakpoints.json');
            fs.writeFileSync(breakpointsPath.fsPath, JSON.stringify(this.breakpoints, null, 4));
            console.log("Saved breakpoints.json to", breakpointsPath.fsPath);
        }
    }

    private async autoContinueIfNeeded() {
        const sessionTracker = DebugSessionTracker.currentTracker;
        if (sessionTracker) {
            const funcName = sessionTracker.threads[0].frames[0].meta.name.match(/.*[!](.*)?\(/mi)[1];
            if (DebugSessionTracker.autoConintueFrameName === funcName) {
                console.log("Auto-continue enabled, continuing execution...");
                await sessionTracker.stepOver();
            } else {
                console.log("Frame name mismatch, ending auto-continue.");
                DebugSessionTracker.autoContinueEnable = false;
                vscode.window.showInformationMessage("End auto-continue.");
            }
        }
    }

    private async procImagePanelVue(message: any) {
        await this.handleImageProcessing(message, "image-panel-vue", "images");
    }

    private async procImageStack(message: any) {
        await this.handleImageProcessing(message, "image-stack", "images-stack");
    }

    private async procImagePanel(message: any) {
        await this.handleImageProcessing(message, "image-panel", "images");
    }

    private async handleImageProcessing(message: any, panelType: string, command: string) {
        VariableTypeFactory.loadSettings();
        const session = vscode.debug.activeDebugSession;
        if (!session) { return; }

        VariableViewPanel.render(this._context, panelType);
        const panel = VariableViewPanel.currentPanel;
        if (panel) {
            panel.sendInstanceMessage("WAIT FOR IMAGES...");
        }

        DebugSessionTracker.newSessionTracker(this._context, session);
        const sessionTracker = DebugSessionTracker.currentTracker!;
        const threadId = message.body.threadId;

        const thread = sessionTracker.addThread(threadId, [], message.body);
        const variables = await thread.fetchLocalVariablesInFirstFrame();
        const imageMetaWides = await this.processImageVariables(sessionTracker);

        this.breakpoints.push(sessionTracker.getSerializable());

        if (panel) {
            for (const metaWide of imageMetaWides) {
                metaWide.imageWebUrl = panel.getWebViewUrlString(vscode.Uri.file(metaWide.vscode.filePath));
            }

            const workspaceFolders = vscode.workspace.workspaceFolders;
            panel.postMessage({
                command,
                metas: imageMetaWides,
                breakpointMeta: message.body,
                vscodeMeta: { workspaceFolders },
                frames: thread.frames.map(frame => frame.getSerializable())
            });
            panel.showPanel();
            panel.postMessage({ command: "capture" });
            panel.sendInstanceMessage("DONE!");
        }
    }

    private async processImageVariables(sessionTracker: DebugSessionTracker) {
        const imageVariables: ImageVariable[] = sessionTracker.gatherImageVariables();
        const imageMetaWides: any[] = [];

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
}