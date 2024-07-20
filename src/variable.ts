import * as vscode from 'vscode';


type IdType = number;
type TrackerId = IdType;
type TrackerName = string;

export class DebugSessionTracker {
    // tracker
    private _trackerId: TrackerId | undefined;
    public sessionName: TrackerName;
    private _session: vscode.DebugSession;
    public readonly threads: DebugThread[] = [];

    // manage trackers
    private static _trackerIdCounter: number = 0;
    public static trackers: DebugSessionTracker[] = [];
    public static currentTracker: DebugSessionTracker | undefined = undefined;

    // constructor
    constructor(
        _session: vscode.DebugSession,
        _sessionName: string = "My Debug Session",
        _threads: DebugThread[] = [],
    ) {
        this._session = _session;
        this.sessionName = _sessionName;
        this.threads = _threads;
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

    // factory
    public static newSessionTracker(_session: vscode.DebugSession): DebugSessionTracker {
        console.log("[DebugSessionTracker]", "Track new session", _session);

        // Create a new tracker
        let new_tracker = new DebugSessionTracker(_session);
        new_tracker = new DebugSessionTracker(_session);
        new_tracker.setNewTrackerId();

        // Add new tracker to the list of trackers
        DebugSessionTracker.trackers.push(new_tracker);
        DebugSessionTracker.currentTracker = new_tracker;
        console.log("[DebugSessionTracker]", "Created new tracker", new_tracker);

        return new_tracker;
    }
    public addThread(_threadId: IdType, _frames: DebugFrame[] = []): DebugThread {
        let thread = new DebugThread(this, _threadId, _frames);
        this.threads.push(thread);
        return thread;
    }

    // internals
    private setNewTrackerId() {
        DebugSessionTracker._trackerIdCounter++;
        this._trackerId = DebugSessionTracker._trackerIdCounter;
    }

    // util
    public getAllVariables(): DebugVariable[] {
        let allVariables: DebugVariable[] = [];
        for (let thread of this.threads) {
            for (let frame of thread.frames) {
                allVariables.push(...frame.variables);
            }
        }
        return allVariables;
    }
}

class DebugThread {
    public readonly tracker: DebugSessionTracker;
    public readonly id: IdType;
    private _frames: DebugFrame[];

    public get frames(): DebugFrame[] {
        return this._frames;
    }

    constructor(
        _tracker: DebugSessionTracker,
        _threadId: IdType,
        _frames: DebugFrame[] = [],
    ) {
        this.tracker = _tracker;
        this.id = _threadId;
        this._frames = _frames;
    }

    addFrame(_frameId: IdType, _variables: DebugVariable[] = []): DebugFrame {
        let frame = new DebugFrame(this, _frameId, _variables);
        this.frames.push(frame);
        return frame;
    }

    async queryFrame(): Promise<DebugFrame[] | undefined> {
        const stackTrace = await this.tracker.session?.customRequest('stackTrace', { threadId: this.id });
        if (stackTrace) {
            this._frames = [];
            stackTrace.stackFrames.map((stackFrame: any) => {
                this.addFrame(stackFrame.id);
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
            variables.variables.forEach((variable: any) => { frame.addVariable(variable); });
        }
        return frame.variables;
    }

}

class DebugFrame {
    public readonly thread: DebugThread;
    public readonly id: IdType;
    public readonly variables: DebugVariable[];

    constructor(
        _thread: DebugThread,
        _frameId: IdType,
        _variables: DebugVariable[] = [],
    ) {
        this.thread = _thread;
        this.id = _frameId;
        this.variables = _variables;
    }

    addVariable(meta: any) {
        let variable = new DebugVariable(this, meta);
        this.variables.push(variable);
        return variable;
    }

}

class DebugVariable {
    public meta: any;
    public readonly frame: DebugFrame;
    public name: string | undefined;
    public expression: string | undefined;
    public type: DebugVariableType | undefined;
    public startAddress: string | undefined;
    public endAddress: string | undefined;
    public sizeByte: string | undefined;


    // value's type is the variable type or an array of DebugVariable or dictionary of DebugVariable
    public value: any | DebugVariableArrayType | DebugVariableStructType | undefined;

    constructor(
        _frame: DebugFrame,
        _meta?: any,
    ) {
        this.frame = _frame;
        this.meta = _meta;

        // Parse meta
        if (this.meta) {
            this.parseMeta();
        }
    }

    parseMeta() {
        this.name = this.meta.name;
        this.expression = this.meta.evaluateName;
        this.type = this.meta.type;

        this.startAddress = this.meta.startAddress;
        this.endAddress = this.meta.endAddress;
        this.sizeByte = this.meta.sizeByte;

        this.value = this.meta.value;
    }
}

class ImageVariable extends DebugVariable {
    public mem_width: number | undefined;
    public mem_height: number | undefined;
    public image_width: number | undefined;
    public image_height: number | undefined;
    public stride: number | undefined;
    public channels: number | undefined;
    public data: number | undefined;
    public buffer: Buffer | ArrayBufferTypes | undefined;
    public format: string | undefined;

    public byte_for_px: number | undefined;

    toFile() {

    }
}


class DebugVariableType {
    // debug variable type knows its name and expression
    public readonly name: string | undefined;
    public readonly expression: string | undefined;

    constructor(
        _name: string,
        _expression?: string
    ) {
        this.name = _name;
        this.expression = _expression;
    }
}
// Array type
type DebugVariableArrayType = DebugVariableType[];

// Struct type
type DebugVariableStructType = { [key: string]: DebugVariableType };

class ImageVariableType extends DebugVariableType {
    // ImageVariableType knows its member names or fixed values
    public mem_width: number | undefined;
    public mem_height: number | undefined;
    public image_width: number | undefined;
    public image_height: number | undefined;
    public stride: number | undefined;
    public channels: number | undefined;
    public data: number | undefined;
    public format: string | undefined;

    constructor(
        _name: string,
        _expression?: string,
        _mem_width?: number,
        _mem_height?: number,
        _image_width?: number,
        _image_height?: number,
        _stride?: number,
        _channels?: number,
        _data?: number,
        _format?: string
    ) {
        super(_name, _expression);
        this.mem_width = _mem_width;
        this.mem_height = _mem_height;
        this.image_width = _image_width;
        this.image_height = _image_height;
        this.stride = _stride;
        this.channels = _channels;
        this.data = _data;
        this.format = _format;
    }

}
