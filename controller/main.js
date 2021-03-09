// Modules to control application life and create native browser window
const {app, BrowserWindow, screen, ipcMain} = require('electron');
const config = require('./controllerConfig.json');

const chimeSdk = require("@aws-sdk/client-chime");
const express = require("express");
const bodyParser = require('body-parser')

const path = require("path");

let mainWindow;
const webProxy = express();
webProxy.use(bodyParser.json())

function sendMessage(req, res) {
    //console.log(req)
    const {method, path, body} = req;
    console.log({method, path, data: body});
    mainWindow.webContents.send('WebRequest', {method, path, data: body});
}

webProxy.get('/api/*', (req, res) => {
    sendMessage(req, res);
    return res.send({success: true});
});
webProxy.post('/api/*', (req, res) => {
    sendMessage(req, res);
    return res.send({success: true});
});

webProxy.put('/api/*', (req, res) => {
    sendMessage(req, res);
    return res.send({success: true});
});

webProxy.delete('/api/*', (req, res) => {
    sendMessage(req, res);
    return res.send({success: true});
});
webProxy.listen(8080, () =>
    console.log(`Web proxy app listening on port 8080!`),
);

const credentials = {accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey};
const chime = new chimeSdk.Chime({
    region: "us-east-1",
    credentials
});

const {IoTDataPlaneClient, UpdateThingShadowCommand} = require("@aws-sdk/client-iot-data-plane");
const awsIot = new IoTDataPlaneClient({region: config.awsIotRegion, credentials});

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
let meetingId;
ipcMain.handle('createMeeting', async () => {
    try {
        const meeting = await chime.createMeetingWithAttendees({
            MeetingHostId: "RemoteCamera",
            MediaRegion: config.amazonChimeMediaRegion,
            Attendees: [{ExternalUserId: "Controller"}]
        });
        meetingId = meeting.Meeting.MeetingId;
        const remoteAttendee = await joinMeeting(meetingId);
        console.log(remoteAttendee);
        const params = {
            thingName: config.thingName,
            payload: JSON.stringify({"state": {"desired": {"meeting": remoteAttendee}}})
        };
        const command = new UpdateThingShadowCommand(params);
        await awsIot.send(command);

        return meeting;
        // process data.
    } catch (error) {
        // error handling.
        console.error(error);
        return error;
    }
});

function deleteMeeting() {
    try {
        console.log("Delete: " + meetingId);
        if (meetingId) {
            const result = chime.deleteMeeting({MeetingId: meetingId});
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

async function joinMeeting(meetingId) {
    try {
        const meeting = await chime
            .getMeeting({
                MeetingId: meetingId,
            });

        const attendee = await chime
            .createAttendee({
                //ID of the meeting
                MeetingId: meeting.Meeting.MeetingId,

                //User ID that we want to associate to
                ExternalUserId: "Remote Thing",
            });
        return {
            Meeting: meeting.Meeting,
            Attendee: attendee.Attendee
        }
        // process data.
    } catch (error) {
        // error handling.
        console.error(error);
    }
}

ipcMain.handle('deleteMeeting', async () => {
    return deleteMeeting();
});

app.on('before-quit', function () {
    deleteMeeting();
})