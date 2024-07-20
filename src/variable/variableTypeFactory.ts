import { DebugVariableType } from "./debugVariable";
import { ImageVariableType } from "./imageVariable";

export class VariableTypeFactory {
    private static _primitiveTypes: { [key: string]: { sizeByte: number, signed: boolean } } = {
        "char": { sizeByte: 1, signed: true },
        "unsigned char": { sizeByte: 1, signed: false },
        "short": { sizeByte: 2, signed: true },
        "unsigned short": { sizeByte: 2, signed: false },
        "int": { sizeByte: 4, signed: true },
        "unsigned int": { sizeByte: 4, signed: false },
        "long": { sizeByte: 4, signed: true },
        "unsigned long": { sizeByte: 4, signed: false },
        "long long": { sizeByte: 8, signed: true },
        "unsigned long long": { sizeByte: 8, signed: false },
        "float": { sizeByte: 4, signed: true },
        "double": { sizeByte: 8, signed: true },
        "long double": { sizeByte: 16, signed: true }
    };

    public static get MyImageType() {
        return new ImageVariableType("Image", "Image",
            {
                // sizeByte: `width*height*1*4`,
                sizeByte: `12`,
                littleEndian: `true`,
                signed: `false`,
                fixedSize: `false`,
            },
            {
                mem_width: `width`,
                mem_height: `height`,
                image_width: `width`,
                image_height: `height`,
                stride: `width*4`,
                channels: `1`,
                data: `data`,
                format: `GRAY`,
                pxType: `int`,
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