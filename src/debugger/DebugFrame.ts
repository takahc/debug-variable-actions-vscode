import { ImageVariable } from './variable/ImageVariable';
import { ImageVariableType } from './variable/ImageVariableType';
import { DebugVariable } from './variable/DebugVariable';
import { DebugVariableType } from './variable/DebugVariableType';

import { DebugThread } from './DebugThread';

type IdType = number;
type TrackerId = IdType;
type TrackerName = string;

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


