const express = require("express");
const config = require("../config/config");

const router = express.Router();

router.get("/checkpoints", async (req, res) => {
    try {
        const response = await fetch(`${config.comfyUrl}/object_info/CheckpointLoaderSimple`);
        const json = await response.json();

        const checkpoints =
            json?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] || [];

        res.json({
            models: checkpoints
        });
    } catch (error) {
        console.error("[routes/comfy] Failed to fetch checkpoints:", error);

        res.status(500).json({
            error: "Failed to fetch checkpoints",
            details: error.message
        });
    }
});

module.exports = router;