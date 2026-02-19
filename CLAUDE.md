# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run compile      # Compile TypeScript → out/
npm run watch        # Watch mode (recompiles on change)
npm run lint         # ESLint TypeScript files in src/
npm run test         # Run VSCode extension tests (compiles + lints first)
```

The compiled extension entry point is `./out/extension.js`. The extension activates on `onDebug` events.

## Architecture

This is a VSCode extension that intercepts Debug Adapter Protocol (DAP) messages to detect and visualize image-typed variables in the debug variables view. The core flow is:

**Breakpoint hit → DAP intercept → Variable discovery → Memory read → Image render → Webview panel**

### Source modules (`src/`)

- **`extension.ts`** — Activation, command registration (`start`, `action`, `tocsv`, `topng`, `topanel`), configuration change listener. Commands appear in the debug variables context menu.
- **`tracker.ts`** — `VariableTracker` implements `vscode.DebugAdapterTracker`. Intercepts DAP `stopped` events and drives the image discovery pipeline.
- **`panel.ts`** — `VariableViewPanel` (singleton) manages the webview panel. Uses EJS templates from `panel_html_templates/`. Converts file URIs for webview use and routes messages from the frontend.
- **`variable/debugSessionTracker.ts`** — Builds the session/thread/frame/variable hierarchy by making DAP requests (`threads`, `stackTrace`, `scopes`, `variables`). Recursively drills into nested variables.
- **`variable/debugVariable.ts`** — Base `DebugVariable` class and `DebugVariableType` metadata.
- **`variable/imageVariable.ts`** — `ImageVariable extends DebugVariable`. Calls `updateImageInfo()` to evaluate expressions for dimensions/data pointer, then `readMemory()` via DAP, converts to typed arrays, and renders PNG with `sharp`. Also produces a normalized (contrast-enhanced) version.
- **`variable/variableTypeFactory.ts`** — Loads built-in and user-configured image types from settings (`debug-variable-actions.config.image-types`). Matches variables by type string against `match_types`.
- **`variable/evalExpression.ts`** — `EvalExpression.eval()` evaluates JS expression strings with variable member values injected as local variables. Used by `imageVariable.ts` to compute width, height, stride, data pointer, etc. from configurable expression strings.

### Frontend (`public/`)

Plain JavaScript files served to the webview:
- **`index_image_panel.js`** — `ImageTraceManager` → `ImageTrace` → `BreakpointCapture` hierarchy. Manages a timeline slider across breakpoints. Renders an image grid with metadata on each breakpoint stop.
- **`index_image.js`** — Image display utilities.
- `tabulator/` — Third-party Tabulator.js library.

### Templates (`panel_html_templates/`)

EJS templates rendered by `panel.ts`. `image-panel.ejs` is the main panel. `test-*.ejs` files are experimental.

## Image Type Configuration

The key extension mechanism: users configure custom image types in VSCode settings. Each type specifies:
- `match_types`: array of C/C++ type strings to match
- `binary_info`: JS expression strings for byte size, endianness, signedness
- `image_info`: JS expression strings for width, height, stride, channels, data pointer, format

Expression strings are evaluated by `EvalExpression.eval()` with struct member values bound as variables, allowing arithmetic like `"width*height*channels"`.

## Key Constraints

- TypeScript strict mode is enabled (`tsconfig.json`).
- ESLint enforces naming conventions and semicolons; run `npm run lint` to check.
- The `sharp` native module requires Node.js compatibility — be careful with Node version when testing locally.
- Extension has only been tested with C/C++ debugger and 1-channel images (see README Known Issues).
- Image storage uses `context.storageUri` or `context.globalStorageUri` — paths are managed in `imageVariable.ts`.
