const vscode = acquireVsCodeApi();
window.addEventListener('DOMContentLoaded', () => {
    const manager = new ImageTraceManager("#wrapper");

    // Handle the message inside the webview
    window.addEventListener('message', event => {

        let message = event.data; // The JSON data our extension sent
        if (!message) { message = event.message; }
        if (!message) { message = event; }
        console.log("message received", message);

        if (message.command === 'images') {
            const metas = message.metas;
            const breakpointCapture = new BreakpointCapture(message.breakpointMeta, message.vscodeMeta);
            manager.addBreakpointCapture(breakpointCapture);
            for (const meta of metas) {
                const imageUrl = convertUrlToHicont(meta.imageWebUrl);
                console.log("image", imageUrl, meta);
                const imageTraceId = meta.variable.evaluateName;
                const imageTrace = manager.addImageTrace(imageTraceId);
                imageTrace.addImage(imageUrl, meta);
                breakpointCapture.addImageIdxCapture(imageTraceId, imageTrace.lastIdx);
            }
            manager.renderAtBreakpoint(breakpointCapture);
        }
        if (message.command === 'image') {
            const imageUrl = message.url;
            const meta = message.meta;
            console.log("image", imageUrl, meta);
            const imageTraceId = meta.variable.evaluateName;
            const imageTrace = manager.addImageTrace(imageTraceId);
            imageTrace.addImage(imageUrl, meta);
            manager.render();
            console.log("manager", manager);
        }
        else if (message.command === 'capture') {
            console.log("capturing", manager);
            manager.capture();
        }
        else if (message.command === 'clear') {
            console.log("clearing panel - debug session ended");
            manager.clear();
            displayInstantMessage("Debug session ended", 2000);
        }
        else if (message.command === 'instant-message') {
            let duration = 1000;
            if (message.message === "WAIT FOR IMAGES...") {
                duration = -1;
            }
            displayInstantMessage(message.message, duration);
        }
    });
});

class ImageTraceManager {
    constructor(parentDomQuery) {
        this.imageTraceList = {};
        this.parentDomQuery = parentDomQuery;
        this.captures = [];
        this.imageTraceIdsAddedFromLastCapture = {};
        this.lastRenderedCaptureIdx = 0;
        this.currentRenderedCaptureIdx = 0;
        this.lastRenderedImageTraceIds = {};
        this.breakpointCaptureList = [];
        this.lastRenderedBreakpointCapture = undefined;

        // Slider to seek captures
        this.slider = this._initial_slider;
        this.frameInfo = document.createElement("span");
        this.goLineCheckBox = document.createElement("input");
        this.backNextSpan = this._initial_back_next_span;
        this._dom = this._initial_dom;
        this.addToParentDom();
    }

    get _initial_dom() {
        // div.image-trace-manager
        const imageTraceManagerDiv = document.createElement("div");
        imageTraceManagerDiv.classList.add("image-trace-manager");
        this.frameInfo.classList.add("frame-info");
        this.goLineCheckBox.classList.add("go-line-checkbox");
        this.goLineCheckBox.type = "checkbox";
        this.goLineCheckBox.checked = true;
        return imageTraceManagerDiv;
    }

    get _initial_slider() {
        let slider = document.createElement("input");
        slider.type = "range";
        slider.min = 0;
        slider.max = 0;
        slider.step = 0;
        slider.oninput = (e) => { this._handleSliderEvent(e); };
        return slider;
    }

    get _initial_back_next_span() {
        const backNextSpan = document.createElement("span");
        // Returns a function to add to this.slider.value
        const buttonClickFunc = (add) => {
            return (() => {
                const valAfter = parseInt(this.slider.value) + add;
                if (valAfter < parseInt(this.slider.min) || parseInt(this.slider.max) < valAfter) {
                    return;
                }
                this.slider.value = valAfter;
                const captureIdx = this.slider.value;
                const breakpointCapture = this.breakpointCaptureList[captureIdx];
                this.renderAtBreakpoint(breakpointCapture);
                this._updateBreakCountBadge(captureIdx);
                if (this.goLineCheckBox.checked) {
                    this.frameInfo.click();
                }
            });
        };
        const backButton = document.createElement("button");
        backButton.classList.add("back-button");
        backButton.classList.add("slider-control-button");
        backButton.onclick = buttonClickFunc(-1);
        backButton.innerHTML = "<";
        const nextButton = document.createElement("button");
        nextButton.classList.add("next-button");
        nextButton.classList.add("slider-control-button");
        nextButton.onclick = buttonClickFunc(1);
        nextButton.innerHTML = ">";

        backNextSpan.appendChild(backButton);
        backNextSpan.appendChild(nextButton);
        return backNextSpan;
    }

    get dom() {
        return this._dom;
    }

    addToParentDom() {
        // Build a sticky toolbar that contains all controls
        const toolbar = document.createElement("div");
        toolbar.id = "toolbar";

        // Breakpoint counter badge
        this._breakCountBadge = document.createElement("span");
        this._breakCountBadge.id = "break-count-badge";
        this._breakCountBadge.title = "Breakpoint index";
        this._breakCountBadge.style.cssText =
            "font-size:10px;color:var(--text-muted);font-family:var(--font-mono);min-width:32px;text-align:right;";
        toolbar.appendChild(this.backNextSpan);
        toolbar.appendChild(this.slider);
        toolbar.appendChild(this._breakCountBadge);

        const goLineLabel = document.createElement("label");
        goLineLabel.title = "Auto-jump to source location when navigating breakpoints";
        goLineLabel.style.display = "flex";
        goLineLabel.style.alignItems = "center";
        goLineLabel.style.gap = "4px";
        goLineLabel.appendChild(this.goLineCheckBox);
        const goLineText = document.createElement("span");
        goLineText.textContent = "Go to line";
        goLineLabel.appendChild(goLineText);
        toolbar.appendChild(goLineLabel);

        toolbar.appendChild(this.frameInfo);

        // Insert toolbar before wrapper, not inside it
        const parent = document.querySelector(this.parentDomQuery);
        parent.parentNode.insertBefore(toolbar, parent);
        parent.appendChild(this.dom);
    }

    _updateBreakCountBadge(idx) {
        if (this._breakCountBadge) {
            const total = this.breakpointCaptureList.length;
            this._breakCountBadge.textContent = total > 0 ? `${parseInt(idx) + 1} / ${total}` : "";
        }
    }

    has(id) {
        return (id in this.imageTraceList);
    }

    get(id) {
        return this.imageTraceList[id];
    }

    addImageTrace(id) {
        if (!(id in this.imageTraceIdsAddedFromLastCapture)) {
            // This imageTrace did not exist in the last capture
            this.imageTraceIdsAddedFromLastCapture[id] = true;
        }
        if (!this.has(id)) {
            let imageTrace = new ImageTrace(this, id);
            this.imageTraceList[id] = imageTrace;
            this.imageTraceIdsAddedFromLastCapture[id] = true;
            this.dom.appendChild(imageTrace.dom);
        }
        return this.imageTraceList[id];
    }

    capture() {
        let cap = {};
        // capture to cap
        Object.entries(this.imageTraceList).forEach(([id, imageTrace]) => {
            cap[id] = imageTrace.lastIdx;
        });
        this.captures.push(cap);

        // set slider max
        this.slider.max = this.captures.length - 1;
        this.slider.value = this.captures.length - 1;

        this.imageTraceIdsAddedFromLastCapture = {};
        console.log("captured", cap, this.captures);
    }

    addBreakpointCapture(breakpointCapture) {
        breakpointCapture.setFrameInfoDom(this.frameInfo);
        this.breakpointCaptureList.push(breakpointCapture);
        // Keep slider range in sync
        const newMax = this.breakpointCaptureList.length - 1;
        this.slider.max = newMax;
        this.slider.value = newMax;
        this._updateBreakCountBadge(newMax);
    }

    render(captureIdx = -1, isSliderEvent = false) {
        console.log("ImageTraceManager.render", captureIdx, isSliderEvent, this);
        // Get capture to render
        let cap;
        if (this.captures.length === 0) {
            // No capture at first rendering
            cap = undefined;
        } else {
            if (captureIdx < 0) {
                // Render the latest imageItem in imageTrace, so set cap to undefined
                // this.currentRenderedCaptureIdx = this.captures.length - 1;
                cap = undefined;
            } else {
                if (captureIdx > this.captures.length - 1) {
                    // Error over index
                    displayInstantMessage(`Error! captureIdx = ${captureIdx} is over captures.length-1 = ${this.captures.length - 1}`);
                    return;
                }
                // Get capture at captureIdx
                this.currentRenderedCaptureIdx = captureIdx;
                cap = this.captures[this.currentRenderedCaptureIdx];
            }
        }

        if (!isSliderEvent && captureIdx === -1) {
            // Set slider value
            this.slider.value = this.captures.length - 1;
        }

        Object.entries(this.imageTraceList).forEach(([id, imageTrace]) => {
            let imageIdxToRender;
            let captureIdxToRefresh;
            if (cap !== undefined) {
                // Render imageTrace at the captureIdx
                imageIdxToRender = cap[imageTrace.id];
                if (imageIdxToRender !== undefined) {
                    captureIdxToRefresh = captureIdx;
                } else {
                    // Here comes imageTrace, which did not exist at this captureIdx
                    captureIdxToRefresh = undefined;
                }
            } else {
                // First rendering, then render the last imageTrace
                imageIdxToRender = imageTrace.lastIdx;
                captureIdxToRefresh = undefined;
            }

            // FIXME: temporary implementation
            // let hide = !(imageTrace.id in this.imageTraceIdsAddedFromLastCapture);
            let hide = false;

            // Render imageTrace
            if (imageIdxToRender === undefined || hide) {
                imageTrace.hide();
            } else {
                imageTrace.show();
                imageTrace.render(imageIdxToRender);
                this.lastRenderedImageTraceIds[id] = true;
                this._refreshFrameInfo(imageTrace, imageIdxToRender, captureIdxToRefresh);
            }
        });

        this.lastRenderedCaptureIdx = this.currentRenderedCaptureIdx;
    }

    renderAtBreakpoint(breakpointCapture) {
        console.log("renderAtBreakpoint", breakpointCapture);

        // Collect all imageTraceIds that exist in the current breakpoint
        const imageTraceIds = Object.keys(breakpointCapture.imageTraceIdxDict);

        // First, hide ALL imageTraces to ensure clean state
        for (const imageTraceId in this.imageTraceList) {
            const imageTrace = this.imageTraceList[imageTraceId];
            imageTrace.hide();
        }

        // Then, show and render only the imageTraces that exist in the current breakpoint
        for (const imageTraceId of imageTraceIds) {
            const idx = breakpointCapture.imageTraceIdxDict[imageTraceId];
            const imageTrace = this.imageTraceList[imageTraceId];
            if (imageTrace) {
                imageTrace.show();
                imageTrace.render(idx);
            }
        }

        breakpointCapture.updateFrameInfoDom();
        this._refreshFrameInfoByBreakpointCapture(breakpointCapture);
        this.lastRenderedBreakpointCapture = breakpointCapture;
    }

    _refreshFrameInfo(imageTrace, idx, captureIdx) {
        const meta = imageTrace.imageItemList[idx].meta;
        const workspaceFolder = meta.vscode.workspaceFolder.uri.fsPath;
        const sourcePathRelative = meta.frame.source.path.replace(workspaceFolder, ".");
        const breakCountStr = captureIdx >= 0 ? " " + String(parseInt(captureIdx) + 1) : "";
        const sourcePathExp = `Break${breakCountStr}: ${sourcePathRelative}:${meta.frame.line}:${meta.frame.column}`;
        const imageFileFsPath = `file:\\\\\\${meta.vscode.filePath}`;
        this.frameInfo.innerHTML = `${sourcePathExp}`;
        this.frameInfo.onclick = () => {
            console.log("Open file", meta.frame.source.path, "pos:", [meta.frame.line, meta.frame.column]);
            // revealTextFile(meta.frame.source.path, [meta.frame.line, meta.frame.column]);
            vscodeOpen(meta.frame.source.path, [meta.frame.line, meta.frame.column]);
        };
    }

    _refreshFrameInfoByBreakpointCapture(breakpointCapture) {
        const meta = breakpointCapture.meta;
        const workspaceFolder = breakpointCapture.vscodeMeta.workspaceFolders[0].uri.fsPath;
        const sourcePathRelative = meta.source.path.replace(workspaceFolder, ".");
        const sourcePathExp = `${sourcePathRelative}:${meta.line}:${meta.column}`;
        console.log("sourcePathExp", sourcePathExp);
        this.frameInfo.innerHTML = `${sourcePathExp}`;
        this.frameInfo.onclick = () => {
            console.log("Open file", meta.source.path, "pos:", [meta.line, meta.column]);
            // revealTextFile(meta.source.path, [meta.line, meta.column]);
            vscodeOpen(meta.source.path, [meta.line, meta.column]);
        };
    }

    _handleSliderEvent(e) {
        const captureIdx = e.target.value;
        const breakpointCapture = this.breakpointCaptureList[captureIdx];
        this.renderAtBreakpoint(breakpointCapture);
        this._updateBreakCountBadge(captureIdx);
        if (this.goLineCheckBox.checked) {
            this.frameInfo.click();
        }
    }

    /**
     * Clear all panel state when debug session ends.
     * This ensures a new session starts fresh without old data.
     */
    clear() {
        console.log("ImageTraceManager.clear - resetting all state");
        // Remove all image trace DOM elements
        for (const imageTraceId in this.imageTraceList) {
            const imageTrace = this.imageTraceList[imageTraceId];
            if (imageTrace.dom && imageTrace.dom.parentNode) {
                imageTrace.dom.parentNode.removeChild(imageTrace.dom);
            }
        }
        // Reset all state
        this.imageTraceList = {};
        this.captures = [];
        this.imageTraceIdsAddedFromLastCapture = {};
        this.lastRenderedCaptureIdx = 0;
        this.currentRenderedCaptureIdx = 0;
        this.lastRenderedImageTraceIds = {};
        this.breakpointCaptureList = [];
        this.lastRenderedBreakpointCapture = undefined;
        // Reset slider
        this.slider.min = 0;
        this.slider.max = 0;
        this.slider.value = 0;
        // Clear frame info
        this.frameInfo.innerHTML = "";
        this.frameInfo.onclick = null;
        // Clear badge
        this._updateBreakCountBadge(0);
    }
}

class BreakpointCapture {
    constructor(meta, vscodeMeta) {
        this.meta = meta;
        this.vscodeMeta = vscodeMeta;
        this.frameInfoDom = undefined;
        this.prev = undefined;
        this.next = undefined;

        this.imageTraceIdxDict = [];
    }

    setFrameInfoDom(frameInfoDom) {
        this.frameInfoDom = frameInfoDom;
        // this.frameInfoDom.classList.add("frame-info");
    }

    updateFrameInfoDom() {
        const meta = this.meta;
        const workspaceFolder = this.vscodeMeta.workspaceFolder;
        const sourcePathRelative = this.meta.source.path.replace(workspaceFolder, ".");
        const sourcePathExp = `${sourcePathRelative}:${meta.line}:${meta.column}`;
        this.frameInfoDom.innerHTML = `${sourcePathExp}`;
        this.frameInfoDom.onclick = () => {
            console.log("Open file", meta.source.path, "pos:", [meta.line, meta.column]);
            // revealTextFile(meta.frame.source.path, [meta.frame.line, meta.frame.column]);
            vscodeOpen(meta.source.path, [meta.line, meta.column]);
        };

        this.frameInfoDom.innerHTML = `${this.meta.source.path}:${this.meta.line}:${this.meta.column}`;
    }
    addImageIdxCapture(imageTraceId, imageIdx) {
        this.imageTraceIdxDict[imageTraceId] = imageIdx;
    }

    vscodeOpen(uri, pos = undefined) {
        vscodeOpen(uri, pos);
    }

    setLink(prev, next) {
        if (prev !== undefined) {
            this.setPrev(prev);
        }
        if (next !== undefined) {
            this.setNext(next);
        }
    }
    setPrev(prev) {
        this.prev = prev;
        prev.next = this;
    }
    setNext(next) {
        this.next = next;
        next.prev = this;
    }
}

class ImageTrace {
    constructor(manager, id) {
        this.manager = manager;
        this.id = id;
        this.imageItemList = [];
        this.imageItemFactory = new ImageItemDomFactory(undefined, undefined);
        this._dom = this._initial_dom;
        this.opt = {
            showAll: false
        };
        this.lastRenderedIdx = undefined;
        this.renderMode = undefined;  // "single" or "showAll", but initialy undefined
    }
    get _initial_dom() {
        // div.image-trace
        let imageTraceDiv = document.createElement("div");
        imageTraceDiv.classList.add("image-trace");
        imageTraceDiv.classList.add("fade");
        return imageTraceDiv;
    }

    get dom() {
        return this._dom;
    }

    render(idx = this.lastIdx) {
        console.log("ImageTrace.render", idx, this);
        const newRenderMode = this.opt.showAll ? "showAll" : "single";
        if (this.renderMode !== newRenderMode) {
            console.log("Intermediate initialization of imageTrace's dom!");
            // this._dom = this._initial_dom; // initialize dom if renderMode is changed
        }
        switch (newRenderMode) {
            case "single":
                this._renderSingle(idx);
                break;
            case "showAll":
                this._renderShowAll(idx);
                break;
        }
        this.renderMode = newRenderMode;
    }

    show() {
        this.dom.hidden = false;
    }
    hide() {
        this.dom.hidden = true;
    }

    _renderShowAll(idx) {
        this._dom.innerHTML = "";
        for (const imageItem of this.imageItemList) {
            // Display all dom of this.imageItemList items'
            this.dom.appendChild(imageItem.dom);
        }
    }

    _renderSingle(idx) {
        if (this.renderMode != "single" || this.renderMode === undefined) {
            // Add a single imageItemDom in this.dom when the last renderMode is not single or first rendering
            const imdom = this.imageItemFactory.create();
            console.log("imdom", imdom, this.dom, this.renderMode);
            this.dom.appendChild(imdom);
            console.log("imdom after", imdom, this.dom);
        }

        // Update the imageItemDom, imageUrl, meta, changedState will be updated
        const imageItem = this.imageItemList[idx];
        console.log("_renderSingle changedState", imageItem.changedState, imageItem);
        this.imageItemFactory.update(imageItem.imageUrl, imageItem.meta, imageItem.changedState);

        if (idx === this.lastRenderedIdx) {
            return;
        }

        // Compare a rendered image with last rendered image, and set new/changed/same image class
        // FIXME: Only supports single image mode, because the lastRenderedIdx is not an array
        // FIXME: This should not be here, because this compare current rendering image by the last "rendered" image, not "captured" image.
        //        This should be done in ImageTrace.addImage() and the result of diff saved in ImageItem.
        // const compare = this.compareImageWithLastRenderedImage(idx);
        // console.log("compare", compare, idx, this.lastRenderedIdx, this);
        // if (compare === undefined) {
        //     // new image
        //     this._setImageDiffClass("is-new-image");
        // } else if (compare === true) {
        //     // changed image
        //     this._setImageDiffClass("is-changed-image");
        // } else {
        //     // same image
        //     this._setImageDiffClass("is-same-image");
        // }

        this.lastRenderedIdx = idx;
    }

    _setImageDiffClass(cls) {
        this.dom.classList.remove("is-new-image");
        this.dom.classList.remove("is-changed-image");
        this.dom.classList.remove("is-same-image");
        this.dom.classList.add(cls);
    }

    get lastIdx() {
        return this.imageItemList.length - 1;
    }

    addImage(imageUrl, meta) {
        let imageItem = new ImageItem(imageUrl, meta, this.lastIdx + 1);  // TODO: allow inserting
        if (this.lastIdx >= 0) {
            // Set link between imageItems
            imageItem.setLink(this.imageItemList[this.lastIdx], undefined);
        }
        this.imageItemList.push(imageItem);
        // this._dom.appendChild(imageItem.dom);
    }

    compareImageWithLastRenderedImage(idx) {
        // Returns
        //  - undefined: new image
        //  - true: changed image
        //  - false: same image
        const imageItem = this.imageItemList[idx];
        if (this.lastIdx < 0 || this.lastRenderedIdx === undefined) {
            // When did not rendered yet, or the last rendered image is not exist
            return undefined;
        }
        else {
            const lastImageItem = this.imageItemList[this.lastRenderedIdx];
            return (imageItem.meta.imageHash !== lastImageItem.meta.imageHash);
        }
    }
}

class ImageItem {
    constructor(imageUrl, meta, idx = undefined) {
        this.imageUrl = imageUrl;
        this.idx = idx;
        this.meta = meta;
        this.imageItemFactory = new ImageItemDomFactory(imageUrl, meta);
        this.previousImageItem = undefined;
        this.nextImageItem = undefined;
        this.isChangedFromPreviousImageItem = null; // undefined:new, true:changed, false:same
        this._dom = this._initial_dom;
    }

    get _initial_dom() {
        return this.imageItemFactory.create();
    }

    get dom() {
        return this._dom;
    }

    get isFirstImage() {
        return (this.previousImageItem === undefined);
    }
    get isLastImage() {
        return (this.nextImageItem === undefined);
    }

    get changedState() {
        if (this.isChangedFromPreviousImageItem === null) {
            // Compre with previous imageItem if the imageItem instance did not created by ImageTrace.addImage()
            // This is because the comparison is done in ImageItem.setLink() in ImageTrace.addImage()
            this._compareImageWithPreviousImage();
        }
        // Returns "new", "changed", "same"
        switch (this.isChangedFromPreviousImageItem) {
            case undefined:
                return "new";
            case true:
                return "changed";
            case false:
                return "same";
            default:
                console.log("Error: invalid changedState", this.isChangedFromPreviousImageItem), "in", this, ", but return 'new'";
                return "new";
        }
    }

    setLink(prev, next) {
        // Update previous
        if (prev !== undefined) {
            this.setPreviousImageItem(prev);
        }
        // Update next
        if (next !== undefined) {
            this.setNextImageItem(next);
        }
    }
    setPreviousImageItem(prev) {
        this.previousImageItem = prev;
        prev.nextImageItem = this;
        this.isChangedFromPreviousImageItem = this._compareImageWithPreviousImage();
    }

    setNextImageItem(next) {
        this.nextImageItem = next;
        next.previousImageItem = this;
        next.changedFromPrevious = next._compareImageWithPreviousImage();
    }

    _compareImageWithPreviousImage() {
        // Returns
        //  - undefined: new image
        //  - true: changed image
        //  - false: same image
        if (this.previousImageItem === undefined) {
            // The new image, which does not have previous image
            this.changedFromPrevious = undefined;
        }
        else {
            // Compare with the hash of previous image, and return true(changed) or false(same)
            this.changedFromPrevious = (this.meta.imageHash !== this.previousImageItem.meta.imageHash);
        }
        return this.changedFromPrevious;
    }
}


class ImageItemDomFactory {
    constructor(imageUrl, meta) {
        this.imageUrl = imageUrl;
        this.meta = meta;

        // Card root
        this.imageItemDiv = document.createElement("div");

        // Image wrapper (dark bg, centred)
        this.imageWrapper = document.createElement("div");
        this.imageWrapper.classList.add("image-wrapper");

        // The actual <img>
        this.img = document.createElement("img");

        // Card body
        this.cardBody = document.createElement("div");
        this.cardBody.classList.add("card-body");

        // Variable name link
        this.a_filename = document.createElement("a");

        // Hidden source-info anchor (kept for back-compat)
        this.a_source = document.createElement("a");
        this.a_source.classList.add("source-info");

        // Meta info row
        this.variableInfoDiv = document.createElement("div");
        this.variableInfoDiv.classList.add("variable-info");
    }

    create() {
        // img
        this.img.classList.add("image");
        this.img.src = this.imageUrl || "";
        this.imageWrapper.appendChild(this.img);

        // card root
        this.imageItemDiv.classList.add("image-item");
        this.imageItemDiv.appendChild(this.imageWrapper);

        // card body
        this.a_filename.classList.add("evaluate-name");
        this.cardBody.appendChild(this.a_filename);
        this.cardBody.appendChild(this.a_source);
        this.cardBody.appendChild(this.variableInfoDiv);
        this.imageItemDiv.appendChild(this.cardBody);

        if (this.imageUrl !== undefined && this.meta !== undefined) {
            this.update(this.imageUrl, this.meta);
        }

        return this.imageItemDiv;
    }

    update(imageUrl, meta, changedState) {
        this.imageUrl = imageUrl;
        this.meta = meta;

        // Update image src
        this.img.src = imageUrl;
        this.img.title = "Click to copy image";
        this.img.onclick = () => copyPngImageToClipboard(imageUrl);

        // Variable name — click to copy image
        this.a_filename.href = "#";
        this.a_filename.onclick = (e) => { e.preventDefault(); copyPngImageToClipboard(imageUrl); };
        this.a_filename.textContent = meta.variable.evaluateName;
        this.a_filename.title = `Copy ${meta.variable.evaluateName} to clipboard`;

        // Hidden source link
        if (meta.frame && meta.frame.source) {
            const workspaceFolder = meta.vscode.workspaceFolder.uri.fsPath;
            const sourcePathRelative = meta.frame.source.path.replace(workspaceFolder, ".");
            this.a_source.textContent = `${sourcePathRelative}:${meta.frame.line}:${meta.frame.column}`;
            this.a_source.onclick = () => vscodeOpen(meta.frame.source.path, [meta.frame.line, meta.frame.column]);
        }

        // Meta info: type badge + size badge + channels
        const imageSizeString = `${meta.imageInfo.mem_width}\u00d7${meta.imageInfo.mem_height}`;
        const chStr = meta.imageInfo.channels > 1 ? ` \u00d7${meta.imageInfo.channels}ch` : "";
        this.variableInfoDiv.innerHTML =
            `<span class="type-badge">${meta.variable.type}</span>` +
            `<span class="size-badge">${imageSizeString}${chStr}</span>`;

        // Change-state border strip
        this.imageItemDiv.classList.remove("is-new-image", "is-changed-image", "is-same-image");
        if (changedState) {
            this.imageItemDiv.classList.add(`is-${changedState}-image`);
        }
    }
}

class ImageDomFactory {
    constructor(imageUrl) {
        this.imageUrl = imageUrl;
    }
    create() {
        // img.image

    }

    update(imageUrl) {
        this.imageUrl = imageUrl;

    }
}

function copyPngImageToClipboard(imageUrl) {
    console.log("fetching blob of png");
    // https://stackoverflow.com/questions/42471755/convert-image-into-blob-using-javascript
    loadXHR(imageUrl).then(function (blob) {
        try {
            console.log("copy png to clip from blob", blob);
            // https://stackoverflow.com/questions/33175909/copy-image-to-clipboard
            navigator.clipboard.write([
                new ClipboardItem({
                    'image/png': blob
                })
            ]);
            displayInstantMessage(`Copied ${imageUrl}`);
        } catch (error) {
            console.error(error);
        }
    });

}

function loadXHR(url) {
    return new Promise(function (resolve, reject) {
        try {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", url);
            xhr.responseType = "blob";
            xhr.onerror = function () { reject("Network error."); };
            xhr.onload = function () {
                if (xhr.status === 200) { resolve(xhr.response); }
                else { reject("Loading error:" + xhr.statusText); }
            };
            xhr.send();
        }
        catch (err) { reject(err.message); }
    });
}

function requestRevealInExplorer() {

}

function revealImageFull(imageUrl) {

}


function revealTextFile(uri, pos = undefined) {
    vscode.postMessage({
        command: "revealTextFile",
        text: "",
        uri, pos
    });
}

function vscodeOpen(uri, pos = undefined) {
    vscode.postMessage({
        command: "open",
        text: "",
        uri, pos
    });
}

function displayInstantMessage(s, duration = 1000) {
    document.querySelector("#instant-message").innerHTML = s;
    if (duration > 0) {
        setTimeout(() => {
            document.querySelector("#instant-message").innerHTML = "";
        }, duration);
    }
}

function convertUrlToHicont(url) {
    const hicontUrl = url.replace(/(^.*?)([^\/]+)(\.[^.]+$)/, "$1$2.hicont$3");
    return hicontUrl;
}