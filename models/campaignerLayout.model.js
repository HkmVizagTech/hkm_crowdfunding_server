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
          default: null,
        },
        sevaDescription: {
          type: String,
          default: null,
        },
        sevaAmount: {
          type: Number,
          default: null,
        },
        sevaImage: {
          filename: {
            type: String,
            default: null,
          },
          url: {
            type: String,
            default: null,
          },
        },
      },
    ],

    sections: [
      {
        type: {
          type: String,
          enum: ["text", "quote", "gallery", "video", "highlights"],
        },
        content: {
          type: mongoose.Schema.Types.Mixed,
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
