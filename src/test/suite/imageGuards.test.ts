/**
 * Integration tests for ImageVariable.toFile() guard logic.
 *
 * Scenario: edge2_MyImage.c L111 — `MyImage edge = edge_detection(&img);`
 *
 * At that line, 'edge' is declared but not yet assigned, so its struct
 * members contain arbitrary stack garbage.  The guards added in the
 * claude/improvements branch must silently skip such variables instead of
 * forwarding a huge byte-count to GDB's readMemory which crashes the DAP
 * server.
 *
 * These tests build the DebugSessionTracker → DebugThread → DebugFrame →
 * ImageVariable hierarchy manually and inject a mock DebugSession so that
 * no real debugger or C compiler is required.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import { DebugSessionTracker } from '../../variable/debugSessionTracker';
import { DebugVariable } from '../../variable/debugVariable';
import { ImageVariable } from '../../variable/imageVariable';
import { VariableTypeFactory } from '../../variable/variableTypeFactory';
import { createMockSession, createMockContext } from './mockHelpers';

// ---------------------------------------------------------------------------
// Helper: build an ImageVariable whose struct children supply the given
// width / height / data-pointer values (mimicking GDB's variables response).
// ---------------------------------------------------------------------------
function buildImageVariable(
    frame: any,          // DebugFrame — typed as any to avoid importing private internals
    varName: string,
    width: string,       // string values as GDB returns them
    height: string,
    dataPointer: string, // e.g. "0x7f1234abcd" or "0x0"
): ImageVariable {
    const imageType = VariableTypeFactory.MyImageType;

    const varMeta = {
        name: varName,
        evaluateName: varName,
        type: 'MyImage',
        value: '',
        variablesReference: 100,
        memoryReference: '0xdeadbeef',  // struct's own address (not the pixel buffer)
    };

    const imageVar = frame.addVariable(varMeta, imageType) as ImageVariable;

    // GDB gives us the pointer value as "<hex> " or "<hex> <symbol>".
    // We append a space to simulate the typical GDB output.
    const dataPtrValue = dataPointer + ' ';

    // Replace the placeholder value with mock child variables (struct members).
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
            value: dataPtrValue,
            variablesReference: 0,
        }),
    ];

    return imageVar;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
suite('ImageVariable guard (uninitialized struct at breakpoint)', () => {

    setup(() => {
        // Reset static state between tests
        DebugSessionTracker.breakCount = 0;
        DebugSessionTracker.trackers = [];
        DebugSessionTracker.currentTracker = undefined;
    });

    // -- Helper that wires up session / thread / frame ------------------------
    function buildFrame(readMemoryImpl: (args: any) => Promise<any>) {
        const mockContext = createMockContext();
        const mockSession = createMockSession(async (cmd: string, args: any) => {
            if (cmd === 'readMemory') { return readMemoryImpl(args); }
            return undefined;
        });
        DebugSessionTracker.newSessionTracker(mockContext, mockSession);
        const tracker = DebugSessionTracker.currentTracker!;
        const thread = tracker.addThread(1, []);
        return thread.addFrame(1, [], { id: 1, name: 'main', line: 111 });
    }

    // -----------------------------------------------------------------------
    // 1. Core regression: uninitialized 'edge' at L111 of edge2_MyImage.c
    // -----------------------------------------------------------------------
    test('skips uninitialized variable with negative width/height (L111 regression)', async () => {
        let readMemoryCalled = false;
        const frame = buildFrame(async () => {
            readMemoryCalled = true;
            throw new Error('readMemory must NOT be called for uninitialized variable');
        });

        // Typical stack-garbage values seen in practice
        const edgeVar = buildImageVariable(frame, 'edge', '-1073741824', '32767', '0x7ffe12345678');

        const result = await edgeVar.toFile();

        assert.strictEqual(result, undefined, 'Uninitialized variable should be skipped (return undefined)');
        assert.strictEqual(readMemoryCalled, false, 'readMemory must not be called when dimensions are garbage');
    });

    // -----------------------------------------------------------------------
    // 2. Zero dimensions
    // -----------------------------------------------------------------------
    test('skips variable with zero width and height', async () => {
        let readMemoryCalled = false;
        const frame = buildFrame(async () => { readMemoryCalled = true; return undefined; });

        const edgeVar = buildImageVariable(frame, 'edge', '0', '0', '0x7f00001234');

        const result = await edgeVar.toFile();
        assert.strictEqual(result, undefined, 'Zero-dimension variable should be skipped');
        assert.strictEqual(readMemoryCalled, false);
    });

    // -----------------------------------------------------------------------
    // 3. Oversized dimensions (> 32768 px per side)
    // -----------------------------------------------------------------------
    test('skips variable whose dimensions exceed the 32 K-pixel limit', async () => {
        let readMemoryCalled = false;
        const frame = buildFrame(async () => { readMemoryCalled = true; return undefined; });

        // 100000 × 100000 would be > 256 MiB — guard must reject it
        const edgeVar = buildImageVariable(frame, 'edge', '100000', '100000', '0x7f00001234');

        const result = await edgeVar.toFile();
        assert.strictEqual(result, undefined, 'Oversized dimensions should be skipped');
        assert.strictEqual(readMemoryCalled, false);
    });

    // -----------------------------------------------------------------------
    // 4. Null data pointer
    // -----------------------------------------------------------------------
    test('skips variable with null data pointer (0x0)', async () => {
        let readMemoryCalled = false;
        const frame = buildFrame(async () => { readMemoryCalled = true; return undefined; });

        // Valid dimensions but data pointer is NULL
        const imgVar = buildImageVariable(frame, 'img', '64', '64', '0x0');

        const result = await imgVar.toFile();
        assert.strictEqual(result, undefined, 'Null-pointer variable should be skipped');
        assert.strictEqual(readMemoryCalled, false, 'readMemory must not be called for a null pointer');
    });

    // -----------------------------------------------------------------------
    // 5. Happy path: initialized variable produces a PNG file and metadata
    // -----------------------------------------------------------------------
    test('processes valid initialized MyImage and writes a PNG file', async () => {
        // Create a synthetic 4×4 grayscale image (16 bytes, uniform mid-gray)
        const pixels = Buffer.alloc(4 * 4, 128);
        const base64Data = pixels.toString('base64');

        let readMemoryArgs: any = null;
        const frame = buildFrame(async (args: any) => {
            readMemoryArgs = args;
            return { data: base64Data };
        });

        const imgVar = buildImageVariable(frame, 'img', '4', '4', '0x7f1234abcd');

        const result = await imgVar.toFile();

        assert.ok(result !== undefined, 'Valid initialized image should produce a metadata object');
        assert.strictEqual(result.imageInfo.mem_width, 4);
        assert.strictEqual(result.imageInfo.mem_height, 4);
        assert.ok(typeof result.imageHash === 'string' && result.imageHash.length > 0,
            'imageHash should be a non-empty MD5 hex string');
        assert.ok(fs.existsSync(result.vscode.filePath),
            'PNG file should exist on disk');
        assert.ok(fs.existsSync(result.vscode.filePathHicont),
            'Contrast-enhanced (hicont) PNG file should exist on disk');

        // Verify readMemory was called with the correct address
        assert.ok(readMemoryArgs !== null, 'readMemory should have been called');
        assert.strictEqual(readMemoryArgs.memoryReference, '0x7f1234abcd');
        assert.strictEqual(readMemoryArgs.count, 16); // 4*4*1*1
    });

    // -----------------------------------------------------------------------
    // 6. readMemory failure is handled gracefully
    // -----------------------------------------------------------------------
    test('returns undefined when readMemory throws (e.g. inaccessible address)', async () => {
        const frame = buildFrame(async () => {
            throw new Error('Cannot access memory at address 0xdeadc0de');
        });

        const imgVar = buildImageVariable(frame, 'img', '10', '10', '0xdeadc0de');

        const result = await imgVar.toFile();
        assert.strictEqual(result, undefined, 'readMemory failure should return undefined, not throw');
    });
});
