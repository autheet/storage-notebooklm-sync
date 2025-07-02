const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUTPUT_FILE = 'tmp/concatenated-compressed.txt';
const START_DIR = '.';
// Define directories to exclude from the scan
const EXCLUDED_DIRS = new Set(['.git', 'node_modules', 'tmp']);
// Define the file extensions and specific filenames to include
const FILE_EXTENSIONS = new Set([
    '.txt', '.md', '.py', '.dart', '.js', '.ts', '.html', '.css',
    '.java', '.kt', '.swift', '.c', '.cpp', '.h', '.hpp', '.rs',
    '.go', '.rb', '.php', '.yml', '.yaml', '.json', '.xml', '.sh',
    '.ini', '.conf', '.properties', '.gitignore', '.npmignore', '.svg', '.yaml', '.yml', '.md', '.txt', '.dart'
]);
const FILE_NAMES = new Set(['Dockerfile']);

// Ensure the output directory exists and the output file is empty
fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, '');

console.log('Starting file scan for compressed archive...');

// Recursive function to walk through directories
function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (EXCLUDED_DIRS.has(entry.name)) {
            continue; // Skip excluded directories
        }

        if (entry.isDirectory()) {
            walkDir(fullPath);
        } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            const filename = entry.name;
            // Process the file if its extension or name is in our include lists
            if (FILE_EXTENSIONS.has(ext) || FILE_NAMES.has(filename)) {
                processFile(fullPath);
            }
        }
    }
}

// Function to process a single file and append it to the archive
function processFile(filePath) {
    try {
        const stat = fs.statSync(filePath);
        const content = fs.readFileSync(filePath, 'utf8');

        // Compress the content
        const compressedContent = zlib.gzipSync(content);
        // Encode the compressed binary data to Base64 to make it text-based
        const encodedContent = compressedContent.toString('base64');

        // Format file permissions to be human-readable (e.g., -rw-r--r--)
        const perms = (stat.mode & 0o777).toString(8).padStart(3, '0');

        // Construct the text-based header with common tar-like variables
        const header = [
            `--- START HEADER ---`,
            `path: ./${filePath.replace(/\/g, '/')}`,
            `size: ${stat.size} bytes`,
            `compressed_size: ${encodedContent.length} bytes`,
            `mode: ${perms}`,
            `uid: ${stat.uid}`,
            `gid: ${stat.gid}`,
            `mtime: ${stat.mtime.toUTCString()}`,
            `encoding: base64`,
            `compression: gzip`,
            `--- END HEADER ---`
        ].join('
');

        const footer = `--- END: ./${filePath.replace(/\/g, '/')} ---`;

        // Append the entry to the output file
        const entry = `${header}
${encodedContent}
${footer}

`;
        fs.appendFileSync(OUTPUT_FILE, entry, 'utf8');
        console.log(`  + Added and compressed ${filePath}`);
    } catch (error) {
        console.error(`  - Failed to process ${filePath}: ${error.message}`);
    }
}

walkDir(START_DIR);
console.log(`
Compressed text archive created successfully at ${OUTPUT_FILE}`);
