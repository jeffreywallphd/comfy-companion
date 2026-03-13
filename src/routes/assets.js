const express = require("express");
const path = require("path");
const fs = require("fs/promises");
const config = require("../config/config");
const {
  LOCAL_IMAGE_DIR,
  listLocalImages,
  listComfyInputImages
} = require("../services/imageLibraryService");
const { GENERATIONS_DIR } = require("../services/generationLibraryService");

const router = express.Router();

function isImageFile(fileName) {
  return /\.(png|jpg|jpeg|webp|bmp|gif)$/i.test(fileName);
}

async function safeStat(fullPath) {
  try {
    return await fs.stat(fullPath);
  } catch {
    return null;
  }
}

function resolveAssetPath(source, fileName) {
  const safeName = path.basename(fileName);

  if (source === "local") {
    return path.join(LOCAL_IMAGE_DIR, safeName);
  }

  if (source === "generation") {
    return path.join(GENERATIONS_DIR, safeName);
  }

  if (source === "comfyui") {
    if (!config.comfyInputDir) {
      throw new Error("COMFY_INPUT_DIR is not configured.");
    }

    return path.join(config.comfyInputDir, safeName);
  }

  throw new Error(`Unsupported asset source: ${source}`);
}

function buildLocalAsset(item, stats = null) {
  return {
    ...item,
    id: item.id || `local:${item.fileName}`,
    source: "local",
    name: item.displayName || item.fileName,
    fileName: item.fileName,
    size: stats?.size ?? item.size ?? null,
    modifiedAt: stats?.mtime?.toISOString?.() ?? item.modifiedAt ?? item.updatedAt ?? null,
    thumbnailUrl: `/media/assets/local/${encodeURIComponent(item.fileName)}`,
    downloadUrl: `/media/assets/local/${encodeURIComponent(item.fileName)}`
  };
}

function buildComfyAsset(item, stats = null) {
  return {
    ...item,
    id: item.id || `comfyui:${item.fileName}`,
    source: "comfyui",
    name: item.displayName || item.fileName,
    fileName: item.fileName,
    size: stats?.size ?? item.size ?? null,
    modifiedAt: stats?.mtime?.toISOString?.() ?? item.modifiedAt ?? item.updatedAt ?? null,
    thumbnailUrl: `/media/assets/comfyui/${encodeURIComponent(item.fileName)}`,
    downloadUrl: `/media/assets/comfyui/${encodeURIComponent(item.fileName)}`
  };
}

async function listGenerationImages() {
  await fs.mkdir(GENERATIONS_DIR, { recursive: true });

  const entries = await fs.readdir(GENERATIONS_DIR, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && isImageFile(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const assets = [];

  for (const fileName of files) {
    const fullPath = path.join(GENERATIONS_DIR, fileName);
    const stats = await safeStat(fullPath);

    assets.push({
      id: `generation:${fileName}`,
      source: "generation",
      name: fileName,
      fileName,
      size: stats?.size ?? null,
      modifiedAt: stats?.mtime?.toISOString?.() ?? null,
      thumbnailUrl: `/media/generations/${encodeURIComponent(fileName)}`,
      downloadUrl: `/media/generations/${encodeURIComponent(fileName)}`
    });
  }

  return assets;
}

async function listNormalizedLocalImages() {
  const local = await listLocalImages();

  return Promise.all(
    local.map(async (item) => {
      const fullPath = resolveAssetPath("local", item.fileName);
      const stats = await safeStat(fullPath);
      return buildLocalAsset(item, stats);
    })
  );
}

async function listNormalizedComfyImages() {
  const comfy = await listComfyInputImages();

  return Promise.all(
    comfy.map(async (item) => {
      const fullPath = resolveAssetPath("comfyui", item.fileName);
      const stats = await safeStat(fullPath);
      return buildComfyAsset(item, stats);
    })
  );
}

async function listAllAssets(source = "all") {
  const normalizedSource = String(source || "all").toLowerCase();

  if (normalizedSource === "local") {
    return listNormalizedLocalImages();
  }

  if (normalizedSource === "generation") {
    return listGenerationImages();
  }

  if (normalizedSource === "comfyui") {
    return listNormalizedComfyImages();
  }

  const [local, generations, comfy] = await Promise.all([
    listNormalizedLocalImages(),
    listGenerationImages(),
    listNormalizedComfyImages()
  ]);

  return [...local, ...generations, ...comfy];
}

router.get("/images", async (req, res) => {
  try {
    const source = String(req.query.source || "all").toLowerCase();
    const images = await listAllAssets(source);

    res.json({
      source,
      count: images.length,
      images
    });
  } catch (error) {
    console.error("[routes/assets] Failed to load images:", error);
    res.status(500).json({
      error: "Failed to load images",
      details: error.message
    });
  }
});

router.delete("/image/:source/:fileName", async (req, res) => {
    try {
      const source = String(req.params.source || "").toLowerCase();
      const safeName = path.basename(req.params.fileName);
  
      if (source !== "local" && source !== "generation" && source !== "comfyui") {
        return res.status(400).json({
          error: `Deletion is not supported for source: ${source}`
        });
      }
  
      const fullPath = resolveAssetPath(source, safeName);
      await fs.unlink(fullPath);
  
      res.json({
        success: true,
        source,
        fileName: safeName
      });
    } catch (error) {
      console.error("[routes/assets] Failed to delete image:", error);
  
      if (error.code === "ENOENT") {
        return res.status(404).json({
          error: "Image not found"
        });
      }
  
      return res.status(500).json({
        error: "Failed to delete image",
        details: error.message
      });
    }
});

module.exports = router;