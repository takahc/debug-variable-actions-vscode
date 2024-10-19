import * as vscode from 'vscode';
import dedent from 'dedent';

import { DebugSessionTracker } from '../debugger/DebugSessionTracker';
import { ImageVariable } from '../debugger/variable/ImageVariable';
import { VariableTypeFactory } from '../debugger/variable/VariableTypeFactory';

interface IDebugAction {
    name: string;
    execute(request: any | undefined): void;
}

export class DebugActionBasic implements IDebugAction {
    public name: string;

    constructor() {
        this.name = "action";
    }

    public execute(request: any | undefined = undefined): void {
        console.log("Debug Action executed", this.name);
        if (request) {
            console.log(request);
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
        }
    }
}

export class DebugActionToCSV implements IDebugAction {
    public name: string;

    constructor() {
        this.name = "tocsv";
    }

    public execute(request: any | undefined = undefined): void {
        console.log("Debug Action executed", this.name);
        if (request) {
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
        }
    }
}

export class DebugActionToPNG implements IDebugAction {
    public name: string;

    constructor() {
        this.name = "topng";
    }

    public execute(request: any | undefined = undefined): void {
        console.log("Debug Action executed", this.name);
        if (request) {
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
        }
    }
}

export class DebugActionAutoContinueFrame implements IDebugAction {
    public name: string;

    constructor() {
        this.name = "autocontinueframe";
    }

    public async execute(request: any | undefined = undefined): Promise<void> {
        console.log("Debug Action executed", this.name);
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
    }
}

export class DebugActionAutoContinueFrameStop implements IDebugAction {
    public name: string;

    constructor() {
        this.name = "autocontinueframe-stop";
    }

    public async execute(request: any | undefined = undefined): Promise<void> {
        console.log("Debug Action executed", this.name);
        DebugSessionTracker.autoContinueEnable = false;
        DebugSessionTracker.autoConintueFrameName = "";
    }
}

export class DebugActionChangeConfiguration implements IDebugAction {
    public name: string;

    constructor() {
        this.name = "change-configuration";
    }

    public async execute(e: any | undefined = undefined): Promise<void> {
        console.log("Debug Action executed", this.name);
        if (e.affectsConfiguration('debug-variable-actions.config.image-types')) {
            console.log("changed config: debug-variable-actions.config.image-types");
            VariableTypeFactory.loadSettings();
        }
        else if (e.affectsConfiguration('debug-variable-actions.config.image-sizebyte-limit')) {
            console.log("changed config: debug-variable-actions.config.image-sizebyte-limit");
            ImageVariable.sizeByteLimit = vscode.workspace.getConfiguration().get("debug-variable-actions.config.image-sizebyte-limit");
        }
    }
}
