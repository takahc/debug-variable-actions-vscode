import * as vscode from 'vscode';
import * as fs from 'fs';
import { ImageVariable, ImageVariableType } from './imageVariable';
import { DebugVariable, DebugVariableType } from './debugVariable';
import { VariableTypeFactory } from './variableTypeFactory';


type IdType = number;
type TrackerId = IdType;
type TrackerName = string;

export class DebugSessionTracker {
    // tracker
    private _trackerId: TrackerId | undefined;
    public sessionName: TrackerName;
    private _session: vscode.DebugSession;
    public readonly context: vscode.ExtensionContext;;
    public readonly threads: DebugThread[] = [];
    public readonly debugStartDate: string;
    private _saveDirUri: vscode.Uri;

    public static breakCount: number = 0; // FIXME: manage brake count not by a static.

    // manage trackers
    private static _trackerIdCounter: number = 0;
    public static trackers: DebugSessionTracker[] = [];
    public static currentTracker: DebugSessionTracker | undefined = undefined;

    // constructor
    constructor(
        context: vscode.ExtensionContext,
        _session: vscode.DebugSession,
        _sessionName: string = "My Debug Session",
        _threads: DebugThread[] = [],
    ) {
        this.context = context;
        this._session = _session;
        this.sessionName = _sessionName;
        this.threads = _threads;

        // Get the current date and time
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1; // getMonth() is zero-based
        const day = now.getDate();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();
        const milliseconds = now.getMilliseconds();

        const monthPadded = month.toString().padStart(2, '0');
        const dayPadded = day.toString().padStart(2, '0');
        const hoursPadded = hours.toString().padStart(2, '0');
        const minutesPadded = minutes.toString().padStart(2, '0');
        const secondsPadded = seconds.toString().padStart(2, '0');
        // Ensure milliseconds are three digits
        const millisecondsPadded = milliseconds.toString().padStart(3, '0');

        // Concatenate the parts with the desired format
        this.debugStartDate = `${year}-${monthPadded}-${dayPadded}_${hoursPadded}-${minutesPadded}-${secondsPadded}-${millisecondsPadded}`;

        // Set the save directory uri
        const session_dir_name = `Session_${this.session.id}`;
        if (context.storageUri !== undefined) {
            this._saveDirUri = vscode.Uri.joinPath(context.storageUri, session_dir_name);
        } else {
            this._saveDirUri = vscode.Uri.joinPath(context.globalStorageUri, `Session${_session.id}`);
        }
        // If not exist context.globalStorageUri directory, create directory
        ((dirpath: string) => {
            if (!fs.existsSync(dirpath)) {
                fs.mkdirSync(dirpath, { recursive: true });
            }

        })(this._saveDirUri.fsPath);
    };

    // getter
    public get session(): vscode.DebugSession {
        return this._session;
    }
    public get trackerId(): TrackerId | undefined {
        return this._trackerId;
    }
    public static getTrackerById(_trackerQuery: TrackerId): DebugSessionTracker | undefined {
        if (!DebugSessionTracker.trackers) {
            return undefined;
        } else {
            return DebugSessionTracker.trackers.find(tracker => tracker.trackerId === _trackerQuery);
        }
    }
    get saveDirUri(): vscode.Uri {
        return this._saveDirUri;
    }

    // factory
    public static newSessionTracker(context: vscode.ExtensionContext, _session: vscode.DebugSession): DebugSessionTracker {
        console.log("[DebugSessionTracker]", "Track new session", _session);

        // Create a new tracker
        let new_tracker = new DebugSessionTracker(context, _session);
        new_tracker.setNewTrackerId();

        // Add new tracker to the list of trackers
        DebugSessionTracker.trackers.push(new_tracker);
        DebugSessionTracker.currentTracker = new_tracker;
        console.log("[DebugSessionTracker]", "Created new tracker", new_tracker);

        return new_tracker;
    }
    public addThread(_threadId: IdType, _frames: DebugFrame[] = [], meta?: any): DebugThread {
        let thread = new DebugThread(this, _threadId, _frames, meta);
        this.threads.push(thread);
        return thread;
    }

    // internals
    private setNewTrackerId() {
        DebugSessionTracker._trackerIdCounter++;
        this._trackerId = DebugSessionTracker._trackerIdCounter;
    }

    // util
    public gatherAllVariables(): DebugVariable[] {
        let allVariables: DebugVariable[] = [];
        for (let thread of this.threads) {
            for (let frame of thread.frames) {
                // recursive gather
                let gather = (variable: DebugVariable) => {
                    allVariables.push(variable);
                    if (variable.value instanceof Array) {
                        variable.value.forEach((child: DebugVariable) => {
                            gather(child);
                        });
                    }
                };
                frame.variables.forEach((variable: DebugVariable) => {
                    gather(variable);
                });

                // gather for only first frame for debug
                // break; //FIXME: remove this line
            }
            // gather for only first thread for debug
            // break; //FIXME: remove this line
        }
        return allVariables;
    }

    gatherImageVariables() {
        const imageVariables = this.gatherAllVariables().filter(
            variable => variable instanceof ImageVariable
        );
        return imageVariables;
    }

    getSerializable() {
        return {
            trackerId: this.trackerId,
            session: this.sessionName,
            threads: this.threads.map(thread => thread.getSerializable())
        };
    }
}

export class DebugThread {
    public readonly tracker: DebugSessionTracker;
    public readonly id: IdType;
    private _frames: DebugFrame[];

    public meta: any;

    public get frames(): DebugFrame[] {
        return this._frames;
    }

    constructor(
        _tracker: DebugSessionTracker,
        _threadId: IdType,
        _frames: DebugFrame[] = [],
        meta?: any
    ) {
        this.tracker = _tracker;
        this.id = _threadId;
        this._frames = _frames;

        this.meta = meta;
    }

    addFrame(_frameId: IdType, _variables: DebugVariable[] = [], meta?: any): DebugFrame {
        let frame = new DebugFrame(this, _frameId, _variables, meta);
        this.frames.push(frame);
        return frame;
    }

    async queryFrame(): Promise<DebugFrame[] | undefined> {
        const stackTrace = await this.tracker.session?.customRequest('stackTrace',
            { threadId: this.id, startFrame: 0, levels: 1000 }
        );
        console.log(stackTrace);
        if (stackTrace) {
            this._frames = [];
            stackTrace.stackFrames.map((stackFrame: any) => {
                this.addFrame(stackFrame.id, [], stackFrame);
            });
            return this._frames;
        }
        else {
            return undefined;
        }
    }

    async fetchLocalVariablesInFirstFrame() {
        if (this.frames.length === 0) {
            await this.queryFrame();
        }
        if (this.frames.length === 0) {
            return [];
        }
        const frame = this.frames[0];
        const scopes = await this.tracker.session?.customRequest('scopes', { frameId: frame.id });
        console.log("scopes", scopes);
        if (scopes) {
            const local_scope = scopes.scopes.find((scope: any) => scope.name === "Locals");
            console.log("local_scope", local_scope);
            const variables = await this.tracker.session?.customRequest('variables', { variablesReference: local_scope.variablesReference });
            console.log("variables", variables);
            variables.variables.forEach((variable: any) => {
                if (VariableTypeFactory.ImageTypeNames.includes(variable.type)) {
                    let imageType = VariableTypeFactory.get(variable.type) || undefined;
                    frame.addVariable(variable, imageType);
                }
                else {
                    // comment out below if you don't want to fetch non-image variables
                    frame.addVariable(variable);
                }
            });
        }
        for (let variable of frame.variables) {
            console.log("start drillDown", variable);
            await variable.drillDown({ depth: -1, type_names: VariableTypeFactory.ImageTypeNames });
        }
        return frame.variables;
    }

    getSerializable() {
        return {
            threadId: this.id,
            meta: this.meta,
            frames: this.frames.map(frame => frame.getSerializable())
        };
    }
}

export class DebugFrame {
    public readonly thread: DebugThread;
    public readonly id: IdType;
    public readonly variables: DebugVariable[];

    public meta: any;

    constructor(
        _thread: DebugThread,
        _frameId: IdType,
        _variables: DebugVariable[] = [],
        meta?: any
    ) {
        this.thread = _thread;
        this.id = _frameId;
        this.variables = _variables;
        this.meta = meta;
    }

    addVariable(meta: any, type?: DebugVariableType): DebugVariable {
        let variable;
        if (type instanceof ImageVariableType) {
            variable = new ImageVariable(this, meta, type);
        }
        else {
            variable = new DebugVariable(this, meta);
        }
        this.variables.push(variable);
        return variable;
    }

    getSerializable() {
        return {
            frameId: this.id,
            meta: this.meta,
            variables: this.variables.map(variable => variable.getSerializable())
        };
    }

}


