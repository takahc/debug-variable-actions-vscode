const express = require('express');
const fs = require('fs');
const path = require('path');
const { glob } = require('glob');
const cors = require('cors');
const os = require('os');

const app = express();
const PORT = 8082;
const JSON_DIR = path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User', 'workspaceStorage', '9e945dd1c70d62ceffb1ab39d02775c0', 'akipg.debug-variable-actions-vscode').replace(/\\/g, "/");

// const JSON_DIR = path.join(__dirname, "../src");

// Use the cors middleware
app.use(cors());

// Middleware to serve static files
app.use(express.static(JSON_DIR));

// Endpoint to list all JSON files
app.get('/files', (req, res) => {
    fs.readdir(JSON_DIR, (err, files) => {
        if (err) {
            return res.status(500).json({ error: 'Unable to scan directory' });
        }
        const jsonFiles = files.filter(file => path.extname(file) === '.json');
        res.json(jsonFiles);
    });
});

// Endpoint to get the content of a specific JSON or PNG file
app.get('/files/:filename', (req, res) => {
    // const filename = decodeURI(req.params.filename);
    // console.log(filename);
    // const filePath = path.join(JSON_DIR, filename);

    const filePath = decodeURI(req.params.filename);
    const fileExtension = path.extname(filePath).toLowerCase();

    if (fileExtension === '.json') {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                return res.status(404).json({ error: 'File not found' });
            }
            try {
                const jsonData = JSON.parse(data);
                res.json(jsonData);
            } catch (parseError) {
                res.status(500).json({ error: 'Error parsing JSON file' });
            }
        });
    } else if (fileExtension === '.png') {
        fs.readFile(filePath, (err, data) => {
            if (err) {
                return res.status(404).json({ error: 'File not found' });
            }
            res.setHeader('Content-Type', 'image/png');
            res.send(data);
        });
    }
    else if (fileExtension === '.csv') {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                return res.status(404).json({ error: 'File not found' });
            }
            res.setHeader('Content-Type', 'text/csv');
            res.send(data);
        });
    } else {
        res.status(400).json({ error: 'Invalid file type' });
    }
});

// Endpoint to search for breakpoints.json files
app.get('/breakpoints', async (req, res) => {
    const pattern = path.join(JSON_DIR, '**', 'breakpoints.json').replace(/\\/g, "/");
    console.log("/breakpoints", pattern);

    try {
        const files = await glob(pattern);
        const filesWithDates = await Promise.all(files.map(async (file) => {
            const stats = await fs.promises.stat(file);
            return {
                // path: path.relative(JSON_DIR, file).replace(/\\/g, "/"),
                path: file.replace(/\\/g, "/"),
                stats
            };
        }));
        // res.json(files.map(file =>
        //     path.relative(JSON_DIR, file).replace(/\\/g, "%2F"))
        // );

        const output = {
            root: JSON_DIR,
            files: filesWithDates
        };

        res.json(output);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error searching for files' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});