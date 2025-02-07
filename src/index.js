const { app, BrowserWindow, Tray, Menu, globalShortcut, screen, nativeImage } = require('electron');
const path = require('path');
const started = require('electron-squirrel-startup');

// Set app name globally
app.name = 'Bud';

// Create custom menu
function createMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    {
      label: 'Bud',
      submenu: [
        {
          label: 'Settings',
          click: () => {
            if (settingsWindow) {
              settingsWindow.show();
            } else {
              createSettingsWindow();
            }
          }
        },
        { type: 'separator' },
        { role: 'hide', label: 'Hide Bud' },
        { role: 'hideOthers' },
        { role: 'unhide', label: 'Show All' },
        { type: 'separator' },
        { role: 'quit', label: 'Quit Bud' }
      ]
    },
    // Add other menu items as needed
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let tray = null;
let settingsWindow = null;
let chatWindow = null;

function createTray() {
  // Simple text-based icon (• character)
  const icon = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(`
    <svg height="22" width="22">
      <text x="50%" y="50%" font-size="16" text-anchor="middle" dominant-baseline="middle">•</text>
    </svg>
  `).toString('base64')}`);

  // Create tray
  tray = new Tray(icon);
  tray.setTitle('Bud');  // This will show text next to icon
  tray.setToolTip('Bud Chat');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Settings',
      click: () => {
        if (settingsWindow) {
          settingsWindow.show();
        } else {
          createSettingsWindow();
        }
      }
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (chatWindow) {
      chatWindow.show();
    } else {
      createChatWindow();
    }
  });
}

// Wait for app to be ready
app.whenReady().then(() => {
  // Only hide dock when no windows are open
  if (process.platform === 'darwin') {
    app.dock.hide();
  }
  
  // Create menu
  createMenu();
  
  // Create tray
  createTray();

  // Register global shortcut
  globalShortcut.register('CommandOrControl+B', () => {
    if (chatWindow) {
      chatWindow.show();
    } else {
      createChatWindow();
    }
  });
});

const createSettingsWindow = () => {
  // Show dock when opening a window
  if (process.platform === 'darwin') {
    app.dock.show();
  }

  settingsWindow = new BrowserWindow({
    width: 400,
    height: 300,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    },
    show: false,
    skipTaskbar: true
  });

  settingsWindow.loadFile(path.join(__dirname, 'settings.html'));

  settingsWindow.on('closed', () => {
    settingsWindow = null;
    // Hide dock if no windows are open
    if (process.platform === 'darwin' && !settingsWindow && !chatWindow) {
      app.dock.hide();
    }
  });

  settingsWindow.show();
};

const createChatWindow = () => {
  // Show dock when opening a window
  if (process.platform === 'darwin') {
    app.dock.show();
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  chatWindow = new BrowserWindow({
    width: 300,
    height: 400,
    x: width - 320, // Position near the right edge
    y: 40, // Position near the top
    frame: false, // Remove window frame
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    },
    show: false,
    skipTaskbar: true,
    title: 'Bud'  // Set window title
  });

  // Set the application name for this window
  chatWindow.setTitle('Bud');
  if (process.platform === 'darwin') {
    app.name = 'Bud';
  }

  chatWindow.loadFile(path.join(__dirname, 'chat.html'));

  chatWindow.on('closed', () => {
    chatWindow = null;
    // Hide dock if no windows are open
    if (process.platform === 'darwin' && !settingsWindow && !chatWindow) {
      app.dock.hide();
    }
  });

  chatWindow.show();
};

// Prevent the app from quitting when all windows are closed
app.on('window-all-closed', (e) => {
  e.preventDefault();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
