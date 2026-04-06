import mongoose from "mongoose";
import { envConfig } from "./env.config.js";

export const dbConnection = async () => {
  try {
    await mongoose.connect(envConfig.db_uri);
    console.log("DB connected successfully 🔗");
  } catch (error) {
    console.log("DB connection failed: ", error);
    process.exit(1)
  }
};
