// electron_main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs'); // Added fs

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280, // Slightly wider for a more modern feel
    height: 800,
    // Attempting transparency - may require OS-level compositor enabled on Linux
    // transparent: true,
    // frame: false, // Keep frame: true for now to avoid needing custom controls immediately
    // backgroundColor: '#00000000', // Required if transparent: true
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // Configure preload script
      nodeIntegration: false,
      contextIsolation: true,
    },
    // Consider titleBarStyle: 'hidden' or 'customButtonsOnHover' for acrylic look later
    // frame: false, // For fully custom frameless window
  });

  // In development, load from Next.js dev server
  // In production, load from Next.js static export
  const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, '../dist/renderer/index.html')}`;
  // console.log(`Loading URL: ${startUrl}`);
  mainWindow.loadURL(startUrl);

  // Open DevTools automatically if not in production
  if (process.env.NODE_ENV !== 'production') {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  /**
   * @file electron_main.js
   * Handles IPC events for executing shell commands requested by the renderer process.
   * Security Warning: Directly executing commands received via IPC can be a significant security risk
   * if the commands are not rigorously sanitized or if the source of the commands is not trusted.
   * In a production application, implement strict validation, command allowlisting, or
   * use safer alternatives to direct shell execution.
   */

  /**
   * Handles the 'execute-command' IPC call from the renderer process.
   * Executes a given shell command using Node.js `child_process.exec`.
   * Includes a timeout for the command execution.
   *
   * @param {IpcMainEvent} event - The IPC event object (not directly used but part of signature).
   * @param {string} commandToExecute - The shell command string to be executed.
   * @returns {Promise<object>} A promise that resolves to an object with the execution result.
   *    On success: { stdout: string, stderr: string, error: null, code: 0 }
   *    On error:   { stdout: string, stderr: string, error: string (error message), code: number (exit code) }
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
    // Basic security check - very simplistic, for real app use sandboxed dialogs or more robust checks.
    // Example: Restrict to a known 'safe' directory or user's documents/downloads.
    // const safeBaseDir = path.join(app.getPath('documents'), 'skyscope_safe_files');
    // if (!filePath.startsWith(safeBaseDir)) {
    //   console.warn(`Main Process: Denied read access to potentially unsafe path: ${filePath}`);
    //   return { error: 'Access denied to this file path for security reasons.' };
    // }
    // For now, just a log for paths outside a conceptual 'user' directory
    if (!filePath.includes(app.getPath('home'))) {
        console.warn(`Main Process: Reading file outside user home: ${filePath}. Ensure this is intended and secure.`);
    }


    try {
      const data = await fs.promises.readFile(filePath, 'utf8');
      return { content: data };
    } catch (error) {
      console.error(`Main Process: Error reading file '${filePath}': ${error.message}`);
      return { error: error.message };
    }
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
