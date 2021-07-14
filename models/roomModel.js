const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const roomSchema = new Schema(
  {
    roomid: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);
//model
const room = mongoose.model("RoomModel", roomSchema);
module.exports = RoomModel;
