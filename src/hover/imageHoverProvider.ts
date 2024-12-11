import * as vscode from 'vscode';
import { ImageVariable } from '../debugger/variable/imageVariable';
import { DebugSessionTracker } from '../debugger/debugSessionTracker';

export class ImageHoverProvider implements vscode.HoverProvider {
  public async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    console.log('provideHover called');
    const range = document.getWordRangeAtPosition(position);
    const word = document.getText(range);
    console.log(`Word at position: ${word}`);

    // this.updateDecorations(vscode.window.activeTextEditor!);

    const sessionTracker = DebugSessionTracker.currentTracker;
    if (!sessionTracker) {
      console.log('No active debug session');
      return null;
    }
    const imageVariables: ImageVariable[] = sessionTracker.gatherImageVariables();
    const sampleImageVariable = imageVariables[0];
    const imageUrl = await this.getImageUrl(sampleImageVariable);
    console.log("imageUrl", imageUrl);

    // const markdownString = new vscode.MarkdownString(word + "\n" + `![image](https://upload.wikimedia.org/wikipedia/commons/c/ce/Example_image.png)`);
    const markdownString = new vscode.MarkdownString(word + "\n" + `![image](${imageUrl})`);
    markdownString.isTrusted = true;
    return new vscode.Hover(markdownString);


    // const existingHover = await vscode.commands.executeCommand<vscode.Hover | undefined>(
    //   'vscode.executeHoverProvider',
    //   document.uri,
    //   position
    // );

    // const session = vscode.debug.activeDebugSession;
    // if (!session) {
    //   console.log('No active debug session');
    //   return null;
    // }

    // const variables = await session.customRequest('variables', { variablesReference: 0 });
    // console.log('Variables fetched from debug session:', variables);
    // const imageVariable = this.findImageVariable(variables, word);

    // if (imageVariable) {
    //   console.log('Image variable found:', imageVariable);
    //   const imageUrl = await this.getImageUrl(imageVariable);
    //   if (imageUrl) {
    //     console.log('Image URL:', imageUrl);
    //     const markdownString = new vscode.MarkdownString(`![image](${imageUrl})`);
    //     markdownString.isTrusted = true;
    //     return new vscode.Hover(markdownString);
    //   }
    // } else {
    //   console.log('No image variable found for word:', word);
    // }

    // return null;
  }

  updateDecorations(editor: vscode.TextEditor) {
    console.log("updateDecorations");
    const text = editor.document.getText();
    const regex = /\bTODO\b/g;
    // const decorationType = vscode.window.createTextEditorDecorationType({
    //   color: "#ee0000",
    //   backgroundColor: "#ffffff",
    // });
    const decorationType = vscode.window.createTextEditorDecorationType({
      color: "#ee0000",
      backgroundColor: "#ffffff",
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      before: {
        // contentIconPath: context.asAbsolutePath("https://upload.wikimedia.org/wikipedia/commons/c/ce/Example_image.png"),
        contentIconPath: vscode.Uri.parse("https://upload.wikimedia.org/wikipedia/commons/c/ce/Example_image.png")
      }
    });
    const options: vscode.DecorationOptions[] = Array.from(
      text.matchAll(regex),
      match => ({
        range: new vscode.Range(
          editor.document.positionAt(match.index!),
          editor.document.positionAt(match.index! + match[0].length))
      }));
    editor.setDecorations(decorationType, options);
  }

  private findImageVariable(variables: any, name: string): any {
    console.log('Searching for image variable:', name);
    for (const variable of variables.variables) {
      if (variable.name === name && variable.type === 'Image') {
        console.log('Image variable matched:', variable);
        return variable;
      }
      if (variable.variablesReference) {
        const childVariable = this.findImageVariable(variable, name);
        if (childVariable) {
          return childVariable;
        }
      }
    }
    return null;
  }

  private async getImageUrl(imageVariable: ImageVariable): Promise<string | null> {
    console.log('Getting image URL for variable:', imageVariable);
    // await imageVariable.toFile();
    const imagePath = imageVariable.imagePath ? vscode.Uri.file(imageVariable.imagePath).toString() : null;
    console.log('Image path:', imagePath);
    return imagePath;
  }
}
