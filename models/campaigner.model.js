import mongoose from "mongoose";

const campaignerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      required: true,
    },
    targetAmount: {
      type: Number,
      required: true,
    },
    totalRaised: {
      type: Number,
      default: 0,
    },
    touchWithDevotee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TempleDevotee",
      default: null,
    },
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    profileImage: {
      filename: {
        type: String,
        required: true,
      },
      url: {
        type: String,
        required: true,
      },
    },
    status: {
      type: String,
      enum: ["active", "pending", "rejected"],
      default: "pending",
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);
campaignerSchema.index({ slug: 1, campaignId: 1 }, { unique: true });
campaignerSchema.index({ name: 1, campaignId: 1 }, { unique: true });
const Campaigner = mongoose.model("Campaigner", campaignerSchema);

export default Campaigner;
