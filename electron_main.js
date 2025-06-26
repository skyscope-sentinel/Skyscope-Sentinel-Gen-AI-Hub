// electron_main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');

/**
 * Creates the main application window.
 * Configures window dimensions, web preferences (including preload script for IPC),
 * and loads the Next.js application (from dev server or static export).
 */
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    // Attempting transparency - may require OS-level compositor enabled on Linux
    // transparent: true,
    // frame: false, // Keep frame: true for now to avoid needing custom controls immediately
    // backgroundColor: '#00000000', // Required if transparent: true
    webPreferences: {
      // Preload script is crucial for bridging Electron main and renderer processes
      // securely when contextIsolation is true.
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false, // Disable Node.js integration in renderer for security
      contextIsolation: true, // Isolate Electron APIs and preload script from renderer's global window
    },
    // titleBarStyle: 'hidden', // Example for custom title bar (macOS)
    // vibrancy: 'under-window', // Example for macOS vibrancy effect
  });

  // Determine the URL to load: development server or production build.
  const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, '../dist/renderer/index.html')}`;
  mainWindow.loadURL(startUrl);

  // Open Chrome DevTools in development environment.
  if (process.env.NODE_ENV !== 'production') {
    mainWindow.webContents.openDevTools();
  }
}

// Electron app lifecycle events

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow(); // Create the main application window

  // On macOS, re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // --- IPC Handlers ---

  /**
   * @file electron_main.js (within app.whenReady)
   * This IPC handler is responsible for executing shell commands sent from the renderer process.
   *
   * Security Warning: Directly executing arbitrary commands received via IPC is a significant security risk.
   * The `commandToExecute` parameter should be treated as untrusted input. In a production application,
   * rigorous sanitization, validation, command allowlisting (only allowing specific, known safe commands),
   * or using safer, more restrictive execution models (e.g., dedicated functions for specific tasks instead
   * of general shell access) is essential. Failure to do so can expose the system to vulnerabilities.
   */

  /**
   * Handles the 'execute-command' IPC call from the renderer process.
   * Executes a given shell command using Node.js `child_process.exec`.
   * Includes a timeout for the command execution to prevent indefinite hangs.
   *
   * @param {IpcMainEvent} event - The Electron IPC event object (not directly used here but part of the handler signature).
   * @param {string} commandToExecute - The shell command string to be executed.
   * @returns {Promise<object>} A promise that resolves to an object detailing the execution result.
   *    On successful execution (exit code 0):
   *      { stdout: string, stderr: string, error: null, code: 0 }
   *    On error during execution (non-zero exit code, command not found, timeout, etc.):
   *      { stdout: string, stderr: string, error: string (descriptive error message), code: number (exit code or -1 if unavailable) }
   */
  ipcMain.handle('execute-command', async (event, commandToExecute) => {
    console.log(`Main Process: Received command to execute: "${commandToExecute}"`);

    // Timeout for the shell command execution.
    const EXEC_TIMEOUT = 30000; // 30 seconds

    return new Promise((resolve) => {
      exec(commandToExecute, { timeout: EXEC_TIMEOUT }, (error, stdout, stderr) => {
        // Ensure stdout and stderr are strings, even if empty, for consistent return structure.
        const currentStdout = stdout || '';
        const currentStderr = stderr || '';

        if (error) {
          console.error(`Main Process: exec error for command "${commandToExecute}": ${error.message}`);
          let specificError = error.message;
          // Check if the error was due to the timeout.
          if (error.killed && error.signal === 'SIGTERM') {
            specificError = `Command timed out after ${EXEC_TIMEOUT / 1000} seconds.`;
          } else if (error.code === 127) { // 'command not found' often returns 127 on POSIX systems.
            specificError = `Command not found: ${commandToExecute.split(' ')[0]}`;
          }
          resolve({
            stdout: currentStdout,
            stderr: currentStderr,
            error: specificError,
            // Provide a default error code if none exists on the error object.
            code: typeof error.code === 'number' ? error.code : -1
          });
          return;
        }

        // Log stdout and stderr even on success for debugging/visibility in main process logs.
        if (currentStdout) {
  console.log(`Main Process: stdout for "${commandToExecute}":\n${currentStdout}`);
        }
        if (currentStderr) {
          // stderr is not always an error; some commands output informational messages to stderr.
  console.warn(`Main Process: stderr for "${commandToExecute}":\n${currentStderr}`);
        }

        // Resolve with success status.
        resolve({
          stdout: currentStdout,
          stderr: currentStderr,
          error: null,
          code: 0
        });
      });
    });
  });

  // IPC Handler for reading local files
  ipcMain.handle('read-local-file', async (event, filePath) => {
    console.log(`Main Process: Received request to read file: ${filePath}`);
    // Path validation: Basic check for paths outside user's home directory.
    // A production app should implement more robust sandboxing, e.g., by only allowing
    // access to files explicitly chosen by the user via a dialog or within a designated workspace.
    if (!filePath.includes(app.getPath('home'))) { // app.getPath('home') gets user's home directory
        console.warn(`Main Process: Security check - Attempt to read file outside user home directory: ${filePath}. This might be restricted in future versions or require explicit user permission.`);
        // Depending on security policy, could return an error here:
        // return { error: "File access restricted to user's home directory." };
    }

    try {
      const data = await fs.promises.readFile(filePath, 'utf8');
      return { content: data };
    } catch (error) {
      console.error(`Main Process: Error reading file '${filePath}': ${error.message}`);
      return { error: error.message }; // Return error details to renderer
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
