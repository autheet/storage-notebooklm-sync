const fs = require('fs');
const path = require('path');
const ignore = require('ignore'); // Our new best friend for .gitignore parsing

const OUTPUT_FILE = 'tmp/concatenated.txt';
const START_DIR = '.';

// Define hardcoded directories to always exclude, regardless of .gitignore.
// '.git' and the script's 'tmp' output directory are typically always excluded.
// 'node_modules' is usually covered by .gitignore files.
const ALWAYS_EXCLUDED_DIRS = new Set(['.git', 'tmp']); // [1]

// Define the file extensions and specific filenames to include.
// This list is quite comprehensive based on the project's likely codebase. [6]
const FILE_EXTENSIONS = new Set([
  '.txt', '.md', '.py', '.dart', '.js', '.ts', '.html', '.css',
  '.java', '.kt', '.swift', '.c', '.cpp', '.h', '.hpp', '.rs',
  '.go', '.rb', '.php', '.yml', '.yaml', '.json', '.xml', '.sh',
  '.ini', '.conf', '.properties', '.gitignore', '.npmignore', '.svg' // Added .gitignore and .npmignore for completeness
]);
const FILE_NAMES = new Set(['Dockerfile']); // [6]

// Initialize a single 'ignore' instance. All .gitignore patterns will be added here.
const ig = ignore();

/**
 * Recursively loads patterns from all .gitignore files starting from a given directory
 * and adds them to the global 'ig' object. Patterns are adjusted to be relative
 * to the START_DIR.
 * Directories explicitly ignored by a parent's .gitignore (or hardcoded excludes) are not
 * traversed for further .gitignore files or content.
 */
function recursivelyLoadGitignorePatterns(currentDir) {
    // Determine the path relative to the initial START_DIR (our "repo root").
    const relativePathToStart = path.relative(START_DIR, currentDir);

    // Skip hardcoded excluded directories immediately. We don't even scan for .gitignore inside them.
    if (ALWAYS_EXCLUDED_DIRS.has(path.basename(currentDir))) {
        console.log(`  - Skipping pattern scan of hardcoded excluded directory: ${currentDir}`);
        return;
    }

    // Check for a .gitignore file in the current directory.
    const gitignorePath = path.join(currentDir, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
        const patterns = fs.readFileSync(gitignorePath, 'utf8');
        patterns.split('\n').forEach(pattern => {
            const trimmedPattern = pattern.trim();
            if (trimmedPattern === '') return; // Skip empty lines

            let adjustedPattern;
            if (relativePathToStart === '') {
                // If we're at the START_DIR, patterns are as-is relative to START_DIR.
                adjustedPattern = trimmedPattern;
            } else {
                // For subdirectories, patterns in their .gitignore are relative to that subdirectory.
                // We need to convert them to be relative to the overall START_DIR.
                // Patterns starting with '/' or '!/' in .gitignore are relative to the .gitignore file's own directory.
                // E.g., if currentDir is 'src/module' and pattern is '/foo', it means 'src/module/foo' globally.
                if (trimmedPattern.startsWith('/')) {
                    // For patterns like '/foo' in a subdirectory, strip the leading '/' and prepend the subdirectory's path.
                    adjustedPattern = path.join(relativePathToStart, trimmedPattern.substring(1)).replace(/\\/g, '/');
                } else if (trimmedPattern.startsWith('!/')) {
                    // Similar for negated root-relative patterns.
                    adjustedPattern = '!' + path.join(relativePathToStart, trimmedPattern.substring(2)).replace(/\\/g, '/');
                } else {
                    // Standard relative pattern (e.g., 'foo/', 'bar.txt'). Just prepend the subdirectory's path.
                    adjustedPattern = path.join(relativePathToStart, trimmedPattern).replace(/\\/g, '/');
                }
            }

            ig.add(adjustedPattern); // Add the adjusted pattern to our global ignore object.
            console.log(`  - Loaded pattern: "${trimmedPattern}" as "${adjustedPattern}" from ${gitignorePath}`);
        });
    }

    // Now, traverse subdirectories to find more .gitignore files.
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory()) {
            const fullPath = path.join(currentDir, entry.name);
            const entryRelativePath = path.relative(START_DIR, fullPath);

            // Crucial optimization: If this directory is already ignored by a previously loaded .gitignore pattern
            // (or by a hardcoded rule), we don't need to descend into it to find more .gitignore files.
            // This is how .gitignore works: if a directory is ignored, its contents are also ignored.
            // We check with a trailing slash to specifically match directory patterns.
            if (ig.ignores(entryRelativePath + '/')) {
                console.log(`  - Skipping scan of .gitignore in ignored directory: ${fullPath}`);
                continue;
            }

            // Recursively call for non-ignored subdirectories.
            recursivelyLoadGitignorePatterns(fullPath);
        }
    }
}

// Phase 1: Load all .gitignore patterns recursively from the starting directory.
console.log('Loading .gitignore patterns recursively...');
recursivelyLoadGitignorePatterns(START_DIR);
console.log('Finished loading .gitignore patterns.\n');

// Ensure the output directory exists and the output file is empty initially.
fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true }); [7]
fs.writeFileSync(OUTPUT_FILE, ''); [7]

console.log('Starting file scan...');

// Phase 2: Walk the directory tree and process files based on the collected ignore rules.
function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true }); [7]
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(START_DIR, fullPath);

    // Skip the output file itself to prevent recursion/self-inclusion. [1]
    if (relativePath === path.relative(START_DIR, OUTPUT_FILE)) {
      continue;
    }

    // Apply hardcoded exclusions first. These override any .gitignore un-ignore rules.
    if (ALWAYS_EXCLUDED_DIRS.has(entry.name)) {
        console.log(`  - Hardcoded ignored: ${fullPath}`);
        continue;
    }

    // Use the 'ignore' package to check if the path should be ignored by .gitignore patterns.
    // For directories, append a trailing slash to correctly match directory-specific patterns.
    const isIgnoredByGitignore = entry.isDirectory() ? ig.ignores(relativePath + '/') : ig.ignores(relativePath);

    if (isIgnoredByGitignore) {
        console.log(`  - Ignored ${fullPath} due to .gitignore pattern.`);
        continue; // Skip ignored files/directories
    }

    // If it's a directory and not ignored, recurse into it.
    if (entry.isDirectory()) {
        walkDir(fullPath); [3]
    } else if (entry.isFile()) {
        // If it's a file and not ignored, check its extension/name.
        const ext = path.extname(entry.name);
        const filename = entry.name;

        // Only process files with specified extensions or names. [3]
        if (FILE_EXTENSIONS.has(ext) || FILE_NAMES.has(filename)) {
            processFile(fullPath);
        }
    }
  }
}

// This function handles the "tar-style" magic for each file. [3]
function processFile(filePath) {
  try {
    const stat = fs.statSync(filePath); // Get file metadata, like in a real tarball.
    const content = fs.readFileSync(filePath, 'utf8');

    // Convert file permissions to a classic octal string (e.g., 644, 755).
    const perms = (stat.mode & 0o777).toString(8).padStart(3, '0');

    // Crafting the header. Note the path normalization for consistency. [8, 9]
    const header = [
      `--- START HEADER ---`,
      `path: ./${filePath.replace(/\\/g, '/')}`, // Standardize path separators.
      `size: ${stat.size} bytes`,
      `mode: ${perms}`,
      `uid: ${stat.uid}`,
      `gid: ${stat.gid}`,
      `mtime: ${stat.mtime.toUTCString()}`,
      `--- END HEADER ---`
    ].join('\n');

    // Adding a clear footer for file separation.
    const footer = `--- END: ./${filePath.replace(/\\/g, '/')} ---`;

    // Append the whole shebang to our output file.
    const entry = `${header}\n${content}\n${footer}\n\n`;
    fs.appendFileSync(OUTPUT_FILE, entry, 'utf8');
    console.log(`  + Added ${filePath}`);
  } catch (error) {
    console.error(`  - Failed to process ${filePath}: ${error.message}`);
  }
}

// Kick off the file system scan from the current directory.
walkDir(START_DIR); [3]

console.log(`\nText archive created successfully at ${OUTPUT_FILE}`);