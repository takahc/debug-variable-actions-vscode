
export class EvalExpression<ReturnType> {
    public expression: string = "";
    constructor(expression: string) {
        this.expression = expression;
    }

    static eval<ReturnType>(expression: string, context?: Record<string, any> | undefined): ReturnType {
        let func;
        if (context === undefined) {
            const func = new Function(`return ${expression};`);
            return func();
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
