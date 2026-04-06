import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
}

const requiredVars = ["DB_URI", "JWT_SECRET"];

for (const key of requiredVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const envConfig = {
  db_uri: process.env.DB_URI,
  port: Number(process.env.PORT) || 5000,
  jwt_secret: process.env.JWT_SECRET,
  node_env: process.env.NODE_ENV || "development",
};
