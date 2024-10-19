import { EvalExpression } from "../../utils/EvalExpression";
import { DebugVariableType, BinaryInfo, BinaryInfoExpressions } from "./DebugVariableType";

export type SupportedImageChannles = 1 | 2 | 3 | 4;
export type SupportedImageFormats = "GRAY" | "RGB" | "BGR" | "RGBA" | "BGRA";

export type ImageInfo = {
    [key: string]: any,
    mem_width: number,
    mem_height: number,
    image_width: number,
    image_height: number,
    stride: number,
    channels: SupportedImageChannles,
    data: string,
    format: SupportedImageFormats,
    bytesForPx: number,
};

export type ImageInfoExpressions = {
    [K in keyof ImageInfo]: string;
};

export type ImageInfoExpressionEvals = {
    [K in keyof ImageInfo]: EvalExpression<ImageInfo[K]>;
};

export type ImageTypeConfig = {
    display_name: string;
    match_types: string[];
    binary_info: BinaryInfo;
    image_info: ImageInfo;
};

export class ImageVariableType extends DebugVariableType {
    // ImageVariableType knows its member names or fixed values

    private imageInfoExpressionEvals: ImageInfoExpressionEvals;

    constructor(
        name: string,
        expression?: string,
        binaryInfoExpressions?: BinaryInfoExpressions,
        imageInfoExpressions?: ImageInfoExpressions,
    ) {
        super(name, expression, binaryInfoExpressions);
        this.imageInfoExpressionEvals = Object.fromEntries(
            Object.entries({
                mem_width: "0",
                mem_height: "0",
                image_width: "0",
                image_height: "0",
                stride: "0",
                channels: "1",
                data: "'0X00'",
                format: "'GRAY'",
                bytesForPx: "1"
            }).map(([key, defaultValue]) => [
                key,
                new EvalExpression(imageInfoExpressions?.[key] || defaultValue)
            ])
        ) as ImageInfoExpressionEvals;
    }

    evalImageInfo(members: any): ImageInfo {
        const imageInfo: ImageInfo = {
            mem_width: 0,
            mem_height: 0,
            image_width: 0,
            image_height: 0,
            stride: 0,
            channels: 1,
            data: "0X00",
            format: "RGB",
            bytesForPx: 1,
        };

        Object.entries(this.imageInfoExpressionEvals).forEach(([key, evalExpression]) => {
            imageInfo[key] = evalExpression.eval(members);
        });

        for (const key of ["mem_width", "mem_height", "image_width", "image_height", "stride", "channels", "bytesForPx"]) {
            imageInfo[key] = parseInt(imageInfo[key]);
        }

        return imageInfo;
    }
}
