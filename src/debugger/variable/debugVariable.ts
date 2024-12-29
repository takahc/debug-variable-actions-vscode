import { DebugFrame } from '../debugFrame';
import { ImageVariable } from './imageVariable';
import { ImageVariableType } from './imageVariableType';
import { BinaryInfo, DebugVariableType, DebugVariableArrayType, DebugVariableStructType } from './debugVariableType';
import { VariableTypeFactory } from './variableTypeFactory';
import { EvalExpression } from '../../utils/evalExpression';

export type DebugEntity = DebugVariable | ImageVariable;

export class DebugVariable {
    public category: string = "primitive";
    public isImageVariable: boolean = false;
    public meta: any;
    public readonly frame: DebugFrame;
    public name: string | undefined;
    public expression: string | undefined;
    public type: DebugVariableType | undefined;
    public startAddress: string | undefined;
    public endAddress: string | undefined;
    public sizeByte: string | undefined;

    public binaryInfo: BinaryInfo = {
        sizeByte: 0,
        littleEndian: true,
        signed: true,
        fixedSize: false,
        isInt: true,
    };

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
            // const typeBinaryInfo: IbinaryInfo<any> = type.evalBinaryInfo({});
            // if (typeBinaryInfo.fixedSize) {
            //     this.endAddress = "0X" + (parseInt(this.meta.endAddress) + typeBinaryInfo.sizeByte).toString(16).toUpperCase();
            // }
        }
    }

    parse() {
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

    updateBinaryInfo() {
        let values = this.getVariableValuesAsDict({});
        Object.assign(values, { "$meta": this.meta });
        // delete invalid keys
        for (const key of Object.keys(values)) {
            try {
                EvalExpression.eval(`((${key}) => true)(${key})`, { [`${key}`]: true });
            } catch (error) {
                // delete
                delete values[key];
            }
            if (key === "") {
                delete values[key];
            }
        };

        console.log("values", values);
        if (this.type) {
            this.binaryInfo = this.type?.evalBinaryInfo(values);
            console.log("this.binaryInfo", this.binaryInfo);
            return this.binaryInfo;
        }
        else {
            console.error("type is undefined");
            return undefined;
        }
    }

    async drillDown(until = { depth: -1, type_names: [] as string[] }, final = false) {
        // if (this.meta === undefined) { return; }
        // if (until.depth === 0) { return; } // break if the depth reaches 0

        if (this.meta.variablesReference === 0) { return; }

        // check prevent drill down
        for (const cond of VariableTypeFactory.preventDrillDownConditions) {
            if (VariableTypeFactory.preventDrillDownConditions) {
                const args = {
                    value: this.getVariableValuesAsDict({}),
                    meta: this.gatherMeta(),
                };
                const check = EvalExpression.eval(cond, args);
                if (check) {
                    // console.log("skip drill down by cond", cond, check, this.meta.name);
                    return;
                }
            }

        }

        // fetch child debug variables
        let variables;
        try {
            variables = await this.frame.thread.tracker.session?.customRequest('variables',
                {
                    variablesReference: this.meta.variablesReference,
                    filter: undefined,
                    // start: 0,
                    count: 1000
                    // count: 0

                }
            );
        } catch (e) {
            console.log("error request variables", this, e);
            return;
        }
        // if (!variables) { return; }

        // console.log("drillDown", this.meta.name, this.name, variables, "ref:", this.meta.variablesReference);
        if (variables.variables.length > 0) {
            this.isArray = true;
            for (const meta of variables.variables) {
                // add child variable
                let variable: DebugVariable;
                if (VariableTypeFactory.ImageTypeNames.includes(meta.type)) {
                    let imageType = VariableTypeFactory.get(meta.type) || undefined;
                    variable = this.addChildVariable(meta, this, imageType);
                }
                else {
                    // comment out below if you don't want to fetch non-image variables
                    variable = this.addChildVariable(meta, this, undefined);
                }

                // count down until.depth if it is not -1 nor negative
                if (until.depth > 0) { until.depth--; }

                // if meta.type is in until.tyes, next is the last drill down
                let next_final = false;
                if (until.type_names.length > 0 && until.type_names.includes(meta.type as string)) {
                    next_final = true; // FIXME: until.type is not working
                }

                if (!final) {
                    // recursive drill down
                    await variable.drillDown(until, next_final);
                }
            };
        } else {
            // the item is not an array, so value is set to meta.value
            this.isArray = false;
            this.value = this.meta.value; // no need to set here, because it is already set in the constructor
        }
    }

    addChildVariable(meta: any, parent: DebugVariable = this, type?: DebugVariableType): DebugVariable {
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

    getVariableValuesAsDict(ret: { [key: string]: any } = {}) {
        if (Array.isArray(this.value)) {
            this.value.forEach((variable: DebugVariable) => {
                Object.assign(ret, { [`${this.name}`]: this.startAddress });
                let temp = variable.getVariableValuesAsDict(ret);
            });
        }
        else {
            Object.assign(ret, { [`${this.name}`]: this.value });
        }
        return ret;
    }

    judgeArrayByName(): "array" | "other" {
        if (this.name) {
            if ("^\[[0-9]\]$".match(this.name)) { return "array"; }
        }
        return "other";
    }

    getSerializable() {
        let ret: any = {
            category: this.category,
            isImageVariable: this.isImageVariable,
            name: this.name,
            meta: this.meta,
            expression: this.expression,
            type: this.type,
            startAddress: this.startAddress,
            endAddress: this.endAddress,
            sizeByte: this.sizeByte,
            binaryInfo: this.binaryInfo,
            value: this.value,
            isVisualizable: this.isVisualizable,
            isArray: this.isArray,
            isStruct: this.isStruct,
            parentName: this.parent?.name,
        };

        if (this.value instanceof Array) {
            ret.value = [];
            this.value.forEach((variable: DebugVariable) => {
                ret.value.push(variable.getSerializable());
            });
        }

        return ret;
    }
}
