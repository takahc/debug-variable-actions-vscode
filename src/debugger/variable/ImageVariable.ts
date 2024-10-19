import * as vscode from 'vscode';
import sharp from 'sharp';
import * as fs from 'fs';
import * as crypto from 'crypto';

import { DebugSessionTracker } from '../DebugSessionTracker';
import { DebugFrame } from '../DebugFrame';
import { DebugVariable } from "./DebugVariable";
import { DebugVariableType } from "./DebugVariableType";
import { ImageVariableType, ImageInfo } from './ImageVariableType';
import { EvalExpression } from "../../utils/EvalExpression";

export class ImageVariable extends DebugVariable {
    public category: string = "image";
    public isImageVariable: boolean = true;
    public imageInfo: ImageInfo = {
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

    declare public type: ImageVariableType | undefined;
    public buffer: Buffer | undefined;
    private metaWide: any; // FIXME: temporal implementation. It should be merged in DebugVariable.meta
    public imageHash: string | undefined;
    public imagePath: string | undefined;
    public imageHiContPath: string | undefined;

    static sizeByteLimit = vscode.workspace.getConfiguration().get("debug-variable-actions.config.image-sizebyte-limit");

    constructor(
        _frame: DebugFrame,
        _meta?: any,
        type?: DebugVariableType
    ) {
        super(_frame, _meta, type);
    }

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
            if (key === "") {
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

    async toFile() {
        console.log("begin toFile", this, this.name, this.expression);
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


        // check null pointer
        if (parseInt(startAddress, 16) <= 0) {
            console.log("toFile skip null pointer image", this.name, this.expression);
            return;
        }
        if (this.binaryInfo.sizeByte <= 0 || this.imageInfo.mem_width <= 0 || this.imageInfo.mem_height <= 0) {
            console.log("toFile skip zero size image", this.name, this.expression, this.binaryInfo.sizeByte);
            return;
        }
        if (this.binaryInfo.sizeByte > 1024 * 1024 * 1024) {
            console.log("toFile skip too large image", this.name, this.expression, this.binaryInfo.sizeByte);
            return;
        }


        console.log("startAddress", startAddress, "sizeByte", this.binaryInfo.sizeByte, this.name, this.expression);
        let readMemory;
        try {
            readMemory = await this.frame.thread.tracker.session.customRequest('readMemory', {
                memoryReference: startAddress, offset: 0, count: this.binaryInfo.sizeByte
            });
        } catch (e) {
            console.log("error readMemory", this, e);
        }
        console.log("readMemory: ", readMemory);


        let a = 1;


        let bufferData = Buffer.from(readMemory.data, "base64");
        const byteStrideForPx = this.imageInfo.bytesForPx * this.imageInfo.channels;
        console.log("bufferData", bufferData, this);


        // Determine the correct TypedArray based on data characteristics
        const TypedArray = !(this.binaryInfo.isInt) ? (this.imageInfo.bytesForPx === 4 ? Float32Array : Float64Array) : (
            this.imageInfo.bytesForPx === 1 ? (this.binaryInfo.signed ? Int8Array : Uint8Array) :
                this.imageInfo.bytesForPx === 2 ? (this.binaryInfo.signed ? Int16Array : Uint16Array) :
                    this.imageInfo.bytesForPx === 4 ? (this.binaryInfo.signed ? Int32Array : Uint32Array) : Uint8Array
        );

        // Create a typed array from the buffer data
        let imageArray = new TypedArray(
            bufferData.buffer,
            // @ts-ignore: TS2554: Expected 0-1 arguments, but got 3.
            bufferData.byteOffset,
            bufferData.byteLength / this.imageInfo.bytesForPx
        );
        try {
            for (let i = 0; i < this.imageInfo.mem_height; i++) {
                for (let j = 0; j < this.imageInfo.mem_width; j++) {
                    for (let c = 0; c < this.imageInfo.channels; c++) {
                        const offset = (i * this.imageInfo.mem_width + j) * this.imageInfo.bytesForPx + this.imageInfo.channels - 1;
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
                        imageArray[i * this.imageInfo.mem_width + j + c] = b;
                    }
                }
            }
        } catch (e) {
            console.log("error read array", this, e);
        }
        console.log("imageArray:", imageArray);


        // Save
        const context = this.frame.thread.tracker.context;
        const storageUri = context.storageUri ? context.storageUri : context.globalStorageUri;
        const breakCount = DebugSessionTracker.breakCount; //FIXME
        const threadId = this.frame.thread.id;
        const frameId = this.frame.meta.name;
        const frameName = this.frame.meta.name;
        const source = `${this.frame.meta.source.name}(${this.frame.meta.line},${this.frame.meta.column})`;

        const break_dir_name = `Break${breakCount}`;
        const pattern = /[\\\/:\*\?\"<>\|]/;
        const filenameStem = `${this.expression}`.replace(pattern, "-");
        const filename = `${filenameStem}.png`;
        const dirPath = vscode.Uri.joinPath(this.frame.thread.tracker.saveDirUri, break_dir_name);
        const filePath = vscode.Uri.joinPath(dirPath, filename);
        console.log("filePath", filePath);

        // hicont image path
        const filenameHicont = `${this.expression}.hicont.png`.replace(pattern, "-");
        const filePathHicont = vscode.Uri.joinPath(this.frame.thread.tracker.saveDirUri, break_dir_name, filenameHicont);

        // Extract the directory path from filePath

        // Check if the directory exists, if not, create it
        if (!fs.existsSync(dirPath.fsPath
        )) {
            await fs.mkdirSync(dirPath.fsPath, { recursive: true });
        }

        if (filePath) {
            // Sanitize path
            // const filePathSafe = vscode.Uri.parse(filePath.fsPath.replace("[\\\/:\*\?\"<>\|]", "$"))

            // Use Sharp to process the image data
            console.log("toFile creating image", this, this.name, this.expression, filePath.fsPath);
            await sharp(imageArray, {
                raw: {
                    width: this.imageInfo.mem_width,
                    height: this.imageInfo.mem_height,
                    channels: this.imageInfo.channels,
                }
            }).toFile(filePath.fsPath, (err, info) => {
                if (err) {
                    console.error('Error processing image:', this.expression, filePath.toString(), err);
                } else {
                    console.log('Image processed and saved:', this.expression, filePath.toString(), info);
                }
            });
            this.imagePath = filePath.fsPath;

            // High contrast image
            const hicontFilePath = vscode.Uri.joinPath(dirPath, `${filenameStem}.hicont.png`);
            await sharp(imageArray, {
                raw: {
                    width: this.imageInfo.mem_width,
                    height: this.imageInfo.mem_height,
                    channels: this.imageInfo.channels,
                }
            }).normalize().toFile(hicontFilePath.fsPath, (err, info) => {
                if (err) {
                    console.error('Error processing image:', this.expression, hicontFilePath.toString(), err);
                } else {
                    console.log('Image processed and saved:', this.expression, hicontFilePath.toString(), info);
                }
            });
            this.imageHiContPath = hicontFilePath.fsPath;

            await sharp(imageArray, {
                raw: {
                    width: this.imageInfo.mem_width,
                    height: this.imageInfo.mem_height,
                    channels: this.imageInfo.channels,
                }
            }).normalize().toFile(filePathHicont.fsPath, (err, info) => {
                if (err) {
                    console.error('Error processing image:', this.expression, err);
                } else {
                    console.log('Image processed and saved:', this.expression, info);
                }
            });

            // Calc image hash
            // this.imageHash = crypto.createHash('blake2b512').update(bufferData).digest('hex');
            this.imageHash = crypto.createHash('md5').update(bufferData).digest('hex');

            this.metaWide = await {
                "vscode": {
                    "workspaceFolder": this.frame.thread.tracker.session.workspaceFolder,
                    "storageUri": storageUri.fsPath,
                    "filePath": filePath.fsPath,
                    "filePathHicont": filePathHicont.fsPath,
                },
                "imageInfo": this.imageInfo,
                "imageHash": this.imageHash,
                "imagewebUrl": "",
                ...this.gatherMeta()
            };
        }

        // Save .meta.json
        const metaPath = vscode.Uri.joinPath(dirPath, `${filename}.meta.json`);
        console.log("metaPath", metaPath);
        fs.writeFileSync(metaPath.fsPath, JSON.stringify(this.metaWide, null, 4));

        return this.metaWide;
    }

    getSerializable() {
        return {
            ...super.getSerializable(),
            imageInfo: this.imageInfo,
            imageHash: this.imageHash,
            imagePath: this.imagePath,
            imageHiContPath: this.imageHiContPath,
            metaWide: this.metaWide,
        };
    }
}
