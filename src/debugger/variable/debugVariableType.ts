import { EvalExpression } from '../../utils/evalExpression';

export type BinaryInfo = {
    [key: string]: any,
    sizeByte: number,
    littleEndian: boolean,
    signed: boolean,
    fixedSize: boolean,
    isInt: boolean,
};

export type BinaryInfoExpressionEvals = {
    [K in keyof BinaryInfo]: EvalExpression<BinaryInfo[K]>;
};

export type BinaryInfoExpressions = {
    [K in keyof BinaryInfo]: string;
};

export class DebugVariableType {
    public readonly name: string | undefined;
    public readonly expression: string | undefined;
    public isVisualizable: boolean = false;

    private binaryInfoExpressionEvals: BinaryInfoExpressionEvals;

    constructor(
        name: string,
        expression?: string,
        binaryInfoExpressions?: BinaryInfoExpressions,
    ) {
        this.name = name;
        this.expression = expression;
        this.binaryInfoExpressionEvals = Object.fromEntries(
            Object.entries({
                sizeByte: "0",
                littleEndian: "true",
                signed: "true",
                fixedSize: "false",
                isInt: "true"
            }).map(([key, defaultValue]) => [
                key,
                new EvalExpression(binaryInfoExpressions?.[key] || defaultValue)
            ])
        ) as BinaryInfoExpressionEvals;
    }

    evalBinaryInfo(members: any): BinaryInfo {
        const binaryInfo: BinaryInfo = {
            sizeByte: 0,
            littleEndian: false,
            signed: false,
            fixedSize: false,
            isInt: true
        };

        Object.entries(this.binaryInfoExpressionEvals).forEach(([key, evalExpression]) => {
            binaryInfo[key] = evalExpression.eval(members);
        });

        return binaryInfo;
    }
}

// Array type
export type DebugVariableArrayType = DebugVariableType[];

// Struct type
export type DebugVariableStructType = { [key: string]: DebugVariableType };

