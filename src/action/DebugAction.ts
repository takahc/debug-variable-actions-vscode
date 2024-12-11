import * as vscode from 'vscode';
import dedent from 'dedent';
import { DebugSessionTracker } from '../debugger/debugSessionTracker';
import { ImageVariable } from '../debugger/variable/imageVariable';
import { VariableTypeFactory } from '../debugger/variable/variableTypeFactory';

interface IDebugAction {
    name: string;
    execute(request: any | undefined): void;
}

class CodeExecutionActionBase implements IDebugAction {
    public name: string;

    constructor(name: string) {
        this.name = name;
    }

    public execute(request: any | undefined = undefined): void {
        console.log(`Debug Action executed: ${this.name}`);
        if (request) {
            this.evaluateExpression(request);
        }
    }

    protected evaluateExpression(request: any): void {
        vscode.debug.activeDebugSession?.customRequest('stackTrace', { threadId: 1 }).then(response => {
            const frameId = response.stackFrames[0].id;
            const code = this.getEvaluationCode(request);
            console.log("evaluate code:", code);
            vscode.debug.activeDebugSession?.customRequest('evaluate', {
                expression: code,
                frameId,
                context: "repl",
                format: { rawString: true }
            });
        });
    }

    protected getEvaluationCode(request: any): string {
        return dedent`
            import json
            print(
                (lambda : json.dumps((${request.variable.name}).tolist()))()
            )
        `;
    }
}

export class DebugActionBasic extends CodeExecutionActionBase {
    constructor() {
        super("action");
    }
}

export class DebugActionToCSV extends CodeExecutionActionBase {
    constructor() {
        super("tocsv");
    }

    protected getEvaluationCode(request: any): string {
        return dedent`
            def save_to_csv(var, var_name):
                import sys as _sys, json as _json
                filename = var_name + ".csv"
                if "numpy" in _sys.modules and isinstance(var, _sys.modules["numpy"].ndarray):
                    _sys.modules["numpy"].savetxt(filename, var, delimiter=',')
                elif "pandas" in _sys.modules and isinstance(var, _sys.modules["pandas"].DataFrame):
                    var.to_csv(filename)
                else:
                    with open(filename, 'w') as f:
                        _json.dump(var, f)
                        
            save_to_csv(${request.variable.name}, "${request.variable.name}")
        `;
    }

    public execute(request: any | undefined = undefined): void {
        super.execute(request);
        vscode.workspace.workspaceFolders?.[0].uri && this.showCSVFile(request.variable.name);
    }

    private showCSVFile(variableName: string): void {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri;
        const filePath = vscode.Uri.joinPath(workspaceFolder!, `${variableName}.csv`);
        vscode.workspace.openTextDocument(filePath).then(doc => vscode.window.showTextDocument(doc));
    }
}

export class DebugActionToPNG extends CodeExecutionActionBase {
    constructor() {
        super("topng");
    }

    protected getEvaluationCode(request: any): string {
        return dedent`
            def save_to_png(var, var_name):
                from PIL import Image
                filename = var_name + ".png"
                try:
                    im = Image.fromarray(var)
                    if var.ndim == 2:
                        im = im.convert("L")
                    im.save(filename)
                    print("success")
                except Exception as e:
                    print("Error:", e)
                    
            save_to_png(${request.variable.name}, "${request.variable.name}")
        `;
    }

    public execute(request: any | undefined = undefined): void {
        super.execute(request);
        vscode.workspace.workspaceFolders?.[0].uri && this.showPNGFile(request.variable.name);
    }

    private showPNGFile(variableName: string): void {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri;
        const filePath = vscode.Uri.joinPath(workspaceFolder!, `${variableName}.png`);
        vscode.workspace.openTextDocument(filePath).then(doc => vscode.window.showTextDocument(doc));
    }
}

export class DebugActionAutoContinueFrame implements IDebugAction {
    public name: string;

    constructor() {
        this.name = "autocontinueframe";
    }

    public async execute(request: any | undefined = undefined): Promise<void> {
        console.log(`Debug Action executed: ${this.name}`);
        const tracker = DebugSessionTracker.currentTracker;

        if (tracker) {
            const funcName = this.extractFunctionName(tracker.threads[0].frames[0].meta.name);
            DebugSessionTracker.autoContinueEnable = true;
            DebugSessionTracker.autoConintueFrameName = funcName;
            vscode.window.showInformationMessage(`Start auto-continue for frame: ${funcName}`);
            await tracker.stepOver();
        } else {
            vscode.window.showErrorMessage("No active debug session");
        }
    }

    private extractFunctionName(frameName: string): string {
        return frameName.match(/.*[!](.*)?\(/mi)?.[1] ?? '';
    }
}

export class DebugActionAutoContinueFrameStop implements IDebugAction {
    public name: string;

    constructor() {
        this.name = "autocontinueframe-stop";
    }

    public async execute(): Promise<void> {
        console.log(`Debug Action executed: ${this.name}`);
        DebugSessionTracker.autoContinueEnable = false;
        DebugSessionTracker.autoConintueFrameName = "";
        vscode.window.showInformationMessage("Auto-continue frame stopped.");
    }
}

export class DebugActionChangeConfiguration implements IDebugAction {
    public name: string;

    constructor() {
        this.name = "change-configuration";
    }

    public async execute(e: vscode.ConfigurationChangeEvent): Promise<void> {
        console.log(`Debug Action executed: ${this.name}`);
        if (e.affectsConfiguration('debug-variable-actions.config.image-types')) {
            VariableTypeFactory.loadSettings();
            console.log("Configuration changed: image types");
        }
        if (e.affectsConfiguration('debug-variable-actions.config.image-sizebyte-limit')) {
            ImageVariable.sizeByteLimit = vscode.workspace.getConfiguration().get<number>("debug-variable-actions.config.image-sizebyte-limit");
            console.log("Configuration changed: image size byte limit");
        }
    }
}
