import * as vscode from 'vscode';
import sharp from 'sharp';
import * as fs from 'fs';
import * as crypto from 'crypto';

import { DebugSessionTracker } from '../debugSessionTracker';
import { DebugFrame } from '../debugFrame';
import { DebugVariable } from "./debugVariable";
import { DebugVariableType } from "./debugVariableType";
import { ImageVariableType, ImageInfo } from './imageVariableType';
import { EvalExpression } from "../../utils/evalExpression";

export class ImageVariable extends DebugVariable {
    public category = "image";
    public isImageVariable = true;
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
    private metaWide: any; // TODO: Merge this into DebugVariable.meta
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
        this.cleanInvalidKeys(values);
        Object.assign(values, { "$meta": this.meta });
        if (this.type) {
            this.imageInfo = this.type.evalImageInfo(values);
            console.log("Updated ImageInfo:", this.imageInfo);
            return this.imageInfo;
        } else {
            console.error("Type is undefined");
            return undefined;
        }
    }

    cleanInvalidKeys(values: Record<string, any>) {
        Object.keys(values).forEach((key) => {
            try {
                EvalExpression.eval(`((${key}) => true)(${key})`, { [`${key}`]: true });
            } catch {
                delete values[key];
            }
            if (key === "") { delete values[key]; }
        });
    }

    async toFile() {
        console.log("Processing image to file:", this.name, this.expression);
        this.updateImageInfo();
        this.updateBinaryInfo();

        const startAddress = this.parseStartAddress(this.imageInfo.data);
        if (!this.isValidImage(startAddress)) { return; }

        const readMemory = await this.readMemory(startAddress);
        if (!readMemory) { return; }

        const bufferData = Buffer.from(readMemory.data, "base64");
        const imageArray = this.createImageArray(bufferData);

        this.imagePath = await this.saveImage(imageArray, "png");
        this.imageHiContPath = await this.saveImage(imageArray, "hicont.png", true);
        this.imageHash = crypto.createHash('md5').update(bufferData).digest('hex');
        this.metaWide = await this.buildMetaData();

        const metaPath = vscode.Uri.joinPath(this.getDirectory(), `${this.getFileName()}.meta.json`);
        fs.writeFileSync(metaPath.fsPath, JSON.stringify(this.metaWide, null, 4));

        return this.metaWide;
    }

    parseStartAddress(data: string): string {
        if (data.toLocaleLowerCase().startsWith("0x")) {
            return data;
        }
        // warning: this is a hack to convert the data to hex
        const ret = `0x${parseInt(data).toString(16)}`;
        console.warn("Data is not in hex format, converting to hex:", data, "->", ret);
        return ret;
    }

    isValidImage(startAddress: string): boolean {
        const sizeLimit = 1024 * 1024 * 1024;
        if (parseInt(startAddress, 16) <= 0) { return false; }
        if (this.binaryInfo.sizeByte <= 0 || this.imageInfo.mem_width <= 0 || this.imageInfo.mem_height <= 0) { return false; }
        if (this.binaryInfo.sizeByte > sizeLimit) { return false; }
        return true;
    }

    async readMemory(startAddress: string) {
        try {
            return await this.frame.thread.tracker.session.customRequest('readMemory', {
                memoryReference: startAddress,
                offset: 0,
                count: this.binaryInfo.sizeByte
            });
        } catch (e) {
            console.error("Error reading memory", e);
            return null;
        }
    }

    createImageArray(bufferData: Buffer) {
        const byteStrideForPx = this.imageInfo.bytesForPx * this.imageInfo.channels;
        const TypedArray = this.getTypedArrayConstructor();
        // @ts-ignore: TS2554: Expected 0-1 arguments, but got 3.
        let imageArray = new TypedArray(bufferData.buffer, bufferData.byteOffset, bufferData.byteLength / this.imageInfo.bytesForPx);

        for (let i = 0; i < this.imageInfo.mem_height; i++) {
            for (let j = 0; j < this.imageInfo.mem_width; j++) {
                for (let c = 0; c < this.imageInfo.channels; c++) {
                    const offset = (i * this.imageInfo.mem_width + j) * byteStrideForPx + c;
                    imageArray[i * this.imageInfo.mem_width + j + c] = this.readBufferValue(bufferData, offset);
                }
            }
        }
        return imageArray;
    }

    getTypedArrayConstructor() {
        const { bytesForPx, isInt, signed } = this.binaryInfo;
        if (!isInt) { return bytesForPx === 4 ? Float32Array : Float64Array; }
        if (bytesForPx === 1) { return signed ? Int8Array : Uint8Array; }
        if (bytesForPx === 2) { return signed ? Int16Array : Uint16Array; }
        if (bytesForPx === 4) { return signed ? Int32Array : Uint32Array; }
        if (bytesForPx === 8) { return signed ? BigInt64Array : BigUint64Array; }
        return Uint8Array;
    }

    readBufferValue(buffer: Buffer, offset: number) {
        if (this.binaryInfo.isInt) {
            return this.binaryInfo.signed ? buffer.readIntLE(offset, this.imageInfo.bytesForPx) : buffer.readUIntLE(offset, this.imageInfo.bytesForPx);
        }
        return this.imageInfo.bytesForPx === 4 ? buffer.readFloatLE(offset) : buffer.readDoubleLE(offset);
    }

    async saveImage(imageArray: any, fileExtension: string, normalize: boolean = false): Promise<string> {
        const filePath = vscode.Uri.joinPath(this.getDirectory(), `${this.getFileName()}.${fileExtension}`);
        const options = {
            raw: {
                width: this.imageInfo.mem_width,
                height: this.imageInfo.mem_height,
                channels: this.imageInfo.channels
            }
        };

        try {
            if (normalize) {
                await sharp(imageArray, options).normalize().toFile(filePath.fsPath);
            } else {
                await sharp(imageArray, options).toFile(filePath.fsPath);
            }
            console.log(`Image saved: ${filePath.fsPath}`);
        } catch (err) {
            console.error(`Error saving image: ${filePath.fsPath}`, err);
        }

        return filePath.fsPath;
    }

    getFileName() {
        return `${this.expression}`.replace(/[\\\/:\*\?\"<>\|]/g, "-");
    }

    getDirectory() {
        const breakCount = DebugSessionTracker.breakCount;
        const dirPath = vscode.Uri.joinPath(this.frame.thread.tracker.saveDirUri, `Break${breakCount}`);
        if (!fs.existsSync(dirPath.fsPath)) {
            fs.mkdirSync(dirPath.fsPath, { recursive: true });
        }
        return dirPath;
    }

    async buildMetaData() {
        const context = this.frame.thread.tracker.context;
        const storageUri = context.storageUri ?? context.globalStorageUri;
        return {
            vscode: {
                workspaceFolder: this.frame.thread.tracker.session.workspaceFolder,
                storageUri: storageUri.fsPath,
                filePath: this.imagePath,
                filePathHicont: this.imageHiContPath,
            },
            imageInfo: this.imageInfo,
            imageHash: this.imageHash,
            ...this.gatherMeta()
        };
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

    // Add a method to fetch image data for hover display
    public async fetchImageData(): Promise<string | null> {
        await this.toFile();
        return this.imagePath ? vscode.Uri.file(this.imagePath).toString() : null;
    }
}
