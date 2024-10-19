import { DebugSessionTracker } from './DebugSessionTracker';
import { DebugFrame } from './DebugFrame';
import { DebugVariable } from './variable/DebugVariable';
import { VariableTypeFactory } from './variable/VariableTypeFactory';

type IdType = number;
type TrackerId = IdType;
type TrackerName = string;

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
