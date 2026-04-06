import mongoose from "mongoose";

const templeDevoteeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      index: true,
      unique: true,
    },
    shortForm: {
      type: String,
      required: true,
      index: true,
      unique: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      register: "Auth",
    },
    profileImage: {
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
  { timestamps: true, versionKey: false },
);

const TempleDevotee = mongoose.model("TempleDevotee", templeDevoteeSchema);

export default TempleDevotee;
