import * as vscode from 'vscode';
import dedent from 'dedent';
import * as ejs from 'ejs';
import { existsSync } from 'fs';
import WebSocket from 'ws';

// export type VariableVeiewRenderMode = "image-panel" | "image-stack";
export type VariableViewRenderMode = string;

export class VariableViewProvider implements vscode.WebviewViewProvider {
    public static currentView: VariableViewProvider | undefined;
    private _webviewView: vscode.WebviewView | undefined;
    private _disposables: vscode.Disposable[] = [];
    private _context: vscode.ExtensionContext;
    public static DefaultRenderMode: VariableViewRenderMode = "image-panel";
    private static lastRenderMode: VariableViewRenderMode | undefined = undefined;
    private _wss: WebSocket.Server;

    constructor(context: vscode.ExtensionContext, renderMode?: VariableViewRenderMode) {
        console.log("VariableViewPanel constructor");
        this._context = context;

        // Set up WebSocket server
        this._wss = new WebSocket.Server({ port: 8081 });
        console.log("WebSocket server starting...", this._wss);
        this._wss.on('connection', ws => {
            console.log('WebSocket connection established');
        });
    }

    resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, token: vscode.CancellationToken): void {
        console.log("VariableViewPanel resolveWebviewView");
        this._webviewView = webviewView;
        VariableViewProvider.currentView = this;
        const localResourceRoots = this._context.storageUri ? [
            vscode.Uri.joinPath(this._context.extensionUri, "public"),
            vscode.Uri.joinPath(this._context.storageUri)
        ] : [vscode.Uri.joinPath(this._context.extensionUri, "public")];
        this._webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: localResourceRoots
        };
        console.log("VariableViewProvider set HTML");
        this._webviewView.webview.html = this._getWebviewContent();
        this._setWebviewMessageListener(this._webviewView.webview);
    }

    /**
   * Cleans up and disposes of webview resources when the webview panel is closed.
   */
    public dispose() {
        VariableViewProvider.currentView = undefined;
        VariableViewProvider.lastRenderMode = undefined;

        // Dispose of the WebSocket server
        this._wss.close();

        // Dispose of the current webview panel
        // this._panel.dispose();

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

    showPanel(preserveFocus?: boolean): boolean {
        console.log("VariableViewPanel show");
        if (this._webviewView) {
            this._webviewView.show(preserveFocus);
            return true;
        }
        return false;
    }

    getWebViewUrlString(uri: vscode.Uri) {
        if (this._webviewView === undefined) {
            console.warn("Error! No webview to get URI", uri);
            return "";
        }
        const weburi = this._webviewView.webview.asWebviewUri(uri);
        const weburiStr = weburi.toString();
        return weburiStr;
    }

    postMessage(message: any) {
        if (this._webviewView) {
            this._webviewView.webview.postMessage(message);
        }
        else {
            console.warn("Error! No panel to post message to!");
        }

        // Post ws
        if (vscode.workspace.getConfiguration().get("debug-variable-actions.config.post-server")) {
            this.postWebSocketMessage(JSON.stringify(message));
        }
    }

    public postWebSocketMessage(message: string) {
        this._wss.clients.forEach((client: WebSocket) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }


    sendInstantMessage(instant_message: string) {
        if (this._webviewView) {
            const message = {
                command: "instant-message",
                message: instant_message
            };
            this._webviewView.webview.postMessage(message);
        }
    }


    _getWebviewContent(renderMode?: VariableViewRenderMode): string {
        if (this._webviewView === undefined) {
            console.warn("Error! No webview to get content");
            return "ERROR:" + __filename;
        }

        let publicDir = this._webviewView.webview.asWebviewUri(
            vscode.Uri.joinPath(this._context.extensionUri, "public")
        );
        console.log("publicDir", publicDir);

        if (renderMode === undefined && VariableViewProvider.lastRenderMode === undefined) {
            renderMode = VariableViewProvider.DefaultRenderMode;
        }
        else if (renderMode === undefined) {
            renderMode = VariableViewProvider.lastRenderMode;
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