import * as campaignControllers from "../controller/campaign.controller.js";
import express from "express";
import { upload } from "../middleware/multer.middleware.js";

const campaignRouter = express.Router();

campaignRouter.post("/", upload.any(), campaignControllers.createCampaign);
campaignRouter.get("/", campaignControllers.getCampaigns);

export default campaignRouter;
