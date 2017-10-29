// TODO: make filtring in list work
// TODO: backup image when there is no
// TODO: save playlist
// TODO: import playlist
// TODO: create and read from database
// TODO: for more detaille check the note file 
const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
// Keep reference of main window because of GC
var mainWindow = null;
// Quit when all windows are closed
app.on('window-all-closed', function() {
    app.quit();
});
// When application is ready, create application window
app.on('ready', function() {
    // Create main window
    // Other options available at:
    // http://electron.atom.io/docs/latest/api/browser-window/#new-browserwindow-options
    mainWindow = new BrowserWindow({
        name: "PlayON",
        width: 1200,
        height: 700,
        minWidth:900,
        minHeight:600,
        toolbar: false,
        frame:false
    });
    // mainWindow.setMinimumSize(900, 600);
    mainWindow.setMenu(null);
    mainWindow.webContents.openDevTools();
    // Target HTML file which will be opened in window
    mainWindow.loadURL('file://' + __dirname + "/app/index.html");
    // Cleanup when window is closed
    mainWindow.on('closed', function() {
        mainWindow = null;
    });
});
