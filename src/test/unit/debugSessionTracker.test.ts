/**
 * Unit tests for DebugSessionTracker, DebugThread, DebugFrame
 *
 * Tests session/thread/frame hierarchy, variable collection, and tracker management.
 */

import * as assert from 'assert';
import { DebugSessionTracker, DebugThread, DebugFrame } from '../../variable/debugSessionTracker';
import { ImageVariable } from '../../variable/imageVariable';
import { DebugVariable } from '../../variable/debugVariable';
import { VariableTypeFactory } from '../../variable/variableTypeFactory';
import { createMockSession, createMockContext } from '../suite/mockHelpers';

suite('DebugSessionTracker Unit Tests', () => {

    setup(() => {
        // Reset static state before each test
        DebugSessionTracker.breakCount = 0;
        DebugSessionTracker.trackers = [];
        DebugSessionTracker.currentTracker = undefined;
    });

    test('newSessionTracker creates a new tracker with unique ID', () => {
        const mockContext = createMockContext();
        const mockSession = createMockSession(async () => undefined);

        const tracker1 = DebugSessionTracker.newSessionTracker(mockContext, mockSession);
        const tracker2 = DebugSessionTracker.newSessionTracker(mockContext, mockSession);

        assert.ok(tracker1.trackerId !== undefined);
        assert.ok(tracker2.trackerId !== undefined);
        assert.notStrictEqual(tracker1.trackerId, tracker2.trackerId, 'Tracker IDs should be unique');
    });

    test('newSessionTracker sets currentTracker', () => {
        const mockContext = createMockContext();
        const mockSession = createMockSession(async () => undefined);

        const tracker = DebugSessionTracker.newSessionTracker(mockContext, mockSession);

        assert.strictEqual(DebugSessionTracker.currentTracker, tracker);
    });

    test('newSessionTracker adds tracker to trackers array', () => {
        const mockContext = createMockContext();
        const mockSession = createMockSession(async () => undefined);

        const tracker1 = DebugSessionTracker.newSessionTracker(mockContext, mockSession);
        const tracker2 = DebugSessionTracker.newSessionTracker(mockContext, mockSession);

        assert.strictEqual(DebugSessionTracker.trackers.length, 2);
        assert.ok(DebugSessionTracker.trackers.includes(tracker1));
        assert.ok(DebugSessionTracker.trackers.includes(tracker2));
    });

    test('getTrackerById retrieves correct tracker', () => {
        const mockContext = createMockContext();
        const mockSession = createMockSession(async () => undefined);

        const tracker = DebugSessionTracker.newSessionTracker(mockContext, mockSession);
        const trackerId = tracker.trackerId!;

        const retrieved = DebugSessionTracker.getTrackerById(trackerId);

        assert.strictEqual(retrieved, tracker);
    });

    test('getTrackerById returns undefined for non-existent ID', () => {
        const retrieved = DebugSessionTracker.getTrackerById(99999);
        assert.strictEqual(retrieved, undefined);
    });

    test('debugStartDate has correct format', () => {
        const mockContext = createMockContext();
        const mockSession = createMockSession(async () => undefined);

        const tracker = DebugSessionTracker.newSessionTracker(mockContext, mockSession);

        // Format: YYYY-MM-DD_HH-MM-SS-mmm
        const dateRegex = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-\d{3}$/;
        assert.ok(dateRegex.test(tracker.debugStartDate), `Date format should match pattern: ${tracker.debugStartDate}`);
    });

    test('addThread creates and adds a thread', () => {
        const mockContext = createMockContext();
        const mockSession = createMockSession(async () => undefined);
        const tracker = DebugSessionTracker.newSessionTracker(mockContext, mockSession);

        const thread = tracker.addThread(1);

        assert.strictEqual(tracker.threads.length, 1);
        assert.strictEqual(thread.id, 1);
        assert.strictEqual(thread.tracker, tracker);
    });

    test('gatherAllVariables collects variables from all frames', () => {
        const mockContext = createMockContext();
        const mockSession = createMockSession(async () => undefined);
        const tracker = DebugSessionTracker.newSessionTracker(mockContext, mockSession);

        const thread = tracker.addThread(1);
        const frame1 = thread.addFrame(1);
        const frame2 = thread.addFrame(2);

        // Add variables to both frames
        frame1.addVariable({ name: 'var1', type: 'int', value: '10', variablesReference: 0 });
        frame2.addVariable({ name: 'var2', type: 'int', value: '20', variablesReference: 0 });

        const allVariables = tracker.gatherAllVariables();

        assert.strictEqual(allVariables.length, 2);
        assert.ok(allVariables.some(v => v.name === 'var1'));
        assert.ok(allVariables.some(v => v.name === 'var2'));
    });

    test('gatherAllVariables recursively collects nested variables', () => {
        const mockContext = createMockContext();
        const mockSession = createMockSession(async () => undefined);
        const tracker = DebugSessionTracker.newSessionTracker(mockContext, mockSession);

        const thread = tracker.addThread(1);
        const frame = thread.addFrame(1);

        // Add parent variable
        const parent = frame.addVariable({
            name: 'parent',
            type: 'struct',
            value: '',
            variablesReference: 100
        });

        // Add child variables
        parent.value = [
            new DebugVariable(frame, { name: 'child1', type: 'int', value: '1', variablesReference: 0 }),
            new DebugVariable(frame, { name: 'child2', type: 'int', value: '2', variablesReference: 0 })
        ];

        const allVariables = tracker.gatherAllVariables();

        // Should have parent + 2 children = 3 variables
        assert.strictEqual(allVariables.length, 3);
        assert.ok(allVariables.some(v => v.name === 'parent'));
        assert.ok(allVariables.some(v => v.name === 'child1'));
        assert.ok(allVariables.some(v => v.name === 'child2'));
    });

    test('gatherImageVariables filters only ImageVariable instances', () => {
        const mockContext = createMockContext();
        const mockSession = createMockSession(async () => undefined);
        const tracker = DebugSessionTracker.newSessionTracker(mockContext, mockSession);

        const thread = tracker.addThread(1);
        const frame = thread.addFrame(1);

        // Add regular variable
        frame.addVariable({ name: 'var1', type: 'int', value: '10', variablesReference: 0 });

        // Add image variable
        const imageType = VariableTypeFactory.MyImageType;
        frame.addVariable({
            name: 'img',
            type: 'Image',
            value: '',
            variablesReference: 100
        }, imageType);

        const imageVariables = tracker.gatherImageVariables();

        assert.strictEqual(imageVariables.length, 1);
        assert.ok(imageVariables[0] instanceof ImageVariable);
        assert.strictEqual(imageVariables[0].name, 'img');
    });

    test('gatherImageVariables returns empty array when no image variables', () => {
        const mockContext = createMockContext();
        const mockSession = createMockSession(async () => undefined);
        const tracker = DebugSessionTracker.newSessionTracker(mockContext, mockSession);

        const thread = tracker.addThread(1);
        const frame = thread.addFrame(1);
        frame.addVariable({ name: 'var1', type: 'int', value: '10', variablesReference: 0 });

        const imageVariables = tracker.gatherImageVariables();

        assert.strictEqual(imageVariables.length, 0);
    });
});

suite('DebugThread Unit Tests', () => {

    setup(() => {
        DebugSessionTracker.breakCount = 0;
        DebugSessionTracker.trackers = [];
        DebugSessionTracker.currentTracker = undefined;
    });

    test('addFrame creates and adds a frame', () => {
        const mockContext = createMockContext();
        const mockSession = createMockSession(async () => undefined);
        const tracker = DebugSessionTracker.newSessionTracker(mockContext, mockSession);

        const thread = tracker.addThread(1);
        const frame = thread.addFrame(10);

        assert.strictEqual(thread.frames.length, 1);
        assert.strictEqual(frame.id, 10);
        assert.strictEqual(frame.thread, thread);
    });

    test('queryFrame fetches stack frames from session', async () => {
        const mockContext = createMockContext();

        const mockStackFrames = [
            { id: 1, name: 'main', line: 10 },
            { id: 2, name: 'foo', line: 20 }
        ];

        const mockSession = createMockSession(async (cmd: string, args: any) => {
            if (cmd === 'stackTrace') {
                return { stackFrames: mockStackFrames };
            }
            return undefined;
        });

        const tracker = DebugSessionTracker.newSessionTracker(mockContext, mockSession);
        const thread = tracker.addThread(1);

        const frames = await thread.queryFrame();

        assert.ok(frames !== undefined);
        assert.strictEqual(frames.length, 2);
        assert.strictEqual(frames[0].id, 1);
        assert.strictEqual(frames[1].id, 2);
    });

    test('fetchLocalVariablesInFirstFrame retrieves variables from session', async () => {
        const mockContext = createMockContext();

        const mockSession = createMockSession(async (cmd: string, args: any) => {
            if (cmd === 'stackTrace') {
                return { stackFrames: [{ id: 1, name: 'main', line: 10 }] };
            }
            if (cmd === 'scopes') {
                return { scopes: [{ name: 'Locals', variablesReference: 100 }] };
            }
            if (cmd === 'variables') {
                return {
                    variables: [
                        { name: 'x', type: 'int', value: '42', variablesReference: 0 },
                        { name: 'img', type: 'Image', value: '', variablesReference: 200 }
                    ]
                };
            }
            return undefined;
        });

        const tracker = DebugSessionTracker.newSessionTracker(mockContext, mockSession);
        const thread = tracker.addThread(1);

        const variables = await thread.fetchLocalVariablesInFirstFrame();

        assert.ok(variables.length >= 1); // At least one variable fetched
        assert.ok(variables.some((v: DebugVariable) => v.name === 'x' || v.name === 'img'));
    });
});

suite('DebugFrame Unit Tests', () => {

    setup(() => {
        DebugSessionTracker.breakCount = 0;
        DebugSessionTracker.trackers = [];
        DebugSessionTracker.currentTracker = undefined;
    });

    test('addVariable adds DebugVariable for primitive types', () => {
        const mockContext = createMockContext();
        const mockSession = createMockSession(async () => undefined);
        const tracker = DebugSessionTracker.newSessionTracker(mockContext, mockSession);

        const thread = tracker.addThread(1);
        const frame = thread.addFrame(1);

        const variable = frame.addVariable({
            name: 'x',
            type: 'int',
            value: '42',
            variablesReference: 0
        });

        assert.strictEqual(frame.variables.length, 1);
        assert.ok(variable instanceof DebugVariable);
        assert.strictEqual(variable.name, 'x');
    });

    test('addVariable adds ImageVariable when ImageVariableType provided', () => {
        const mockContext = createMockContext();
        const mockSession = createMockSession(async () => undefined);
        const tracker = DebugSessionTracker.newSessionTracker(mockContext, mockSession);

        const thread = tracker.addThread(1);
        const frame = thread.addFrame(1);

        const imageType = VariableTypeFactory.MyImageType;
        const variable = frame.addVariable({
            name: 'img',
            type: 'Image',
            value: '',
            variablesReference: 100
        }, imageType);

        assert.strictEqual(frame.variables.length, 1);
        assert.ok(variable instanceof ImageVariable);
        assert.strictEqual(variable.name, 'img');
    });

    test('variables array maintains insertion order', () => {
        const mockContext = createMockContext();
        const mockSession = createMockSession(async () => undefined);
        const tracker = DebugSessionTracker.newSessionTracker(mockContext, mockSession);

        const thread = tracker.addThread(1);
        const frame = thread.addFrame(1);

        frame.addVariable({ name: 'var1', type: 'int', value: '1', variablesReference: 0 });
        frame.addVariable({ name: 'var2', type: 'int', value: '2', variablesReference: 0 });
        frame.addVariable({ name: 'var3', type: 'int', value: '3', variablesReference: 0 });

        assert.strictEqual(frame.variables[0].name, 'var1');
        assert.strictEqual(frame.variables[1].name, 'var2');
        assert.strictEqual(frame.variables[2].name, 'var3');
    });
});
