// Modules to control application life and create native browser window
const {app, BrowserWindow, screen} = require('electron')
const path = require('path')

const AWS = require("@aws-sdk/client-chime");
const client = new AWS.Chime({region: "REGION"});

function createWindow() {
    // Create the browser window.
    const {width, height} = screen.getPrimaryDisplay().workAreaSize
    const mainWindow = new BrowserWindow({
        width: width,
        height: height,
        webPreferences: {
            nodeIntegration: true,
            preload: path.join(__dirname, 'preload.js')
        }
    })

    // and load the index.html of the app.
    mainWindow.loadFile('index.html')

    // Open the DevTools.
    mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
    createWindow()

    app.on('activate', function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
const {ipcMain} = require('electron');
let meetingId;
ipcMain.handle('createMeeting', async (event, mediaRegion) => {
    try {
        const meeting = await client.createMeetingWithAttendees({
            MeetingHostId: "RemoteCamera",
            MediaRegion: mediaRegion,
            Attendees: [{ExternalUserId: "Controller"}]
        });
        meetingId = meeting.Meeting.MeetingId;
        return meeting;
        // process data.
    } catch (error) {
        // error handling.
        return error;
    }
});

function deleteMeeting() {
    try {
        console.log("Delete: " + meetingId);
        if(meetingId) {
            const result = client.deleteMeeting({MeetingId: meetingId});
            meetingId = undefined;
            return result;
        }
        return {};
        // process data.
    } catch (error) {
        // error handling.
        return error;
    }
}

ipcMain.handle('deleteMeeting', async () => {
    return deleteMeeting();
});

app.on('before-quit', function () {
    deleteMeeting();
})