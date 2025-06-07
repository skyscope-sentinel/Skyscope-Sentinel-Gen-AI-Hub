// electron_main.js
const { app, BrowserWindow, ipcMain } = require('electron'); // Added ipcMain
const path = require('path');
const { exec } = require('child_process'); // Added exec

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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
    // In a real application, sanitize/validate 'commandToExecute' rigorously
    // or use a more restrictive execution model.
    return new Promise((resolve) => {
      exec(commandToExecute, (error, stdout, stderr) => {
        if (error) {
          console.error(`Main Process: exec error for command '${commandToExecute}': ${error.message}`);
          resolve({ stdout: stdout || '', stderr: stderr || '', error: error.message, code: error.code });
          return;
        }
        console.log(`Main Process: stdout for '${commandToExecute}': ${stdout}`);
        if (stderr) {
          console.warn(`Main Process: stderr for '${commandToExecute}': ${stderr}`);
        }
        resolve({ stdout, stderr, error: null, code: 0 });
      });
    });
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
