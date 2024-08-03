import * as vscode from 'vscode';
import { DebugVariableType, IbinaryInfo } from "./debugVariable";
import { ImageVariableType, IimageInfo } from "./imageVariable";

interface IimageTypeConfig {
    display_name: string;
    match_types: string[];
    binary_info: IbinaryInfo<string>;
    image_info: IimageInfo<string>;
}

export class VariableTypeFactory {
    private static imageTypesConfig: { [key: string]: IimageTypeConfig } = {};
    private static imageMatchTypeStrs: string[] = [];

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

    public static get ImageTypeNames() {
        return ["Image"].concat(this.imageMatchTypeStrs);
    }

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

        if (this.imageTypesConfig && this.imageTypesConfig[type_name]) {
            let type = this.imageTypesConfig[type_name];
            return new ImageVariableType(type_name, type_name,
                {
                    sizeByte: `${type.binary_info.sizeByte}`,
                    littleEndian: `${type.binary_info.littleEndian}`,
                    signed: `${type.binary_info.signed}`,
                    fixedSize: `${type.binary_info.fixedSize}`,
                    isInt: `${type.binary_info.isInt}`,
                },
                {
                    mem_width: `${type.image_info.mem_width}`,
                    mem_height: `${type.image_info.mem_height}`,
                    image_width: `${type.image_info.image_width}`,
                    image_height: `${type.image_info.image_height}`,
                    stride: `${type.image_info.stride}`,
                    channels: `${type.image_info.channels}`,
                    data: `${type.image_info.data}`,
                    format: `${type.image_info.format}`,
                    bytesForPx: `${type.image_info.bytesForPx}`,
                }
            );
        }

        switch (type_name) {
            case "Image":
                return VariableTypeFactory.MyImageType;
        }
        return undefined;
    }

    static loadSettings() {
        // load user defined types
        const _configs: IimageTypeConfig[] | undefined = vscode.workspace.getConfiguration().get("debug-variable-actions.config.image-types");
        if (_configs) {
            console.log("Before loading config: imageTypesConfig", this.imageTypesConfig);
            this.imageTypesConfig = {};
            this.imageMatchTypeStrs = [];
            for (const config of _configs) {
                for (const match_type of config.match_types) {
                    this.imageTypesConfig[match_type] = config;
                }
                this.imageMatchTypeStrs = this.imageMatchTypeStrs.concat(config.match_types);
            }
            console.log("Load config: imageTypesConfig", this.imageTypesConfig);
        } else {
            console.log("No config found: imageTypesConfig");
        }
    }

}