// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import dedent from 'dedent';

import { VariableTrackerRegister } from './tracker';

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log("activated");

	// Only allow a single Cat Coder
	let lastPanel: vscode.WebviewPanel | undefined = undefined;

	// Register a variable tracker:
	console.log("context", context)
	context.subscriptions.push(VariableTrackerRegister.register(context));

	// Register a variable tracker
	// context.subscriptions.push(
	// 	vscode.debug.registerDebugAdapterTrackerFactory('*', {
	// 		createDebugAdapterTracker: (session: vscode.DebugSession): vscode.ProviderResult<vscode.DebugAdapterTracker> => {
	// 			console.log("sessoin!!", session);
	// 			return {
	// 				onDidSendMessage(message: any): void {
	// 					if ((message.type === 'event' && message.event === 'output') ||
	// 						(message.type === 'response' && message.command === 'evaluate')) {
	// 						console.log(Object.assign({}, message));
	// 						if ((message.body && message.body.category === 'stdout') ||
	// 							(message.boy && message.body.category === 'stdout')) {

	// 							console.log('message.body', message.body);
	// 							if (lastPanel) {
	// 								lastPanel.reveal(vscode.ViewColumn.Two);
	// 							} else {
	// 								lastPanel = getWebviewPanel(context);
	// 							}

	// 							let variableOut = {
	// 								message,
	// 								name: message.body.variablesReference,
	// 								value: message.body.output
	// 							};

	// 							lastPanel.webview.postMessage({ command: 'variable', message: variableOut });
	// 						}
	// 					}
	// 				},

	// 			};
	// 		}
	// 	}));

	context.subscriptions.push(
		vscode.commands.registerCommand('debug-variable-right-click-actions.action', (request: any) => {
			// get value
			vscode.debug.activeDebugSession?.customRequest('stackTrace', { threadId: 1 }).then((response) => {
				const frameId = response.stackFrames[0].id;
				// const code = `import pandas as pd; print(pd.DataFrame(${request.variable.name}).to_json())`;
				// const code = `import pandas; print((lambda : pandas.DataFrame(${request.variable.name}).to_json())())`
				const code = dedent`
				import json
				print(
					(lambda : 
						json.dumps(
							(${request.variable.name}).tolist()
						) 
					)()
				)`;
				const code2 = dedent`
					def get_type

					def get_variable_info():
						import builtins as _VSCODE_BUILTINS
						import sys as _VSCODE_SYS
						import json as _VSCODE_JSON
						
						var = ${request.variable.name}
						
						
						if "numpy" in _VSCODE_SYS.modules:
							import numpy as _VSCODE_NP
							if isinstance(var_json, _VSCODE_NP.ndarray):
								var_json = numpy.array(var_json).tolist()						

						if "pandas" in _VSCODE_SYS.modules:
							var_json = _VSCODE_PD.DataFrame({var).to_json()
								
						out_json = json.dumps{}

						return xxx
						
					print(get_variable_info())

					del _VSCODE_BUILTINS, _VSODE_SYS, _VSCODE_JSON
					if "numpy" in _VSCODE_SYS.modules: del _VSCODE_NP
					if "pandas" in _VSCODE_SYS.modules: del _VSCODE_PD
					
					del get_variable_info
				`;

				console.log("evaluate code: ", code);
				vscode.debug.activeDebugSession?.customRequest('evaluate', {
					expression: code,
					frameId: frameId,
					context: "repl",
					format: { rawString: true }
				});
			});

		})
	);


	context.subscriptions.push(
		vscode.commands.registerCommand('debug-variable-right-click-actions.tocsv', (request: any) => {
			// get value
			vscode.debug.activeDebugSession?.customRequest('stackTrace', { threadId: 1 }).then((response) => {
				const frameId = response.stackFrames[0].id;
				const code = dedent`
				def get_variable_info(var, var_name):
					import builtins as _VSCODE_BUILTINS
					import sys as _VSCODE_SYS
					import json as _VSCODE_JSON
					if "numpy" in _VSCODE_SYS.modules: import numpy as _VSCODE_NP
					if "pandas" in _VSCODE_SYS.modules: import pandas as _VSCODE_PD

					filename = var_name + ".csv"
											
					if "numpy" in _VSCODE_SYS.modules and isinstance(var, _VSCODE_NP.ndarray):
						_VSCODE_NP.savetxt(filename, var, delimiter=',')
					elif "pandas" in _VSCODE_SYS.modules and isinstance(var, _VSCODE_PD.DataFrame):
						var.to_csv(filename)
					else:
						with open(filename, 'w') as f:
							_VSCODE_JSON.dump(var, f)							
					
				get_variable_info(${request.variable.name}, "${request.variable.name}")

				#del _VSCODE_BUILTINS, _VSODE_SYS, _VSCODE_JSON
				#if "numpy" in _VSCODE_SYS.modules: del _VSCODE_NP
				#if "pandas" in _VSCODE_SYS.modules: del _VSCODE_PD
				del get_variable_info
			`;
				console.log("evaluate code: ", code);
				vscode.debug.activeDebugSession?.customRequest('evaluate', {
					expression: code,
					frameId: frameId,
					context: "repl",
					format: { rawString: true }
				}).then((response) => {
					console.log("response_tocsv: ", response);
					const content = 'exampleContent';
					const workspaceFolders = vscode.workspace.workspaceFolders;
					const filePath = workspaceFolders ? vscode.Uri.joinPath(workspaceFolders[0].uri, `${request.variable.name}.csv`) : null;
					
					if (filePath) {
						const openPath = vscode.Uri.file(filePath.toString());
						vscode.workspace.openTextDocument(filePath).then(doc => {
							vscode.window.showTextDocument(doc);
						});
					}
				});
			});

		})
	);


	context.subscriptions.push(
		vscode.commands.registerCommand('debug-variable-right-click-actions.topng', (request: any) => {
			// get value
			vscode.debug.activeDebugSession?.customRequest('stackTrace', { threadId: 1 }).then((response) => {
				const frameId = response.stackFrames[0].id;
				const code = dedent`
				def get_variable_info(var, var_name):
					import builtins as _VSCODE_BUILTINS
					import sys as _VSCODE_SYS
					import json as _VSCODE_JSON
					if "numpy" in _VSCODE_SYS.modules: import numpy as _VSCODE_NP
					if "pandas" in _VSCODE_SYS.modules: import pandas as _VSCODE_PD
					from PIL import Image as _VSCODE_IMAGE

					filename = var_name + ".png"
					
					try:
						im = _VSCODE_IMAGE.fromarray(var)
						if var.ndim == 2:
							im = im.convert("L")
						im.save(filename)
						print("success")
					except Exception as e:
						print("Error", e)
					
				get_variable_info(${request.variable.name}, "${request.variable.name}")

				#del _VSCODE_BUILTINS, _VSODE_SYS, _VSCODE_JSON
				#if "numpy" in _VSCODE_SYS.modules: del _VSCODE_NP
				#if "pandas" in _VSCODE_SYS.modules: del _VSCODE_PD
				del get_variable_info
			`;
				console.log("evaluate code: ", code);
				vscode.debug.activeDebugSession?.customRequest('evaluate', {
					expression: code,
					frameId: frameId,
					context: "repl",
					format: { rawString: true }
				}).then((response) => {
					console.log("response_topng: ", response);
					const workspaceFolders = vscode.workspace.workspaceFolders;
					const filePath = workspaceFolders ? vscode.Uri.joinPath(workspaceFolders[0].uri, `${request.variable.name}.png`) : null;
					
					if (filePath) {
						const openPath = vscode.Uri.file(filePath.toString());
						vscode.workspace.openTextDocument(filePath).then(doc => {
							vscode.window.showTextDocument(doc);
						});
					}
				});
			});

		})
	);



	context.subscriptions.push(
		vscode.commands.registerCommand('debug-variable-right-click-actions.start', () => {
			// Create and show a webview
			if (lastPanel) {
				lastPanel.reveal(vscode.ViewColumn.One);
			} else {
				lastPanel = getWebviewPanel(context);
			}

			// Send a message to our webview.
			// You can send any JSON serializable data.
			lastPanel.webview.postMessage({ command: 'refactor' });
		})


	);
}

// This method is called when your extension is deactivated
export function deactivate() { }


function getWebviewPanel(context: vscode.ExtensionContext): vscode.WebviewPanel {
	let panel: vscode.WebviewPanel | undefined = vscode.window.createWebviewPanel(
		'variable',
		'Cat Coding',
		vscode.ViewColumn.Two,
		{
			enableScripts: true
		}
	);
	// WebView 内で`./public/index.js`を読み込み可能にするためのUri
	const scriptUri = panel.webview.asWebviewUri(
		vscode.Uri.joinPath(context.extensionUri, "public", "index.js")
	);

	panel.webview.html = `<!DOCTYPE html>
  <html lang="en">
  <head>
	  <meta charset="UTF-8">
	  <meta name="viewport" content="width=device-width, initial-scale=1.0">
	  <title>Cat Coding</title>
  </head>
  <body>
	  <img src="https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif" width="300" />
	  <h1 id="lines-of-code-counter">0</h1>
  
	  <script src="${scriptUri}" />
  </body>
  </html>`;

	panel.onDidDispose(
		() => {
			panel = undefined;
		},
		undefined,
		context.subscriptions
	);

	return panel;
}