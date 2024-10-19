console.log("hey yo");

const vscode = acquireVsCodeApi();
window.addEventListener('DOMContentLoaded', () => {
    const manager = new ImageTraceManager("#wrapper");

    // Handle the message inside the webview
    window.addEventListener('message', event => {

        let message = event.data; // The JSON data our extension sent
        if (!message) { message = event.message; }
        if (!message) { message = event; }
        console.log("message received", message);

        if (message.command === 'images-stack') {
            const metas = message.metas;
            const breakpointCapture = new BreakpointCapture(message.breakpointMeta, message.vscodeMeta);
            manager.addBreakpointCapture(breakpointCapture);
            console.log("images-stack", metas);

            // Make a stack of frames
            const topFrameId = message.frames[message.frames.length - 1].meta.name;
            const topFrameItem = manager.addFrameItem(topFrameId);
            let frameItem;
            if (message.frames.length <= 1) {
                frameItem = topFrameItem;
            } else {
                let parentFrameItem = topFrameItem;
                for (let i = message.frames.length - 2; i >= 0; i--) {
                    const frameMeta = message.frames[i];
                    const frameId = frameMeta.meta.name;
                    console.log("adding frame item", frameMeta, frameId);
                    frameItem = parentFrameItem.addFrameItem(frameId);
                    parentFrameItem = frameItem;
                }
            }
            console.log("topFrameItem", topFrameItem, "frameItem", frameItem);

            // Add images to the stack of frames
            for (const meta of metas) {
                const imageUrl = meta.imageWebUrl;
                console.log("images-stack", imageUrl, meta);
                const imageTraceId = `${meta.variable.evaluateName}@${meta.frame.name}`;
                const imageTrace = frameItem.addImageTrace(imageTraceId);
                imageTrace.renderMode = "stack";
                imageTrace.addImage(imageUrl, meta);
                breakpointCapture.addImageIdxCapture(imageTraceId, imageTrace.lastIdx);
            }
            // manager.renderAtBreakpoint(breakpointCapture, "stack");
            // manager.renderStackFrames(breakpointCapture);
            manager.renderStackFrames();
        }
        else if (message.command === 'images') {
            const metas = message.metas;
            const breakpointCapture = new BreakpointCapture(message.breakpointMeta, message.vscodeMeta);
            manager.addBreakpointCapture(breakpointCapture);
            for (const meta of metas) {
                const imageUrl = meta.imageWebUrl;
                console.log("image", imageUrl, meta);
                const imageTraceId = meta.variable.evaluateName;
                const imageTrace = manager.addImageTrace(imageTraceId);
                imageTrace.addImage(imageUrl, meta);
                breakpointCapture.addImageIdxCapture(imageTraceId, imageTrace.lastIdx);
            }
            manager.renderAtBreakpoint(breakpointCapture, "single");
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
        this.frameItemList = {};
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
        this.toolbar = document.createElement("div");
        this.slider = this._initial_slider;
        this.frameInfo = document.createElement("span");
        this.goLineCheckBox = document.createElement("input");
        this.backNextSpan = this._initial_back_next_span;
        this._dom = this._initial_dom;
        this.addToParentDom();
    }

    get _initial_dom() {
        // div.image-trace-manager
        let imageTraceManagerDiv = document.createElement("div");
        imageTraceManagerDiv.classList.add("image-trace-manager");

        this.toolbar.classList.add("toolbar");
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
            console.log("clicked add", add);
            return (e => {
                console.log("clicked this", this);
                const valAfter = parseInt(this.slider.value) + add;
                if (valAfter < this.slider.min || this.slider.max < valAfter) {
                    console.log("button click was ignored", this.slider.min, this.slider.max, valAfter);
                    return;
                }
                this.slider.value = valAfter;
                const captureIdx = this.slider.value;
                // this.render(captureIdx, true);
                const breakpointCapture = this.breakpointCaptureList[captureIdx];
                this.renderAtBreakpoint(breakpointCapture);
                this.frameInfo.click();
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
        this.toolbar.appendChild(this.backNextSpan);
        this.toolbar.appendChild(this.slider);
        this.toolbar.appendChild(this.goLineCheckBox);
        this.toolbar.appendChild(this.frameInfo);
        document.querySelector(this.parentDomQuery).appendChild(this.toolbar);
        document.querySelector(this.parentDomQuery).appendChild(this.dom);
    }

    hasImageTrace(id) {
        return (id in this.imageTraceList);
    }
    getImageTrace(id) {
        return this.imageTraceList[id];
    }
    addImageTrace(id) {
        if (!(id in this.imageTraceIdsAddedFromLastCapture)) {
            // This imageTrace did not exist in the last capture
            this.imageTraceIdsAddedFromLastCapture[id] = true;
        }
        if (!this.hasImageTrace(id)) {
            let imageTrace = new ImageTrace(this, id);
            this.imageTraceList[id] = imageTrace;
            this.imageTraceIdsAddedFromLastCapture[id] = true;
            this.dom.appendChild(imageTrace.dom);
        }
        return this.imageTraceList[id];
    }

    hasFrameItem(id) {
        return (id in this.frameItemList);
    }
    getFrameItem(id) {
        return this.frameItemList[id];
    }
    addFrameItem(id) {
        if (!this.hasFrameItem(id)) {
            let frameItem = new FrameItem(this, id);
            this.frameItemList[id] = frameItem;
            this.dom.appendChild(frameItem.dom);
        }
        return this.frameItemList[id];
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

    renderAtBreakpoint(breakpointCapture, renderMode = "single") {
        console.log("renderAtBreakpoint", breakpointCapture);

        // Render imageTraces in the given breakpointCapture
        const imageTraceIds = Object.keys(breakpointCapture.imageTraceIdxDict);
        for (const imageTraceId of imageTraceIds) {
            const idx = breakpointCapture.imageTraceIdxDict[imageTraceId];
            const imageTrace = this.imageTraceList[imageTraceId];
            imageTrace.show();
            imageTrace.render(idx);
            breakpointCapture.updateFrameInfoDom();
        }

        if (renderMode === "single") {
            // Hide imageTraces which are not in the current breakpointCapture
            if (this.lastRenderedBreakpointCapture !== undefined) {
                for (const pastImageTraceId of Object.keys(this.lastRenderedBreakpointCapture.imageTraceIdxDict)) {
                    if (!imageTraceIds.includes(pastImageTraceId)) {
                        const imageTrace = this.imageTraceList[pastImageTraceId];
                        imageTrace.hide();
                    }
                }
            }
        }

        this._refreshFrameInfoByBreakpointCapture(breakpointCapture);
        this.lastRenderedBreakpointCapture = breakpointCapture;
    }

    renderStackFrames(targetFrameItemList = undefined) {
        console.log("renderStackFrames", this);
        if (targetFrameItemList === undefined) {
            targetFrameItemList = this.frameItemList;
        }
        for (const [id, frameItem] of Object.entries(targetFrameItemList)) {
            for (const [imageTraceId, imageTrace] of Object.entries(frameItem.imageTraceList)) {
                imageTrace.show();
                imageTrace.render(imageTrace.lastIdx);
                // const idx = breakpointCapture.imageTraceIdxDict[imageTraceId];
                // if (breakpointCapture === undefined || idx === undefined) {
                //     imageTrace.addBlankStack();
                // } else {
                //     imageTrace.render(idx);
                // }

                // Recursively render stack frames
                this.renderStackFrames(frameItem.frameItemList);
            }
        }
        // this.lastRenderedBreakpointCapture = breakpointCapture;
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
        let captureIdx = e.target.value;
        // this.render(captureIdx, true);
        const breakpointCapture = this.breakpointCaptureList[captureIdx];
        this.renderAtBreakpoint(breakpointCapture);
        if (this.goLineCheckBox.checked) {
            this.frameInfo.click();
        }
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

class FrameItem {
    constructor(_manager, id, _parent = undefined) {
        this.manager = _manager;
        this.id = id;
        this.parent = _parent;
        this.imageTraceList = {};
        this.frameItemList = {};
        this.frameItemListOrder = [];
        this.prev = undefined;
        this.next = undefined;

        this.frameInfoDiv = document.createElement("div");
        this.frameBarDiv = document.createElement("div");
        this.imageTracesDiv = document.createElement("div");
        this.frameItemsDiv = document.createElement("div");
        this._dom = this._initial_dom;

        this.depth = this.parent === undefined ? 0 : this.parent.depth + 1;
        this.depthMax = 0;
    }

    get _initial_dom() {
        // div.frame-item
        let frameItemDiv = document.createElement("div");
        frameItemDiv.classList.add("frame-item");
        frameItemDiv.dataset.frameItemId = this.id;
        frameItemDiv.dataset.frameDepth = this.depth;
        this.frameInfoDiv.classList.add("frame-info");
        this.frameInfoDiv.innerHTML = this.id;
        frameItemDiv.appendChild(this.frameInfoDiv);

        this.frameBarDiv.classList.add("frame-bar");
        this.frameBarDiv.innerHTML = this.id;
        frameItemDiv.appendChild(this.frameBarDiv);

        let frameContentDiv = document.createElement("div");
        frameContentDiv.classList.add("frame-content");
        frameItemDiv.appendChild(frameContentDiv);

        this.imageTracesDiv.classList.add("image-traces");
        frameContentDiv.appendChild(this.imageTracesDiv);

        this.frameItemsDiv.classList.add("frame-items");
        frameContentDiv.appendChild(this.frameItemsDiv);
        return frameItemDiv;
    }
    get dom() {
        return this._dom;
    }
    get depth() {
        return this._depth;
    }
    set depth(newDepth) {
        this._depth = newDepth;
        this.dom.dataset.frameDepth = this._depth;
    }
    get depthMax() {
        return this._depthMax;
    }
    set depthMax(newDepthMax) {
        this._depthMax = newDepthMax;
        this.imageTracesDiv.style.marginLeft = `${this._depthMax * 80}px`;
        this.dom.dataset.frameDepthMax = this._depthMax;
    }

    // updateDepthMax() {
    //     this.depthMax = this.depth;
    //     for (const frameItem of Object.values(this.frameItemList)) {
    //         const depth = frameItem.updateDepthMax();
    //         if (this.depthMax < depth) {
    //             this.depthMax = depth;
    //         }
    //     }

    //     return this.depthMax;
    // }

    addBreakpointCapture(breakpointCapture) {
        this.breakpointCaptureList.push(breakpointCapture);
    }

    hasImageTrace(id) {
        return (id in this.imageTraceList);
    }
    getImageTrace(id) {
        return this.imageTraceList[id];
    }
    addImageTrace(id) {
        if (!this.hasImageTrace(id)) {
            let imageTrace = new ImageTrace(this, id);
            this.imageTraceList[id] = imageTrace;
            this.imageTracesDiv.appendChild(imageTrace.dom);
        }
        return this.imageTraceList[id];
    }

    hasFrameItem(id) {
        return (id in this.frameItemList);
    }
    getFrameItem(id) {
        return this.frameItemList[id];
    }
    addFrameItem(id) {
        if (!this.hasFrameItem(id)) {
            let frameItem = new FrameItem(this.manager, id, this);
            this.frameItemList[id] = frameItem;
            this.frameItemListOrder.push(frameItem.id);
            this.frameItemsDiv.appendChild(frameItem.dom);

            if (this.depthMax < frameItem.depth) {
                this.depthMax = frameItem.depth;
                this._propagateDepthMax();
            }

            console.log("added frameItem", frameItem, this);
        }
        return this.frameItemList[id];
    }

    _propagateDepthMax() {
        if (this.parent !== undefined) {
            if (this.parent.depthMax < this.depthMax) {
                this.parent.depthMax = this.depthMax;
                this.parent.propagateDepthMax();
            }
        }
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
        this._renderMode = undefined;  // "single" or "showAll", but initialy undefined
        this._doInitDomNextRender = false;
    }
    get _initial_dom() {
        // div.image-trace
        let imageTraceDiv = document.createElement("div");
        imageTraceDiv.classList.add("image-trace");
        imageTraceDiv.classList.add("fade");
        imageTraceDiv.dataset.imageTraceId = this.id;
        return imageTraceDiv;
    }

    get dom() {
        return this._dom;
    }

    get renderMode() {
        return this._renderMode;
    }
    set renderMode(newRenderMode) {
        console.log("set renderMode", newRenderMode, this);
        if (this._renderMode !== undefined) {
            // this._renderMode is undefined only at the first rendering
            //   No need to initialize dom at the first rendering
            if (newRenderMode !== undefined && this._renderMode !== newRenderMode) {
                // Set flag to initialize dom at next render
                this._doInitDomNextRender = true;
                console.log("this._doInitDomNextRender", this._doInitDomNextRender);
            }
        }

        this._renderMode = newRenderMode;
    }

    clearDom() {
        // Clear all dom of this.imageItemList items'
        // Do not remove this.dom itself by setting this._dom = this._initial_dom;
        //  because this.dom is already appended to the parent dom when this instance is created by ImageTraceManager.addImageTrace()
        this._dom.innerHTML = "";
    }

    render(idx = this.lastIdx) {
        console.log("ImageTrace.render", idx, this);
        // const newRenderMode = this.opt.showAll ? "showAll" : "single";
        if (this._doInitDomNextRender) {
            console.log("Intermediate initialization of imageTrace's dom!");
            this._dom = this._initial_dom; // initialize dom if renderMode is changed
            this._doInitDomNextRender = false;
        }
        switch (this.renderMode) {
            case "single":
                this._renderSingle(idx);
                break;
            case "showAll":
                this._renderShowAll(idx);
                break;
            case "stack":
                this._renderStack(idx);
                break;
        }
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
        if (this.renderMode !== "single" || this.renderMode === undefined) {
            // Add a single imageItemDom in this.dom when the last renderMode is not single or first rendering
            const imdom = this.imageItemFactory.createDom();
            console.log("imdom", imdom, this.dom, this.renderMode);
            this.dom.appendChild(imdom);
            console.log("imdom after", imdom, this.dom);
        }

        // Update the imageItemDom, imageUrl, meta, changedState will be updated
        const imageItem = this.imageItemList[idx];
        console.log("_renderSingle changedState", imageItem.changedState, imageItem);
        this.imageItemFactory.update(imageItem.imageUrl, imageItem.meta, imageItem.changedState, "single");

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

    _renderStack(currentBreakIdx) {
        this.clearDom();
        // for (let breakIdx = 0; breakIdx < this.imageItemList.length; breakIdx++) {
        // for (let breakIdx = 0; breakIdx <= currentBreakIdx; breakIdx++) {
        for (let breakIdx = currentBreakIdx; breakIdx >= 0; breakIdx--) {
            const imageItemFactory = ImageItemDomFactory.createFactory();
            imageItemFactory.update(this.imageItemList[breakIdx].imageUrl, this.imageItemList[breakIdx].meta, this.imageItemList[breakIdx].changedState, "stack");
            this._dom.appendChild(imageItemFactory.dom);
            console.log("stacking", imageItemFactory.dom, this.dom);
        }
    }

    _setImageDiffClass(cls) {
        this.dom.classList.remove("is-new-image");
        this.dom.classList.remove("is-changed-image");
        this.dom.classList.remove("is-same-image");
        this.dom.classList.add(cls);
    }

    addBlankStack() {
        let imageItemFactory = ImageItemDomFactory.createFactory();
        imageItemFactory.toBlank();
        this._dom.appendChild(imageItemFactory.dom);
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
        return this.imageItemFactory.createDom();
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
        this.imageItemDiv = document.createElement("div");
        this.a_filename = document.createElement("a");
        this.a_source = document.createElement("a");
        this.img = document.createElement("img");
        this.variableInfoDiv = document.createElement("div");
    }

    get dom() {
        return this.imageItemDiv;
    }

    static createFactory() {
        const factory = new ImageItemDomFactory();
        factory.createDom();
        return factory;
    }

    createDom() {
        const imageUrl = this.imageUrl;
        const meta = this.meta;

        // img.image
        this.img.classList.add("image");
        this.img.src = this.imageUrl;
        this.imageItemDiv.appendChild(this.img);

        // div.image-item
        this.imageItemDiv.classList.add("image-item");

        // a
        const adiv = document.createElement("div");
        adiv.style.padding = "3px";
        adiv.style.paddingTop = "0px";
        adiv.appendChild(this.a_filename);
        adiv.appendChild(this.a_source);
        this.imageItemDiv.appendChild(adiv);

        // div.variable-info
        this.variableInfoDiv.classList.add("variable-info");
        if (this.imageUrl !== undefined && this.meta !== undefined) {
            this.update(this.imageUrl, this.meta);
        }
        this.imageItemDiv.appendChild(this.variableInfoDiv);

        return this.imageItemDiv;
    }

    toBlank() {
        this.img.src = "";
        this.a_filename.innerHTML = "";
        this.a_source.innerHTML = "";
        this.variableInfoDiv.innerHTML = "";
    }

    update(imageUrl, meta, changedState, renderMode = "stack") {
        switch (renderMode) {
            case "single":
                this._updateSingle(imageUrl, meta, changedState);
                break;
            case "stack":
                this._updateStack(imageUrl, meta, changedState);
                break;
        }
    }

    _updateSingle(imageUrl, meta, changedState) {
        this.imageUrl = imageUrl;
        this.meta = meta;

        // img.image
        this.img.src = imageUrl;

        // a
        this.a_filename.href = "#";
        this.a_filename.onclick = () => copyPngImageToClipboard(`${imageUrl} `);
        // this.a_filename.innerHTML = `< b > ${ meta.variable.evaluateName }</b > <br>`;
        this.a_filename.innerHTML = `${meta.variable.evaluateName}<br>`;
        this.a_filename.classList.add("evaluate-name");

        const workspaceFolder = meta.vscode.workspaceFolder.uri.fsPath;
        const sourcePathRelative = meta.frame.source.path.replace(workspaceFolder, ".");
        const sourcePathExp = `${sourcePathRelative}:${meta.frame.line}:${meta.frame.column}`;
        const imageFileFsPath = `file:\\\\\\${meta.vscode.filePath}`;
        this.a_source.classList.add("source-info");
        this.a_source.innerHTML = `${sourcePathExp}`;
        this.a_source.onclick = (() => () => {
            console.log("Open file", meta.frame.source.path, "pos:", [meta.frame.line, meta.frame.column]);
            // revealTextFile(meta.frame.source.path, [meta.frame.line, meta.frame.column]);
            vscodeOpen(meta.frame.source.path, [meta.frame.line, meta.frame.column]);
        })(meta);
        // this.a_source.innerHTML = ``;

        // div.variable-info
        const filename = decodeURI(imageUrl.split('/').pop());
        const imageSizeString = `${meta.imageInfo.mem_width}x${meta.imageInfo.mem_height}`;
        // variableInfoDiv.innerHTML = `<b><a onclick="copyPngImageToClipboard(${imageUrl})" href="${imageFileFsPath}">${meta.variable.evaluateName}</a></b>
        // this.variableInfoDiv.innerHTML = `<span>${meta.variable.type}</span> <span> ${imageSizeString}</span> <span> <i>${filename}</i></span>`;
        this.variableInfoDiv.innerHTML = `<span>${meta.variable.type}</span> <span> ${imageSizeString}</span></span>`;

        // Update is-***-image class
        this.imageItemDiv.classList.remove(`is-new-image`);
        this.imageItemDiv.classList.remove(`is-changed-image`);
        this.imageItemDiv.classList.remove(`is-same-image`);
        this.imageItemDiv.classList.add(`is-${changedState}-image`);
    }


    _updateStack(imageUrl, meta, changedState) {
        this.imageUrl = imageUrl;
        this.meta = meta;

        // img.image
        this.img.src = imageUrl;

        // a
        this.a_filename.href = "#";
        this.a_filename.onclick = () => copyPngImageToClipboard(`${imageUrl}`);
        // this.a_filename.innerHTML = `<b>${meta.variable.evaluateName}</b><br>`;
        // this.a_filename.innerHTML = `${meta.variable.evaluateName}<br>`;
        this.a_filename.innerHTML = `${meta.variable.evaluateName}@${meta.frame.name}<br>`;
        this.a_filename.classList.add("evaluate-name");

        const workspaceFolder = meta.vscode.workspaceFolder.uri.fsPath;
        const sourcePathRelative = meta.frame.source.path.replace(workspaceFolder, ".");
        const sourcePathExp = `${sourcePathRelative}:${meta.frame.line}:${meta.frame.column}`;
        const imageFileFsPath = `file:\\\\\\${meta.vscode.filePath}`;
        this.a_source.classList.add("source-info");
        this.a_source.innerHTML = `${sourcePathExp}`;
        this.a_source.onclick = (() => () => {
            console.log("Open file", meta.frame.source.path, "pos:", [meta.frame.line, meta.frame.column]);
            // revealTextFile(meta.frame.source.path, [meta.frame.line, meta.frame.column]);
            vscodeOpen(meta.frame.source.path, [meta.frame.line, meta.frame.column]);
        })(meta);
        // this.a_source.innerHTML = ``;

        // div.variable-info
        const filename = decodeURI(imageUrl.split('/').pop());
        const imageSizeString = `${meta.imageInfo.mem_width}x${meta.imageInfo.mem_height}`;
        // variableInfoDiv.innerHTML = `<b><a onclick="copyPngImageToClipboard(${imageUrl})" href="${imageFileFsPath}">${meta.variable.evaluateName}</a></b>
        // this.variableInfoDiv.innerHTML = `<span>${meta.variable.type}</span> <span> ${imageSizeString}</span> <span> <i>${filename}</i></span>`;
        this.variableInfoDiv.innerHTML = `<span>${meta.variable.type}</span> <span> ${imageSizeString}</span></span>`;

        // Update is-***-image class
        this.imageItemDiv.classList.remove(`is-new-image`);
        this.imageItemDiv.classList.remove(`is-changed-image`);
        this.imageItemDiv.classList.remove(`is-same-image`);
        this.imageItemDiv.classList.add(`is-${changedState}-image`);
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