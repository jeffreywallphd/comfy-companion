const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const config = require("../config/config");

const router = express.Router();

router.get("/status", async (req, res) => {
    const startedAt = req.app.locals.startedAt || new Date();

    let workflowsDirExists = false;
    let dataDirExists = false;

    try {
        const stat = await fs.stat(config.workflowsDir);
        workflowsDirExists = stat.isDirectory();
    } catch (error) {
        workflowsDirExists = false;
    }

    try {
        const stat = await fs.stat(path.resolve(config.dataDir));
        dataDirExists = stat.isDirectory();
    } catch (error) {
        dataDirExists = false;
    }

    res.json({
        app: {
            name: "ComfyCompanion",
            status: "online",
            uptimeSeconds: Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000),
            nodeEnv: process.env.NODE_ENV || "development"
        },
        server: {
            hostName: os.hostname(),
            platform: os.platform(),
            localTime: new Date().toISOString()
        },
        paths: {
            workflowsDir: config.workflowsDir,
            workflowsDirExists,
            dataDir: config.dataDir,
            dataDirExists
        },
        security: {
            apiKeyEnabled: Boolean(process.env.LOCAL_API_KEY)
        },
        comfyui: {
            configuredUrl: config.comfyUrl,
            reachable: null
        }
    });
});

module.exports = router;