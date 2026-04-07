import * as campaignerLayoutServices from "../services/campaignerLayout.service.js";
import { asyncHandler } from "../utils/handlers.js";
import response from "../utils/response.js";

export const createCampaignerLayout = asyncHandler(async (req, res) => {
  const { status, message, data } =
    await campaignerLayoutServices.createCampaignerLayoutService(req);

  response(res, status, message, data);
});

export const getSingleCampaignerLayout = asyncHandler(async (req, res) => {
  const { status, message, data } =
    await campaignerLayoutServices.getSingleCampaignerLayoutService(req);

  response(res, status, message, data);
});

export const getAllCampaignerLayouts = asyncHandler(async (req, res) => {
  const { status, message, data } =
    await campaignerLayoutServices.getAllCampaignerLayoutsService(req);

  response(res, status, message, data);
});
