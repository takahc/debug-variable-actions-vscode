import * as vscode from 'vscode';
import { EvalExpression } from "./evalExpression";
import { DebugVariable, DebugVariableType, IbinaryInfo } from "./debugVariable";
import sharp from 'sharp';


export class ImageVariable extends DebugVariable {
    public mem_width: number | undefined;
    public mem_height: number | undefined;
    public image_width: number | undefined;
    public image_height: number | undefined;
    public stride: number | undefined;
    public channels: number | undefined;
    public data: number | undefined;
    public buffer: Buffer | ArrayBufferTypes | undefined;
    public format: string | undefined;

    public byte_for_px: number | undefined;

    async toFile(parent_dir: string, filename?: string) {
        let buffer = this.buffer;
        if (buffer instanceof Buffer) {
            let filename = this.name + ".png";
        }

        /*
        
        
                const readMemory = await vscode.debug.activeDebugSession?.customRequest('readMemory', { memoryReference: startAddress, offset: 0, count: size });
                console.log("readMemory: ", readMemory);
        
        
                let bufferData = Buffer.from(readMemory.data, "base64");
                const off = bytesForPx * channels;
        
        
                // Determine the correct TypedArray based on data characteristics
                const TypedArray = bytesForPx === 1 ? Uint8Array :
                    bytesForPx === 2 ? (isSigned ? Int16Array : Uint16Array) :
                        bytesForPx === 4 ? (isInt ? (isSigned ? Int32Array : Uint32Array) : Float32Array) :
                            Float64Array; // Assuming bytesForPx === 8 for double precision floats
        
                // Create a typed array from the buffer data
                let imageArray = new TypedArray(bufferData.buffer, bufferData.byteOffset, bufferData.byteLength / bytesForPx);
                for (let i = 0; i < height; i++) {
                    for (let j = 0; j < width; j++) {
                        const offset = off * j;
                        let b;
                        if (isInt) {
                            if (isSigned) {
                                b = bufferData.readIntLE(offset, bytesForPx);
                            }
                            else {
                                b = bufferData.readUIntLE(offset, bytesForPx);
                            }
                        }
                        else {
                            if (bytesForPx === 4) {
                                b = bufferData.readFloatLE(offset);
                            }
                            else if (bytesForPx === 8) {
                                b = bufferData.readDoubleLE(offset);
                            }
                            else {
                                throw Error;
                            }
                        }
                        imageArray[i * width + j] = b;
                    }
                }
                console.log("imageArray:", imageArray);
        
        
                const workspaceFolders = vscode.workspace.workspaceFolders;
                const relativePath = `${request.variable.name}.png`;
                // const filePath = workspaceFolders ? vscode.Uri.joinPath(workspaceFolders[0].uri, relativePath) : null;
                const storageUri = context.storageUri ? context.storageUri : context.globalStorageUri;
                const filePath = vscode.Uri.joinPath(storageUri, relativePath);
        
                // Extract the directory path from filePath
                const dirPath = path.dirname(filePath.fsPath);
        
                // Check if the directory exists, if not, create it
                if (!fs.existsSync(dirPath)) {
                    fs.mkdirSync(dirPath, { recursive: true });
                }
        
        
                if (filePath) {
                    // Use Sharp to process the image data
                    await sharp(imageArray, {
                        raw: {
                            width: width,
                            height: height,
                            channels: channels,
                        },
                        create: {
                            width: width,
                            height: height,
                            channels: 3,
                            background: { r: 0, g: 0, b: 0, alpha: 0 },
                        }
                    })
                        .toFile(filePath.fsPath, (err, info) => {
                            if (err) {
                                console.error('Error processing image:', err);
                            } else {
                                console.log('Image processed and saved:', info);
                            }
                        });
        
                    // Display
                    // const openPath = vscode.Uri.file(filePath.toString()).toString().replace("/file:", "");
                    // vscode.commands.executeCommand('vscode.open', filePath.fsPath);
                    let a = filePath.toString();
                    VariableViewPanel.render(context);
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
        */

    }
}


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
    pxType: T,
};

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
            channels: new EvalExpression<number>(imageMetaString?.channels || "0"),
            data: new EvalExpression<string>(imageMetaString?.data || "0X00"),
            format: new EvalExpression<string>(imageMetaString?.format || "RGB"),
            pxType: new EvalExpression<string>(imageMetaString?.pxType || "uint8"),
        };
    }

    evalImageInfo(members: any) {
        const imageInfo: IimageInfo<any> = {
            mem_width: 0,
            mem_height: 0,
            image_width: 0,
            image_height: 0,
            stride: 0,
            channels: 0,
            data: 0X00,
            format: "RGB",
            pxType: "uint8",
        };

        Object.entries(this.imageMeta).forEach(([key, evalExpression]) => {
            imageInfo[key] = evalExpression.eval(members);
        });

        return imageInfo;
    }
}
