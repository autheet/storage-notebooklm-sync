import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { authenticate } from '@google-cloud/local-auth';
import { google } from 'googleapis';

// --- Configuration ---
// The ID of the document to update. Extract this from the document's URL.
const DOCUMENT_ID = '1kfTD4U2BRjIyTM8COb1RFTUNpg7WkA4wg_n_WQ4ymqY';

// Scopes define the level of access you are requesting.
const SCOPES = ['https://www.googleapis.com/auth/documents'];

// Paths for authentication and temporary files.
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const TEMP_DIR = path.join(process.cwd(), 'tmp');
const OUTPUT_FILE = path.join(TEMP_DIR, 'concatenated.txt');

/**
 * Creates a formatted header for a file's content.
 * @param {string} filePath - The path of the file.
 * @returns {string} - The formatted header string.
 */
const createFileHeader = (filePath) => {
  const separator = '='.repeat(80);
  return `\n${separator}\nSTART OF FILE: ${filePath}\n${separator}\n\n`;
};

/**
 * Concatenates all text-based files from the current directory into a single file.
 * Mimics the behavior of the original `tar.js` script.
 */
async function concatenateFiles() {
  console.log('Scanning for text files in the current directory...');
  // Find all files, excluding node_modules, .git, and the tmp directory itself.
  const files = await glob('**/*', {
    nodir: true,
    ignore: ['node_modules/**', '.git/**', 'tmp/**', 'package*.json', 'update-doc.js', 'credentials.json', 'token.json'],
  });

  let concatenatedContent = `This document was auto-generated on: ${new Date().toUTCString()}\n`;

  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf8');
      concatenatedContent += createFileHeader(file);
      concatenatedContent += content;
    } catch (error) {
      console.warn(`Could not read file (may be binary): ${file}`);
    }
  }

  // Ensure the tmp directory exists.
  await fs.mkdir(TEMP_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_FILE, concatenatedContent);
  console.log(`Successfully concatenated ${files.length} files into ${OUTPUT_FILE}`);
  return concatenatedContent;
}

/**
 * Loads previously saved credentials from a file.
 * @returns {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentials() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Saves credentials to a file for future runs.
 * @param {OAuth2Client} client - The authenticated client.
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Main authorization function. It will try to load saved tokens,
 * and if that fails, it will initiate the local authentication flow.
 * @returns {Promise<OAuth2Client>}
 */
async function authorize() {
  let client = await loadSavedCredentials();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

/**
 * Overwrites the content of the specified Google Doc.
 * @param {OAuth2Client} authClient - The authenticated client.
 * @param {string} content - The new content for the document.
 */
async function updateDocument(authClient, content) {
  const docs = google.docs({ version: 'v1', auth: authClient });

  try {
    // First, get the current document to find its content length.
    const { data: docData } = await docs.documents.get({
      documentId: DOCUMENT_ID,
    });

    const docLength = docData.body.content.at(-1).endIndex - 1;

    // Create a batch update request.
    const requests = [
      // 1. Delete all existing content.
      {
        deleteContentRange: {
          range: {
            startIndex: 1, // Do not delete the first character.
            endIndex: docLength,
          },
        },
      },
      // 2. Insert the new content at the beginning.
      {
        insertText: {
          location: {
            index: 1,
          },
          text: content,
        },
      },
    ];

    console.log('Updating Google Doc...');
    await docs.documents.batchUpdate({
      documentId: DOCUMENT_ID,
      requestBody: {
        requests,
      },
    });
    console.log('✅ Document updated successfully!');

  } catch (error) {
    console.error('❌ Error updating document:', error.message);
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    const contentToUpload = await concatenateFiles();
    const authClient = await authorize();
    await updateDocument(authClient, contentToUpload);
  } catch (error) {
    console.error('An unexpected error occurred:', error);
  }
}

main();
