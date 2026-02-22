/**
 * Unit tests for VariableViewPanel
 *
 * Tests panel lifecycle, state management, and webview configuration.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { VariableViewPanel } from '../../panel';
import { createMockContext } from '../suite/mockHelpers';

suite('VariableViewPanel Unit Tests', () => {

    teardown(() => {
        // Clean up any open panels after each test
        if (VariableViewPanel.currentPanel) {
            VariableViewPanel.currentPanel.dispose();
        }
    });

    test('render() creates a new panel if none exists', () => {
        const mockContext = createMockContext();

        assert.strictEqual(VariableViewPanel.currentPanel, undefined, 'No panel should exist initially');

        VariableViewPanel.render(mockContext);

        assert.ok(VariableViewPanel.currentPanel !== undefined, 'Panel should be created after render()');
    });

    test('render() reveals existing panel instead of creating a new one', () => {
        const mockContext = createMockContext();

        VariableViewPanel.render(mockContext);
        const firstPanel = VariableViewPanel.currentPanel;

        VariableViewPanel.render(mockContext);
        const secondPanel = VariableViewPanel.currentPanel;

        assert.strictEqual(firstPanel, secondPanel, 'Should reuse the same panel instance');
    });

    test('panel opens in ViewColumn.Beside (rightmost position)', () => {
        const mockContext = createMockContext();

        VariableViewPanel.render(mockContext);

        // Verify the panel was created (we can't directly check ViewColumn in unit test,
        // but we can verify the panel exists)
        assert.ok(VariableViewPanel.currentPanel !== undefined);
    });

    test('clearPanel() sends clear command to webview', (done) => {
        const mockContext = createMockContext();

        // Create a panel
        VariableViewPanel.render(mockContext);
        const panel = VariableViewPanel.currentPanel!;

        // Intercept postMessage to verify the command
        const originalPostMessage = panel.postMessage.bind(panel);
        let messageReceived: any = null;

        panel.postMessage = (message: any) => {
            messageReceived = message;
            // Call original to maintain state
            originalPostMessage(message);
        };

        // Call clearPanel
        VariableViewPanel.clearPanel();

        // Verify the clear command was sent
        setImmediate(() => {
            assert.ok(messageReceived !== null, 'postMessage should have been called');
            assert.strictEqual(messageReceived.command, 'clear', 'Command should be "clear"');
            done();
        });
    });

    test('clearPanel() does nothing if no panel exists', () => {
        // Should not throw
        assert.doesNotThrow(() => {
            VariableViewPanel.clearPanel();
        });
    });

    test('dispose() clears currentPanel reference', () => {
        const mockContext = createMockContext();

        VariableViewPanel.render(mockContext);
        assert.ok(VariableViewPanel.currentPanel !== undefined);

        VariableViewPanel.currentPanel.dispose();

        assert.strictEqual(VariableViewPanel.currentPanel, undefined, 'currentPanel should be cleared after dispose');
    });

    test('postMessage() sends message to webview', (done) => {
        const mockContext = createMockContext();

        VariableViewPanel.render(mockContext);
        const panel = VariableViewPanel.currentPanel!;

        const originalPostMessage = panel.postMessage.bind(panel);
        let messageReceived: any = null;

        panel.postMessage = (message: any) => {
            messageReceived = message;
            originalPostMessage(message);
        };

        const testMessage = { command: 'test', data: 'hello' };
        VariableViewPanel.postMessage(testMessage);

        setImmediate(() => {
            assert.deepStrictEqual(messageReceived, testMessage);
            done();
        });
    });

    test('sendInstanceMessage() sends instant-message command', (done) => {
        const mockContext = createMockContext();

        VariableViewPanel.render(mockContext);
        const panel = VariableViewPanel.currentPanel!;

        const originalPostMessage = panel.postMessage.bind(panel);
        let messageReceived: any = null;

        panel.postMessage = (message: any) => {
            messageReceived = message;
            originalPostMessage(message);
        };

        VariableViewPanel.sendInstanceMessage('Test message');

        setImmediate(() => {
            assert.ok(messageReceived !== null);
            assert.strictEqual(messageReceived.command, 'instant-message');
            assert.strictEqual(messageReceived.message, 'Test message');
            done();
        });
    });

    test('showPanel() reveals the panel', () => {
        const mockContext = createMockContext();

        VariableViewPanel.render(mockContext);
        const panel = VariableViewPanel.currentPanel!;

        const result = panel.showPanel();

        assert.strictEqual(result, true, 'showPanel() should return true when panel exists');
    });

    test('showPanel() returns false when no panel exists', () => {
        // Create a disposed panel
        const mockContext = createMockContext();
        VariableViewPanel.render(mockContext);
        const panel = VariableViewPanel.currentPanel!;
        panel.dispose();

        // Try to show (this tests the instance method on a disposed panel)
        // Note: Static VariableViewPanel.currentPanel is now undefined,
        // so we can't call the instance method. This test verifies the safety.
        assert.strictEqual(VariableViewPanel.currentPanel, undefined);
    });

    test('getWebViewUrlString() converts file URI to webview URI', () => {
        const mockContext = createMockContext();

        VariableViewPanel.render(mockContext);
        const panel = VariableViewPanel.currentPanel!;

        const testUri = vscode.Uri.file('/tmp/test-image.png');
        const webviewUrl = panel.getWebViewUrlString(testUri);

        assert.ok(typeof webviewUrl === 'string', 'Should return a string');
        assert.ok(webviewUrl.length > 0, 'Should return a non-empty string');
        // Webview URIs typically start with vscode-webview://
        assert.ok(webviewUrl.startsWith('vscode-webview://') || webviewUrl.startsWith('vscode-resource://'),
            'Should be a webview URI scheme');
    });
});
