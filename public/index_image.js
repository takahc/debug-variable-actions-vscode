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

function addImageToBreakDiv(breakDiv, imageUrl, filename) {
    let imageContentDiv = document.createElement("div");
    imageContentDiv.classList.add("image-content");

    let imageDiv = document.createElement("div");
    imageDiv.classList.add("image");

    let img = document.createElement("img");
    img.src = imageUrl;
    imageDiv.appendChild(img);

    let filenameDiv = document.createElement("div");
    filenameDiv.classList.add("filename");
    filenameDiv.innerHTML = decodeURI(filename);

    imageContentDiv.appendChild(imageDiv);
    imageContentDiv.appendChild(filenameDiv);
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
        doImage(url, session_name, break_name, filename);
        // doImageSimple(url, break_name, filename);

    }
});


function doImage(imageUrl, session_name, break_name, filename) {
    console.log("doImage", imageUrl, session_name, break_name, filename);
    let breakDiv = breakDivs[session_name][break_name];
    console.log(breakDiv);
    addImageToBreakDiv(breakDiv, imageUrl, filename);
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