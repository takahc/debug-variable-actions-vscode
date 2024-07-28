import * as vscode from 'vscode';
import dedent from 'dedent';


export class VariableViewPanel {
    public static currentPanel: VariableViewPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _context: vscode.ExtensionContext;


    constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
        console.log("VariableViewPanel constructor");
        this._panel = panel;
        this._context = context;

        // Set an event listener to listen for when the panel is disposed (i.e. when the user closes
        // the panel or when the panel is closed programmatically)
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Set the HTML content for the webview panel
        this._panel.webview.html = this._getWebviewContent();

        // Set an event listener to listen for messages passed from the webview context
        this._setWebviewMessageListener(this._panel.webview);
    }

    /**
   * Cleans up and disposes of webview resources when the webview panel is closed.
   */
    public dispose() {
        VariableViewPanel.currentPanel = undefined;

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
                            console.log("vscode.open", uri);
                            vscode.commands.executeCommand("vscode.open", uri);
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

    showPanel(where: vscode.ViewColumn = vscode.ViewColumn.Beside): boolean {
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

    public static render(context: vscode.ExtensionContext) {
        if (VariableViewPanel.currentPanel) {
            // If the webview panel already exists reveal it
            VariableViewPanel.currentPanel._panel.reveal(vscode.ViewColumn.Beside);
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
                }
            );

            VariableViewPanel.currentPanel = new VariableViewPanel(panel, context);
        }
    }


    postMessage(message: any) {
        if (this._panel) {
            this._panel.webview.postMessage(message);
        }
        else {
            console.log("Error! No panel to post message to!");
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


    static sendInstanceMessage(instant_message: string) {
        const panel = VariableViewPanel.currentPanel;
        if (panel) {
            const message = {
                command: "instant-message",
                message: instant_message
            }
            panel._panel.webview.postMessage(message);
        }
    }


    _getWebviewContent() {
        let html;

        let publicDir = this._panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this._context.extensionUri, "public")
        );

        // this._panel.webview.html = `<!DOCTYPE html>
        // <head>
        //   <html>
        //     <meta charset="utf-8"/>
        //     <body>
        //       Test Chart
        //       <canvas id="myChart" style="background-color: #FFF"></canvas>
        //       <script
        //         type="text/javascript"
        //         src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.2.0/chart.min.js">
        //         </script>
        //       <script type="text/javascript">
        //         const ctx = document.getElementById("myChart");
        //         const myChart = new Chart(ctx, {
        //           type: "bar",
        //           data: {
        //             labels: ["Red", "Blue", "Yellow", "Green", "Purple", "Orange"],
        //             datasets: [
        //               {
        //                 label: "# of Votes",
        //                 data: [12, 19, 3, 5, 2, 3],
        //                 backgroundColor: [
        //                   "rgba(255, 99, 132, 0.2)",
        //                   "rgba(54, 162, 235, 0.2)",
        //                   "rgba(255, 206, 86, 0.2)",
        //                   "rgba(75, 192, 192, 0.2)",
        //                   "rgba(153, 102, 255, 0.2)",
        //                   "rgba(255, 159, 64, 0.2)",
        //                 ],
        //                 borderColor: [
        //                   "rgba(255, 99, 132, 1)",
        //                   "rgba(54, 162, 235, 1)",
        //                   "rgba(255, 206, 86, 1)",
        //                   "rgba(75, 192, 192, 1)",
        //                   "rgba(153, 102, 255, 1)",
        //                   "rgba(255, 159, 64, 1)",
        //                 ],
        //                 borderWidth: 1,
        //               },
        //             ],
        //           },
        //           options: {
        //             scales: {
        //               y: {
        //                 beginAtZero: true,
        //               },
        //             },
        //           },
        //         });
        //       </script>
        //     </body>
        //   </html>
        // </head>`;

        html = `<!DOCTYPE html>
        <html lang="en">
          <head>
            <link
              href="https://unpkg.com/gridjs/dist/theme/mermaid.min.css"
              rel="stylesheet"
            />
          </head>
          <body>
            <div id="wrapper"></div>
        
            <script src="https://unpkg.com/gridjs/dist/gridjs.umd.js"></script>
            <script>
                new gridjs.Grid({
                    columns: ["Name", "Email", "Phone Number"],
                    data: [
                    ["John", "john@example.com", "(353) 01 222 3333"],
                    ["Mark", "mark@gmail.com", "(01) 22 888 4444"],
                    ["Eoin", "eoin@gmail.com", "0097 22 654 00033"],
                    ["Sarah", "sarahcdd@gmail.com", "+322 876 1233"],
                    ["Afshin", "afshin@mail.com", "(353) 22 87 8356"]
                    ]
                }).render(document.getElementById("wrapper"));
            </script>
            <script src="${publicDir}/index.js" />

          </body>
        </html>`;




        // this._panel.webview.html = `<!DOCTYPE html>
        // <head>
        //   <html>
        //     <meta charset="utf-8"/>
        //     <body>
        //     <script type="text/javascript" src="https://cdn.jsdelivr.net/npm/gridjs@latest/dist/gridjs.production.min.js"></script>
        //     <div id="wrapper"></div>

        //     <script type="text/javascript">
        //         const grid = new Grid({
        //             data: [
        //             ["John", 30, "Engineer"],
        //             ["Jane", 25, "Designer"]
        //             ],
        //             columns: ["Name", "Age", "Occupation"]
        //             });
        //     </script>

        //     </body>
        //   </html>
        // </head>`;




        // this._panel.webview.html = dedent`
        //     <!DOCTYPE html>
        //         <html lang="en">
        //         <head>
        //             <meta charset="UTF-8">
        //             <meta name="viewport" content="width=device-width, initial-scale=1.0"
        //             <link rel="stylesheet" href="${publicDir}/tabulator/css/style.css" />

        //             <title>Cat Coding</title>
        //         </head>
        //         <body>

        //             <div id="example-table"></div>

        //             <script src="${publicDir}/tabulator.min.js" />
        //             <script src="${publicDir}/index.js" />
        //         </body>
        //     </html>`;

        // this._panel.webview.html = dedent`
        // <!DOCTYPE html>
        // <html lang="en">
        // <head>
        //     <meta charset="UTF-8">
        //     <meta name="viewport" content="width=device-width, initial-scale=1.0" <link rel="stylesheet" href="${publicDir}/tabulator/css/style.css" />
        //     <title>View Variable</title>
        //     <link href="https://unpkg.com/tabulator-tables@6.2.1/dist/css/tabulator.min.css" rel="stylesheet">
        //     <script type="text/javascript" src="https://unpkg.com/tabulator-tables@6.2.1/dist/js/tabulator.min.js"></script>
        // </head>
        // <body>
        //     <div id="example-table"></div>
        //     <script src="${publicDir}/index.js" />
        // </body>
        // </html>`


        // jSpreadsheet
        html = dedent`
        <html>
            <script src="https://bossanova.uk/jspreadsheet/v4/jexcel.js"></script>
            <link rel="stylesheet" href="https://bossanova.uk/jspreadsheet/v4/jexcel.css" type="text/css" />
            <link rel="stylesheet" href="https://bossanova.uk/jspreadsheet/v4/jexcel.themes.css" type="text/css" />

            <script src="https://jsuites.net/v4/jsuites.js"></script>
            <link rel="stylesheet" href="https://jsuites.net/v4/jsuites.css" type="text/css" />
            
            <div id="spreadsheet"></div>

            <style>body{color:white;}</style>

            <script src="${publicDir}/index.js" />
        </html>
        `;

        // Image
        html = dedent`
        <html>
        <head>
            <link rel="stylesheet" href="${publicDir}/style_image.css" type="text/css" />
        </head>
        <body>
            <div id="instant-message"></div>
            <div id="wrapper"></div>
            <script src="${publicDir}/index_image.js" />
        </body></html>
        `;


        // Image panel
        html = dedent`
                <html>
                <head>
                    <link rel="stylesheet" href="${publicDir}/style_image_panel.css" type="text/css" />
                </head>
                <body>
                    <div id="instant-message"></div>
                    <div id="wrapper"></div>
                    <script src="${publicDir}/index_image_panel.js" />
                </body></html>
        `;


        return html;

    }
}