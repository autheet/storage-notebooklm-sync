// storage-notebooklm-sync/tar.cjs

const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = 'tmp/concatenated.txt';
const START_DIR = '.';

// Define directories to explicitly exclude from the recursive scan.
// These are typically build outputs, caches, or IDE configurations.
const EXCLUDED_DIRS = new Set([
    '.venv', // python venv
    'venv', // python venv
    'Pods', // Pods
  '.git', // Git version control directory
  'node_modules', // Node.js package dependencies
  'tmp', // Temporary output directory for concatenated.txt
  '.vscode', // VS Code IDE configuration files [10, 11]
  'build', // Top-level Flutter build output directory [12, 13]
  '.dart_tool', // Dart/Flutter internal tool-generated files and caches
  'android/build', // Android build output
  'android/.gradle', // Android Gradle caches
  'ios/build', // iOS build output
  'ios/Pods', // iOS CocoaPods dependencies
  'ios/.symlinks', // iOS Xcode symlinks
  'web/build', // Web build output
  'windows/build', // Windows build output
  'linux/build', // Linux build output
  'macos/build' // macOS build output
]);

// Define the file extensions to explicitly include.
// .md files are intentionally removed as per the instruction.
const FILE_EXTENSIONS = new Set([
  '.txt',
  '.py',
  '.dart', // Keep .dart for source code, further filtering for generated files occurs below
  '.js',
  '.ts',
  '.html',
  '.css',
  '.java',
  '.kt',
  '.swift',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.rs',
  '.go',
  '.rb',
  '.php',
  '.yml',
  '.yaml',
  '.json',
  '.xml',
  '.sh',
  '.ini',
  '.conf',
  '.properties',
  '.gitignore', // Git ignore file, useful context
  '.npmignore', // NPM ignore file, useful context
  '.svg' // Often used in text-based formats (e.g., SVG as XML)
]);

// Define specific filenames to always include, regardless of their extension or location.
// These are typically crucial configuration files.
const FILE_NAMES = new Set([
  'Dockerfile',
  'pubspec.yaml', // Flutter project dependencies and metadata [14, 15]
  'firebase.json', // Firebase project configuration [12, 13, 16-19]
  'firestore.rules', // Firestore security rules [20-24]
  'analysis_options.yaml', // Dart analyzer and linting rules [25-32]
]);

// Define regular expressions for specific file patterns to exclude.
// This targets auto-generated files that end up in source directories.
const EXCLUDED_FILE_PATTERNS = [
  // Generated Flutter localization files [6, 7, 33-35]
  /lib\/l10n\/app_localizations\.dart$/,
  /lib\/l10n\/app_localizations_.*\.dart$/,
  // Generated Firebase options file [8, 9]
  /lib\/firebase_options\.dart$/,
  // Generated Plugin Registrant files (across various platforms) [36-39]
  /lib\/generated_plugin_registrant\.dart$/, // For generic Dart path
  /ios\/Runner\/GeneratedPluginRegistrant\.swift$/,
  /macos\/Flutter\/GeneratedPluginRegistrant\.swift$/,
  /windows\/flutter\/generated_plugin_registrant\.h$/,
  // Common build_runner generated files (e.g., for Freezed, JSON serializable)
  /\.g\.dart$/,
  /\.freezed\.dart$/,
  /\.gr\.dart$/, // go_router generated files
  // Other commonly generated files not useful for AI summarization
  /pubspec\.lock$/, // Dependency lock file, frequently changes [14, 15]
];

// Ensure the output directory exists and the output file is empty
fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, '');

console.log('Starting file scan...');

/**
 * Determines if a file should be excluded based on specific patterns or names.
 * @param {string} filePath The full path to the file.
 * @returns {boolean} True if the file should be excluded.
 */
function shouldExcludeFile(filePath) {
  const normalizedPath = path.normalize(filePath); // Normalize path for consistent matching

  // Check against specific excluded file patterns
  for (const pattern of EXCLUDED_FILE_PATTERNS) {
    if (pattern.test(normalizedPath)) {
      return true;
    }
  }
  return false;
}

/**
 * Recursively walks through directories to find files to include.
 * @param {string} dir The current directory to scan.
 */
function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(START_DIR, fullPath); // Get path relative to START_DIR

    // Check if the current entry (or its parent chain) is an explicitly excluded directory.
    let isExcludedDir = false;
    for (const excludedDir of EXCLUDED_DIRS) {
      if (relativePath.startsWith(excludedDir) || relativePath === excludedDir) {
        isExcludedDir = true;
        break;
      }
    }
    if (isExcludedDir) {
      console.log(`  - Skipping excluded directory: ${fullPath}`);
      continue; // Skip the entire excluded directory tree
    }

    if (entry.isDirectory()) {
      walkDir(fullPath); // Recurse into subdirectories
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      const filename = entry.name;

      // Determine if the file should be processed:
      // 1. Its extension must be in FILE_EXTENSIONS OR its name in FILE_NAMES.
      // 2. It must NOT be a Markdown file (.md).
      // 3. It must NOT match any of the specific EXCLUDED_FILE_PATTERNS.
      const shouldProcess =
        (FILE_EXTENSIONS.has(ext) || FILE_NAMES.has(filename)) &&
        ext !== '.md' && // Explicitly exclude .md files as per instruction
        !shouldExcludeFile(fullPath);

      if (shouldProcess) {
        processFile(fullPath);
      } else {
        console.log(`  - Skipping file: ${fullPath} (does not match criteria or is excluded)`);
      }
    }
  }
}

/**
 * Processes a single file: reads its content, formats it with a header/footer,
 * and appends it to the output file.
 * @param {string} filePath The full path to the file to process.
 */
function processFile(filePath) {
  try {
    const stat = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf8');

    // Format file permissions to be human-readable (e.g., -rw-r--r--)
    const perms = (stat.mode & 0o777).toString(8).padStart(3, '0');

    // Construct the text-based header with common tar-like variables
    const header = [
      `--- START HEADER ---`,
      `path: ./${path.relative(START_DIR, filePath).replace(/\\/g, '/')}`,
      `size: ${stat.size} bytes`,
      `mode: ${perms}`,
      `uid: ${stat.uid}`,
      `gid: ${stat.gid}`,
      `mtime: ${stat.mtime.toUTCString()}`,
      `--- END HEADER ---`
    ].join('\n');

    const footer = `--- END: ./${path.relative(START_DIR, filePath).replace(/\\/g, '/')} ---`;

    // Append the entry to the output file
    const entry = `${header}\n${content}\n${footer}\n\n`;
    fs.appendFileSync(OUTPUT_FILE, entry, 'utf8');
    console.log(`  + Added ${filePath}`);
  } catch (error) {
    console.error(`  - Failed to process ${filePath}: ${error.message}`);
  }
}

// Start the file scanning process
walkDir(START_DIR);
console.log(`\nText archive created successfully at ${OUTPUT_FILE}`);