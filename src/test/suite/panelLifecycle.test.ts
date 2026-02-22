/**
 * Integration tests for panel lifecycle management
 *
 * Tests the interaction between VariableTracker and VariableViewPanel,
 * particularly around debug session termination and panel state management.
 */

import * as assert from 'assert';
import { VariableTracker } from '../../tracker';
import { VariableViewPanel } from '../../panel';
import { createMockContext } from './mockHelpers';

suite('Panel Lifecycle Integration Tests', () => {

    let tracker: VariableTracker;
    let mockContext: any;

    setup(() => {
        mockContext = createMockContext();
        tracker = new VariableTracker(mockContext);
    });

    teardown(() => {
        // Clean up panels
        if (VariableViewPanel.currentPanel) {
            VariableViewPanel.currentPanel.dispose();
        }
    });

    test('terminated event triggers panel clear', async () => {
        // 1. Create a panel (simulating a debug session with breakpoint)
        VariableViewPanel.render(mockContext);
        const panel = VariableViewPanel.currentPanel!;
        assert.ok(panel !== undefined, 'Panel should be created');

        // 2. Spy on postMessage to detect clear command
        let clearMessageReceived = false;
        const originalPostMessage = panel.postMessage.bind(panel);
        panel.postMessage = (message: any) => {
            if (message.command === 'clear') {
                clearMessageReceived = true;
            }
            originalPostMessage(message);
        };

        // 3. Send terminated event
        const terminatedMessage = {
            type: 'event',
            event: 'terminated',
            body: {}
        };

        await tracker.onDidSendMessage(terminatedMessage);

        // 4. Verify clear was triggered
        assert.strictEqual(clearMessageReceived, true,
            'Panel should receive clear command when debug session terminates');
    });

    test('panel can be created and disposed multiple times', () => {
        // First lifecycle
        VariableViewPanel.render(mockContext);
        assert.ok(VariableViewPanel.currentPanel !== undefined);
        (VariableViewPanel.currentPanel as any).dispose();
        assert.strictEqual(VariableViewPanel.currentPanel, undefined);

        // Second lifecycle
        VariableViewPanel.render(mockContext);
        assert.ok(VariableViewPanel.currentPanel !== undefined);
        (VariableViewPanel.currentPanel as any).dispose();
        assert.strictEqual(VariableViewPanel.currentPanel, undefined);
    });

    test('clearPanel is safe to call when panel does not exist', () => {
        assert.strictEqual(VariableViewPanel.currentPanel, undefined);

        // Should not throw
        assert.doesNotThrow(() => {
            VariableViewPanel.clearPanel();
        });
    });

    test('multiple render calls reuse same panel instance', () => {
        VariableViewPanel.render(mockContext);
        const panel1 = VariableViewPanel.currentPanel;

        VariableViewPanel.render(mockContext);
        const panel2 = VariableViewPanel.currentPanel;

        VariableViewPanel.render(mockContext);
        const panel3 = VariableViewPanel.currentPanel;

        assert.strictEqual(panel1, panel2, 'Second render should reuse panel');
        assert.strictEqual(panel2, panel3, 'Third render should reuse panel');
    });

    test('sendInstanceMessage works with panel lifecycle', (done) => {
        VariableViewPanel.render(mockContext);
        const panel = VariableViewPanel.currentPanel!;

        let messageReceived: any = null;
        const originalPostMessage = panel.postMessage.bind(panel);
        panel.postMessage = (message: any) => {
            messageReceived = message;
            originalPostMessage(message);
        };

        VariableViewPanel.sendInstanceMessage('WAIT FOR IMAGES...');

        setImmediate(() => {
            assert.ok(messageReceived !== null);
            assert.strictEqual(messageReceived.command, 'instant-message');
            assert.strictEqual(messageReceived.message, 'WAIT FOR IMAGES...');
            done();
        });
    });

    test('panel persists across multiple breakpoint events', () => {
        // First breakpoint
        VariableViewPanel.render(mockContext, 'image-panel');
        const panel1 = VariableViewPanel.currentPanel;
        assert.ok(panel1 !== undefined);

        // Second breakpoint (panel should be revealed, not recreated)
        VariableViewPanel.render(mockContext, 'image-panel');
        const panel2 = VariableViewPanel.currentPanel;

        assert.strictEqual(panel1, panel2,
            'Panel should persist and be reused across multiple breakpoints');
    });

    test('dispose cleans up panel reference immediately', () => {
        VariableViewPanel.render(mockContext);
        assert.ok(VariableViewPanel.currentPanel !== undefined);

        VariableViewPanel.currentPanel.dispose();

        // Should be immediately undefined, not on next tick
        assert.strictEqual(VariableViewPanel.currentPanel, undefined,
            'currentPanel should be cleared synchronously on dispose');
    });
});
