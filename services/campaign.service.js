import { AppError } from "../utils/AppError.js";
import { deleteFromGCS, uploadToGCS } from "../utils/GCS.js";
import Campaign from "../models/campaign.model.js";
import slugify from "slugify";
import mongoose from "mongoose";
import CampaignerLayout from "../models/campaignerLayout.model.js";

export const createCampaignService = async (req) => {
  const {
    title,
    description,
    sections,
    startDate,
    endDate,
    status,
    campaignerLayout,
  } = req.body;

  const requiredFields = [
    "title",
    "description",
    "sections",
    "startDate",
    "endDate",
    "campaignerLayout",
  ];

  for (let field of requiredFields) {
    if (!req.body[field]) {
      throw new AppError(`${field} is required`, 400);
    }
  }

  if (!mongoose.isValidObjectId(campaignerLayout)) {
    throw new AppError(`Invalid CampaignerLayoutId: ${campaignerLayout}`, 400);
  }

  const campaignerLayoutDetails =
    await CampaignerLayout.findById(campaignerLayout);

  if (!campaignerLayoutDetails) {
    throw new AppError("Campaigner Layout not found", 404);
  }

  let parsedSections;
  try {
    parsedSections =
      typeof sections === "string" ? JSON.parse(sections) : sections;
  } catch {
    throw new AppError("Invalid sections JSON", 400);
  }

  if (!Array.isArray(parsedSections) || parsedSections.length === 0) {
    throw new AppError("Sections must be non-empty array", 400);
  }

  const validTypes = ["text", "quote", "gallery", "video", "highlights"];

  for (let section of parsedSections) {
    if (!validTypes.includes(section?.type)) {
      throw new AppError(`Invalid section type: ${section?.type}`, 400);
    }
    if (!section.content) {
      throw new AppError("Section content is required", 400);
    }
  }

  const parsedStartDate = new Date(startDate);
  const parsedEndDate = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  parsedStartDate.setHours(0, 0, 0, 0);
  parsedEndDate.setHours(0, 0, 0, 0);

  if (isNaN(parsedStartDate)) throw new AppError("Invalid start date", 400);
  if (parsedStartDate < today)
    throw new AppError("Start date can't be in past", 400);

  if (isNaN(parsedEndDate)) throw new AppError("Invalid end date", 400);
  if (parsedEndDate <= parsedStartDate) {
    throw new AppError("End date must be greater than start date", 400);
  }

  const cleanedTitle = title.trim();
  const cleanedDescription = description.trim();
  const slug = slugify(cleanedTitle, { lower: true, strict: true });

  const isExistCampaign = await Campaign.findOne({ slug });
  if (isExistCampaign) {
    throw new AppError(
      "Campaign with this title already exists. Try variation.",
      400,
    );
  }

  const fileMap = {};
  for (let file of req.files || []) {
    fileMap[file.fieldname] = file;
  }

  const bannerFile = fileMap["banner"];
  const campaignImageFile = fileMap["campaignImage"];

  if (!bannerFile) throw new AppError("Banner is required", 400);
  if (!campaignImageFile) throw new AppError("Campaign Image is required", 400);

  const campaign = await Campaign.create({
    title: cleanedTitle,
    slug,
    campaignerLayout: campaignerLayoutDetails._id,
    description: cleanedDescription,
    sections: [],
    startDate: parsedStartDate,
    endDate: parsedEndDate,
    status: status || "published",
  });

  const basePath = `campaigns/${campaign._id}`;

  try {
    const [bannerResult, campaignImageResult] = await Promise.all([
      uploadToGCS(bannerFile, `${basePath}/images`),
      uploadToGCS(campaignImageFile, `${basePath}/images`),
    ]);

    if (!bannerResult?.filename || !bannerResult?.url) {
      throw new AppError("Banner image upload failed", 500);
    }
    if (!campaignImageResult?.filename || !campaignImageResult?.url) {
      throw new AppError("Campaigner image upload failed", 500);
    }

    for (let section of parsedSections) {
      if (section.type === "gallery") {
        if (!Array.isArray(section.content)) {
          throw new AppError("Gallery content must be array", 400);
        }

        const uploads = await Promise.all(
          section.content.map(async (item) => {
            if (!item.fileKey) {
              throw new AppError("fileKey is required for gallery", 400);
            }

            const file = fileMap[item.fileKey];
            if (!file) throw new AppError("Gallery image missing", 400);

            const result = await uploadToGCS(file, `${basePath}/gallery`);

            if (!result?.filename || !result?.url) {
              throw new AppError("Gallery Images upload failed", 500);
            }
            return {
              filename: result.filename,
              url: result.url,
            };
          }),
        );

        section.content = uploads;
      }

      if (section.type === "video") {
        const file = fileMap[section.content.fileKey];

        if (!file) throw new AppError("Video file missing", 400);

        const result = await uploadToGCS(file, `${basePath}/videos`);
        if (!result?.filename || !result?.url) {
          throw new AppError("Video File upload failed", 500);
        }
        section.content = {
          filename: result.filename,
          url: result.url,
        };
      }

      if (section.type === "highlights") {
        let parsedHighlights;

        try {
          parsedHighlights =
            typeof section.content === "string"
              ? JSON.parse(section.content)
              : section.content;
        } catch {
          throw new AppError("Invalid highlights format", 400);
        }

        if (!Array.isArray(parsedHighlights)) {
          throw new AppError("Highlights must be an array", 400);
        }

        section.content = parsedHighlights;
      }
    }

    campaign.banner = {
      filename: bannerResult.filename,
      url: bannerResult.url,
    };

    campaign.campaignImage = {
      filename: campaignImageResult.filename,
      url: campaignImageResult.url,
    };

    campaign.sections = parsedSections;

    await campaign.save();

    return {
      status: 201,
      message: "Campaign created successfully",
      data: campaign,
    };
  } catch (err) {
    await Campaign.findByIdAndDelete(campaign._id);
    throw err;
  }
};
export const getCampaignsService = async (req) => {
  const status = req.query.status;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let query = {};
  const validStatus = ["draft", "expired"];

  if (status && !validStatus.includes(status)) {
    throw new AppError("Invalid status filter", 400);
  }
  if (status === "draft") {
    query = { status: "draft" };
  } else if (status === "expired") {
    query = {
      status: "published",
      endDate: { $lt: today },
    };
  } else {
    query = {
      status: "published",
      endDate: { $gte: today },
    };
  }

  const campagins = await Campaign.find(query).select("-createdAt -updatedAt").lean();

  if (!campagins.length) {
    return {
      status: 200,
      message: "No active campaigns found",
      data: [],
    };
  }

  return {
    status: 200,
    message: "Campaign fetched successfully",
    data: campagins,
  };
};

export const updateCampaignService = async (req) => {
  const id = req.params.id;

  if (!id) throw new AppError("Campaign id is required", 400);

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(`Invalid CampaignId: ${id}`, 400);
  }

  const campaign = await Campaign.findById(id);
  if (!campaign) throw new AppError("Campaign not found", 404);

  const updateData = Object.fromEntries(
    Object.entries(req.body).filter(([_, value]) => value !== undefined),
  );

  if (Object.keys(updateData).length === 0 && !req.files?.length) {
    throw new AppError("No fields provided for update", 400);
  }

  delete updateData._id;
  delete updateData.createdAt;
  delete updateData.updatedAt;

  const fileMap = {};
  for (let file of req.files || []) {
    fileMap[file.fieldname] = file;
  }

  const basePath = `campaigns/${campaign._id}`;

  if (updateData?.title && updateData.title !== campaign.title) {
    const cleanedTitle = updateData.title.trim();
    const slug = slugify(cleanedTitle, { lower: true, strict: true });

    const exists = await Campaign.findOne({
      slug,
      _id: { $ne: id },
    });

    if (exists) {
      throw new AppError("Campaign with this title already exists", 400);
    }

    campaign.title = cleanedTitle;
    campaign.slug = slug;
  }

  if (
    updateData?.description &&
    updateData.description !== campaign.description
  ) {
    campaign.description = updateData.description.trim();
  }

  if (updateData?.campaignerLayout) {
    if (!mongoose.isValidObjectId(updateData.campaignerLayout)) {
      throw new AppError("Invalid campaignLayoutId", 400);
    }

    if (updateData.campaignerLayout !== campaign.campaignerLayout.toString()) {
      const campaignerLayoutDetails = await CampaignerLayout.findById(
        updateData.campaignerLayout,
      ).lean();

      if (!campaignerLayoutDetails) {
        throw new AppError("CampaignerLayout not found", 404);
      }

      campaign.campaignerLayout = campaignerLayoutDetails._id;
    }
  }

  if (fileMap["banner"]) {
    const result = await uploadToGCS(fileMap["banner"], `${basePath}/images`);

    if (!result?.filename || !result?.url) {
      throw new AppError("Banner upload failed", 500);
    }

    if (campaign.banner?.filename) {
      await deleteFromGCS(campaign.banner.filename);
    }

    campaign.banner = {
      filename: result.filename,
      url: result.url,
    };
  }

  if (fileMap["campaignImage"]) {
    const result = await uploadToGCS(
      fileMap["campaignImage"],
      `${basePath}/images`,
    );

    if (!result?.filename || !result?.url) {
      throw new AppError("Campaign image upload failed", 500);
    }

    if (campaign.campaignImage?.filename) {
      await deleteFromGCS(campaign.campaignImage.filename);
    }

    campaign.campaignImage = {
      filename: result.filename,
      url: result.url,
    };
  }

  let parsedSections;

  if (updateData?.sections) {
    try {
      parsedSections =
        typeof updateData.sections === "string"
          ? JSON.parse(updateData.sections)
          : updateData.sections;
    } catch {
      throw new AppError("Invalid sections JSON", 400);
    }

    if (!Array.isArray(parsedSections) || parsedSections.length === 0) {
      throw new AppError("Sections must be non-empty array", 400);
    }

    const validTypes = ["text", "quote", "gallery", "video", "highlights"];

    for (let section of parsedSections) {
      if (!validTypes.includes(section?.type)) {
        throw new AppError(`Invalid section type: ${section?.type}`, 400);
      }

      if (!section.content) {
        throw new AppError("Section content is required", 400);
      }

      if (section.type === "gallery") {
        if (!Array.isArray(section.content)) {
          throw new AppError("Gallery content must be array", 400);
        }

        const updatedContent = [];

        for (let item of section.content) {
          if (item.url && item.filename && !item.fileKey) {
            updatedContent.push(item);
            continue;
          }

          if (item.fileKey) {
            const file = fileMap[item.fileKey];

            if (!file) throw new AppError("Gallery image missing", 400);

            const result = await uploadToGCS(file, `${basePath}/gallery`);

            updatedContent.push({
              filename: result.filename,
              url: result.url,
            });
          }
        }

        section.content = updatedContent;
      }

      if (section.type === "video") {
        if (section.content?.url && !section.content?.fileKey) {
          continue;
        }

        const file = fileMap[section.content.fileKey];

        if (!file) throw new AppError("Video file missing", 400);

        const result = await uploadToGCS(file, `${basePath}/videos`);

        section.content = {
          filename: result.filename,
          url: result.url,
        };
      }

      if (section.type === "highlights") {
        let parsedHighlights;

        try {
          parsedHighlights =
            typeof section.content === "string"
              ? JSON.parse(section.content)
              : section.content;
        } catch {
          throw new AppError("Invalid highlights format", 400);
        }

        if (!Array.isArray(parsedHighlights)) {
          throw new AppError("Highlights must be an array", 400);
        }

        section.content = parsedHighlights;
      }
    }

    campaign.sections = parsedSections;
  }

  await campaign.save();

  return {
    status: 200,
    message: "Campaign updated successfully",
    data: campaign,
  };
};
