// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import dedent from 'dedent';

import { VariableTrackerRegister } from './tracker/VariableTrackerRegister';
import *  as actions from './action/DebugAction';

// process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log("activated");

	// Register a variable tracker:
	console.log("context", context);
	context.subscriptions.push(VariableTrackerRegister.register(context));

	// Register commands:
	context.subscriptions.push(
		vscode.commands.registerCommand('debug-variable-actions.action', (request: any) => {
			new actions.DebugActionBasic().execute(request);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('debug-variable-actions.tocsv', (request: any) => {
			new actions.DebugActionToCSV().execute(request);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('debug-variable-actions.topng', (request: any) => {
			new actions.DebugActionToPNG().execute(request);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('debug-variable-actions.autocontinueframe', async () => {
			await new actions.DebugActionAutoContinueFrame().execute();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('debug-variable-actions.autocontinueframe-stop', async () => {
			await new actions.DebugActionAutoContinueFrameStop().execute();
		})
	);

	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
		new actions.DebugActionChangeConfiguration().execute(e);
	}));
}

// This method is called when your extension is deactivated
export function deactivate() { }

