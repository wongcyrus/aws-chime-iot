// Modules to control application life and create native browser window
const {app, BrowserWindow, screen} = require('electron')
const path = require('path')

const AWS = require("@aws-sdk/client-chime");
const client = new AWS.Chime({region: "us-east-1"});
const awsIot = require('aws-iot-device-sdk');
const config = require('./config.json');
const {ipcMain} = require('electron');

let meetingId;
let mainWindow;

function createWindow() {
    // Create the browser window.
    const {width, height} = screen.getPrimaryDisplay().workAreaSize
    mainWindow = new BrowserWindow({
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

async function joinMeeting() {
    try {
        const meeting = await client
            .getMeeting({
                MeetingId: meetingId,
            });

        const attendee = await client
            .createAttendee({
                //ID of the meeting
                MeetingId: meeting.Meeting.MeetingId,

                //User ID that we want to associate to
                ExternalUserId: config.thingName,
            });
        mainWindow.webContents.send('startMeeting', {
            Meeting: meeting.Meeting,
            Attendee:attendee.Attendee
        });
        // process data.
    } catch (error) {
        // error handling.
        console.error(error);
    }
}

function ConnectAwsIoT() {
    console.log(config);
    const thingShadows = awsIot.thingShadow({
        keyPath: config.keyPath,
        certPath: config.certPath,
        caPath: config.caPath,
        clientId: config.clientId,
        host: config.host
    });
    thingShadows.on('connect', function () {
        console.log("connected");
        thingShadows.register(config.thingName, {}, function () {
            let initialState = {"state": {"desired": {"meetingId": ""}}};
            let clientTokenUpdate = thingShadows.update(config.thingName, initialState);
            if (clientTokenUpdate === null) {
                console.log('update shadow failed, operation still in progress');
            }
        });
    });
    thingShadows.on('status',
        (thingName, stat, clientToken, stateObject) => {
            console.log('received ' + stat + ' on ' + thingName + ': ' +
                JSON.stringify(stateObject));
        });
    thingShadows.on('delta',
        async (thingName, stateObject) => {
            console.log('received delta on ' + thingName + ': ' +
                JSON.stringify(stateObject));
            if (stateObject.state.meetingId !== "") {
                meetingId = stateObject.state.meetingId;
                await joinMeeting();
            }
        });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    });
    ConnectAwsIoT();
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.


app.on('before-quit', function () {

})