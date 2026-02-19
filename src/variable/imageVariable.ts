import * as vscode from 'vscode';
import { EvalExpression } from "./evalExpression";
import { DebugVariable, DebugVariableType, IbinaryInfo } from "./debugVariable";
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { DebugSessionTracker } from './debugSessionTracker';

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
    private metaWide: any; // FIXME: temporal implementation. It should be merged in DebugVariable.meta
    public imageHash: string | undefined;

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

        this.updateImageInfo();
        this.updateBinaryInfo();

        // Extract hex address from imageInfo.data (e.g. "0x7f1234abcd")
        const startAddress = ((str: string): string => {
            if (str.charAt(0) === '0' && str.charAt(1).toLowerCase() === 'x') {
                const hexMatch = str.match(/^0x[0-9A-Fa-f]+/);
                return hexMatch ? hexMatch[0] : "0x00";
            }
            return "0x00";
        })(this.imageInfo.data);

        // check null pointer
        if (parseInt(startAddress, 16) === 0) {
            console.log("toFile skip null pointer image", this.name, this.expression);
            return;
        }
        // Sanity-check image dimensions. Uninitialised struct members can produce
        // garbage values (e.g. stack addresses interpreted as width/height) that
        // cause an astronomically large sizeByte and crash the DAP server.
        const MAX_DIM = 32768;   // 32K px per side is more than enough for debugging
        const MAX_READ_BYTES = 256 * 1024 * 1024; // 256 MiB hard cap for readMemory count

        const wVal = Math.trunc(Number(this.imageInfo.mem_width));
        const hVal = Math.trunc(Number(this.imageInfo.mem_height));
        if (!isFinite(wVal) || wVal <= 0 || wVal > MAX_DIM ||
            !isFinite(hVal) || hVal <= 0 || hVal > MAX_DIM) {
            console.log("toFile skip: image dimensions out of range",
                { width: wVal, height: hVal }, this.name, this.expression,
                "(variable may be uninitialised)");
            return;
        }

        // Ensure sizeByte is a safe positive integer that the DAP server can accept.
        // GDB's readMemory 'count' field must fit in a 32-bit signed integer.
        const rawSizeByte = this.binaryInfo.sizeByte;
        const sizeByte = Math.trunc(Number(rawSizeByte));
        if (!isFinite(sizeByte) || sizeByte <= 0 || sizeByte > MAX_READ_BYTES) {
            console.log("toFile skip: sizeByte out of range", sizeByte, rawSizeByte, this.name, this.expression,
                `(width=${wVal}, height=${hVal}, channels=${this.imageInfo.channels}, bpp=${this.imageInfo.bytesForPx})`);
            return;
        }

        console.log("startAddress", startAddress, "sizeByte", sizeByte, this.name, this.expression);
        let readMemory;
        try {
            readMemory = await this.frame.thread.tracker.session.customRequest('readMemory', {
                memoryReference: startAddress, offset: 0, count: sizeByte
            });
        } catch (e) {
            console.log("error readMemory", this, e);
            return;
        }
        if (!readMemory) {
            console.log("readMemory returned undefined", this.name);
            return;
        }
        console.log("readMemory done", this.name);

        const bufferData = Buffer.from(readMemory.data, "base64");

        // Build a Uint8 raw buffer suitable for sharp.
        // For non-uint8 types we normalise values into [0,255] so sharp can render them.
        let rawBuffer: Buffer;
        const { mem_width, mem_height, channels, bytesForPx } = this.imageInfo;
        // Clamp totalPixels to what was actually read, to guard against expression mis-evaluation.
        const maxFromBuffer = Math.floor(bufferData.byteLength / Math.max(1, bytesForPx));
        const totalPixels = Math.min(mem_width * mem_height * channels, maxFromBuffer);

        if (!this.binaryInfo.isInt) {
            // Float32 / Float64 → normalise to uint8
            const isFloat32 = bytesForPx === 4;
            const floatArr = isFloat32
                ? new Float32Array(bufferData.buffer, bufferData.byteOffset, totalPixels)
                : new Float64Array(bufferData.buffer, bufferData.byteOffset, totalPixels);
            let min = Infinity, max = -Infinity;
            for (let k = 0; k < floatArr.length; k++) {
                const v = floatArr[k];
                if (v < min) { min = v; }
                if (v > max) { max = v; }
            }
            const range = max - min || 1;
            rawBuffer = Buffer.allocUnsafe(totalPixels);
            for (let k = 0; k < floatArr.length; k++) {
                rawBuffer[k] = Math.round(((floatArr[k] - min) / range) * 255);
            }
        } else if (bytesForPx === 1) {
            // uint8 / int8 — use buffer directly (zero-copy for unsigned)
            if (!this.binaryInfo.signed) {
                rawBuffer = bufferData.subarray(0, totalPixels);
            } else {
                // Shift signed int8 to [0,255]
                rawBuffer = Buffer.allocUnsafe(totalPixels);
                for (let k = 0; k < totalPixels; k++) {
                    rawBuffer[k] = bufferData.readInt8(k) + 128;
                }
            }
        } else {
            // uint16/int16/uint32/int32 → normalise to uint8
            const readFn = bytesForPx === 2
                ? (this.binaryInfo.signed ? (o: number) => bufferData.readInt16LE(o) : (o: number) => bufferData.readUInt16LE(o))
                : (this.binaryInfo.signed ? (o: number) => bufferData.readInt32LE(o) : (o: number) => bufferData.readUInt32LE(o));
            // First pass: find min/max
            let min = Infinity, max = -Infinity;
            for (let k = 0; k < totalPixels; k++) {
                const v = readFn(k * bytesForPx);
                if (v < min) { min = v; }
                if (v > max) { max = v; }
            }
            const range = max - min || 1;
            rawBuffer = Buffer.allocUnsafe(totalPixels);
            for (let k = 0; k < totalPixels; k++) {
                rawBuffer[k] = Math.round(((readFn(k * bytesForPx) - min) / range) * 255);
            }
        }

        console.log("rawBuffer ready, size:", rawBuffer.length);


        // Save
        const context = this.frame.thread.tracker.context;
        const storageUri = context.storageUri ? context.storageUri : context.globalStorageUri;
        const breakCount = DebugSessionTracker.breakCount;

        const session_dir_name = `Session${this.frame.thread.tracker.session.id}`;
        const break_dir_name = `Break${breakCount}`;
        const pattern = /[\\/:*?"<>|]/g;
        const filename = `${this.expression}.png`.replace(pattern, "-");
        const filePath = vscode.Uri.joinPath(storageUri, session_dir_name, break_dir_name, filename);
        console.log("filePath", filePath);

        // hicont image path
        const filenameHicont = `${this.expression}.hicont.png`.replace(pattern, "-");
        const filePathHicont = vscode.Uri.joinPath(storageUri, session_dir_name, break_dir_name, filenameHicont);

        // Ensure directory exists
        const dirPath = path.dirname(filePath.fsPath);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        // Build sharp input from the normalised uint8 raw buffer
        const sharpInput = sharp(rawBuffer, {
            raw: {
                width: mem_width,
                height: mem_height,
                channels: channels as 1 | 2 | 3 | 4,
            }
        });

        console.log("toFile creating images (parallel)", this.expression, filePath.fsPath);

        // Write original and contrast-enhanced (hicont) images in parallel
        await Promise.all([
            sharpInput.clone().toFile(filePath.fsPath),
            sharpInput.clone().normalize().toFile(filePathHicont.fsPath),
        ]);

        console.log("toFile images written", this.expression);

        // Calc image hash from raw buffer (fast, already in memory)
        this.imageHash = crypto.createHash('md5').update(rawBuffer).digest('hex');

        this.metaWide = {
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

        // Save .meta.json
        const metaPath = vscode.Uri.joinPath(storageUri, session_dir_name, break_dir_name, `${filename}.meta.json`);
        fs.writeFileSync(metaPath.fsPath, JSON.stringify(this.metaWide, null, 4));

        return this.metaWide;
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
