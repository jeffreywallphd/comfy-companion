const express = require("express");
const path = require("path");
const fs = require("fs/promises");
const config = require("../config/config");
const { LOCAL_IMAGE_DIR } = require("../services/imageLibraryService");

const router = express.Router();

router.get("/local/:fileName", async (req, res) => {
  try {
    const safeName = path.basename(req.params.fileName);
    const fullPath = path.join(LOCAL_IMAGE_DIR, safeName);

    await fs.access(fullPath);
    res.sendFile(path.resolve(fullPath));
  } catch (error) {
    console.error("[routes/mediaAssets] Failed to serve local asset image:", error);
    res.status(404).json({
      error: "Image not found"
    });
  }
});

router.get("/comfyui/:fileName", async (req, res) => {
  try {
    if (!config.comfyInputDir) {
      return res.status(500).json({
        error: "COMFY_INPUT_DIR is not configured."
      });
    }

    const safeName = path.basename(req.params.fileName);
    const fullPath = path.join(config.comfyInputDir, safeName);

    await fs.access(fullPath);
    res.sendFile(path.resolve(fullPath));
  } catch (error) {
    console.error("[routes/mediaAssets] Failed to serve ComfyUI asset image:", error);
    res.status(404).json({
      error: "Image not found"
    });
  }
});

module.exports = router;