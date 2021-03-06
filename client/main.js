// Modules to control application life and create native browser window
const {app, BrowserWindow, screen, ipcMain} = require('electron')
const path = require('path');
const express = require("express");
const bodyParser = require('body-parser')
const awsIot = require('aws-iot-device-sdk');
const config = require('./clientConfig.json');


let meeting;

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
webProxy.listen(8081, () =>
    console.log(`Web proxy app listening on port 8080!`),
);

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
        console.log("Meeting");
        console.log(meeting);
        mainWindow.webContents.send('startMeeting', {
            Meeting: meeting.Meeting,
            Attendee: meeting.Attendee
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
        keyPath: "certs/private.pem.key",
        certPath: "certs/device.pem.crt",
        caPath: "AmazonRootCA1.pem",
        clientId: "RemoteCameraDevice",
        host: config.host
    });
    thingShadows.on('connect', function () {
        console.log("connected");
        thingShadows.register(config.thingName, {}, function () {
            let initialState = {"state": {"desired": {"meeting": ""}}};
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
            if (stateObject.state.meeting !== "") {
                meeting = stateObject.state.meeting;
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

ipcMain.handle('sendWebRequest', async (event, args) => {
    const {net} = require('electron')
    const request = net.request({
        method: 'GET',
        protocol: 'http:',
        hostname: 'localhost',
        port: 5000,
        path: '/'
    });
    request.setHeader("Content-Type", "application/json")


    request.on('response', (response) => {
        console.log(`STATUS: ${response.statusCode}`)
        console.log(`HEADERS: ${JSON.stringify(response.headers)}`)
        response.on('data', (chunk) => {
            console.log(`BODY: ${chunk}`)
        })
        response.on('end', () => {
            console.log('No more data in response.')
        })
    })
    request.write(args);
    request.end()
});
