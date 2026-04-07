import mongoose from "mongoose";

const campaignSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
    },
    banner: {
      filename: {
        type: String,
      },
      url: {
        type: String,
      },
    },
    campaignerLayout: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CampaignerLayout",
      required: true,
    },
    campaignImage: {
      filename: {
        type: String,
      },
      url: {
        type: String,
      },
    },
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
    totalRaised: {
      type: Number,
      default: 0,
    },
    donorsCount: {
      type: Number,
      default: 0,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
      validate: {
        validator: function (value) {
          return value >= this.startDate;
        },
        message: "End date must be after start date",
      },
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);
campaignSchema.virtual("computedStatus").get(function () {
  if (this.status === "draft") return "draft";
  if (this.endDate < new Date()) return "expired";
  return "active";
});
const Campaign = mongoose.model("Campaign", campaignSchema);

export default Campaign;
