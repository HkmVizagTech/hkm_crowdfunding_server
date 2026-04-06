import * as campaignServices from "../services/campaign.service.js";
import { asyncHandler } from "../utils/handlers.js";
import response from "../utils/response.js";

export const createCampaign = asyncHandler(async (req, res) => {
  const { status, message, data } =
    await campaignServices.createCampaignService(req);
  response(res, status, message, data);
});

export const getCampaigns = asyncHandler(async (req, res) => {
  const { status, message, data } =
    await campaignServices.getCampaignsService(req);
  response(res, status, message, data);
});
