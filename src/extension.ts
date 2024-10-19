// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import dedent from 'dedent';
import Jimp from 'jimp';
import sharp from 'sharp';

import * as fs from 'fs';
import * as path from 'path';

import { VariableTrackerRegister } from './tracker';
import { VariableViewPanel } from './panel';
import { VariableTypeFactory } from './variable/variableTypeFactory';
import { ImageVariable } from './variable/imageVariable';
import { DebugSessionTracker } from './variable/debugSessionTracker';

// process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log("activated");

	// Only allow a single Cat Coder
	let lastPanel: vscode.WebviewPanel | undefined = undefined;

	// Register a variable tracker:
	console.log("context", context);
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
		vscode.commands.registerCommand('debug-variable-actions.action', (request: any) => {
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
		vscode.commands.registerCommand('debug-variable-actions.tocsv', (request: any) => {
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
		vscode.commands.registerCommand('debug-variable-actions.topng', (request: any) => {
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
		vscode.commands.registerCommand('debug-variable-actions.topanel', async (request: any) => {
			console.log("debug-variable-actions.topanel request", request);
			// get value
			const variables_response = await vscode.debug.activeDebugSession?.customRequest('variables', { variablesReference: request.variable.variablesReference });
			console.log("variables_response", variables_response);

			var startAddress = "";
			var endAddress = "";
			var width: number = 0;
			var height: number = 0;
			var capacity: number = 0;
			variables_response.variables.forEach((element: any) => {
				console.log("variable", element);
				console.log("name:", element.name, "value:", element.value);
				switch (element.name) {
					case "data":
						startAddress = ((str: string) => {
							let result = "";
							const hexChars = "0123456789ABCDEFabcdef";

							if (str.charAt(0) === '0' && str.charAt(1).toLowerCase() === 'x') {
								result = "0x";
								for (var i = 2; i < str.length; i++) {
									if (hexChars.includes(str.charAt(i))) {
										result += str.charAt(i);
									} else {
										break;
									}
								}
							} else {
								result = "0x00";
							}
							return result;
						})(element.value);
						break;
					case "capacity":
						capacity = parseInt(element.value);
						break;
					case "width":
						width = parseInt(element.value);
						break;
					case "height":
						height = parseInt(element.value);
						break;
				}
			});

			const channels = 1;
			const bytesForChannel = 1;
			let bytesForPx = 1;
			const isSigned = false;
			const isInt = true;
			const stride = width * bytesForPx * channels;
			const size = stride * height;

			const readMemory = await vscode.debug.activeDebugSession?.customRequest('readMemory', { memoryReference: startAddress, offset: 0, count: size });
			console.log("readMemory: ", readMemory);


			let bufferData = Buffer.from(readMemory.data, "base64");
			const off = bytesForPx * channels;


			// Determine the correct TypedArray based on data characteristics
			const TypedArray = bytesForPx === 1 ? Uint8Array :
				bytesForPx === 2 ? (isSigned ? Int16Array : Uint16Array) :
					bytesForPx === 4 ? (isInt ? (isSigned ? Int32Array : Uint32Array) : Float32Array) :
						Float64Array; // Assuming bytesForPx === 8 for double precision floats

			// Create a typed array from the buffer data
			// @ts-ignore: TS2554: Expected 0-1 arguments, but got 3.
			let imageArray = new TypedArray(bufferData.buffer, bufferData.byteOffset, bufferData.byteLength / bytesForPx);
			for (let i = 0; i < height; i++) {
				for (let j = 0; j < width; j++) {
					const offset = off * j;
					let b;
					if (isInt) {
						if (isSigned) {
							b = bufferData.readIntLE(offset, bytesForPx);
						}
						else {
							b = bufferData.readUIntLE(offset, bytesForPx);
						}
					}
					else {
						if (bytesForPx === 4) {
							b = bufferData.readFloatLE(offset);
						}
						else if (bytesForPx === 8) {
							b = bufferData.readDoubleLE(offset);
						}
						else {
							throw Error;
						}
					}
					imageArray[i * width + j] = b;
				}
			}
			console.log("imageArray:", imageArray);


			const workspaceFolders = vscode.workspace.workspaceFolders;
			const relativePath = `${request.variable.name}.png`;
			// const filePath = workspaceFolders ? vscode.Uri.joinPath(workspaceFolders[0].uri, relativePath) : null;
			const storageUri = context.storageUri ? context.storageUri : context.globalStorageUri;
			const filePath = vscode.Uri.joinPath(storageUri, relativePath);

			// Extract the directory path from filePath
			const dirPath = path.dirname(filePath.fsPath);

			// Check if the directory exists, if not, create it
			if (!fs.existsSync(dirPath)) {
				fs.mkdirSync(dirPath, { recursive: true });
			}


			if (filePath) {
				// Use Sharp to process the image data
				await sharp(imageArray, {
					raw: {
						width: width,
						height: height,
						channels: channels,
					},
					create: {
						width: width,
						height: height,
						channels: 3,
						background: { r: 0, g: 0, b: 0, alpha: 0 },
					}
				})
					.toFile(filePath.fsPath, (err, info) => {
						if (err) {
							console.error('Error processing image:', err);
						} else {
							console.log('Image processed and saved:', info);
						}
					});

				// Display
				// const openPath = vscode.Uri.file(filePath.toString()).toString().replace("/file:", "");
				// vscode.commands.executeCommand('vscode.open', filePath.fsPath);
				let a = filePath.toString();
				VariableViewPanel.render(context);
				const panel = VariableViewPanel.currentPanel;
				if (panel) {
					const weburi = panel.getWebViewUrlString(filePath);
					panel.postMessage({
						command: "image",
						// url: filePath.toString()
						url: weburi

					});
					panel.showPanel();
				}

			}


		})
	);



	context.subscriptions.push(
		vscode.commands.registerCommand('debug-variable-actions.start', () => {
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


	context.subscriptions.push(
		vscode.commands.registerCommand('debug-variable-actions.autocontinueframe', async () => {
			if (DebugSessionTracker.currentTracker) {
				// Get current frame
				const frameName = DebugSessionTracker.currentTracker.threads[0].frames[0].meta.name;
				const funcName = frameName.match(/.*[!](.*)?\(/mi)[1];
				DebugSessionTracker.autoContinueEnable = true;
				DebugSessionTracker.autoConintueFrameName = funcName;
				vscode.window.showInformationMessage(`Start auto continue frame: ${funcName}`);
				await DebugSessionTracker.currentTracker.stepOver();
			}
			else {
				vscode.window.showErrorMessage("No active debug session");
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('debug-variable-actions.autocontinueframe-stop', async () => {
			DebugSessionTracker.autoContinueEnable = false;
			DebugSessionTracker.autoConintueFrameName = "";
		})
	);




	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
		if (e.affectsConfiguration('debug-variable-actions.config.image-types')) {
			console.log("changed config: debug-variable-actions.config.image-types");
			VariableTypeFactory.loadSettings();
		}
		else if (e.affectsConfiguration('debug-variable-actions.config.image-sizebyte-limit')) {
			console.log("changed config: debug-variable-actions.config.image-sizebyte-limit");
			ImageVariable.sizeByteLimit = vscode.workspace.getConfiguration().get("debug-variable-actions.config.image-sizebyte-limit");
		}
	}));


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