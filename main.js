import { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, clipboard, screen } from 'electron';
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
let settingsWindow = null;
let iconWindow = null;
let lastClip = clipboard.readText();

function createWindow() {
  // Determine fixed bar dimensions and center horizontally
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
  const barWidth = 760;
  const barHeight = 450;
  mainWindow = new BrowserWindow({
    x: Math.round((screenWidth - barWidth) / 2),
    y: 0,
    width: barWidth,
    height: barHeight,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  mainWindow.loadFile('popup.html');
  mainWindow.webContents.openDevTools({ mode: 'detach' });  // open DevTools for debugging click handlers

  // Show a context menu with 'Fix with AI' on right-click
  /*
  mainWindow.webContents.on('context-menu', (event, params) => {
    const { Menu } = require('electron');
    const menu = Menu.buildFromTemplate([
      { label: 'Fix with AI', click: () => mainWindow.webContents.send('trigger-enhance') }
    ]);
    menu.popup({ window: mainWindow });
  });
  */

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

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 400,
    height: 300,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  settingsWindow.loadFile('settings.html');
  settingsWindow.on('closed', () => {
    settingsWindow = null;
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
        createSettingsWindow();
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

function simulateCopy() {
  console.log('Starting simulateCopy...');
  return new Promise((resolve, reject) => {
    if (process.platform === 'darwin') {
      // For Mac
      exec(
        `osascript -e 'tell application "System Events" to keystroke "c" using {command down}'`,
        (error) => {
          if (error) {
            console.error('Error simulating copy:', error); 
          }
        })
    } else {
    exec(
      `powershell -windowstyle hidden -command "$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys('^c')"`,
      (error) => {
        if (error) {
          console.error('Error simulating copy:', error);
          reject(error);
        } else {
          console.log('Copy simulation successful');
          resolve();
        }
      }
    );
  }});
}

function createIconWindow() {
  if (iconWindow) return;
  iconWindow = new BrowserWindow({
    width: 40,
    height: 40,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    show: false
  });
  iconWindow.loadFile(path.join(__dirname, 'icon-popup.html'));
}

function showIconAtCursor() {
  if (!iconWindow) createIconWindow();
  const cursorPos = screen.getCursorScreenPoint();
  iconWindow.setPosition(cursorPos.x + 10, cursorPos.y + 10);
  iconWindow.show();
  // Hide after 2 seconds
  setTimeout(() => {
    if (iconWindow) iconWindow.hide();
  }, 2000);
}
/*
async function getSelectedText() {
  return new Promise((resolve, reject) => {
    if (process.platform === 'darwin') {
      // For Mac, use AppleScript to get selected text
      exec(
        `osascript -e 'tell application "System Events" to set selectedText to (get value of attribute "AXSelectedText" of (first process whose frontmost is true))'`,
        (error, stdout, stderr) => {
          if (error) {
            console.error('Error getting selected text:', error);
            resolve(''); // Return empty string on error
          } else {
            resolve(stdout.trim());
          }
        }
      );
    } else {
      // For Windows, use clipboard
      resolve(clipboard.readText());
    }
  });
}*/

async function setupHotkey() {
  const hotkey = process.platform === 'darwin' ? 'Command+Control+I' : 'CommandOrControl+Alt+I';
  globalShortcut.register(hotkey, async () => {
    console.log('Hotkey pressed: Ctrl + Alt + I');
    try {
      console.log('Simulating copy...');
      await simulateCopy();
      console.log('Waiting for clipboard update...');
      await new Promise(r => setTimeout(r, 500));
      const selectedText = clipboard.readText();
      console.log('Selected text from clipboard:', selectedText);
      if (!selectedText) {
        console.warn('No text was copied to the clipboard.');
      }
      lastSelectedText = selectedText;

      if (mainWindow) {
        console.log('Showing main window');
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('text-selected', selectedText);
      } else {
        console.warn('Main window is not initialized.');
      }
    } catch (error) {
      console.error('Hotkey handler error:', error);
    }
  });
  console.log('Hotkey registered:', hotkey);
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

// Provide an IPC method to get current LLM config
ipcMain.handle('get-llm-config', async () => {
  return llmConfig;
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

// Handle settings save
ipcMain.on('save-settings', (event, newConfig) => {
  // Write to config.json
  try {
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
    llmConfig = newConfig;
    llmHandler.config = newConfig;
    event.sender.send('settings-saved', 'success');
    if (settingsWindow) settingsWindow.close();
  } catch (err) {
    console.error('Error saving settings:', err);
    event.sender.send('settings-saved', 'error');
  }
});

// Poll the clipboard every 500ms
setInterval(async () => {
  try {
    const cur = clipboard.readText();
    if (cur && cur !== lastClip) {
      lastClip = cur;
      showIconAtCursor();         // pop up the icon
      lastSelectedText = cur;     // store it
      mainWindow.webContents.send('text-selected', cur);
    }
  } catch (e) { /* ignore read errors */ }
}, 500);

// Listen for close requests from the renderer
ipcMain.on('close-main-window', () => {
  console.log('DEBUG: main process received close-main-window, hiding mainWindow');
  if (mainWindow) {
    mainWindow.hide();
  }
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