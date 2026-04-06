import { AppError } from "./AppError.js";
import multer from "multer";
import response from "./response.js";

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export const errorHandler = (err, req, res, next) => {
  console.log("❌ Error: ", err);

  if (err instanceof AppError) {
    return response(res, err.statusCode, err.message);
  }

  if (err.code === 11000) {
    return response(res, 400, "Duplicate Value");
  }

  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);

    return response(res, 400, messages.join(", "));
  }

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return response(res, 400, "File size must be less than 5MB");
    }

    return response(res, 400, err.message);
  }

  if (res.headersSent) {
    return next(err);
  }

  return response(res, 500, "Internal Server Error");
};
