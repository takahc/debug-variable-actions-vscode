import * as vscode from 'vscode';
import dedent from 'dedent';


export class VariableViewPanel {
    private _panel: vscode.WebviewPanel;
    private _panels: vscode.WebviewPanel[] = [];
    private _disposables: vscode.Disposable[] = [];
    private _context: vscode.ExtensionContext;


    constructor(context: vscode.ExtensionContext) {
        console.log("VariableViewPanel constructor");
        this._context = context;
        this._panel = this.createPanel();
    }

    createPanel(): vscode.WebviewPanel {
        if (this._panel) {
            return this._panel;
        }
        console.log("VariableViewPanel create");

        let localResourceRoots = this._context.storageUri ? [
            vscode.Uri.joinPath(this._context.extensionUri, "public"),
            vscode.Uri.joinPath(this._context.storageUri)
        ] : [vscode.Uri.joinPath(this._context.extensionUri, "public")];

        this._panel = vscode.window.createWebviewPanel(
            'variableView',
            'Variable View',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: localResourceRoots
            }
        );

        let csp = this._panel.webview.cspSource;

        this._panel.onDidDispose(() => {
            this._panel = this.createPanel();
        });

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

        this._panel.webview.html = `<!DOCTYPE html>
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
        this._panel.webview.html = dedent`
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

        return this._panel;
    }

    showPanel(where: vscode.ViewColumn = vscode.ViewColumn.One): boolean {
        console.log("VariableViewPanel show");
        if (this._panel) {
            this._panel.reveal(where);
            return true;
        }
        return false;
    }

    getWebViewUrlString(relative_path: string) {
        const p = this._context.storageUri ?
            vscode.Uri.joinPath(this._context.storageUri, relative_path) :
            vscode.Uri.joinPath(this._context.globalStorageUri, relative_path);

        const uri = this._panel.webview.asWebviewUri(p);
        const urlStr = uri.toString();

        return urlStr;
    }

    render(where: vscode.ViewColumn = vscode.ViewColumn.One) {
        console.log("VariableViewPanel render");
        if (!this._panel) {
            this._panel = this.createPanel();
        }
        this.showPanel(where);
    }

    postMessage(message: any) {
        if (this._panel) {
            this._panel.webview.postMessage(message);
        }
        else {
            console.log("Error! No panel to post message to!");
        }
    }

    isPanelExist(): boolean {
        return this._panel ? true : false;
    }
}