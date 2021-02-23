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
};

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

        await meetingSession.audioVideo.chooseAudioInputDevice(
            audioInputs[0].deviceId
        );
        await meetingSession.audioVideo.chooseVideoInputDevice(
            videoInputs[0].deviceId
        );

        meetingSession.audioVideo.addObserver(observer);
        meetingSession.audioVideo.startLocalVideoTile();
        meetingSession.audioVideo.bindAudioElement(audioOutputElement);
        meetingSession.audioVideo.start();
    } catch (err) {
        console.error(err);
    }
}






