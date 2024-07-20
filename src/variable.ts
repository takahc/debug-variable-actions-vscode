import { constants } from 'buffer';
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

    public breakCount: number = 0;

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
            }
        }
        return allVariables;
    }

    gatherImageVariables() {
        const imageVariables = this.gatherAllVariables().filter(variable => variable instanceof ImageVariable);
        return imageVariables;
    }
}

class DebugThread {
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
        const stackTrace = await this.tracker.session?.customRequest('stackTrace', { threadId: this.id });
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
            variables.variables.forEach((variable: any) => { frame.addVariable(variable); });
        }
        for (let variable of frame.variables) {
            console.log("start drillDown", variable);
            await variable.drillDown({ depth: -1, type_names: ["Image"] });
        }
        return frame.variables;
    }

}

class DebugFrame {
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

    // not primitive type
    public isVisualizable: boolean | undefined = undefined;
    public isArray: boolean | undefined = undefined;
    public isStruct: boolean | undefined = undefined;
    public parent: DebugVariable | undefined;

    constructor(
        _frame: DebugFrame,
        _meta?: any,
        type?: DebugVariableType
    ) {
        this.frame = _frame;
        this.meta = _meta;

        // Parse meta
        if (this.meta) {
            this.parseMeta();
        }

        // address
        this.startAddress = this.meta.memoryReference;

        // type
        if (type) {
            this.type = type;
            if (this.type.sizeByte) {
                this.endAddress = "0X" + (parseInt(this.meta.endAddress) + this.type.sizeByte).toString(16).toUpperCase();
            }
        }

    }

    async parse() {
        // Parse type
        if (this.type) {
            this.parseType();
        }
    }

    parseMeta() {
        this.name = this.meta.name;
        this.expression = this.meta.evaluateName;
        this.type = this.meta.type;
        this.value = this.meta.value;
    }

    async judgeHasChild() {
        if (!this.meta) { return false; }
        const variables = await this.frame.thread.tracker.session?.customRequest('variables', { variablesReference: this.meta.variablesReference });
        if (variables.variables.length > 0) { return true; }
        return false;
    }

    parseType() {

    }

    async drillDown(until = { depth: -1, type_names: [] as string[] }, final = false) {
        if (!this.meta) { return; }
        if (until.depth === 0) { return; } // break if the depth reaches 0

        // fetch child debug variables
        const variables = await this.frame.thread.tracker.session?.customRequest('variables', { variablesReference: this.meta.variablesReference });
        if (!variables) { return; }

        console.log("drillDown", variables);
        if (variables.variables.length > 0) {
            this.isArray = true;
            variables.variables.forEach((meta: any) => {
                // add child variable
                let variable = this.addChildVariable(meta);

                // count down until.depth if it is not -1 nor negative
                if (until.depth > 0) { until.depth--; }

                // if this.meta.type is in until.tyes, next is the last drill down
                let next_final = false;
                if (until.type_names.length > 0 && until.type_names.includes(this.meta.type as string)) {
                    next_final = true; // FIXME: until.type is not working
                }

                if (!final) {
                    // recursive drill down
                    variable.drillDown(until, next_final);
                }
            });
        } else {
            // the item is not an array, so value is set to meta.value
            this.isArray = false;
            this.value = this.meta.value; // no need to set here, because it is already set in the constructor
        }
    }

    addChildVariable(meta: any, parent: DebugVariable = this, type?: DebugVariableType) {
        let variable;
        if (type instanceof ImageVariableType) {
            variable = new ImageVariable(this.frame, meta, type);
        }
        else {
            variable = new DebugVariable(this.frame, meta);
        }
        variable.parent = parent;
        if (!Array.isArray(this.value)) {
            // if meta.value is set, replace it to an empty array
            this.value = [];
        }
        this.value.push(variable);
        return variable;
    }

    setParent(_parent: DebugVariable) {
        this.parent = _parent;
    }


    autoTypeSelector(type_name: string) {
        const PrimitiveTypes: { [key: string]: { sizeByte: number, isSigned: boolean } } = {
            "char": { sizeByte: 1, isSigned: true },
            "unsigned char": { sizeByte: 1, isSigned: false },
            "short": { sizeByte: 2, isSigned: true },
            "unsigned short": { sizeByte: 2, isSigned: false },
            "int": { sizeByte: 4, isSigned: true },
            "unsigned int": { sizeByte: 4, isSigned: false },
            "long": { sizeByte: 4, isSigned: true },
            "unsigned long": { sizeByte: 4, isSigned: false },
            "long long": { sizeByte: 8, isSigned: true },
            "unsigned long long": { sizeByte: 8, isSigned: false },
            "float": { sizeByte: 4, isSigned: true },
            "double": { sizeByte: 8, isSigned: true },
            "long double": { sizeByte: 16, isSigned: true }
        };
        if (PrimitiveTypes[type_name]) {
            let { sizeByte, isSigned } = PrimitiveTypes[type_name];
            let type = new DebugVariableType(type_name, type_name, sizeByte, true, isSigned);
            return type;
        }
        else {
            return undefined;
        }
    }

    gatherMeta() {
        let gathered = {
            session: { ...this.frame.thread.tracker.session },
            thread: { ...this.frame.thread.meta },
            frame: { ...this.frame.meta },
            variable: { ...this.meta },
        };

        return gathered;
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

    toFile(parent_dir: string, filename?: string) {
        let buffer = this.buffer;
        if (buffer instanceof Buffer) {
            let filename = this.name + ".png";
        }
    }
}

class TypeFactory {
    public static createType(_name: string, _expression?: string): DebugVariableType {
        return new DebugVariableType(_name, _expression);
    }

}


class DebugVariableTypeFactory {

    public static get MyImageType() {
        return new ImageVariableType("Image", "Image", , true, true, 0, 0, 0, 0, 0, 0, 0, "RGB);
    }

}


class EvalExpression<ReturnType> {
    public expression: string = "";
    constructor(expression: string) {
        this.expression = expression;
    }

    static eval<ReturnType>(expression: string, context?: Record<string, any> | undefined): ReturnType {
        let func;
        if (context === undefined) {
            const func = new Function(`return ${expression};`);
            return func()
        }
        else {
            // Extract keys and values from the context object
            const keys = Object.keys(context);
            const values = keys.map(key => context[key]);

            // Create a new function that returns the result of the expression
            // The function's arguments are the keys from the context object
            const func = new Function(...keys, `return ${expression};`);

            // Execute the function with the context values
            return func(...values);
        }
    }

    eval(context?: Record<string, any>): ReturnType {
        return EvalExpression.eval(this.expression, context);
    }

    setExpression(expression: string) {
        this.expression = expression;
    }
}

interface IbinaryMeta {
    [key: string]: any;
    sizeByte: number,
    littleEndian: boolean,
    signed: boolean,
}
interface IbinaryMetaExpressions {
    [key: string]: EvalExpression<any>;
    sizeByte: EvalExpression<number>,
    littleEndian: EvalExpression<boolean>,
    signed: EvalExpression<boolean>,
}
interface IbinaryMetaStrings {
    sizeByte: string,
    littleEndian: string,
    signed: string,
}

class DebugVariableType {
    // meta
    public readonly name: string | undefined;
    public readonly expression: string | undefined;
    public isVisualizable: boolean = false;

    // binary info
    public binaryMeta: IbinaryMetaExpressions = {
        sizeByte: new EvalExpression<number>(""),
        littleEndian: new EvalExpression<boolean>("true"),
        signed: new EvalExpression<boolean>("true"),
    };

    constructor(
        _name: string,
        _expression?: string,
        binaryMetaString?: IbinaryMetaStrings,
    ) {
        this.name = _name;
        this.expression = _expression;
        if (binaryMetaString) {
            Object.entries(binaryMetaString).forEach(([key, value]) => {
                this.binaryMeta[key].setExpression(value);
            });
        }
    }

    eval(members: any) {
        let binaryMetaValues: IbinaryMeta = {
            sizeByte: 0,
            littleEndian: false,
            signed: false,
        };
        // eval as a type by given members
        Object.entries(this.binaryMeta).forEach(([key, evalExpression]) => {
            // Assuming EvalExpression has an evaluate method that takes members as context
            binaryMetaValues[key] = evalExpression.eval(members);
        });
        return {
            name: this.name,
            expression: this.expression,
            binaryMeta: binaryMetaValues
        }
    }
}



// Array type
type DebugVariableArrayType = DebugVariableType[];

// Struct type
type DebugVariableStructType = { [key: string]: DebugVariableType };


interface IImageMeta {
    mem_width: EvalExpression<number>,
    mem_height: EvalExpression<number>,
    image_width: EvalExpression<number>,
    image_height: EvalExpression<number>,
    stride: EvalExpression<number>,
    channels: EvalExpression<number>,
    data: EvalExpression<number>,
    format: EvalExpression<number>,
};

interface IImageMetaString {
    mem_width: string,
    mem_height: string,
    image_width: string,
    image_height: string,
    stride: string,
    channels: string,
    data: string,
    format: string,
};


class ImageVariableType extends DebugVariableType {
    // ImageVariableType knows its member names or fixed values


    public imageMeta: IImageMeta = {
        mem_width: new EvalExpression<number>(""),
        mem_height: new EvalExpression<number>(""),
        image_width: new EvalExpression<number>(""),
        image_height: new EvalExpression<number>(""),
        stride: new EvalExpression<number>(""),
        channels: new EvalExpression<number>(""),
        data: new EvalExpression<string>(""),
        format: new EvalExpression<string>(""),
    };

    constructor(
        _name: string,
        _expression?: string,
        _sizeByte?: number,
        _isLittleEndian?: boolean,
        _isSigned?: boolean,
        _mem_width?: number,
        _mem_height?: number,
        _image_width?: number,
        _image_height?: number,
        _stride?: number,
        _channels?: number,
        _data?: number,
        _format?: string
    ) {
        super(_name, _expression, _sizeByte, _isLittleEndian, _isSigned);
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
