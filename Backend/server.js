import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import userRouter from "./routers/userRouter.js";
import productRouter from "./routers/productRouter.js";

dotenv.config();

const app = express();
// new middleware passing json data to body of request
app.use(express.json());
// all request which contain data will be translated to req.body in the node app
app.use(express.urlencoded({ extended: true }));

//connect to mongodb, process env mongodburl makes it flex to env, but in our case it is false so the hardcoded url is used
mongoose.connect(process.env.MONGODB_URL || "mongodb://localhost/amazona", {
  // get rid of duplicated warnings
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
});

app.use("/api/users", userRouter);
app.use("/api/products", productRouter);
app.get("/", (req, res) => {
  res.send("Server is ready");
});
//error catches from router express asynfunction
app.use((err, req, res, next) => {
  res.status(500).send({ message: err.message });
});
const port = process.env.PORT || 5000;
app.listen(5000, () => {
  console.log(`Serve at http://localhost:${port}`);
});
