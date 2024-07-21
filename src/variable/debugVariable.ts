import { DebugFrame } from './debugSessionTracker';
import { EvalExpression } from './evalExpression';
import { ImageVariable, ImageVariableType } from './imageVariable';
import { VariableTypeFactory } from './variableTypeFactory';

export interface IbinaryInfo<T> {
    [key: string]: T,
    sizeByte: T,
    littleEndian: T,
    signed: T,
    fixedSize: T,
    isInt: T,
}
export class DebugVariable {
    public meta: any;
    public readonly frame: DebugFrame;
    public name: string | undefined;
    public expression: string | undefined;
    public type: DebugVariableType | undefined;
    public startAddress: string | undefined;
    public endAddress: string | undefined;
    public sizeByte: string | undefined;

    public binaryInfo: IbinaryInfo<any> = {
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

        // fetch child debug variables
        const variables = await this.frame.thread.tracker.session?.customRequest('variables',
            { variablesReference: this.meta.variablesReference }
        );
        // if (!variables) { return; }

        // console.log("drillDown", this.meta.name, this.name, variables, "ref:", this.meta.variablesReference);
        if (variables.variables.length > 0) {
            this.isArray = true;
            for (const meta of variables.variables) {
                // add child variable
                let variable: DebugVariable;
                if (["Image"].includes(meta.type)) {
                    let imageType = VariableTypeFactory.get("Image") || undefined;
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
}

export class DebugVariableType {
    public readonly name: string | undefined;
    public readonly expression: string | undefined;
    public isVisualizable: boolean = false;

    private binaryMeta: IbinaryInfo<EvalExpression<any>>;

    constructor(
        name: string,
        expression?: string,
        binaryMetaString?: IbinaryInfo<string>,
    ) {
        this.name = name;
        this.expression = expression;
        this.binaryMeta = {
            sizeByte: new EvalExpression<number>(binaryMetaString?.sizeByte || ""),
            littleEndian: new EvalExpression<boolean>(binaryMetaString?.littleEndian || "true"),
            signed: new EvalExpression<boolean>(binaryMetaString?.signed || "true"),
            fixedSize: new EvalExpression<boolean>(binaryMetaString?.fixedSize || "false"),
            isInt: new EvalExpression<boolean>(binaryMetaString?.isInt || "true"),
        };
    }

    evalBinaryInfo(members: any): IbinaryInfo<any> {
        const binaryInfo: IbinaryInfo<any> = {
            sizeByte: 0,
            littleEndian: false,
            signed: false,
            fixedSize: false,
            isInt: true
        };

        Object.entries(this.binaryMeta).forEach(([key, evalExpression]) => {
            binaryInfo[key] = evalExpression.eval(members);
        });

        return binaryInfo;
    }
}


// Array type
export type DebugVariableArrayType = DebugVariableType[];

// Struct type
export type DebugVariableStructType = { [key: string]: DebugVariableType };

