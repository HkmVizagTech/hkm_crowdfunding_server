import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const noCache = (req, res, next) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store",
  });
  next();
};
const app = express();

app.use(noCache);
app.use(express.json());
app.use(cors());
app.use(cookieParser());

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});
import campaignRouter from "./routes/campaign.routes.js";
app.use("/api/campaign", campaignRouter);
import { errorHandler } from "./utils/handlers.js";
app.use(errorHandler);
export default app;
