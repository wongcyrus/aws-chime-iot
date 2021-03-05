// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process because
// `nodeIntegration` is turned off. Use `preload.js` to
// selectively enable features needed in the rendering
// process.

const chimeLogger = new ChimeSDK.ConsoleLogger(
    "ChimeMeetingLogs",
    ChimeSDK.LogLevel.WARN
);
const deviceController = new ChimeSDK.DefaultDeviceController(chimeLogger);
const {ipcRenderer} = require('electron');
// const BrowserWindow = require('electron').remote.BrowserWindow;


ipcRenderer.on('startMeeting', async (event, message) => {
    console.log(message);
    await start(message);
})

let meetingId;

function toggleFullScreen(e) {
    e.target.classList.toggle("fullScreen");
}

function updateTiles(meetingSession) {
    const tiles = meetingSession.audioVideo.getAllVideoTiles();
    console.log("tiles", tiles);
    tiles.forEach(tile => {
        let tileId = tile.tileState.tileId
        let videoElement = document.getElementById("video-" + tileId);

        if (!videoElement) {
            videoElement = document.createElement("video");
            videoElement.id = "video-" + tileId;
            videoElement.addEventListener("click", toggleFullScreen);
            document.getElementById("video-list").append(videoElement);
            meetingSession.audioVideo.bindVideoElement(
                tileId,
                videoElement
            );
        }
    })
}

const observer = {
    // videoTileDidUpdate is called whenever a new tile is created or tileState changes.
    videoTileDidUpdate: (tileState) => {
        console.log("VIDEO TILE DID UPDATE");
        console.log(tileState);
        // Ignore a tile without attendee ID and other attendee's tile.
        if (!tileState.boundAttendeeId) {
            return;
        }
        updateTiles(meetingSession);
    },
    eventDidReceive(name, attributes) {
        // Handle a meeting event.
        const {meetingHistory, ...otherAttributes} = attributes;
        const recentMeetingHistory = meetingHistory.filter(({timestampMs}) => {
            return Date.now() - timestampMs < 5 * 60 * 1000;
        });
        switch (name) {
            case 'audioInputFailed':
            case 'videoInputFailed':
            case 'meetingStartFailed':
            case 'meetingFailed':
                console.error(`Failure: ${name} with attributes: `, {
                    ...otherAttributes,
                    recentMeetingHistory
                });
                break;
            case 'meetingEnded':
                console.log(attributes);
                window.location.reload();
                break;
        }
    }
};

function handleMessage(message){
    console.log(message);
    const dataString = new TextDecoder("utf-8").decode(message.data);
    console.log(dataString);
}

async function start(data) {
    try {
        const audioOutputElement = document.getElementById("meeting-audio");
        if (window.meetingSession) {
            //reset previous session.
            console.log("Reset Session");
            meetingSession.audioVideo.removeObserver(observer);
            await meetingSession.audioVideo.chooseAudioInputDevice(null);
            await meetingSession.audioVideo.chooseVideoInputDevice(null);
            meetingSession.audioVideo.stopLocalVideoTile();
            meetingSession.audioVideo.stop();
        }

        meetingId = data.Meeting.MeetingId;
        const configuration = new ChimeSDK.MeetingSessionConfiguration(
            data.Meeting,
            data.Attendee
        );

        window.meetingSession = new ChimeSDK.DefaultMeetingSession(
            configuration,
            chimeLogger,
            deviceController
        );

        const audioInputs = await meetingSession.audioVideo.listAudioInputDevices();
        const videoInputs = await meetingSession.audioVideo.listVideoInputDevices();

        console.log(videoInputs);
        let camera = videoInputs.filter(c => !c.label.includes("Condor"))[0];
        console.log(camera);
        await meetingSession.audioVideo.chooseAudioInputDevice(
            audioInputs[0].deviceId
        );

        await meetingSession.audioVideo.chooseVideoInputDevice(
            camera.deviceId
        );

        meetingSession.audioVideo.addObserver(observer);
        meetingSession.audioVideo.startLocalVideoTile();
        meetingSession.audioVideo.bindAudioElement(audioOutputElement);
        meetingSession.audioVideo.start();
        meetingSession.audioVideo.realtimeSubscribeToReceiveDataMessage("ControlMessage",handleMessage);
    } catch (err) {
        console.error(err);
    }
}






