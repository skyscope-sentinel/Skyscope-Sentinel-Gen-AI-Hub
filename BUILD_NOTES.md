# SKYSCOPE AI Build & Packaging Notes

## Linux Installer Package Generation

This project uses `electron-builder` to create Linux installer packages (AppImage, .deb, .tar.gz).

### Prerequisites:

1.  **Development Environment**: Ensure you have Node.js, npm (or yarn) installed.
2.  **Dependencies**: Run `npm install` (or `yarn install`) in the project root to install all dependencies, including `electron-builder`.
3.  **Application Icon**:
    *   `electron-builder` is configured to look for an icon at `build/icon.png` for Linux builds.
    *   Please create this directory and place a suitable PNG icon there (e.g., 256x256 pixels or 512x512 pixels).
    *   Example commands to create a placeholder:
        ```bash
        mkdir -p build
        # Create or copy your desired icon.png into the build/ directory
        # As a temporary placeholder, you could:
        # touch build/icon.png
        echo "Placeholder for build/icon.png - Replace with actual 256x256 or 512x512 icon"
        ```
    *   For Windows (`icon.ico`) and macOS (`icon.icns`), corresponding icons would be needed in the `build` folder if building for those platforms.

### Build Command:

To build the Next.js frontend and then package the Electron application for all configured targets (including Linux AppImage and .deb):

```bash
npm run build
```
or
```bash
yarn build
```

### Output:

The packaged application(s) will be found in the `dist_electron` directory (as configured in `package.json`). You should find files like:
*   `SKYSCOPE AI-0.1.0.AppImage`
*   `skyscope-ai_0.1.0_amd64.deb`
*   `skyscope-ai-0.1.0.tar.gz`

### Running the CopilotKit Backend:

The CopilotKit backend service located in the `copilotkit_backend/` directory needs to be run separately for the chat functionality to work. Navigate to `copilotkit_backend/` and run:
```bash
npm install # If not already done
npm start
```
This backend service is NOT automatically packaged with the Electron application by the current configuration. It's designed to be a separate process.

### AppImageLauncher / GearLever Compatibility:
The `linux.category` in `package.json` has been set to `"Development"`. This should help tools like AppImageLauncher or GearLever correctly categorize the application. Standard AppImages produced by `electron-builder` are generally compatible. If specific issues arise with desktop integration, further customization of the `electron-builder` Linux config might be needed (e.g., specific `.desktop` file entries).
