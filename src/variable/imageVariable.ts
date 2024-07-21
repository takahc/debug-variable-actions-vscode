import * as vscode from 'vscode';
import { EvalExpression } from "./evalExpression";
import { DebugVariable, DebugVariableType, IbinaryInfo } from "./debugVariable";
import { VariableViewPanel } from '../panel';
import sharp from 'sharp';
// import * as cv from '@techstark/opencv-js';
import * as fs from 'fs';
import * as path from 'path';

export interface IimageInfo<T> {
    [key: string]: T,
    mem_width: T,
    mem_height: T,
    image_width: T,
    image_height: T,
    stride: T,
    channels: T,
    data: T,
    format: T,
    bytesForPx: T,
};

export class ImageVariable extends DebugVariable {
    public imageInfo: IimageInfo<any> = {
        mem_width: 0,
        mem_height: 0,
        image_width: 0,
        image_height: 0,
        stride: 0,
        channels: 1,
        data: "0X00",
        format: "RGB",
        bytesForPx: "1",
    };

    declare public type: ImageVariableType | undefined;
    public buffer: Buffer | undefined;

    updateImageInfo() {
        let values = this.getVariableValuesAsDict({});
        // delete invalid keys
        for (const key of Object.keys(values)) {
            try {
                EvalExpression.eval(`((${key}) => true)(${key})`, { [`${key}`]: true });
            } catch (error) {
                // delete
                delete values[key];
            }
        };

        Object.assign(values, { "$meta": this.meta });
        console.log("values", values);
        if (this.type) {
            this.imageInfo = this.type?.evalImageInfo(values);
            console.log("this.imageInfo", this.imageInfo);
            return this.imageInfo;
        }
        else {
            console.error("type is undefined");
            return undefined;
        }
    }

    async toFile(parent_dir?: vscode.Uri, filename?: string) {
        let buffer = this.buffer;


        this.updateImageInfo();
        this.updateBinaryInfo();

        let startAddress = ((str: string) => {
            let result = "";
            const hexChars = "0123456789ABCDEFabcdef";

            if (str.charAt(0) === '0' && str.charAt(1).toLowerCase() === 'x') {
                result = "0x";
                for (var i = 2; i < str.length; i++) {
                    if (hexChars.includes(str.charAt(i))) {
                        result += str.charAt(i);
                    } else {
                        break;
                    }
                }
            } else {
                result = "0x00";
            }
            return result;
        })(this.imageInfo.data);

        if (parseInt(startAddress, 16) === 0) {
            console.log("toFile skip null pointer image", this.name, this.expression);
            return;
        }
        const readMemory = await vscode.debug.activeDebugSession?.customRequest('readMemory', {
            memoryReference: startAddress, offset: 0, count: this.binaryInfo.sizeByte
        });
        console.log("readMemory: ", readMemory);


        let a = 1;


        let bufferData = Buffer.from(readMemory.data, "base64");
        const off = this.imageInfo.bytesForPx * this.imageInfo.channels;


        // Determine the correct TypedArray based on data characteristics
        const TypedArray = this.imageInfo.bytesForPx === 1 ? Uint8Array :
            this.imageInfo.bytesForPx === 2 ? (this.binaryInfo.signed ? Int16Array : Uint16Array) :
                this.imageInfo.bytesForPx === 4 ? (this.binaryInfo.signed ? Int32Array : Uint32Array) : Float64Array;
        // (isInt ? (this.imageInfo.bytesForPx === 4 : Float32Array : Float64Array;) : 

        // Create a typed array from the buffer data
        let imageArray = new TypedArray(
            bufferData.buffer,
            bufferData.byteOffset,
            bufferData.byteLength / this.imageInfo.bytesForPx
        );
        for (let i = 0; i < this.imageInfo.mem_height; i++) {
            for (let j = 0; j < this.imageInfo.mem_width; j++) {
                const offset = off * j;
                let b;
                if (this.binaryInfo.isInt) {
                    if (this.binaryInfo.signed) {
                        b = bufferData.readIntLE(offset, this.imageInfo.bytesForPx);
                    }
                    else {
                        b = bufferData.readUIntLE(offset, this.imageInfo.bytesForPx);
                    }
                }
                else {
                    if (this.imageInfo.bytesForPx === 4) {
                        b = bufferData.readFloatLE(offset);
                    }
                    else if (this.imageInfo.bytesForPx === 8) {
                        b = bufferData.readDoubleLE(offset);
                    }
                    else {
                        throw Error;
                    }
                }
                imageArray[i * this.imageInfo.mem_width + j] = b;
            }
        }
        console.log("imageArray:", imageArray);


        // refer to https://github.com/Mohamed5341/opencv-image/blob/main/src/myimages.ts
        // console.log("convert array to opencv image");
        // let imageSrc = cv.matFromArray(this.imageInfo.mem_width, this.imageInfo.mem_height, this.type, imageArray);
        // if (this.imageInfo.channels === 1) {
        //     console.log("convert image to RGB from gray");
        //     cv.cvtColor(imageSrc, imageSrc, cv.COLOR_GRAY2RGB);
        // }

        // if (this.imageInfo.channels === 3) {
        //     cv.cvtColor(imageSrc, imageSrc, cv.COLOR_BGR2RGB);
        // } else if (this.imageInfo.channels === 4) {
        //     cv.cvtColor(imageSrc, imageSrc, cv.COLOR_BGRA2RGBA);
        // }

        // Save
        if (filename === undefined) {
            filename = `${this.name}_${this.expression}.png`;
        }
        if (parent_dir === undefined) {
            const context = this.frame.thread.tracker.context;
            const storageUri = context.storageUri ? context.storageUri : context.globalStorageUri;
            const breakCount = this.frame.thread.tracker.breakCount;
            const threadId = this.frame.thread.id;
            const frameId = this.frame.meta.name;
            const frameName = this.frame.meta.name;
            const source = `${this.frame.meta.source.name}(${this.frame.meta.line},${this.frame.meta.column})`;
            const parent_dir_name = `Break${breakCount}_thread${threadId}_frame${frameId}_${frameName}_${source}`;
            parent_dir = vscode.Uri.joinPath(storageUri, parent_dir_name);
        }
        const filePath = vscode.Uri.joinPath(parent_dir, filename);

        // Extract the directory path from filePath
        const dirPath = path.dirname(filePath.fsPath);

        // Check if the directory exists, if not, create it
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        if (filePath) {
            // Use Sharp to process the image data
            console.log("toFile creating image", this.name, this.expression, filePath.fsPath);
            await sharp(imageArray, {
                raw: {
                    width: this.imageInfo.mem_width,
                    height: this.imageInfo.mem_height,
                    channels: this.imageInfo.channels,
                },
                create: {
                    width: this.imageInfo.mem_width,
                    height: this.imageInfo.mem_height,
                    channels: 3,
                    background: { r: 0, g: 0, b: 0, alpha: 0 },
                }
            }).toFile(filePath.fsPath, (err, info) => {
                if (err) {
                    console.error('Error processing image:', err);
                } else {
                    console.log('Image processed and saved:', info);
                }
            });

            // console.log("Setting opencv image to jimp");
            // new Jimp({
            //     width: this.imageInfo.mem_width, height: this.imageInfo.mem_height, data: Buffer.from(imageSrc.data)
            // }
            // ).write(filePath.fsPath);
            // console.log("delete opencv image");
            // imageSrc.delete();

            // Display
            // const openPath = vscode.Uri.file(filePath.toString()).toString().replace("/file:", "");
            // vscode.commands.executeCommand('vscode.open', filePath.fsPath);
            let a = filePath.toString();
            VariableViewPanel.render(this.frame.thread.tracker.context);
            const panel = VariableViewPanel.currentPanel;
            if (panel) {
                const weburi = panel.getWebViewUrlString(filePath);
                panel.postMessage({
                    command: "image",
                    // url: filePath.toString()
                    url: weburi

                });
                panel.showPanel();
            }

        }
    }


}

export class ImageVariableType extends DebugVariableType {
    // ImageVariableType knows its member names or fixed values


    private imageMeta: IimageInfo<EvalExpression<any>>;

    constructor(
        name: string,
        expression?: string,
        binaryMetaString?: IbinaryInfo<string>,
        imageMetaString?: IimageInfo<string>,
    ) {
        super(name, expression, binaryMetaString);
        this.imageMeta = {
            mem_width: new EvalExpression<number>(imageMetaString?.mem_width || "0"),
            mem_height: new EvalExpression<number>(imageMetaString?.mem_height || "0"),
            image_width: new EvalExpression<number>(imageMetaString?.image_width || "0"),
            image_height: new EvalExpression<number>(imageMetaString?.image_height || "0"),
            stride: new EvalExpression<number>(imageMetaString?.stride || "0"),
            channels: new EvalExpression<number>(imageMetaString?.channels || "3"),
            data: new EvalExpression<string>(imageMetaString?.data || "'0X00'"),
            format: new EvalExpression<string>(imageMetaString?.format || "'RGB'"),
            bytesForPx: new EvalExpression<number>(imageMetaString?.bytesForPx || "1"),
        };
    }

    evalImageInfo(members: any): IimageInfo<any> {
        const imageInfo: IimageInfo<any> = {
            mem_width: 0,
            mem_height: 0,
            image_width: 0,
            image_height: 0,
            stride: 0,
            channels: 0,
            data: "'0X00'",
            format: "'RGB'",
            bytesForPx: 1,
        };

        Object.entries(this.imageMeta).forEach(([key, evalExpression]) => {
            imageInfo[key] = evalExpression.eval(members);
        });

        imageInfo.mem_width = parseInt(imageInfo.mem_width);
        imageInfo.mem_height = parseInt(imageInfo.mem_height);
        imageInfo.image_width = parseInt(imageInfo.image_width);
        imageInfo.image_height = parseInt(imageInfo.image_height);
        imageInfo.stride = parseInt(imageInfo.stride);
        imageInfo.channels = parseInt(imageInfo.channels);
        imageInfo.bytesForPx = parseInt(imageInfo.bytesForPx);

        return imageInfo;
    }
}
