/**
 * Integration tests for image processing with Sharp
 *
 * Tests PNG generation, parallel processing, hash generation, and metadata.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import sharp from 'sharp';
import { ImageVariable } from '../../variable/imageVariable';
import { VariableTypeFactory } from '../../variable/variableTypeFactory';
import { DebugSessionTracker } from '../../variable/debugSessionTracker';
import { DebugVariable } from '../../variable/debugVariable';
import { createMockSession, createMockContext } from './mockHelpers';

suite('Image Processing Integration Tests', () => {

    setup(() => {
        DebugSessionTracker.breakCount = 0;
        DebugSessionTracker.trackers = [];
        DebugSessionTracker.currentTracker = undefined;
    });

    function buildImageVariable(
        frame: any,
        varName: string,
        width: number,
        height: number,
        pixelData: Buffer
    ): ImageVariable {
        const imageType = VariableTypeFactory.MyImageType;

        const varMeta = {
            name: varName,
            evaluateName: varName,
            type: 'MyImage',
            value: '',
            variablesReference: 100,
            memoryReference: '0xdeadbeef',
        };

        const imageVar = frame.addVariable(varMeta, imageType) as ImageVariable;

        imageVar.value = [
            new DebugVariable(frame, {
                name: 'width',
                evaluateName: `${varName}.width`,
                type: 'int',
                value: String(width),
                variablesReference: 0,
            }),
            new DebugVariable(frame, {
                name: 'height',
                evaluateName: `${varName}.height`,
                type: 'int',
                value: String(height),
                variablesReference: 0,
            }),
            new DebugVariable(frame, {
                name: 'data',
                evaluateName: `${varName}.data`,
                type: 'unsigned char *',
                value: '0x7f1234abcd ',
                variablesReference: 0,
            }),
        ];

        return imageVar;
    }

    test('toFile creates both original and hicont PNG files', async () => {
        // Create 8x8 gradient image
        const pixels = Buffer.alloc(8 * 8);
        for (let i = 0; i < 64; i++) {
            pixels[i] = Math.floor((i / 63) * 255);
        }

        const mockContext = createMockContext();
        const base64Data = pixels.toString('base64');

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

        const imageVar = buildImageVariable(frame, 'testImg', 8, 8, pixels);

        const result = await imageVar.toFile();

        assert.ok(result !== undefined, 'toFile should return metadata');
        assert.ok(fs.existsSync(result.vscode.filePath), 'Original PNG should exist');
        assert.ok(fs.existsSync(result.vscode.filePathHicont), 'Hicont PNG should exist');

        // Verify both files are valid PNGs
        const originalMeta = await sharp(result.vscode.filePath).metadata();
        const hicontMeta = await sharp(result.vscode.filePathHicont).metadata();

        assert.strictEqual(originalMeta.width, 8);
        assert.strictEqual(originalMeta.height, 8);
        assert.strictEqual(hicontMeta.width, 8);
        assert.strictEqual(hicontMeta.height, 8);
    });

    test('MD5 hash is computed from pixel data', async () => {
        const pixels = Buffer.alloc(4 * 4, 128);

        const mockContext = createMockContext();
        const base64Data = pixels.toString('base64');

        const mockSession = createMockSession(async (cmd: string) => {
            if (cmd === 'readMemory') {
                return { data: base64Data };
            }
            return undefined;
        });

        DebugSessionTracker.newSessionTracker(mockContext, mockSession);
        const tracker = DebugSessionTracker.currentTracker!;
        const thread = tracker.addThread(1, []);
        const frame = thread.addFrame(1, [], { id: 1, name: 'main', line: 10 });

        const imageVar = buildImageVariable(frame, 'img', 4, 4, pixels);
        const result = await imageVar.toFile();

        assert.ok(result !== undefined);
        assert.ok(typeof result.imageHash === 'string');
        assert.strictEqual(result.imageHash.length, 32, 'MD5 hash should be 32 hex chars');
        assert.ok(/^[0-9a-f]{32}$/.test(result.imageHash), 'Should be valid MD5 hex');
    });

    test('metadata JSON file is created', async () => {
        const pixels = Buffer.alloc(4 * 4, 100);

        const mockContext = createMockContext();
        const base64Data = pixels.toString('base64');

        const mockSession = createMockSession(async (cmd: string) => {
            if (cmd === 'readMemory') {
                return { data: base64Data };
            }
            return undefined;
        });

        DebugSessionTracker.newSessionTracker(mockContext, mockSession);
        const tracker = DebugSessionTracker.currentTracker!;
        const thread = tracker.addThread(1, []);
        const frame = thread.addFrame(1, [], { id: 1, name: 'main', line: 10 });

        const imageVar = buildImageVariable(frame, 'img', 4, 4, pixels);
        const result = await imageVar.toFile();

        assert.ok(result !== undefined);

        // Check metadata file exists
        const metaPath = result.vscode.filePath + '.meta.json';
        assert.ok(fs.existsSync(metaPath), 'Metadata JSON should exist');

        // Parse and verify metadata structure
        const metaJson = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        assert.ok(metaJson.vscode !== undefined);
        assert.ok(metaJson.imageInfo !== undefined);
        assert.ok(metaJson.imageHash !== undefined);
        assert.strictEqual(metaJson.imageInfo.mem_width, 4);
        assert.strictEqual(metaJson.imageInfo.mem_height, 4);
    });

    test('parallel processing: multiple images generate all files', async function() {
        this.timeout(5000);  // Allow time for parallel sharp processing

        const mockContext = createMockContext();

        // Create 3 different images
        const pixels1 = Buffer.alloc(4 * 4, 50);
        const pixels2 = Buffer.alloc(4 * 4, 100);
        const pixels3 = Buffer.alloc(4 * 4, 150);

        const mockSession = createMockSession(async (cmd: string, args: any) => {
            if (cmd === 'readMemory') {
                // Return different data based on memory address
                // (In practice, this would be more sophisticated)
                return { data: pixels1.toString('base64') };
            }
            return undefined;
        });

        DebugSessionTracker.newSessionTracker(mockContext, mockSession);
        const tracker = DebugSessionTracker.currentTracker!;
        const thread = tracker.addThread(1, []);
        const frame = thread.addFrame(1, [], { id: 1, name: 'main', line: 10 });

        const img1 = buildImageVariable(frame, 'img1', 4, 4, pixels1);
        const img2 = buildImageVariable(frame, 'img2', 4, 4, pixels2);
        const img3 = buildImageVariable(frame, 'img3', 4, 4, pixels3);

        // Process in parallel (simulating tracker.ts behavior)
        const results = await Promise.all([
            img1.toFile(),
            img2.toFile(),
            img3.toFile(),
        ]);

        // Verify all succeeded
        assert.strictEqual(results.length, 3);
        assert.ok(results.every(r => r !== undefined), 'All images should process successfully');

        // Verify all files exist
        for (const result of results) {
            if (result) {
                assert.ok(fs.existsSync(result.vscode.filePath));
                assert.ok(fs.existsSync(result.vscode.filePathHicont));
            }
        }
    });

    test('different pixel values produce different hashes', async () => {
        const pixels1 = Buffer.alloc(4 * 4, 100);
        const pixels2 = Buffer.alloc(4 * 4, 200);

        const mockContext1 = createMockContext();
        const mockContext2 = createMockContext();

        const mockSession1 = createMockSession(async (cmd: string) => {
            if (cmd === 'readMemory') {return { data: pixels1.toString('base64') };}
            return undefined;
        });

        const mockSession2 = createMockSession(async (cmd: string) => {
            if (cmd === 'readMemory') {return { data: pixels2.toString('base64') };}
            return undefined;
        });

        // First image
        DebugSessionTracker.newSessionTracker(mockContext1, mockSession1);
        let tracker = DebugSessionTracker.currentTracker!;
        let thread = tracker.addThread(1, []);
        let frame = thread.addFrame(1, [], { id: 1, name: 'main', line: 10 });
        const img1 = buildImageVariable(frame, 'img1', 4, 4, pixels1);
        const result1 = await img1.toFile();

        // Reset for second image
        DebugSessionTracker.newSessionTracker(mockContext2, mockSession2);
        tracker = DebugSessionTracker.currentTracker!;
        thread = tracker.addThread(1, []);
        frame = thread.addFrame(1, [], { id: 1, name: 'main', line: 10 });
        const img2 = buildImageVariable(frame, 'img2', 4, 4, pixels2);
        const result2 = await img2.toFile();

        assert.ok(result1 !== undefined && result2 !== undefined);
        assert.notStrictEqual(result1.imageHash, result2.imageHash,
            'Different pixel data should produce different MD5 hashes');
    });
});
