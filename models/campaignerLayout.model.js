import mongoose from "mongoose";

const campaignerLayoutSchema = new mongoose.Schema(
  {
    layoutName: {
      type: String,
      required: true,
      unique: true,
    },
    campaignerCardDescription: {
      type: String,
      required: true,
    },
    donationCard: {
      quote: {
        type: String,
        required: true,
      },
      quoteSource: {
        type: String,
        required: true,
      },
    },
    sevaList: [
      {
        sevaName: {
          type: String,
        },
        sevaDescription: {
          type: String,
        },
        sevaAmount: {
          type: Number,
        },
        sevaImage: {
          filename: {
            type: String,
          },
          url: {
            type: String,
          },
        },
      },
    ],

    sections: [
      {
        type: {
          type: String,
          enum: ["text", "quote", "gallery", "video", "highlights"],
          required: true,
        },
        content: {
          type: mongoose.Schema.Types.Mixed,
          required: true,
        },
      },
    ],

    isActive: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const CampaignerLayout = mongoose.model(
  "CampaignerLayout",
  campaignerLayoutSchema,
);

export default CampaignerLayout;
