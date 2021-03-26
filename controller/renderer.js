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

let meetingId;
const createMeeting = document.getElementById("createMeeting");
const deleteMeeting = document.getElementById("deleteMeeting");
const sendMessage = document.getElementById("sendMessage");
const meetingIdTextBox = document.getElementById("meetingIdTextBox");
const controlMessageInput = document.getElementById("controlMessageTextBox");

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
    console.log("client message");
    console.log(message);
    const dataString = new TextDecoder("utf-8").decode(message.data);
    console.log(dataString);
    // ipcRenderer.invoke('sendWebRequest', dataString).then(async (data) => {
    //     console.log(data);
    // })
}

async function start() {
    createMeeting.disabled = true;
    sendMessage.disabled = false;
    deleteMeeting.disabled = false;
    ipcRenderer.invoke('createMeeting').then(async (data) => {
        console.log(data);
        try {
            meetingId = data.Meeting.MeetingId;
            meetingIdTextBox.value = meetingId;
            const configuration = new ChimeSDK.MeetingSessionConfiguration(
                data.Meeting,
                data.Attendees[0]
            );
            window.meetingSession = new ChimeSDK.DefaultMeetingSession(
                configuration,
                chimeLogger,
                deviceController
            );

            const audioInputs = await meetingSession.audioVideo.listAudioInputDevices();
            // const videoInputs = await meetingSession.audioVideo.listVideoInputDevices();

            await meetingSession.audioVideo.chooseAudioInputDevice(
                audioInputs[0].deviceId
            );
            // await meetingSession.audioVideo.chooseVideoInputDevice(
            //     videoInputs[0].deviceId
            // );


            meetingSession.audioVideo.addObserver(observer);

            meetingSession.audioVideo.startLocalVideoTile();

            const audioOutputElement = document.getElementById("meeting-audio");
            meetingSession.audioVideo.bindAudioElement(audioOutputElement);
            meetingSession.audioVideo.start();
            meetingSession.audioVideo.realtimeSubscribeToReceiveDataMessage("ClientMessage",handleMessage);
        } catch (err) {
            console.error(err);
        }

    })
}

async function stop() {
    createMeeting.disabled = false;
    deleteMeeting.disabled = true;
    sendMessage.disabled = true;
    ipcRenderer.invoke('deleteMeeting', meetingId).then(async (data) => {
        console.log(data);
    })
}

function send() {
    console.log(controlMessageInput.value);
    if (window.meetingSession) {
        window.meetingSession.audioVideo.realtimeSendDataMessage("ControlMessage", controlMessageInput.value);
    }
}

ipcRenderer.on("WebRequest", (event, args) => {
    console.log("ipcRenderer", args);
    if (window.meetingSession) {
        window.meetingSession.audioVideo.realtimeSendDataMessage("ControlMessage", JSON.stringify(args));
    }
})


window.addEventListener("DOMContentLoaded", () => {
    createMeeting.addEventListener("click", start);
    deleteMeeting.addEventListener("click", stop);
    sendMessage.addEventListener("click", send);
});



