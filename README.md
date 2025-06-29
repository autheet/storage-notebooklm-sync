# **GitHub Action: storage-notebooklm-sync** 
# THIS IS NOT READY TO USE YET


git submodule add --branch main https://github.com/autheet/storage-notebooklm-sync.git storage-notebooklm-sync


This GitHub Action automates the process of synchronizing your repository's source code with a **NotebookLM for Enterprise** data source. Please note, this tool is specifically designed for enterprise users and relies on the Google Cloud APIs available with that service.

It is designed to be a "set it and forget it" tool. Once configured, every push to your main branch will automatically upload your repository's files to a Google Cloud Storage (GCS) bucket and refresh the corresponding Data Store in NotebookLM, ensuring your AI research assistant always has the most current version of your codebase.

## **The Problem This Solves**

NotebookLM is a powerful tool for analyzing documents, but keeping it synced with an active codebase can be a manual and repetitive process. This is especially true for enterprise environments where security, automation, and up-to-date information are critical.

This action addresses several key challenges:

* **Automation:** It completely automates the process of packaging and refreshing your codebase as a NotebookLM source.
* **Enterprise Integration:** This action uses the official Google Cloud APIs to interact with the backend of NotebookLM for Enterprise (**Vertex AI Agent Builder**), allowing for robust and secure programmatic updates.

## **How It Works**

This workflow is triggered on every push to your main branch and performs the following steps:

1.  **Guided Setup Check:** The action first verifies that all necessary configuration (in the form of GitHub Secrets) is in place. If not, it fails with clear, instructive error messages telling you exactly what to set up.
2.  **Upload to GCS:** The action securely authenticates with Google Cloud and uploads the repository's file structure to a specified Google Cloud Storage (GCS) bucket.
3.  **Create or Refresh Data Store:** Finally, the action makes an API call to **Vertex AI Agent Builder**.
    * If a Data Store with the ID you specified doesn't exist, it creates a new one.
    * It then triggers an incremental import from the GCS folder, which effectively refreshes the Data Store with the latest content, adding new files and updating existing ones.

## **Workflow Strategies: Folder Sync vs. Single File**

This Action supports two methods for packaging your repository. The default and recommended method for most use cases is **Folder Sync**.

### **Folder Sync (Recommended Default)**

* **How it works:** This method uploads your repository's directory structure and individual files directly to a GCS folder. NotebookLM's Data Store then ingests the entire folder.
* **Pros:**
    * Preserves individual file names and structure.
    * Provides precise, file-specific citations within NotebookLM (e.g., "Answer based on src/api/auth.py").
    * More intuitive to browse the source data in GCS.
* **Cons:**
    * Each file in your repository counts toward the Data Store's document limit.

### **Single File Concatenation (Optional Alternative)**

* **How it works:** This method scans your repository for text files, concatenates them all into a single .txt file, and uploads that one file to GCS. The Data Store ingests only this single source.
* **Pros:**
    * Bypasses document count limits, making it ideal for repositories with thousands of small files.
* **Cons:**
    * Loses individual file context. Citations in NotebookLM will always point to the single large file (e.g., repository\_content.txt), making it harder to trace information back to its original source file.

*(Note: The GitHub Action workflow file is pre-configured for the **Folder Sync** method. To use the single-file method, you would need to modify the workflow script.)*

## **Prerequisites: One-Time Setup**

Before this action can run successfully, you must complete a one-time setup in both Google Cloud and your GitHub repository.

### **A. Google Cloud Platform Setup**

1.  **Create a GCS Bucket:** In your Google Cloud project, create a Cloud Storage bucket. This will be the landing spot for your repository content.
2.  **Create a Service Account:** Navigate to **IAM & Admin > Service Accounts** and create a new service account (e.g., github-notebooklm-action).
3.  **Grant IAM Roles:** Grant the service account you just created the following two roles:
    * Storage Object Admin (to write files to the GCS bucket)
    * Vertex AI Search Admin (to create and refresh the NotebookLM Data Store)
4.  **Generate a JSON Key:** For the service account, create a new JSON key and download it to your computer.

### **B. GitHub Repository Setup**

Navigate to your repository's **Settings > Secrets and variables > Actions** and create the following four **repository secrets**:

1.  GCP\_PROJECT\_ID
    * **Value:** Your Google Cloud Project ID.
2.  CODE\_GCS
    * **Value:** The name of the GCS bucket you created (e.g., my-repo-content-for-notebooklm).
3.  NOTEBOOKLM\_DATA\_STORE\_ID
    * **Value:** A unique ID you choose for your NotebookLM data source. This should be a descriptive, machine-friendly string (e.g., my-project-main-branch-source).
4.  GCP\_SA\_KEY
    * **Value:** The Base64 encoded content of the JSON key file you downloaded.
    * **How to get this value:** Open a terminal on your computer and run the appropriate command:
        * **On macOS / Linux:** `base64 /path/to/your/keyfile.json`
        * **On Windows (PowerShell):** `[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\your\keyfile.json"))`
    * Copy the entire string output by the command and paste it into the GitHub secret's value field.

## **Usage**

Create a new file in your repository at the following path: `.github/workflows/sync-to-notebooklm.yml`. Paste the entire code block from the final GitHub Action we designed into this file.

Once you commit this file and have the secrets configured, the action will run on the next push to main.

### **Connecting to NotebookLM (Manual First Step)**

After the GitHub Action has run successfully for the first time, you need to connect the source to your notebook in the UI:

1.  Open your **NotebookLM for Enterprise** instance.
2.  Create a new notebook or open an existing one.
3.  Click **+ Add source**.
4.  Your new Data Store (named with the ID you provided in the NOTEBOOKLM\_DATA\_STORE\_ID secret) will appear in the list of available sources. Select it.

From this point on, you do not need to repeat this step. The action will keep this source updated automatically in the background.

## **Frequently Asked Questions (FAQ)**

Q: Can I use this with the free, personal version of NotebookLM?
A: No. This action relies on the Vertex AI Agent Builder API, which is only available with NotebookLM for Enterprise.
Q: Can I transfer my existing personal notebook to an enterprise account?
A: No, there is no direct transfer or migration tool. The underlying data storage and security models are completely separate. You must manually recreate the notebook in your enterprise account by re-adding the sources.

## **Anatomy of a Reusable GitHub Action Repository**

When creating a reusable GitHub Action for others to use (for instance, publishing it to the GitHub Marketplace), the repository follows a specific, conventional structure. It is different from a repository that simply *uses* actions.

* `action.yml` (or `action.yaml`): This is the most important file and must be in the root directory. It is the metadata file that defines the action's name, description, branding (icon and color), inputs, outputs, and specifies how the action's code should be run.
* `README.md`: This file provides the detailed documentation for the action. Its content is displayed on the action's main page in the GitHub Marketplace.
* `LICENSE`: A file containing the software license (e.g., MIT, Apache 2.0) that tells others how they are permitted to use your action.
* **Action Code Files:** These are the files containing the actual logic of your action.
    * **JavaScript:** Actions can be written in JavaScript and run directly on the GitHub-hosted runner using Node.js. This is often faster for simple actions.
    * **Python via Docker:** A very common and robust method is to write your action in Python. The code is packaged into a Docker container, which GitHub builds and runs. In your `action.yml`, you would specify `using: 'docker'` and point to your `Dockerfile`. This is the recommended approach for actions with dependencies or complex logic, like this one.
    * **Composite:** Simple shell scripts can be combined directly in the `action.yml` using `using: 'composite'`.

A repository designed to be a publishable action should be lean and contain only the files necessary for the action to function. It should not contain a `.github/workflows` directory, as that is for consuming actions, not defining them.

### **Internal Development Notes (Do Not Publish)**

This action's source code is managed within a subfolder named `storage-notebooklm-sync` inside a larger parent monorepo.

To streamline the development workflow, the parent repository contains a separate GitHub Action located at `.github/workflows/push_to_action_repo.yml`. This workflow is configured to automatically push the contents of the `storage-notebooklm-sync` subfolder to the main branch of its dedicated, public-facing repository every time a push is made to the main branch of the parent monorepo. This ensures the published action is always in sync with the development source.

## **Publishing Guide for LLMs and Developers**

This section outlines the complete process for publishing this tool as a reusable, public GitHub Action on the Marketplace.

### **Step 1: Create the Public Action Repository**

First, create a new, public GitHub repository. This repository will house the action and will be what users see on the Marketplace. Example name: `storage-notebooklm-sync`.

### **Step 2: Create the Core Action Files**

In the root of this new public repository, you will create the files that define the action.

**1. `action.yml` (The Action's Manifest)**

This file defines the action's metadata, inputs, and how it runs.

```yaml
# action.yml
name: 'storage-notebooklm-sync'
description: 'Uploads repository content to GCS and refreshes a NotebookLM for Enterprise data store.'
author: 'Your Name or Org'

branding:
  icon: 'cloud-upload'
  color: 'blue'

inputs:
  gcp_project_id:
    description: 'The Google Cloud Project ID.'
    required: true
  gcs_bucket:
    description: 'The GCS bucket to upload the repository content to.'
    required: true
  datastore_id:
    description: 'The Vertex AI Data Store ID to create or refresh.'
    required: true
  gcp_sa_key:
    description: 'The Base64 encoded Google Cloud Service Account key.'
    required: true
  source_subfolder:
    description: 'Optional subfolder within the repo to sync.'
    required: false
    default: '.'

runs:
  using: 'docker'
  image: 'Dockerfile'

´´´
2. Dockerfile (The Action's Environment)

This file defines the container where your Python script will run.

Dockerfile

# Dockerfile
FROM python:3.9-slim

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the action's Python script into the container
COPY main.py /main.py

# Set the entrypoint for the container
ENTRYPOINT ["python", "/main.py"]
3. requirements.txt (The Python Dependencies)

This file lists the Python libraries needed by your script.

# requirements.txt
google-cloud-discoveryengine
google-cloud-storage
4. main.py (The Action's Logic)

This is the Python script that performs all the work. It will read the inputs provided in the action.yml file as environment variables (prefixed with INPUT_).

(This would contain the logic from our previous discussions for creating/refreshing the data store and uploading to GCS, adapted to read from INPUT_* environment variables.)

5. LICENSE

Add a file named LICENSE containing the text of an open-source license, such as the MIT License.

Step 3: Set up the Automation from the Monorepo
This step ensures that your development work in the storage-notebooklm-sync subfolder is automatically pushed to the public action repository.

In the parent monorepo, create the following workflow file:

File: .github/workflows/push_to_action_repo.yml

YAML

# .github/workflows/push_to_action_repo.yml
name: Sync Action to Public Repo

on:
  push:
    branches:
      - main
    paths:
      - 'storage-notebooklm-sync/**' # Only run when files in the subfolder change

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Parent Repo
        uses: actions/checkout@v4

      - name: Push Subfolder to Action Repo
        uses: srt32/git-actions@v0.0.3
        with:
          # The HTTPS URL to the public action repository with an access token
          # Example: https://<YOUR_PAT>@[github.com/your-username/storage-notebooklm-sync.git](https://github.com/your-username/storage-notebooklm-sync.git)
          repository: 'https://${{ secrets.ACTION_REPO_PAT }}@[github.com/YOUR_USERNAME/YOUR_ACTION_REPO.git](https://github.com/YOUR_USERNAME/YOUR_ACTION_REPO.git)'
          # The branch in the public repo to push to
          branch: 'main'
          # The subfolder in this monorepo to use as the source
          source_dir: 'storage-notebooklm-sync'
Create a Secret for the Push Action:

You need to create a Personal Access Token (PAT) with repo scope.

In the parent monorepo's settings, create a secret named ACTION_REPO_PAT and paste your PAT as the value.

Step 4: Publish to the GitHub Marketplace
This is the final, manual step.

Navigate to the public action repository on GitHub.

Click on the Releases tab.

Click "Draft a new release."

Give your release a version tag (e.g., v1.0.0) and a title.

You will see a checkbox: "Publish this Action to the GitHub Marketplace." Check this box.

Click Publish release.

Your action is now live on the GitHub Marketplace for anyone to use.

Submodules
This repository utilizes a Git submodule for the storage-notebooklm-sync component. This component is also maintained as a standalone GitHub Action for the Marketplace.

Cloning with Submodules
To clone this repository and automatically fetch the submodule content, use the --recursive flag:

Bash

git clone --recursive [https://github.com/autheet/myapp.git](https://github.com/autheet/myapp.git)
Initializing Submodules (if already cloned)
If you have already cloned the repository without the --recursive flag, you can initialize and update the submodule later:

Bash

cd myapp-repository-root
git submodule update --init --recursive
Working with the storage-notebooklm-sync Submodule
If you plan to contribute to or update the storage-notebooklm-sync component directly from within this repository, follow these steps:

Navigate into the submodule directory:

Bash

cd storage-notebooklm-sync
Make your changes and commit them locally within the submodule:

Bash

# Make code changes here
git add .
git commit -m "Your descriptive message for changes in storage-notebooklm-sync"
Push the changes to the storage-notebooklm-sync's remote repository:

Bash

git push origin main # Or your development branch for the submodule
Navigate back to the main myapp repository's root:

Bash

cd ..
Commit the submodule pointer update in myapp:
Git will recognize that the submodule's reference has changed. You need to commit this change in the main repository.

Bash

git add storage-notebooklm-sync
git commit -m "Update storage-notebooklm-sync submodule to latest commit"
Push the myapp repository's update:

Bash

git push origin main
This ensures that both repositories are correctly linked and updated.
