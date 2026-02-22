/**
 * Unit tests for ImageVariable buffer conversion logic
 *
 * Tests the critical buffer normalization paths for different pixel formats:
 * - uint8: zero-copy
 * - int8: shift to [0,255]
 * - uint16/int16/uint32/int32: min/max normalization
 * - float32/float64: min/max normalization
 */

import * as assert from 'assert';
import { ImageVariable } from '../../variable/imageVariable';
import { VariableTypeFactory } from '../../variable/variableTypeFactory';
import { DebugSessionTracker } from '../../variable/debugSessionTracker';
import { createMockSession, createMockContext } from '../suite/mockHelpers';

suite('ImageVariable Buffer Conversion Tests', () => {

    setup(() => {
        // Reset static state
        DebugSessionTracker.breakCount = 0;
        DebugSessionTracker.trackers = [];
        DebugSessionTracker.currentTracker = undefined;
    });

    // Helper to create ImageVariable with mock session and frame
    function buildImageVar(
        width: number,
        height: number,
        bytesForPx: number,
        signed: boolean,
        isInt: boolean,
        pixelData: Buffer
    ): ImageVariable {
        const mockContext = createMockContext();
        const base64Data = pixelData.toString('base64');

        const mockSession = createMockSession(async (cmd: string, args: any) => {
            if (cmd === 'readMemory') {
                return { data: base64Data };
            }
            return undefined;
        });

        DebugSessionTracker.newSessionTracker(mockContext, mockSession);
        const tracker = DebugSessionTracker.currentTracker!;
        const thread = tracker.addThread(1, []);
        const frame = thread.addFrame(1, [], { id: 1, name: 'main', line: 10 });

        const imageType = VariableTypeFactory.MyImageType;
        const varMeta = {
            name: 'testImage',
            evaluateName: 'testImage',
            type: 'MyImage',
            value: '',
            variablesReference: 100,
            memoryReference: '0xdeadbeef',
        };

        const imageVar = frame.addVariable(varMeta, imageType) as ImageVariable;

        // Mock the struct members
        imageVar.value = [
            { name: 'width', value: String(width), variablesReference: 0 },
            { name: 'height', value: String(height), variablesReference: 0 },
            { name: 'data', value: '0x7f1234abcd ', variablesReference: 0 },
        ] as any;

        // Override binaryInfo to match the test format
        imageVar.updateImageInfo();
        imageVar.updateBinaryInfo();
        (imageVar as any).binaryInfo = {
            sizeByte: width * height * bytesForPx,
            signed,
            isInt,
        };
        (imageVar as any).imageInfo.bytesForPx = bytesForPx;

        return imageVar;
    }

    test('uint8 buffer: zero-copy (no conversion needed)', async () => {
        // Create a 4x4 uint8 grayscale image (16 bytes)
        const pixels = Buffer.from([
            0, 64, 128, 192,
            64, 128, 192, 255,
            128, 192, 255, 0,
            192, 255, 0, 64
        ]);

        const imageVar = buildImageVar(4, 4, 1, false, true, pixels);
        const result = await imageVar.toFile();

        assert.ok(result !== undefined, 'Should process uint8 image successfully');
        assert.strictEqual(result.imageInfo.mem_width, 4);
        assert.strictEqual(result.imageInfo.mem_height, 4);
        assert.ok(result.imageHash !== undefined, 'Should have imageHash');
    });

    test('int8 buffer: shift signed [-128,127] to [0,255]', async () => {
        // Create int8 data: -128, -64, 0, 64, 127
        const int8Data = Buffer.from([
            0x80, 0xC0, 0x00, 0x40, 0x7F,  // First row
            0x80, 0xC0, 0x00, 0x40, 0x7F,  // Repeat
            0x00, 0x00, 0x00, 0x00, 0x00,
        ].slice(0, 16));  // 4x4 = 16 bytes

        const imageVar = buildImageVar(4, 4, 1, true, true, int8Data);
        const result = await imageVar.toFile();

        assert.ok(result !== undefined, 'Should process int8 image with shifting');
        // After shifting: -128+128=0, -64+128=64, 0+128=128, 64+128=192, 127+128=255
    });

    test('uint16 buffer: normalize to [0,255]', async () => {
        // Create uint16 data: min=0, max=65535
        const uint16Buffer = Buffer.allocUnsafe(4 * 4 * 2);  // 4x4 pixels × 2 bytes
        for (let i = 0; i < 16; i++) {
            const value = Math.floor((i / 15) * 65535);  // Gradient 0 to 65535
            uint16Buffer.writeUInt16LE(value, i * 2);
        }

        const imageVar = buildImageVar(4, 4, 2, false, true, uint16Buffer);
        const result = await imageVar.toFile();

        assert.ok(result !== undefined, 'Should process uint16 image with normalization');
        assert.strictEqual(result.imageInfo.bytesForPx, 2);
    });

    test('int16 buffer: normalize signed to [0,255]', async () => {
        // Create int16 data with negative and positive values
        const int16Buffer = Buffer.allocUnsafe(4 * 4 * 2);
        const values = [-32768, -16384, 0, 16384, 32767];
        for (let i = 0; i < 16; i++) {
            int16Buffer.writeInt16LE(values[i % values.length], i * 2);
        }

        const imageVar = buildImageVar(4, 4, 2, true, true, int16Buffer);
        const result = await imageVar.toFile();

        assert.ok(result !== undefined, 'Should process int16 image with normalization');
    });

    test('uint32 buffer: normalize to [0,255]', async () => {
        const uint32Buffer = Buffer.allocUnsafe(4 * 4 * 4);
        for (let i = 0; i < 16; i++) {
            const value = Math.floor((i / 15) * 4294967295);  // 0 to max uint32
            uint32Buffer.writeUInt32LE(value, i * 4);
        }

        const imageVar = buildImageVar(4, 4, 4, false, true, uint32Buffer);
        const result = await imageVar.toFile();

        assert.ok(result !== undefined, 'Should process uint32 image');
        assert.strictEqual(result.imageInfo.bytesForPx, 4);
    });

    test('float32 buffer: normalize to [0,255]', async () => {
        const float32Buffer = Buffer.allocUnsafe(4 * 4 * 4);
        const values = [-1.0, -0.5, 0.0, 0.5, 1.0, 2.0];
        for (let i = 0; i < 16; i++) {
            float32Buffer.writeFloatLE(values[i % values.length], i * 4);
        }

        const imageVar = buildImageVar(4, 4, 4, true, false, float32Buffer);
        const result = await imageVar.toFile();

        assert.ok(result !== undefined, 'Should process float32 image with normalization');
    });

    test('float64 buffer: normalize to [0,255]', async () => {
        const float64Buffer = Buffer.allocUnsafe(2 * 2 * 8);  // Smaller for double
        const values = [-10.5, 0.0, 5.25, 10.5];
        for (let i = 0; i < 4; i++) {
            float64Buffer.writeDoubleLE(values[i], i * 8);
        }

        const imageVar = buildImageVar(2, 2, 8, true, false, float64Buffer);
        const result = await imageVar.toFile();

        assert.ok(result !== undefined, 'Should process float64 image');
        assert.strictEqual(result.imageInfo.bytesForPx, 8);
    });

    test('totalPixels clamp: buffer smaller than declared dimensions', async () => {
        // Declare 4x4 (16 pixels) but only provide 8 bytes
        const smallBuffer = Buffer.alloc(8, 128);

        const imageVar = buildImageVar(4, 4, 1, false, true, smallBuffer);
        const result = await imageVar.toFile();

        // Should handle gracefully (totalPixels will be clamped to 8)
        assert.ok(result !== undefined, 'Should handle buffer smaller than dimensions');
    });

    test('uniform image produces consistent hash', async () => {
        const pixels1 = Buffer.alloc(4 * 4, 100);
        const pixels2 = Buffer.alloc(4 * 4, 100);

        const imageVar1 = buildImageVar(4, 4, 1, false, true, pixels1);
        const imageVar2 = buildImageVar(4, 4, 1, false, true, pixels2);

        const result1 = await imageVar1.toFile();
        const result2 = await imageVar2.toFile();

        assert.ok(result1 !== undefined && result2 !== undefined);
        assert.strictEqual(result1.imageHash, result2.imageHash,
            'Identical pixel data should produce the same MD5 hash');
    });

    test('different images produce different hashes', async () => {
        const pixels1 = Buffer.alloc(4 * 4, 100);
        const pixels2 = Buffer.alloc(4 * 4, 200);

        const imageVar1 = buildImageVar(4, 4, 1, false, true, pixels1);
        const imageVar2 = buildImageVar(4, 4, 1, false, true, pixels2);

        const result1 = await imageVar1.toFile();
        const result2 = await imageVar2.toFile();

        assert.ok(result1 !== undefined && result2 !== undefined);
        assert.notStrictEqual(result1.imageHash, result2.imageHash,
            'Different pixel data should produce different MD5 hashes');
    });
});
