console.log("hey yo");


// Handle the message inside the webview
window.addEventListener('message', event => {

    let message = event.data; // The JSON data our extension sent
    if (!message) { message = event.message; }
    if (!message) { message = event; }
    console.log("message received", message);

    if (message.command === 'variable') {
        doVariable(message);
    }
    else if (message.command === 'image') {
        url = message.url;
        console.log("image", url);
        doImage(url);
    }
});

//define data array
var tabledata = [
    { id: 1, name: "Oli Bob", progress: 12, gender: "male", rating: 1, col: "red", dob: "19/02/1984", car: 1 },
    { id: 2, name: "Mary May", progress: 1, gender: "female", rating: 2, col: "blue", dob: "14/05/1982", car: true },
    { id: 3, name: "Christine Lobowski", progress: 42, gender: "female", rating: 0, col: "green", dob: "22/05/1982", car: "true" },
    { id: 4, name: "Brendon Philips", progress: 100, gender: "male", rating: 1, col: "orange", dob: "01/08/1980" },
    { id: 5, name: "Margret Marmajuke", progress: 16, gender: "female", rating: 5, col: "yellow", dob: "31/01/1999" },
    { id: 6, name: "Frank Harbours", progress: 38, gender: "male", rating: 4, col: "red", dob: "12/05/1966", car: 1 },
];

var value;
function doImage(imageUrl) {
    let img = document.createElement("img");
    img.src = imageUrl;
    document.body.appendChild(img);
}

function doVariable(message) {
    var value = message.output.message.body.output;
    if (value === "\n") {
        return;
    }

    console.log("YOYO", value);
    value = JSON.parse(value);
    console.log("YOYO", value);
    // value = convertDfJsonToTabulatorJson(value);
    // console.log("YOYO", value)

    // var table = new Tabulator("#example-table", {
    //     data: value, //assign data to table
    //     autoColumns: true, //create columns from data field names
    // });

    jspreadsheet(document.getElementById('spreadsheet'), {
        data: value
    });

}


// function convertDfJsonToTabulatorJson(dfJson) {
//     dfJson.map((key) => {
// }