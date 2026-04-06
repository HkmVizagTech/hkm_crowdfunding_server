import { AppError } from "../utils/AppError.js";
import { uploadToGCS } from "../utils/GCS.js";
import Campaign from "../models/campaign.model.js";
import slugify from "slugify";

export const createCampaignService = async (req) => {
  const { title, description, sections, startDate, endDate, status } = req.body;

  const requiredFields = [
    "title",
    "description",
    "sections",
    "startDate",
    "endDate",
  ];

  for (let field of requiredFields) {
    if (!req.body[field]) {
      throw new AppError(`${field} is required`, 400);
    }
  }

  let parsedSections;
  try {
    parsedSections =
      typeof sections === "string" ? JSON.parse(sections) : sections;
  } catch (err) {
    throw new AppError("Invalid sections JSON", 400);
  }

  if (!Array.isArray(parsedSections) || parsedSections.length === 0) {
    throw new AppError("Sections must be non-empty array", 400);
  }

  const validTypes = ["text", "quote", "gallery", "video", "highlights"];

  for (let section of parsedSections) {
    console.log("section types: ", section?.type);
    if (!validTypes.includes(section?.type)) {
      throw new AppError(`Invalid section type: ${section?.type}`, 400);
    }
    console.log("section content: ", section.content);
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
      "Campaign with this title already exists. Try adding year or variation.",
      400,
    );
  }

  const fileMap = {};
  for (let file of req.files) {
    fileMap[file.fieldname] = file;
  }

  const bannerFile = fileMap["banner"];
  const campaignImageFile = fileMap["campaignImage"];

  if (!bannerFile) throw new AppError("Banner is required", 400);
  if (!campaignImageFile) throw new AppError("Campaign Image is required", 400);

  const [bannerResult, campaignImageResult] = await Promise.all([
    uploadToGCS(bannerFile, `campaigns/${slug}/images`),
    uploadToGCS(campaignImageFile, `campaigns/${slug}/images`, true),
  ]);

  for (let section of parsedSections) {
    if (section.type === "gallery") {
      if (!Array.isArray(section?.content)) {
        throw new AppError("content must be array of object", 400);
      }

      const uploads = await Promise.all(
        section?.content?.map(async (item) => {
          if (!item.fileKey) {
            throw new AppError("fileKey is required for gallery", 400);
          }

          const file = fileMap[item.fileKey];

          if (!file) throw new AppError("Gallery image missing", 400);

          const result = await uploadToGCS(
            file,
            `campaigns/${slug}/gallery`,
            true,
          );

          return {
            filename: result.filename,
            url: result.url,
          };
        }),
      );

      section.content = uploads;
    }

    if (section.type === "video") {
      const file = fileMap[section?.content?.fileKey];

      if (!file) throw new AppError("Video file missing", 400);

      const result = await uploadToGCS(file, `campaigns/${slug}/videos`);

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

  const newCampaign = await Campaign.create({
    title: cleanedTitle,
    slug,
    description: cleanedDescription,
    sections: parsedSections,
    startDate: parsedStartDate,
    endDate: parsedEndDate,
    banner: {
      filename: bannerResult.filename,
      url: bannerResult.url,
    },
    campaignImage: {
      filename: campaignImageResult.filename,
      url: campaignImageResult.url,
    },
    status: status || "published",
  });

  return {
    status: 201,
    message: "Campaign created successfully",
    data: newCampaign,
  };
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

  const campagins = await Campaign.find(query).select("-createdAt -updatedAt");

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
