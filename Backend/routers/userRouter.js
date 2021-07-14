import express from "express";
import expressAsyncHandler from "express-async-handler";
import bcrypt from "bcryptjs";
import data from "../data.js";
import User from "../models/userModel.js";
import { generateToken } from "../utils.js";

//express.router is a function which makes the code modular, instead of having all routers in server.js. now multiple files have our router
const userRouter = express.Router();

// async get method for seed api, req and res is node api method
userRouter.get(
  "/seed",
  expressAsyncHandler(async (req, res) => {
    // create users, User is the oject, insertmany accept an array
    // users in data.js will be inserted to the users collection in MongoDB
    // await User.remove({});
    const createdUsers = await User.insertMany(data.users);
    res.send({ createdUsers });
  })
);
// async express function acepts request and response
userRouter.post(
  "/signin",
  expressAsyncHandler(async (req, res) => {
    //check user email in db
    const user = await User.findOne({ email: req.body.email });
    if (user) {
      //compare the relevant password and db password
      if (bcrypt.compareSync(req.body.password, user.password)) {
        res.send({
          id: user._id,
          name: user.name,
          email: user.email,
          isAdmin: user.isAdmin,
          // json webtoken is a hased string, we use this next to authenticate
          token: generateToken(user),
        });
        return;
      }
    }
    // 401 is unautorized code
    res.status(401).send({ message: "Invalid email or password" });
  })
);

userRouter.post(
  "/register",
  expressAsyncHandler(async (req, res) => {
    const user = new User({
      name: req.body.name,
      email: req.body.email,
      password: bcrypt.hashSync(req.body.password, 8),
    });
    const createdUser = await user.save();
    res.send({
      id: createdUser._id,
      name: createdUser.name,
      email: createdUser.email,
      isAdmin: createdUser.isAdmin,
      // json webtoken is a hased string, we use this next to authenticate
      token: generateToken(createdUser),
    });
  })
);

export default userRouter;
