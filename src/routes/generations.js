const express = require("express");
const path = require("path");
const fs = require("fs/promises");
const { GENERATIONS_DIR } = require("../services/generationLibraryService");

const router = express.Router();

router.get("/:fileName", async (req, res) => {
    try {
        const safeName = path.basename(req.params.fileName);
        const fullPath = path.join(GENERATIONS_DIR, safeName);
        res.sendFile(path.resolve(fullPath));
    } catch (error) {
        console.error("[routes/generations] Failed to serve generation:", error);
        res.status(404).json({
            error: "Generation not found"
        });
    }
});

router.delete("/:fileName", async (req, res) => {
    try {
        const safeName = path.basename(req.params.fileName);
        const fullPath = path.join(GENERATIONS_DIR, safeName);

        await fs.unlink(fullPath);

        res.json({
            ok: true,
            deleted: safeName
        });
    } catch (error) {
        console.error("[routes/generations] Failed to delete generation:", error);
        res.status(500).json({
            error: "Failed to delete generation",
            details: error.message
        });
    }
});

module.exports = router;