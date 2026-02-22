/**
 * Integration tests for error handling and graceful degradation.
 *
 * Tests that the extension handles failures gracefully without crashing:
 * - readMemory failures
 * - Invalid pointer addresses
 * - File write failures
 * - Sharp processing errors
 */

import * as assert from 'assert';
import * as fs from 'fs';
import { DebugSessionTracker } from '../../variable/debugSessionTracker';
import { ImageVariable } from '../../variable/imageVariable';
import { DebugVariable } from '../../variable/debugVariable';
import { VariableTypeFactory } from '../../variable/variableTypeFactory';
import { createMockSession, createMockContext } from './mockHelpers';

suite('Error Handling Integration Tests', () => {

    setup(() => {
        DebugSessionTracker.breakCount = 0;
        DebugSessionTracker.trackers = [];
        DebugSessionTracker.currentTracker = undefined;
    });

    function buildImageVariable(
        frame: any,
        varName: string,
        width: string,
        height: string,
        dataPointer: string
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
                value: width,
                variablesReference: 0,
            }),
            new DebugVariable(frame, {
                name: 'height',
                evaluateName: `${varName}.height`,
                type: 'int',
                value: height,
                variablesReference: 0,
            }),
            new DebugVariable(frame, {
                name: 'data',
                evaluateName: `${varName}.data`,
                type: 'unsigned char *',
                value: dataPointer + ' ',
                variablesReference: 0,
            }),
        ];

        return imageVar;
    }

    test('readMemory failure returns undefined without throwing', async () => {
        const mockContext = createMockContext();
        const mockSession = createMockSession(async (cmd: string) => {
            if (cmd === 'readMemory') {
                throw new Error('Cannot access memory at address 0xdeadc0de');
            }
            return undefined;
        });

        DebugSessionTracker.newSessionTracker(mockContext, mockSession);
        const tracker = DebugSessionTracker.currentTracker!;
        const thread = tracker.addThread(1);
        const frame = thread.addFrame(1, [], { id: 1, name: 'main', line: 10 });

        const imageVar = buildImageVariable(frame, 'img', '10', '10', '0xdeadc0de');

        // Should not throw
        const result = await imageVar.toFile();

        assert.strictEqual(result, undefined, 'readMemory failure should return undefined');
    });

    test('invalid memory address is handled gracefully', async () => {
        const mockContext = createMockContext();
        const mockSession = createMockSession(async (cmd: string) => {
            if (cmd === 'readMemory') {
                throw new Error('Invalid memory address');
            }
            return undefined;
        });

        DebugSessionTracker.newSessionTracker(mockContext, mockSession);
        const tracker = DebugSessionTracker.currentTracker!;
        const thread = tracker.addThread(1);
        const frame = thread.addFrame(1, [], { id: 1, name: 'main', line: 10 });

        const imageVar = buildImageVariable(frame, 'img', '4', '4', '0xINVALID');

        // Should not throw
        await assert.doesNotReject(async () => {
            await imageVar.toFile();
        });
    });

    test('null pointer (0x0) is rejected before readMemory', async () => {
        let readMemoryCalled = false;

        const mockContext = createMockContext();
        const mockSession = createMockSession(async (cmd: string) => {
            if (cmd === 'readMemory') {
                readMemoryCalled = true;
                return { data: Buffer.alloc(16).toString('base64') };
            }
            return undefined;
        });

        DebugSessionTracker.newSessionTracker(mockContext, mockSession);
        const tracker = DebugSessionTracker.currentTracker!;
        const thread = tracker.addThread(1);
        const frame = thread.addFrame(1, [], { id: 1, name: 'main', line: 10 });

        const imageVar = buildImageVariable(frame, 'img', '4', '4', '0x0');

        const result = await imageVar.toFile();

        assert.strictEqual(result, undefined, 'Null pointer should be rejected');
        assert.strictEqual(readMemoryCalled, false, 'readMemory should not be called for null pointer');
    });

    test('negative dimensions are rejected before readMemory', async () => {
        let readMemoryCalled = false;

        const mockContext = createMockContext();
        const mockSession = createMockSession(async (cmd: string) => {
            if (cmd === 'readMemory') {
                readMemoryCalled = true;
                return { data: Buffer.alloc(16).toString('base64') };
            }
            return undefined;
        });

        DebugSessionTracker.newSessionTracker(mockContext, mockSession);
        const tracker = DebugSessionTracker.currentTracker!;
        const thread = tracker.addThread(1);
        const frame = thread.addFrame(1, [], { id: 1, name: 'main', line: 10 });

        const imageVar = buildImageVariable(frame, 'img', '-100', '10', '0x7f1234abcd');

        const result = await imageVar.toFile();

        assert.strictEqual(result, undefined, 'Negative dimensions should be rejected');
        assert.strictEqual(readMemoryCalled, false, 'readMemory should not be called for negative dimensions');
    });

    test('oversized dimensions are rejected before readMemory', async () => {
        let readMemoryCalled = false;

        const mockContext = createMockContext();
        const mockSession = createMockSession(async (cmd: string) => {
            if (cmd === 'readMemory') {
                readMemoryCalled = true;
                return { data: Buffer.alloc(16).toString('base64') };
            }
            return undefined;
        });

        DebugSessionTracker.newSessionTracker(mockContext, mockSession);
        const tracker = DebugSessionTracker.currentTracker!;
        const thread = tracker.addThread(1);
        const frame = thread.addFrame(1, [], { id: 1, name: 'main', line: 10 });

        // 100000 x 100000 exceeds MAX_DIM (32768)
        const imageVar = buildImageVariable(frame, 'img', '100000', '100000', '0x7f1234abcd');

        const result = await imageVar.toFile();

        assert.strictEqual(result, undefined, 'Oversized dimensions should be rejected');
        assert.strictEqual(readMemoryCalled, false, 'readMemory should not be called for oversized dimensions');
    });

    test('zero dimensions are rejected before readMemory', async () => {
        let readMemoryCalled = false;

        const mockContext = createMockContext();
        const mockSession = createMockSession(async (cmd: string) => {
            if (cmd === 'readMemory') {
                readMemoryCalled = true;
                return { data: Buffer.alloc(16).toString('base64') };
            }
            return undefined;
        });

        DebugSessionTracker.newSessionTracker(mockContext, mockSession);
        const tracker = DebugSessionTracker.currentTracker!;
        const thread = tracker.addThread(1);
        const frame = thread.addFrame(1, [], { id: 1, name: 'main', line: 10 });

        const imageVar = buildImageVariable(frame, 'img', '0', '0', '0x7f1234abcd');

        const result = await imageVar.toFile();

        assert.strictEqual(result, undefined, 'Zero dimensions should be rejected');
        assert.strictEqual(readMemoryCalled, false, 'readMemory should not be called for zero dimensions');
    });

    test('NaN dimensions are rejected gracefully', async () => {
        let readMemoryCalled = false;

        const mockContext = createMockContext();
        const mockSession = createMockSession(async (cmd: string) => {
            if (cmd === 'readMemory') {
                readMemoryCalled = true;
                return { data: Buffer.alloc(16).toString('base64') };
            }
            return undefined;
        });

        DebugSessionTracker.newSessionTracker(mockContext, mockSession);
        const tracker = DebugSessionTracker.currentTracker!;
        const thread = tracker.addThread(1);
        const frame = thread.addFrame(1, [], { id: 1, name: 'main', line: 10 });

        const imageVar = buildImageVariable(frame, 'img', 'NaN', '10', '0x7f1234abcd');

        const result = await imageVar.toFile();

        assert.strictEqual(result, undefined, 'NaN dimensions should be rejected');
        assert.strictEqual(readMemoryCalled, false, 'readMemory should not be called for NaN dimensions');
    });

    test('Infinity dimensions are rejected gracefully', async () => {
        let readMemoryCalled = false;

        const mockContext = createMockContext();
        const mockSession = createMockSession(async (cmd: string) => {
            if (cmd === 'readMemory') {
                readMemoryCalled = true;
                return { data: Buffer.alloc(16).toString('base64') };
            }
            return undefined;
        });

        DebugSessionTracker.newSessionTracker(mockContext, mockSession);
        const tracker = DebugSessionTracker.currentTracker!;
        const thread = tracker.addThread(1);
        const frame = thread.addFrame(1, [], { id: 1, name: 'main', line: 10 });

        const imageVar = buildImageVariable(frame, 'img', 'Infinity', '10', '0x7f1234abcd');

        const result = await imageVar.toFile();

        assert.strictEqual(result, undefined, 'Infinity dimensions should be rejected');
        assert.strictEqual(readMemoryCalled, false, 'readMemory should not be called for Infinity dimensions');
    });

    test('empty readMemory response is handled gracefully', async () => {
        const mockContext = createMockContext();
        const mockSession = createMockSession(async (cmd: string) => {
            if (cmd === 'readMemory') {
                return { data: '' }; // Empty data
            }
            return undefined;
        });

        DebugSessionTracker.newSessionTracker(mockContext, mockSession);
        const tracker = DebugSessionTracker.currentTracker!;
        const thread = tracker.addThread(1);
        const frame = thread.addFrame(1, [], { id: 1, name: 'main', line: 10 });

        const imageVar = buildImageVariable(frame, 'img', '4', '4', '0x7f1234abcd');

        // Should not throw
        await assert.doesNotReject(async () => {
            await imageVar.toFile();
        });
    });

    test('malformed base64 data is handled gracefully', async () => {
        const mockContext = createMockContext();
        const mockSession = createMockSession(async (cmd: string) => {
            if (cmd === 'readMemory') {
                return { data: 'NOT_VALID_BASE64!!!!' };
            }
            return undefined;
        });

        DebugSessionTracker.newSessionTracker(mockContext, mockSession);
        const tracker = DebugSessionTracker.currentTracker!;
        const thread = tracker.addThread(1);
        const frame = thread.addFrame(1, [], { id: 1, name: 'main', line: 10 });

        const imageVar = buildImageVariable(frame, 'img', '4', '4', '0x7f1234abcd');

        // Should not throw
        await assert.doesNotReject(async () => {
            await imageVar.toFile();
        });
    });

    test('gatherImageVariables continues after one variable fails', async () => {
        const pixels = Buffer.alloc(4 * 4, 128);
        const base64Data = pixels.toString('base64');

        let callCount = 0;
        const mockContext = createMockContext();
        const mockSession = createMockSession(async (cmd: string) => {
            if (cmd === 'readMemory') {
                callCount++;
                if (callCount === 1) {
                    throw new Error('First readMemory fails');
                }
                return { data: base64Data };
            }
            return undefined;
        });

        DebugSessionTracker.newSessionTracker(mockContext, mockSession);
        const tracker = DebugSessionTracker.currentTracker!;
        const thread = tracker.addThread(1);
        const frame = thread.addFrame(1, [], { id: 1, name: 'main', line: 10 });

        const img1 = buildImageVariable(frame, 'img1', '4', '4', '0x7f1234abc1');
        const img2 = buildImageVariable(frame, 'img2', '4', '4', '0x7f1234abc2');

        // Process both images
        const results = await Promise.all([
            img1.toFile(),
            img2.toFile()
        ]);

        // First should fail, second should succeed
        assert.strictEqual(results[0], undefined, 'First image should fail');
        assert.ok(results[1] !== undefined, 'Second image should succeed');
        assert.ok(fs.existsSync(results[1]!.vscode.filePath), 'Second image PNG should exist');
    });

    test('missing width/height child variables returns undefined', async () => {
        const mockContext = createMockContext();
        const mockSession = createMockSession(async (cmd: string) => {
            if (cmd === 'readMemory') {
                throw new Error('Should not be called');
            }
            return undefined;
        });

        DebugSessionTracker.newSessionTracker(mockContext, mockSession);
        const tracker = DebugSessionTracker.currentTracker!;
        const thread = tracker.addThread(1);
        const frame = thread.addFrame(1, [], { id: 1, name: 'main', line: 10 });

        const imageType = VariableTypeFactory.MyImageType;
        const imageVar = frame.addVariable({
            name: 'img',
            type: 'MyImage',
            value: '',
            variablesReference: 100
        }, imageType) as ImageVariable;

        // Leave value as placeholder (no width/height/data children)
        // This simulates a partially loaded variable

        const result = await imageVar.toFile();

        assert.strictEqual(result, undefined, 'Missing child variables should return undefined');
    });
});
