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

  // IPC Handler for executing terminal commands
  ipcMain.handle('execute-command', async (event, commandToExecute) => {
    console.log(`Main Process: Received command to execute: ${commandToExecute}`);
    // WARNING: Executing arbitrary commands is a security risk.
    return new Promise((resolve) => {
      exec(commandToExecute, (error, stdout, stderr) => {
        if (error) {
          console.error(`Main Process: exec error for command '${commandToExecute}': ${error.message}`);
          resolve({ stdout: stdout || '', stderr: stderr || '', error: error.message, code: error.code });
          return;
        }
        console.log(`Main Process: stdout for '${commandToExecute}': ${stdout}`);
        if (stderr) console.warn(`Main Process: stderr for '${commandToExecute}': ${stderr}`);
        resolve({ stdout, stderr, error: null, code: 0 });
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
