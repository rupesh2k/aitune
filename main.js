import { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, clipboard } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import LLMHandler from './llm-api.js';
import { exec } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load LLM configuration from config.json
const configPath = path.join(__dirname, 'config.json');
let llmConfig;
try {
  const rawConfig = fs.readFileSync(configPath, 'utf-8');
  llmConfig = JSON.parse(rawConfig);
} catch (error) {
  console.error('Failed to load config.json, using defaults:', error);
  llmConfig = {
    provider: 'openai',
    apiKey: '',
    model: 'gpt-3.5-turbo',
    endpoint: 'http://localhost:11434/api/generate'
  };
}
const llmHandler = new LLMHandler(llmConfig);

let mainWindow = null;
let tray = null;
let isQuitting = false;
let lastSelectedText = '';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 400,
    show: false,
    frame: false,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('popup.html');

  // Open DevTools for debugging
  mainWindow.webContents.openDevTools({ mode: 'detach' });

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  tray = new Tray(path.join(__dirname, 'assets', 'icon.png'));
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show/Hide',
      click: () => {
        if (mainWindow) {
          mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
        }
      }
    },
    {
      label: 'Settings',
      click: () => {
        // TODO: Open settings window
      }
    },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);
  tray.setToolTip('AI Tune');
  tray.setContextMenu(contextMenu);
}

// Helper to simulate Ctrl+C via PowerShell
function simulateCopy() {
  return new Promise((resolve, reject) => {
    exec(
      `powershell -windowstyle hidden -command "$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys('^c')"`,
      (error) => {
        if (error) reject(error);
        else resolve();
      }
    );
  });
}

async function setupHotkey() {
  globalShortcut.register('CommandOrControl+Alt+I', async () => {
    try {
      // 1. Simulate copy (Cmd/Ctrl+C) to bring the selected text into the clipboard
      await simulateCopy();
      // 2. Wait briefly for clipboard to update
      await new Promise((resolve) => setTimeout(resolve, 150));
      // 3. Read the selected text from the clipboard
      const selectedText = clipboard.readText();
      lastSelectedText = selectedText;

      // 4. Show the popup and send the selected text to the renderer
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('text-selected', selectedText);
      }
    } catch (error) {
      console.error('Hotkey handler error:', error);
    }
  });
}

// Handle IPC communication
ipcMain.handle('enhance-text', async (event, text) => {
  try {
    return await llmHandler.enhanceText(text);
  } catch (error) {
    console.error('Error enhancing text:', error);
    throw error;
  }
});

// Provide an IPC method to access the last selected text
ipcMain.handle('get-selected-text', async () => {
  return lastSelectedText;
});

// Stream responses for real-time updates
ipcMain.on('stream-enhance-text', (event, text) => {
  // Clear existing value in renderer
  event.sender.send('enhance-text-chunk', '');
  // Stream the text
  llmHandler.streamEnhanceText(text, (chunk) => {
    event.sender.send('enhance-text-chunk', chunk);
  }).catch((error) => {
    console.error('Error in stream-enhance-text:', error);
    // Notify renderer of error
    event.sender.send('enhance-text-error', error.message || String(error));
  });
});

app.whenReady().then(() => {
  createWindow();
  createTray();
  setupHotkey();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
}); 