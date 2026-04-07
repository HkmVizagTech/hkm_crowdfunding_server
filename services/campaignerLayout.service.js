import mongoose from "mongoose";
import CampaignerLayout from "../models/campaignerLayout.model.js";
import { AppError } from "../utils/AppError.js";
import { uploadToGCS } from "../utils/GCS.js";
import Campaign from "../models/campaign.model.js";

export const createCampaignerLayoutService = async (req) => {
  const {
    layoutName,
    campaignerCardDescription,
    donationCard,
    sevaList,
    sections,
    isActive,
  } = req.body;

  if (!layoutName?.trim()) {
    throw new AppError("layoutName is required", 400);
  }

  if (!campaignerCardDescription?.trim()) {
    throw new AppError("campaignerCardDescription is required", 400);
  }

  if (!donationCard) {
    throw new AppError("donationCard is required", 400);
  }
  let parsedDonationCard;

  try {
    parsedDonationCard =
      typeof donationCard === "string"
        ? JSON.parse(donationCard)
        : donationCard;
  } catch {
    throw new AppError("Invalid donationCard JSON", 400);
  }

  const donationCardRequiredFields = ["quote", "quoteSource"];
  console.log("parsedDonationCard:", parsedDonationCard);
  for (let field of donationCardRequiredFields) {
    if (
      !parsedDonationCard[field] ||
      typeof parsedDonationCard[field] !== "string"
    ) {
      throw new AppError(`${field} is required`, 400);
    }
  }
  let active;

  if (typeof isActive === "boolean") {
    active = isActive;
  } else if (isActive === "true" || isActive === "false") {
    active = isActive === "true";
  } else {
    throw new AppError("isActive must be boolean", 400);
  }

  const fileMap = {};
  for (let file of req.files || []) {
    fileMap[file.fieldname] = file;
  }

  const layout = await CampaignerLayout.create({
    layoutName,
    campaignerCardDescription,
    donationCard: {
      quote: parsedDonationCard.quote,
      quoteSource: parsedDonationCard.quoteSource,
    },
    isActive: active,
    sections: [],
  });

  const basePath = `campaignerLayouts/${layout._id}`;

  try {
    let updatedSevaList = [];

    if (sevaList) {
      let parsedSevaList;

      try {
        parsedSevaList =
          typeof sevaList === "string" ? JSON.parse(sevaList) : sevaList;
      } catch {
        throw new AppError("Invalid sevaList JSON", 400);
      }

      if (!Array.isArray(parsedSevaList)) {
        throw new AppError("sevaList must be array", 400);
      }

      updatedSevaList = await Promise.all(
        parsedSevaList.map(async (seva) => {
          if (
            !seva.sevaName ||
            !seva.sevaDescription ||
            !seva.sevaAmount ||
            !seva.sevaImage
          ) {
            throw new AppError("Invalid sevaList fields", 400);
          }

          const file = fileMap[seva.sevaImage];

          if (!file) {
            throw new AppError("Seva image file missing", 400);
          }

          const result = await uploadToGCS(file, `${basePath}/seva`);

          return {
            sevaName: seva.sevaName,
            sevaDescription: seva.sevaDescription,
            sevaAmount: seva.sevaAmount,
            sevaImage: {
              filename: result.filename,
              url: result.url,
            },
          };
        }),
      );
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

      if (section.type === "gallery") {
        if (!Array.isArray(section?.content)) {
          throw new AppError("Gallery must be array", 400);
        }

        const uploads = await Promise.all(
          section?.content?.map(async (item) => {
            if (!item?.fileKey) {
              throw new AppError("fileKey is required for gallery", 400);
            }
            const file = fileMap[item?.fileKey];

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
        if (!section.content?.fileKey) {
          throw new AppError("Video fileKey is required", 400);
        }
        const file = fileMap[section.content?.fileKey];

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

    if (updatedSevaList?.length > 0) {
      layout.sevaList = updatedSevaList;
    }

    layout.sections = parsedSections;

    await layout.save();

    return {
      status: 201,
      message: "Campaigner Layout created successfully",
      data: layout,
    };
  } catch (err) {
    await CampaignerLayout.findByIdAndDelete(layout._id);
    throw err;
  }
};

export const getSingleCampaignerLayoutService = async (req) => {
  const id = req.params.id;

  if (!id) {
    throw new AppError("id is required", 400);
  }

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(`Invalid campaignerLayout Id: ${id}`, 400);
  }

  const camapignerLayout = await CampaignerLayout.findById(id)
    .select("-updatedAt")
    .lean();

  const campaignUsing = await Campaign.countDocuments({ campaignerLayout: id });

  if (!camapignerLayout) {
    throw new AppError("Campaigner Layout not found", 404);
  }

  return {
    status: 200,
    message: "Campaigner layout fetched successfully",
    data: {
      ...camapignerLayout,
      campaignUsing,
    },
  };
};

export const getAllCampaignerLayoutsService = async (req) => {
  let { isActive, page = 1, limit = 15 } = req.query;

  page = parseInt(page);
  limit = parseInt(limit);
  const skip = (page - 1) * limit;

  const filter = {};

  if (isActive !== undefined) {
    if (isActive === "true" || isActive === "false") {
      filter.isActive = isActive === "true";
    } else {
      throw new AppError("isActive must be boolean value", 400);
    }
  }

  const campaignerLayouts = await CampaignerLayout.find({ isActive })
    .select("layoutName isActive createdAt _id")
    .skip(skip)
    .limit(limit)
    .lean();

  if (campaignerLayouts.length === 0) {
    return {
      status: 200,
      message: "No campaigner layouts",
      data: {
        layouts: [],
        totalLayouts: 0,
        totalPages: 1,
        page,
        limit,
      },
    };
  }

  const totalCampaingerLayouts = await CampaignerLayout.countDocuments({
    isActive,
  });

  const layoutIds = campaignerLayouts.map((item) => item._id);

  const counts = await Campaign.aggregate([
    {
      $match: {
        campaignerLayout: { $in: layoutIds },
      },
    },
    {
      $group: {
        _id: "$campaignerLayout",
        totalCount: {
          $sum: 1,
        },
      },
    },
  ]);

  const countMap = {};

  counts.forEach((c) => {
    countMap[c._id.toString()] = c.totalCount;
  });

  const updatedLayouts = campaignerLayouts.map((item) => ({
    ...item,
    campaignUsing: countMap[item._id.toString()] || 0,
  }));

  return {
    status: 200,
    message: "Layouts fetched successfully",
    data: {
      layouts: updatedLayouts,
      totalLayouts: totalCampaingerLayouts,
      totalPages: Math.ceil(totalCampaingerLayouts / limit),
      page,
      limit,
    },
  };
};
