if (location.href.substr(0, 5) !== "https")
  location.href = "https" + location.href.substr(4, location.href.length - 4);

const socket = io();

let producer = null;

nameInput.value = "YourName" + Math.round(Math.random() * 1000);

socket.request = function request(type, data = {}) {
  return new Promise((resolve, reject) => {
    socket.emit(type, data, (data) => {
      if (data.error) {
        reject(data.error);
      } else {
        resolve(data);
      }
    });
  });
};

let rc = null;
// newArr = ["1"];

function joinRoom(name, room_id) {
  if (rc && rc.isOpen()) {
    console.log("already connected to a room");
  } else {
    rc = new RoomClient(
      localMedia,
      remoteVideos,
      remoteAudios,
      window.mediasoupClient,
      socket,
      room_id,
      name,
      roomOpen
    );

    addListeners();
  }
}

// function addRoom() {
//   newArr.push("room_id");
// }

function roomOpen() {
  login.className = "hidden";
  reveal(startAudioButton);
  hide(stopAudioButton);
  reveal(startVideoButton);
  hide(stopVideoButton);
  reveal(startScreenButton);
  hide(stopScreenButton);
  reveal(exitButton);
  control.className = "";
  reveal(videoMedia);
  newArr.push("room_id");
}

document.getElementById("demo").innerHTML = newArr;

function hide(elem) {
  elem.className = "hidden";
}

function reveal(elem) {
  elem.className = "";
}

function addListeners() {
  rc.on(RoomClient.EVENTS.startScreen, () => {
    hide(startScreenButton);
    reveal(stopScreenButton);
  });

  rc.on(RoomClient.EVENTS.stopScreen, () => {
    hide(stopScreenButton);
    reveal(startScreenButton);
  });

  rc.on(RoomClient.EVENTS.stopAudio, () => {
    hide(stopAudioButton);
    reveal(startAudioButton);
  });
  rc.on(RoomClient.EVENTS.startAudio, () => {
    hide(startAudioButton);
    reveal(stopAudioButton);
  });

  rc.on(RoomClient.EVENTS.startVideo, () => {
    hide(startVideoButton);
    reveal(stopVideoButton);
  });
  rc.on(RoomClient.EVENTS.stopVideo, () => {
    hide(stopVideoButton);
    reveal(startVideoButton);
  });
  rc.on(RoomClient.EVENTS.exitRoom, () => {
    hide(control);
    reveal(login);
    hide(videoMedia);
  });
}

// Load mediaDevice options
navigator.mediaDevices.enumerateDevices().then((devices) =>
  devices.forEach((device) => {
    let el = null;
    if ("audioinput" === device.kind) {
      el = audioSelect;
    } else if ("videoinput" === device.kind) {
      el = videoSelect;
    }
    if (!el) return;

    let option = document.createElement("option");
    option.value = device.deviceId;
    option.innerText = device.label;
    el.appendChild(option);
  })
);

const app = require("/src/app");
