console.log("hey yo");

var sessionDivs = {};
var breakDivs = {};
const vscode = acquireVsCodeApi();

class ImageTraceManager {
    constructor(parentDomQuery) {
        this.imageTraceList = {};
        this.parentDomQuery = parentDomQuery;
        this.captures = [];

        // Slider to seek captures
        this.slider = this._initial_slider;

        this._dom = this._initial_dom;
        this.addToParentDom();
    }

    get _initial_dom() {
        // div.image-trace-manager
        let imageTraceManagerDiv = document.createElement("div");
        imageTraceManagerDiv.classList.add("image-trace-manager");
        return imageTraceManagerDiv;
    }

    get _initial_slider() {
        let slider = document.createElement("input");
        slider.type = "range";
        slider.min = 0;
        slider.max = 0;
        slider.step = 0;
        slider.oninput = (e) => { this._handleSliderEvent(e) };
        return slider;
    }

    get dom() {
        return this._dom;
    }

    addToParentDom() {
        document.querySelector(this.parentDomQuery).appendChild(this.slider);
        document.querySelector(this.parentDomQuery).appendChild(this.dom);
    }

    has(id) {
        return (id in this.imageTraceList);
    }

    get(id) {
        return this.imageTraceList[id];
    }

    addImageTrace(id) {
        if (!this.has(id)) {
            let imageTrace = new ImageTrace(this, id);
            this.imageTraceList[id] = imageTrace;
            this.dom.appendChild(imageTrace.dom)
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

        console.log("captured", cap, this.captures);
    }

    render(captureIdx = -1, isSliderEvent = false) {
        let cap = undefined;;
        if (captureIdx < 0) {
            cap = this.captures[this.captures.length - 1];
        } else {
            if (captureIdx > this.captures.length - 1) {
                displayInstanceMessage(`Error! captureIdx = ${captureIdx} is over captures.length-1 = ${this.captures.length - 1}`);
                return;
            }
            cap = this.captures[captureIdx];
        }

        if (!isSliderEvent && captureIdx === -1) {
            // Set slider value
            this.slider.value = this.captures.length - 1;
        }

        Object.entries(this.imageTraceList).forEach(([id, imageTrace]) => {
            let idx;
            if (cap !== undefined) {
                const idx = cap[imageTrace.id];
                if (idx !== undefined) {
                    imageTrace.show();
                    imageTrace.render(idx);
                } else {
                    // Here comes imageTrace, which did not exist at this captureIdx
                    imageTrace.hide();
                }
            } else {
                imageTrace.render(imageTrace.lastIdx);
            }
        });

    }

    _handleSliderEvent(e) {
        let captureIdx = e.target.value;
        this.render(captureIdx, true);
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
        }
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
        const newRenderMode = this.opt.showAll ? "showAll" : "single";
        if (this.renderMode !== newRenderMode) {
            console.log("Intermediate initialization of imageTrace's dom!");
            // this._dom = this._initial_dom; // initialize dom if renderMode is changed
        }
        switch (newRenderMode) {
            case "single":
                this._renderSingle(idx)
                break
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
            const imdom = this.imageItemFactory.create()
            console.log("imdom", imdom, this.dom)
            this.dom.appendChild(imdom);
            console.log("imdom after", imdom, this.dom)
        }
        else if (idx === this.lastRenderedIdx) {
            return;
        }
        const imageItem = this.imageItemList[idx];
        this.imageItemFactory.update(imageItem.imageUrl, imageItem.meta);
        this.lastRenderedIdx = idx;
    }

    get lastIdx() {
        return this.imageItemList.length - 1;
    }

    addImage(imageUrl, meta) {
        let imageItem = new ImageItem(imageUrl, meta, this.lastIdx + 1);  // TODO: allow inserting
        this.imageItemList.push(imageItem);
        // this._dom.appendChild(imageItem.dom);
    }
}

class ImageItem {
    constructor(imageUrl, meta, idx = undefined) {
        this.imageUrl = imageUrl;
        this.idx = idx;
        this.meta = meta;
        this.imageItemFactory = new ImageItemDomFactory(imageUrl, meta);
        this._dom = this._initial_dom;
    }

    get _initial_dom() {
        return this.imageItemFactory.create();
    }

    get dom() {
        return this._dom;
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

    create() {
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
        adiv.appendChild(this.a_filename)
        adiv.appendChild(this.a_source)
        this.imageItemDiv.appendChild(adiv);

        // div.variable-info
        this.variableInfoDiv.classList.add("variable-info");
        if (this.imageUrl !== undefined && this.meta !== undefined) {
            this.update(this.imageUrl, this.meta);
        }
        this.imageItemDiv.appendChild(this.variableInfoDiv);

        return this.imageItemDiv;
    }

    update(imageUrl, meta) {
        this.imageUrl = imageUrl;
        this.meta = meta;

        // img.image
        this.img.src = imageUrl;

        // a
        this.a_filename.href = "#";
        this.a_filename.onclick = () => copyPngImageToClipboard(`${imageUrl}`);
        // this.a_filename.innerHTML = `<b>${meta.variable.evaluateName}</b><br>`;
        this.a_filename.innerHTML = `${meta.variable.evaluateName}<br>`;
        this.a_filename.classList.add("evaluate-name");

        const workspaceFolder = meta.vscode.workspaceFolder.uri.fsPath;
        const sourcePathRelative = meta.frame.source.path.replace(workspaceFolder, ".");
        const sourcePathExp = `${sourcePathRelative}:${meta.frame.line}:${meta.frame.column}`;
        const imageFileFsPath = `file:\\\\\\${meta.vscode.filePath}`;
        this.a_source.innerHTML = `${sourcePathExp}`;
        this.a_source.onclick = () => {
            console.log("Open file", meta.frame.source.path, "pos:", [meta.frame.line, meta.frame.column]);
            // revealTextFile(meta.frame.source.path, [meta.frame.line, meta.frame.column]);
            vscodeOpen(meta.frame.source.path);
        };
        // this.a_source.innerHTML = ``;

        // div.variable-info
        const filename = decodeURI(imageUrl.split('/').pop());
        const imageSizeString = `${meta.imageInfo.mem_width}x${meta.imageInfo.mem_height}`;
        // variableInfoDiv.innerHTML = `<b><a onclick="copyPngImageToClipboard(${imageUrl})" href="${imageFileFsPath}">${meta.variable.evaluateName}</a></b>
        this.variableInfoDiv.innerHTML = `<span>${meta.variable.type}</span> <span> ${imageSizeString}</span> <span> <i>${filename}</i></span>`;
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


const manager = new ImageTraceManager("#wrapper");

// Handle the message inside the webview
window.addEventListener('message', event => {

    let message = event.data; // The JSON data our extension sent
    if (!message) { message = event.message; }
    if (!message) { message = event; }
    console.log("message received", message);

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
        displayInstanceMessage(message.message);
    }
});



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
            displayInstanceMessage(`Copied ${imageUrl}`);
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
            xhr.onerror = function () { reject("Network error.") };
            xhr.onload = function () {
                if (xhr.status === 200) { resolve(xhr.response) }
                else { reject("Loading error:" + xhr.statusText) }
            };
            xhr.send();
        }
        catch (err) { reject(err.message) }
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
    })
}

function vscodeOpen(uri) {
    vscode.postMessage({
        command: "open",
        text: "",
        uri
    })
}

function displayInstanceMessage(s) {
    document.querySelector("#instant-message").innerHTML = s;
    setTimeout(() => {
        document.querySelector("#instant-message").innerHTML = "";
    }, 1500);
}