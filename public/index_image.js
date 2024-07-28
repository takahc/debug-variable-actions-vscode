console.log("hey yo");

var sessionDivs = {};
var breakDivs = {};

function createSessionDiv(session_name) {
    let div = document.createElement("div");
    let title = document.createElement("h2");
    let contentDiv = document.createElement("div");
    div.appendChild(title);
    div.appendChild(contentDiv);
    contentDiv.classList.add("session-content");
    div.classList.add("session");
    title.innerHTML = session_name;
    return contentDiv;
}

function createBreakDiv(break_name) {
    let div = document.createElement("div");
    let title = document.createElement("h3");
    title.innerHTML = break_name;
    div.appendChild(title);
    div.classList.add("break");
    return div;
}

function addImageToBreakDiv(breakDiv, imageUrl, message) {
    const meta = message.meta;
    let imageContentDiv = document.createElement("div");
    imageContentDiv.classList.add("image-content");

    let imageDiv = document.createElement("div");
    imageDiv.classList.add("image");

    let img = document.createElement("img");
    img.src = imageUrl;
    imageDiv.appendChild(img);

    let variableInfoDiv = document.createElement("div");
    variableInfoDiv.classList.add("variable-info");

    // path
    const workspaceFolder = meta.vscode.workspaceFolder.uri.fsPath;
    const sourcePathRelative = meta.frame.source.path.replace(workspaceFolder, ".");
    const sourcePathExp = `${sourcePathRelative}:${meta.frame.line}:${meta.frame.column}`;

    const imageFileFsPath = `file:\\\\\\${meta.vscode.filePath}`;

    const filename = decodeURI(imageUrl.split('/').pop());
    const imageSizeString = `${meta.imageInfo.mem_width}x${meta.imageInfo.mem_height}`;

    // variableInfoDiv.innerHTML = `<b><a onclick="copyPngImageToClipboard(${imageUrl})" href="${imageFileFsPath}">${meta.variable.evaluateName}</a></b>
    variableInfoDiv.innerHTML = `<b><a style="font-size:medium" onclick="copyPngImageToClipboard('${imageUrl}')" href="#">${meta.variable.evaluateName}</a></b>
    <span style="font-size:medium">  ${meta.variable.type}</span> <span> ${imageSizeString}</span> <span> <i> ${filename}</i></span><br>
    <a href=${sourcePathExp}>${sourcePathExp}</a>`


    // details
    // const details = document.createElement("details");
    // details.innerHTML = `<summary>...</summary>${JSON.stringify(meta, null, 2)}`;
    // variableInfoDiv.appendChild(details);

    imageContentDiv.appendChild(imageDiv);
    imageContentDiv.appendChild(variableInfoDiv);
    breakDiv.appendChild(imageContentDiv);
    console.log("added img to breakDiv", breakDiv);

}

// Handle the message inside the webview
window.addEventListener('message', event => {

    let message = event.data; // The JSON data our extension sent
    if (!message) { message = event.message; }
    if (!message) { message = event; }
    console.log("message received", message);

    if (message.command === 'image') {
        url = message.url;
        console.log("image", url);
        const filename = url.split('/').pop();
        const break_name = url.split('/').slice(-2)[0];
        const session_name = url.split('/').slice(-3)[0];

        const wrapper = document.querySelector("#wrapper");
        if (!sessionDivs[session_name]) {
            sessionDivs[session_name] = createSessionDiv(session_name);
            wrapper.insertBefore(sessionDivs[session_name].parentNode, wrapper.firstChild);
        }
        if (!breakDivs[session_name]) {
            breakDivs[session_name] = {};
        }
        if (!breakDivs[session_name][break_name]) {
            breakDivs[session_name][break_name] = createBreakDiv(break_name);
            sessionDivs[session_name].insertBefore(breakDivs[session_name][break_name], sessionDivs[session_name].firstChild);
        }
        console.log(filename, break_name, session_name);
        console.log(sessionDivs, breakDivs);
        doImage(url, session_name, break_name, message);
        // doImageSimple(url, break_name, filename);

    }
});


function doImage(imageUrl, session_name, break_name, message) {
    console.log("doImage", imageUrl, session_name, break_name, message);
    let breakDiv = breakDivs[session_name][break_name];
    console.log(breakDiv);
    addImageToBreakDiv(breakDiv, imageUrl, message);
}


function doImageSimple(imageUrl, break_name, filename) {
    let div = document.createElement("div");
    let img = document.createElement("img");
    let span = document.createElement("span");
    span.innerHTML = imageUrl;
    img.src = imageUrl;

    div.appendChild(img);
    div.appendChild(span);
    document.body.appendChild(div);
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

function displayInstanceMessage(s) {
    document.querySelector("#instant-message").innerHTML = s;
    setTimeout(() => {
        document.querySelector("#instant-message").innerHTML = "";
    }, 1500);
}