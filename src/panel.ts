import * as vscode from 'vscode';
import dedent from 'dedent';
import * as ejs from 'ejs';
import { existsSync } from 'fs';
import * as https from 'https';

// export type VariableVeiewRenderMode = "image-panel" | "image-stack";
export type VariableVeiewRenderMode = string;

export class VariableViewPanel {
    public static currentPanel: VariableViewPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _context: vscode.ExtensionContext;
    public static DefaultRenderMode: VariableVeiewRenderMode = "image-panel";
    private static lastRenderMode: VariableVeiewRenderMode | undefined = undefined;


    constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext, renderMode?: VariableVeiewRenderMode) {
        console.log("VariableViewPanel constructor");
        this._panel = panel;
        this._context = context;

        // Set an event listener to listen for when the panel is disposed (i.e. when the user closes
        // the panel or when the panel is closed programmatically)
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Set the HTML content for the webview panel
        this._panel.webview.html = this._getWebviewContent(renderMode);

        // Set an event listener to listen for messages passed from the webview context
        this._setWebviewMessageListener(this._panel.webview);
    }

    /**
   * Cleans up and disposes of webview resources when the webview panel is closed.
   */
    public dispose() {
        VariableViewPanel.currentPanel = undefined;
        VariableViewPanel.lastRenderMode = undefined;

        // Dispose of the current webview panel
        this._panel.dispose();

        // Dispose of all disposables (i.e. commands) associated with the current webview panel
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    /**
   * Sets up an event listener to listen for messages passed from the webview context and
   * executes code based on the message that is recieved.
   *
   * @param webview A reference to the extension webview
   */
    private _setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(
            (message: any) => {
                const command = message.command;
                const text = message.text;

                switch (command) {
                    case "hello":
                        // Code that should run in response to the hello message command
                        vscode.window.showInformationMessage(text);
                        return;
                    // Add more switch case statements here as more webview message commands
                    // are created within the webview context (i.e. inside src/webview/main.ts)
                    case "revealTextFile":
                        {
                            const uri = vscode.Uri.file(message.uri);
                            const _pos = message.pos;
                            const pos = _pos ? new vscode.Position(_pos[0], _pos[1]) : new vscode.Position(0, 0);
                            console.log("vscode.executeDocumentHighlights", uri, pos);
                            vscode.commands.executeCommand("vscode.executeDocumentHighlights", uri, pos);
                        }
                        break;
                    case "open":
                        {
                            const uri = vscode.Uri.file(message.uri);
                            const _pos = message.pos;
                            console.log("vscode.open", message, uri, _pos);
                            // vscode.commands.executeCommand("vscode.open", uri);
                            vscode.commands.executeCommand("vscode.openWith", uri, "default", vscode.ViewColumn.One);

                            let activeEditor = vscode.window.activeTextEditor;
                            if (activeEditor) {
                                const lineToGo = _pos[0];
                                let range = activeEditor.document.lineAt(lineToGo - 1).range;
                                activeEditor.selection = new vscode.Selection(range.start, range.end);
                                activeEditor.revealRange(range);
                            }
                        }
                        break;

                }
            },
            undefined,
            this._disposables
        );
    }

    createPanel(): vscode.WebviewPanel {
        if (this._panel) {
            return this._panel;
        }
        console.log("VariableViewPanel create");

        return this._panel;
    }

    showPanel(where: vscode.ViewColumn = vscode.ViewColumn.Two): boolean {
        console.log("VariableViewPanel show");
        if (this._panel) {
            this._panel.reveal(where);
            return true;
        }
        return false;
    }

    getWebViewUrlString(uri: vscode.Uri) {
        const weburi = this._panel.webview.asWebviewUri(uri);
        const weburiStr = weburi.toString();
        return weburiStr;
    }

    public static render(context: vscode.ExtensionContext, renderMode?: VariableVeiewRenderMode) {
        if (VariableViewPanel.currentPanel) {
            // If the webview panel already exists reveal it
            VariableViewPanel.currentPanel._panel.reveal(vscode.ViewColumn.Two);
        } else {
            let localResourceRoots = context.storageUri ? [
                vscode.Uri.joinPath(context.extensionUri, "public"),
                vscode.Uri.joinPath(context.storageUri)
            ] : [vscode.Uri.joinPath(context.extensionUri, "public")];

            // If a webview panel does not already exist create and show a new one
            const panel = vscode.window.createWebviewPanel(
                // Panel view type
                'variableView',
                // Panel title
                'Variable View',
                // The editor column the panel should be displayed in
                vscode.ViewColumn.Beside,
                // Extra panel configurations
                {
                    // Enable JavaScript in the webview
                    enableScripts: true,
                    // Restrict the webview to only load resources from the `out` directory
                    localResourceRoots: localResourceRoots,
                    // misc
                    enableFindWidget: true
                }
            );

            VariableViewPanel.currentPanel = new VariableViewPanel(panel, context, renderMode);
        }
        VariableViewPanel.lastRenderMode = renderMode;
    }


    postMessage(message: any) {
        if (this._panel) {
            this._panel.webview.postMessage(message);
        }
        else {
            console.log("Error! No panel to post message to!");
        }

        if (vscode.workspace.getConfiguration().get("debug-variable-actions.config.post-server")) {
            // Post http request for frontend
            const options = {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
            };
            let url = vscode.workspace.getConfiguration().get("variable-view-debugger.serverUrl");
            if (!url) {
                if (process.env.NODE_ENV === "development") {
                    url = "http://localhost:8080";
                } else {
                    url = "http://localhost:8080"; // default
                }
            }
            console.log("postMessage to", url, message);
            const request = https.request(url as string, options, response => {
                console.log(`statusCode: ${response.statusCode}`);
            });
            request.write(JSON.stringify(message));
            request.end();
        }
    }

    static postMessage(message: any) {
        const panel = VariableViewPanel.currentPanel;
        if (panel) {
            panel._panel.webview.postMessage(message);
        }
        else {
            console.log("Error! No panel to post message to!");
        }
    }


    sendInstanceMessage(instant_message: string) {
        const panel = VariableViewPanel.currentPanel;
        if (panel) {
            const message = {
                command: "instant-message",
                message: instant_message
            };
            panel._panel.webview.postMessage(message);
        }
    }


    _getWebviewContent(renderMode?: VariableVeiewRenderMode): string {

        let publicDir = this._panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this._context.extensionUri, "public")
        );
        console.log("publicDir", publicDir);

        if (renderMode === undefined && VariableViewPanel.lastRenderMode === undefined) {
            renderMode = VariableViewPanel.DefaultRenderMode;
        }
        else if (renderMode === undefined) {
            renderMode = VariableViewPanel.lastRenderMode;
        }

        const templeatePath = vscode.Uri.joinPath(this._context.extensionUri, "panel_html_templates", renderMode + ".ejs");
        console.log("templeatePath", templeatePath.fsPath);
        // check exist
        if (existsSync(templeatePath.fsPath) === false) {
            console.log("Error. Template file not found: ", templeatePath.fsPath);
            return dedent`Error. Template file not found: ${templeatePath.fsPath}`;
        }
        const template = ejs.fileLoader(templeatePath.fsPath).toString();
        const html = ejs.render(template, { publicDir: publicDir });

        return html;
    }
}