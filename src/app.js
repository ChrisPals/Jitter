const express = require("express");

const app = express();
const https = require("httpolyglot");
const fs = require("fs");
const mediasoup = require("mediasoup");
const config = require("./config");
const path = require("path");
const Room = require("./Room");
const Peer = require("./Peer");

const options = {
  key: fs.readFileSync(path.join(__dirname, config.sslKey), "utf-8"),
  cert: fs.readFileSync(path.join(__dirname, config.sslCrt), "utf-8"),
};

const httpsServer = https.createServer(options, app);
const io = require("socket.io")(httpsServer);

app.use(express.static(path.join(__dirname, "..", "public")));

httpsServer.listen(config.listenPort, () => {
  console.log(
    "Listening on https://" + config.listenIp + ":" + config.listenPort
  );
});

// all mediasoup workers
let workers = [];
let nextMediasoupWorkerIdx = 0;

/**
 * roomList
 * {
 *  room_id: Room {
 *      id:
 *      router:
 *      peers: {
 *          id:,
 *          name:,
 *          master: [boolean],
 *          transports: [Map],
 *          producers: [Map],
 *          consumers: [Map],
 *          rtpCapabilities:
 *      }
 *  }
 * }
 */
let roomList = new Map();

(async () => {
  await createWorkers();
})();

async function createWorkers() {
  let { numWorkers } = config.mediasoup;

  for (let i = 0; i < numWorkers; i++) {
    let worker = await mediasoup.createWorker({
      logLevel: config.mediasoup.worker.logLevel,
      logTags: config.mediasoup.worker.logTags,
      rtcMinPort: config.mediasoup.worker.rtcMinPort,
      rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
    });

    worker.on("died", () => {
      console.error(
        "mediasoup worker died, exiting in 2 seconds... [pid:%d]",
        worker.pid
      );
      setTimeout(() => process.exit(1), 2000);
    });
    workers.push(worker);

    // log worker resource usage
    /*setInterval(async () => {
            const usage = await worker.getResourceUsage();
            console.info('mediasoup Worker resource usage [pid:%d]: %o', worker.pid, usage);
        }, 120000);*/
  }
}

io.on("connection", (socket) => {
  socket.on("createRoom", async ({ room_id }, callback) => {
    if (roomList.has(room_id)) {
      callback("already exists");
    } else {
      console.log("Created room", { room_id: room_id });
      let worker = await getMediasoupWorker();
      roomList.set(room_id, new Room(room_id, worker, io));
      callback(room_id);
    }
  });

  socket.on("join", ({ room_id, name }, cb) => {
    console.log("User joined", {
      room_id: room_id,
      name: name,
    });

    if (!roomList.has(room_id)) {
      return cb({
        error: "Room does not exist",
      });
    }

    roomList.get(room_id).addPeer(new Peer(socket.id, name));
    socket.room_id = room_id;

    cb(roomList.get(room_id).toJson());
  });

  socket.on("getProducers", () => {
    if (!roomList.has(socket.room_id)) return;
    console.log("Get producers", {
      name: `${roomList.get(socket.room_id).getPeers().get(socket.id).name}`,
    });

    // send all the current producer to newly joined member
    let producerList = roomList.get(socket.room_id).getProducerListForPeer();

    socket.emit("newProducers", producerList);
  });

  socket.on("getRouterRtpCapabilities", (_, callback) => {
    console.log("Get RouterRtpCapabilities", {
      name: `${roomList.get(socket.room_id).getPeers().get(socket.id).name}`,
    });

    try {
      callback(roomList.get(socket.room_id).getRtpCapabilities());
    } catch (e) {
      callback({
        error: e.message,
      });
    }
  });

  socket.on("createWebRtcTransport", async (_, callback) => {
    console.log("Create webrtc transport", {
      name: `${roomList.get(socket.room_id).getPeers().get(socket.id).name}`,
    });

    try {
      const { params } = await roomList
        .get(socket.room_id)
        .createWebRtcTransport(socket.id);

      callback(params);
    } catch (err) {
      console.error(err);
      callback({
        error: err.message,
      });
    }
  });

  socket.on(
    "connectTransport",
    async ({ transport_id, dtlsParameters }, callback) => {
      console.log("Connect transport", {
        name: `${roomList.get(socket.room_id).getPeers().get(socket.id).name}`,
      });

      if (!roomList.has(socket.room_id)) return;
      await roomList
        .get(socket.room_id)
        .connectPeerTransport(socket.id, transport_id, dtlsParameters);

      callback("success");
    }
  );

  socket.on(
    "produce",
    async ({ kind, rtpParameters, producerTransportId }, callback) => {
      if (!roomList.has(socket.room_id)) {
        return callback({ error: "not is a room" });
      }

      let producer_id = await roomList
        .get(socket.room_id)
        .produce(socket.id, producerTransportId, rtpParameters, kind);

      console.log("Produce", {
        type: `${kind}`,
        name: `${roomList.get(socket.room_id).getPeers().get(socket.id).name}`,
        id: `${producer_id}`,
      });

      callback({
        producer_id,
      });
    }
  );

  socket.on(
    "consume",
    async ({ consumerTransportId, producerId, rtpCapabilities }, callback) => {
      //TODO null handling
      let params = await roomList
        .get(socket.room_id)
        .consume(socket.id, consumerTransportId, producerId, rtpCapabilities);

      console.log("Consuming", {
        name: `${
          roomList.get(socket.room_id) &&
          roomList.get(socket.room_id).getPeers().get(socket.id).name
        }`,
        producer_id: `${producerId}`,
        consumer_id: `${params.id}`,
      });

      callback(params);
    }
  );

  socket.on("resume", async (data, callback) => {
    await consumer.resume();
    callback();
  });

  socket.on("getMyRoomInfo", (_, cb) => {
    cb(roomList.get(socket.room_id).toJson());
  });

  socket.on("disconnect", () => {
    console.log("Disconnect", {
      name: `${
        roomList.get(socket.room_id) &&
        roomList.get(socket.room_id).getPeers().get(socket.id).name
      }`,
    });

    if (!socket.room_id) return;
    roomList.get(socket.room_id).removePeer(socket.id);
  });

  socket.on("producerClosed", ({ producer_id }) => {
    console.log("Producer close", {
      name: `${
        roomList.get(socket.room_id) &&
        roomList.get(socket.room_id).getPeers().get(socket.id).name
      }`,
    });

    roomList.get(socket.room_id).closeProducer(socket.id, producer_id);
  });

  socket.on("exitRoom", async (_, callback) => {
    console.log("Exit room", {
      name: `${
        roomList.get(socket.room_id) &&
        roomList.get(socket.room_id).getPeers().get(socket.id).name
      }`,
    });

    if (!roomList.has(socket.room_id)) {
      callback({
        error: "not currently in a room",
      });
      return;
    }
    // close transports
    await roomList.get(socket.room_id).removePeer(socket.id);
    if (roomList.get(socket.room_id).getPeers().size === 0) {
      roomList.delete(socket.room_id);
    }

    socket.room_id = null;

    callback("successfully exited room");
  });
});

// TODO remove - never used?
function room() {
  return Object.values(roomList).map((r) => {
    return {
      router: r.router.id,
      peers: Object.values(r.peers).map((p) => {
        return {
          name: p.name,
        };
      }),
      id: r.id,
    };
  });
}

/**
 * Get next mediasoup Worker.
 */
function getMediasoupWorker() {
  const worker = workers[nextMediasoupWorkerIdx];

  if (++nextMediasoupWorkerIdx === workers.length) nextMediasoupWorkerIdx = 0;

  return worker;
}

const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const ejs = require("ejs");

app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");

var now = new Date();

mongoose.connect(
  "mongodb+srv://JitterBot:Sommer2021@squareone.jtrh4.mongodb.net/JitterBase",
  { useNewUrlParser: true, useUnifiedTopology: true }
);

//create a data schema
const roomidSchema = {
  roomid: String,
  timestamp: Date,
};

const RoomId = mongoose.model("Roomid", roomidSchema);

const userSchema = {
  email: String,
  password: String,
  name: String,
};

const User = mongoose.model("Users", userSchema);
// Find and show all rooms, limit 10
app.get("/", function (req, res) {
  RoomId.find(
    {
      roomid: { $exists: true, $ne: "" },
    },
    function (err, roomids) {
      res.render("index", {
        roomidList: roomids,
      });
    }
  )
    .limit(10)
    .sort({ timestamp: -1 });

  //.deleteMany({});
});

app.get("/Signin", function (req, res) {
  res.render("Signin", {});
});

app.get("/register", function (req, res) {
  res.render("register", {});
});

app.post("/", function (req, res) {
  console.log("Posting RoomId");
  let newRoomid = new RoomId({
    roomid: req.body.title,
    timestamp: now,
  });

  newRoomid.save();
  res.status(204).send();
});

app.post("/register", function (req, res) {
  console.log("Posting userData");
  let user = new User({
    email: req.body.email,
    password: req.body.password,
    name: req.body.name,
  });
  console.log("redirecting to home");
  res.redirect("./");
  user.save();
});

app.post("/Signin", function (req, res) {
  console.log("validating user");

  User.findOne(
    { email: req.body.email, password: req.body.password },
    function (err, user) {
      if (user) {
        console.log("user exists");
        res.redirect("./");
      } else {
        console.log("user doesn't exist");
        res.redirect("/Signin");
      }
    }
  );
});

// Unique rooms function

// app.post("/", function (req, res) {
//   console.log("Posting RoomId");
//   let newRoomid = new RoomId({
//     roomid: req.body.title,
//     timestamp: now,
//   });
//   RoomId.findOne({ roomName: req.body.title }, function (err, room) {
//     if (room) {
//       console.log("Room exists already");
//       res.redirect("./");
//     } else {
//       console.log("Room does not exist creating Room");
//       newRoomid.save();
//     }
//   });
// });

var request = require("request");
const { exit } = require("process");

function callback(error, response, body) {
  if (!error && response.statusCode == 200) {
    console.log(body);
  }
}

request(options, callback);
