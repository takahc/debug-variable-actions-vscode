import { DebugVariableType } from "./debugVariable";
import { ImageVariableType } from "./imageVariable";

export class VariableTypeFactory {
    private static _primitiveTypes: { [key: string]: { sizeByte: number, signed: boolean, isInt: boolean } } = {
        "char": { sizeByte: 1, signed: true, isInt: true },
        "unsigned char": { sizeByte: 1, signed: false, isInt: true },
        "short": { sizeByte: 2, signed: true, isInt: true },
        "unsigned short": { sizeByte: 2, signed: false, isInt: true },
        "int": { sizeByte: 4, signed: true, isInt: true },
        "unsigned int": { sizeByte: 4, signed: false, isInt: true },
        "long": { sizeByte: 4, signed: true, isInt: true },
        "unsigned long": { sizeByte: 4, signed: false, isInt: true },
        "long long": { sizeByte: 8, signed: true, isInt: true },
        "unsigned long long": { sizeByte: 8, signed: false, isInt: true },
        "float": { sizeByte: 4, signed: true, isInt: false },
        "double": { sizeByte: 8, signed: true, isInt: false },
        "long double": { sizeByte: 16, signed: true, isInt: false },
    };

    public static get MyImageType() {
        return new ImageVariableType("Image", "Image",
            {
                sizeByte: `width*height*1*1`, // w*h*c*bytesForPx
                littleEndian: `true`,
                signed: `false`,
                fixedSize: `false`,
                isInt: `true`,
            },
            {
                mem_width: `width`,
                mem_height: `height`,
                image_width: `width`,
                image_height: `height`,
                stride: `width*1`,
                channels: `1`,
                data: `String(((d)=> data.split(" ")[0] )(data))`,
                format: `"GRAY"`,
                bytesForPx: `1`,
            }
        );
    }


    static get(type_name: string): DebugVariableType | undefined {
        if (this._primitiveTypes[type_name]) {
            let { sizeByte, signed } = this._primitiveTypes[type_name];
            let littleEndian = true;
            let fixedSize = false;
            let type = new DebugVariableType(type_name, type_name,
                {
                    sizeByte: `${sizeByte}`,
                    littleEndian: `${littleEndian}`,
                    signed: `${signed}`,
                    fixedSize: `${signed}`,
                    isInt: `${signed}`,
                }
            );
            return type;
        }

        switch (type_name) {
            case "Image":
                return VariableTypeFactory.MyImageType;
        }
        return undefined;
    }

}