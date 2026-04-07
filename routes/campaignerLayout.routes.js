import * as campaignerLayoutControllers from "../controller/campaignerLayout.controller.js";
import express from "express";
import { upload } from "../middleware/multer.middleware.js";

const campaignerLayoutRouter = express.Router();

campaignerLayoutRouter.post(
  "/layout",
  upload.any(),
  campaignerLayoutControllers.createCampaignerLayout,
);

campaignerLayoutRouter.get(
  "/layout/:id",
  campaignerLayoutControllers.getSingleCampaignerLayout,
);

campaignerLayoutRouter.get(
  "/layout",
  campaignerLayoutControllers.getAllCampaignerLayouts,
);

export default campaignerLayoutRouter;
