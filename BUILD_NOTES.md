# SKYSCOPE AI Build & Packaging Notes

This document provides instructions for building, packaging, and running the SKYSCOPE AI application.

## 1. Prerequisites

Before you begin, ensure you have the following installed on your system:

1.  **Node.js and npm/yarn**:
    *   Node.js (LTS version recommended).
    *   npm (comes with Node.js) or Yarn.
2.  **Git**: For cloning the repository.
3.  **Ollama**:
    *   Ollama must be installed and running on your system. Visit [https://ollama.com/](https://ollama.com/) for installation instructions.
    *   **Required Models**: You need to pull at least one general-purpose chat model and one multimodal (vision-enabled) model. Examples:
        *   `ollama pull llama3` (for general chat)
        *   `ollama pull llava` (for vision tasks; or another like `qwen2:7b-chat`, `bakllava`)
        *   The application might default to these, or you can specify models via the UI/AI prompts.
4.  **Application Icon (for packagers)**:
    *   If you intend to build distributable packages, `electron-builder` is configured to look for an icon at `build/icon.png` for Linux.
    *   Create this directory and place a suitable PNG icon (e.g., 256x256 or 512x512 pixels).
    *   Example commands to create the directory:
        ```bash
        mkdir -p build
        # Then, copy your icon.png into the build/ directory.
        # For Windows (.ico) and macOS (.icns) builds, corresponding icons are needed.
        ```

## 2. Installation (Setting up the code)

1.  **Clone the Repository**:
    ```bash
    # git clone <repository_url>
    # cd skyscope-ai
    ```
    (Replace `<repository_url>` with the actual URL if applicable, and `skyscope-ai` with the project's root directory name if different)

2.  **Install Frontend & Electron App Dependencies**:
    Navigate to the project's root directory and run:
    ```bash
    npm install
    ```
    or
    ```bash
    yarn install
    ```

3.  **Install CopilotKit Backend Service Dependencies**:
    Navigate to the `copilotkit_backend/` directory and run:
    ```bash
    cd copilotkit_backend
    npm install
    # cd .. (to go back to project root)
    ```

## 3. Running the Application in Development Mode

To run SKYSCOPE AI for development, you need to start three separate processes:

1.  **Start Ollama**: Ensure your Ollama application/service is running.
2.  **Start the CopilotKit Backend Service**:
    Open a terminal, navigate to the `copilotkit_backend/` directory, and run:
    ```bash
    npm start
    ```
    This service typically runs on `http://localhost:3001`.
3.  **Start the Electron + Next.js Frontend**:
    Open another terminal in the project's root directory and run:
    ```bash
    npm run dev
    ```
    or
    ```bash
    yarn dev
    ```
    This will launch the Next.js development server and then the Electron application window. The Electron app will load the UI from `http://localhost:3000`.

## 4. Building Installer Packages (Linux)

To build the Next.js frontend and then package the Electron application for Linux (AppImage, .deb, .tar.gz):

1.  Ensure all prerequisites from Section 1 are met (especially the application icon in `build/icon.png`).
2.  From the project's root directory, run:
    ```bash
    npm run build
    ```
    or
    ```bash
    yarn build
    ```

### Build Output:

The packaged application(s) will be found in the `dist_electron/` directory (as configured in `package.json`). You should find files like:
*   `SKYSCOPE AI-0.1.0.AppImage`
*   `skyscope-ai_0.1.0_amd64.deb`
*   `skyscope-ai-0.1.0.tar.gz`

## 5. Runtime Notes & Configuration

*   **CopilotKit Backend**: As mentioned, the service in `copilotkit_backend/` must be running for the AI chat and many advanced features to work. This service is NOT automatically started by or packaged with the Electron application.
*   **API Keys & Tokens**:
    *   Some CopilotKit actions (e.g., Google Search, GitHub interactions, Hugging Face queries) require API keys or Personal Access Tokens.
    *   The application does not currently have a secure settings store for these.
    *   The AI assistant may ask you to provide these keys/tokens during conversation. You might be able to paste them into the old API test input fields on the UI if the AI refers to them, or directly in chat if the AI is designed to temporarily use them from there. This is a temporary measure.
*   **AppImageLauncher / GearLever Compatibility**:
    The `linux.category` in `package.json` has been set to `"Development"`. This should help tools like AppImageLauncher or GearLever correctly categorize the application. Standard AppImages produced by `electron-builder` are generally compatible.

## 6. Building for macOS (Intel x64)

To create a `.dmg` (disk image) and a zipped `.app` bundle for Intel-based macOS systems:

### Prerequisites for macOS Build:

1.  **macOS Environment**: You need to build on a macOS machine.
2.  **Node.js and npm/yarn**: Same as for Linux.
3.  **Xcode Command Line Tools**: While not strictly required for unsigned builds, they are often needed for native module compilation and are essential for code signing. Install via:
    ```bash
    xcode-select --install
    ```
4.  **Application Icon (`.icns`)**:
    *   `electron-builder` is configured to look for an icon at `build/icon.icns`.
    *   Create this file. A common way is to start with a high-resolution PNG (e.g., 1024x1024) and use macOS's `iconutil` command-line tool or an online converter to create the `.icns` file.
    *   Example (if you have a folder `my_icon.iconset` containing appropriately sized PNGs):
        ```bash
        # mkdir -p build
        # iconutil -c icns build/my_icon.iconset -o build/icon.icns
        # (Ensure build/my_icon.iconset contains icon_512x512.png, icon_256x256.png etc.)
        # Or, use an online PNG to ICNS converter and place the result in build/icon.icns
        ```
        For a placeholder: `mkdir -p build && touch build/icon.icns`

### Build Command for macOS:

Ensure you have run `npm install` (or `yarn install`) in the project root on your macOS machine. Then, from the project's root directory:

```bash
npm run build
```
or
```bash
yarn build
```
`electron-builder` will detect it's on macOS and build the targets specified in `package.json` (dmg and zip for x64).

### Output:

The packaged application(s) will be found in the `dist_electron/` directory. You should find files like:
*   `SKYSCOPE AI-0.1.0.dmg`
*   `skyscope-ai-mac-0.1.0-x64.zip` (or similar, containing the .app)

### Running the Application on macOS:
1.  Open the `.dmg` file and drag `SKYSCOPE AI.app` to your Applications folder.
2.  Alternatively, unzip the `.zip` file and run the `.app`.
3.  Remember to also run the `copilotkit_backend` service separately, and ensure Ollama is running with the necessary models.

### Code Signing and Notarization (Advanced):
For distributing the macOS app more widely (e.g., outside direct downloads from people who trust you), you'll likely encounter issues with macOS Gatekeeper if the app is not signed and notarized with an Apple Developer ID. This is an advanced process:
*   You would need an Apple Developer account.
*   Configure `electron-builder` with your Apple ID and signing certificates.
*   After building a signed app, it needs to be submitted to Apple for notarization.
This is beyond the scope of basic building but important for broader, smoother distribution on macOS. Unsigned apps will require users to manually bypass Gatekeeper warnings (e.g., by right-clicking and choosing "Open").
