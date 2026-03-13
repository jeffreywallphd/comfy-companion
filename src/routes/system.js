const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const config = require("../config/config");
const {
    getComfyAvailability,
    getComfySystemStats,
    getLocalGpuStats,
    getManagedComfyState,
    startComfyUi,
    stopComfyUi
} = require("../services/comfyService");

const router = express.Router();

async function existsDir(dirPath) {
    try {
        const stat = await fs.stat(dirPath);
        return stat.isDirectory();
    } catch {
        return false;
    }
}

function normalizeComfySystemStats(systemStats) {
    const devices = Array.isArray(systemStats?.devices) ? systemStats.devices : [];

    const normalizedDevices = devices.map((device, index) => {
        const vramTotal = Number(
            device.vram_total ??
            device.total_vram ??
            device.total_memory ??
            0
        );

        const vramFree = Number(
            device.vram_free ??
            device.free_vram ??
            device.free_memory ??
            0
        );

        const vramUsed = Math.max(0, vramTotal - vramFree);

        const torchTotal = Number(
            device.torch_vram_total ??
            device.torch_total_vram ??
            0
        );

        const torchFree = Number(
            device.torch_vram_free ??
            device.torch_free_vram ??
            0
        );

        const torchUsed =
            torchTotal > 0 ? Math.max(0, torchTotal - torchFree) : null;

        return {
            id: device.index ?? index,
            index: device.index ?? index,
            name: device.name || device.device || `GPU ${index}`,
            type: device.type || device.device_type || "gpu",
            vramTotal,
            vramFree,
            vramUsed,
            torchVramTotal: torchTotal || null,
            torchVramFree: torchFree || null,
            torchVramUsed: torchUsed
        };
    });

    return {
        system: systemStats?.system || {},
        devices: normalizedDevices
    };
}

router.get("/status", async (req, res) => {
    const startedAt = req.app.locals.startedAt || new Date();

    const workflowsDirExists = await existsDir(config.workflowsDir);
    const dataDirExists = await existsDir(path.resolve(config.dataDir));

    const totalSystemMemory = os.totalmem();
    const freeSystemMemory = os.freemem();
    const usedSystemMemory = Math.max(0, totalSystemMemory - freeSystemMemory);

    const localGpuStats = await getLocalGpuStats();
    const managedComfy = getManagedComfyState();

    let comfyuiStatus = "checking";
    let comfyuiAvailable = false;
    let comfyuiStats = null;
    let comfyuiError = null;

    try {
        const available = await getComfyAvailability();

        if (available) {
            const rawStats = await getComfySystemStats();
            comfyuiStats = normalizeComfySystemStats(rawStats);
            comfyuiStatus = "available";
            comfyuiAvailable = true;
        } else {
            comfyuiStatus = "unavailable";
            comfyuiAvailable = false;
            comfyuiError = "ComfyUI did not respond.";
        }
    } catch (error) {
        comfyuiStatus = "unavailable";
        comfyuiAvailable = false;
        comfyuiError = error.message;
    }

    res.json({
        app: {
            name: "ComfyCompanion",
            status: "online",
            startedAt,
            uptimeSeconds: Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000),
            nodeEnv: process.env.NODE_ENV || "development",
            nodeVersion: process.version
        },
        server: {
            hostName: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
            localTime: new Date().toISOString()
        },
        memory: {
            systemRamTotal: totalSystemMemory,
            systemRamUsed: usedSystemMemory,
            systemRamFree: freeSystemMemory
        },
        localGpu: localGpuStats,
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
            status: comfyuiStatus,
            available: comfyuiAvailable,
            configuredUrl: config.comfyUrl,
            checkedAt: new Date().toISOString(),
            managed: managedComfy,
            systemStats: comfyuiStats,
            error: comfyuiError
        }
    });
});

router.post("/comfyui/start", async (req, res) => {
    try {
        const result = await startComfyUi();
        res.json({
            ok: true,
            result
        });
    } catch (error) {
        console.error("[routes/system] Failed to start ComfyUI:", error);
        res.status(500).json({
            error: "Failed to start ComfyUI",
            details: error.message
        });
    }
});

router.post("/comfyui/stop", async (req, res) => {
    try {
        const result = await stopComfyUi();
        res.json({
            ok: true,
            result
        });
    } catch (error) {
        console.error("[routes/system] Failed to stop ComfyUI:", error);
        res.status(500).json({
            error: "Failed to stop ComfyUI",
            details: error.message
        });
    }
});

module.exports = router;