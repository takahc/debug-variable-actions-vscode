import * as vscode from 'vscode';

class AutoBreak {
    constructor() {
        console.log('AutoBreak', this);
    }

    public async run() {
        console.log('AutoBreak.run', this);
    }

    _getBreakpointCandidates() {
        console.log('AutoBreak._getBreakpointCandidates', this);

    }

}