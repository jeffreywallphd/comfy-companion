const express = require("express");
const multer = require("multer");
const { saveUploadedLocalImage } = require("../services/imageLibraryService");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024
  }
});

router.post("/image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "No image file was uploaded."
      });
    }

    if (!req.file.mimetype || !req.file.mimetype.startsWith("image/")) {
      return res.status(400).json({
        error: "Uploaded file must be an image."
      });
    }

    const asset = await saveUploadedLocalImage(req.file);

    res.json({
      ok: true,
      asset
    });
  } catch (error) {
    console.error("[routes/uploads] Failed to upload image:", error);

    res.status(500).json({
      error: "Failed to upload image",
      details: error.message
    });
  }
});

module.exports = router;