import { bucket } from "../config/GCS.config.js";
import sharp from "sharp";
import { AppError } from "./AppError.js";

// 🔥 Smart compression function
const compressImage = async (buffer, isProfile) => {
  let quality = isProfile ? 70 : 80;
  let width = isProfile ? 300 : 800;

  const maxSize = isProfile ? 1 * 1024 * 1024 : 5 * 1024 * 1024;

  let outputBuffer = await sharp(buffer)
    .resize({ width })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();

  // 🔁 Reduce quality until size fits
  while (outputBuffer.length > maxSize && quality > 30) {
    quality -= 10;

    outputBuffer = await sharp(buffer)
      .resize({ width })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
  }

  return outputBuffer;
};

export const uploadToGCS = async (
  file,
  folder = "uploads",
  isProfile = false,
) => {
  const isImage = file.mimetype.startsWith("image/");
  const isVideo = file.mimetype.startsWith("video/");

  if (!isImage && !isVideo) {
    throw new AppError("Only image and video files are allowed", 400);
  }

  // 🔥 Global max size (videos/images raw upload limit)
  if (file.size > 20 * 1024 * 1024) {
    throw new AppError("File size too large (max 20MB)", 400);
  }

  let bufferToUpload = file.buffer;

  // ✅ Smart image compression
  if (isImage) {
    bufferToUpload = await compressImage(file.buffer, isProfile);
  }

  // 🔥 Clean filename
  const ext = isImage ? "jpg" : file.mimetype.split("/")[1];

  const cleanName = file.originalname
    .split(".")[0]
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9.-]/g, "");

  const filename = `${folder}/${Date.now()}-${cleanName}.${ext}`;

  const blob = bucket.file(filename);
  try {
    await blob.save(bufferToUpload, {
      resumable: false,
      contentType: isImage ? "image/jpeg" : file.mimetype,
      validation: false,
    });

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;

    return {
      filename,
      url: publicUrl,
      type: isImage ? "image" : "video",
    };
  } catch (error) {
    throw new AppError(`GCS upload failed: ${error.message}`, 500);
  }
};

export const deleteFromGCS = async (fileName) => {
  if (!fileName) throw new Error("File name is required");

  await bucket.file(fileName).delete({
    ignoreNotFound: true,
  });
};
