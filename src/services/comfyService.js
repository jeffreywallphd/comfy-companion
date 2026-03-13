const config = require("../config/config");
const { spawn, execFile } = require("child_process");
const os = require("os");
const util = require("util");

const execFileAsync = util.promisify(execFile);

let managedComfyProcess = null;
let managedComfyPid = null;
let managedComfySpawnedByCompanion = false;
let managedComfyStartedAt = null;

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 3500) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });

        const text = await response.text();

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${text}`);
        }

        return text ? JSON.parse(text) : {};
    } finally {
        clearTimeout(timeout);
    }
}

async function getComfyAvailability() {
    try {
        await fetchJsonWithTimeout(`${config.comfyUrl}/system_stats`, {}, 2500);
        return true;
    } catch {
        return false;
    }
}

async function getComfySystemStats() {
    return fetchJsonWithTimeout(`${config.comfyUrl}/system_stats`, {}, 3500);
}

async function queuePrompt(promptWorkflow) {
    const url = `${config.comfyUrl}/prompt`;

    console.log("[comfyService.queuePrompt] Sending workflow to ComfyUI:", url);
    console.log(
        "[comfyService.queuePrompt] Prompt node keys:",
        Object.keys(promptWorkflow || {})
    );

    const payload = {
        prompt: promptWorkflow
    };

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    const text = await response.text();

    if (!response.ok) {
        console.error("[comfyService.queuePrompt] ComfyUI returned error:", text);
        console.error(
            "[comfyService.queuePrompt] Failed payload preview:",
            JSON.stringify(payload, null, 2).slice(0, 6000)
        );
        throw new Error(`ComfyUI prompt request failed: ${response.status} ${text}`);
    }

    let json;
    try {
        json = JSON.parse(text);
    } catch (error) {
        console.error("[comfyService.queuePrompt] Failed to parse ComfyUI response JSON:", text);
        throw error;
    }

    console.log("[comfyService.queuePrompt] Workflow queued successfully:", json);
    return json;
}

async function getLocalGpuStats() {
    if (process.platform !== "win32" && process.platform !== "linux") {
        return {
            provider: null,
            devices: [],
            error: "Local GPU probing is not implemented for this platform."
        };
    }

    try {
        const { stdout } = await execFileAsync("nvidia-smi", [
            "--query-gpu=index,name,memory.total,memory.used,memory.free",
            "--format=csv,noheader,nounits"
        ]);

        const lines = stdout
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);

        const devices = lines.map((line) => {
            const parts = line.split(",").map((part) => part.trim());

            const index = Number(parts[0]);
            const name = parts[1];
            const memoryTotalMiB = Number(parts[2]);
            const memoryUsedMiB = Number(parts[3]);
            const memoryFreeMiB = Number(parts[4]);

            const mib = 1024 * 1024;

            return {
                index,
                name,
                provider: "nvidia-smi",
                vramTotal: memoryTotalMiB * mib,
                vramUsed: memoryUsedMiB * mib,
                vramFree: memoryFreeMiB * mib
            };
        });

        return {
            provider: "nvidia-smi",
            devices,
            error: null
        };
    } catch (error) {
        return {
            provider: null,
            devices: [],
            error: "nvidia-smi is unavailable or failed."
        };
    }
}

function getManagedComfyState() {
    const running =
        Boolean(managedComfyProcess) &&
        managedComfyPid != null &&
        managedComfyProcess.exitCode == null &&
        !managedComfyProcess.killed;

    return {
        running,
        pid: managedComfyPid,
        spawnedByCompanion: managedComfySpawnedByCompanion,
        startedAt: managedComfyStartedAt
    };
}

function requireStartConfig() {
    if (!config.comfyStartCommand) {
        throw new Error("COMFY_START_COMMAND is not configured.");
    }

    return {
        command: config.comfyStartCommand,
        args: Array.isArray(config.comfyStartArgs) ? config.comfyStartArgs : [],
        cwd: config.comfyWorkingDir || process.cwd()
    };
}

async function startComfyUi() {
    const available = await getComfyAvailability();
    if (available) {
        return {
            started: false,
            reason: "ComfyUI is already available."
        };
    }

    const managedState = getManagedComfyState();
    if (managedState.running) {
        return {
            started: false,
            reason: "ComfyUI was already started by ComfyCompanion.",
            pid: managedState.pid
        };
    }

    const { command, args, cwd } = requireStartConfig();

    console.log("[comfyService.startComfyUi] Starting ComfyUI:", { command, args, cwd });

    const child = spawn(command, args, {
        cwd,
        detached: false,
        shell: true,
        stdio: "ignore"
    });

    managedComfyProcess = child;
    managedComfyPid = child.pid;
    managedComfySpawnedByCompanion = true;
    managedComfyStartedAt = new Date().toISOString();

    child.on("exit", (code, signal) => {
        console.log("[comfyService.startComfyUi] Managed ComfyUI exited:", { code, signal });

        managedComfyProcess = null;
        managedComfyPid = null;
        managedComfySpawnedByCompanion = false;
        managedComfyStartedAt = null;
    });

    return {
        started: true,
        pid: child.pid
    };
}

async function stopComfyUi() {
    const managedState = getManagedComfyState();

    if (!managedState.running || !managedState.spawnedByCompanion || !managedState.pid) {
        return {
            stopped: false,
            reason: "No ComfyUI process started by ComfyCompanion is currently running."
        };
    }

    const pid = managedState.pid;

    console.log("[comfyService.stopComfyUi] Stopping managed ComfyUI process:", pid);

    if (process.platform === "win32") {
        await execFileAsync("taskkill", ["/pid", String(pid), "/t", "/f"]);
    } else {
        process.kill(pid, "SIGTERM");
    }

    managedComfyProcess = null;
    managedComfyPid = null;
    managedComfySpawnedByCompanion = false;
    managedComfyStartedAt = null;

    return {
        stopped: true,
        pid
    };
}

module.exports = {
    queuePrompt,
    getComfyAvailability,
    getComfySystemStats,
    getLocalGpuStats,
    getManagedComfyState,
    startComfyUi,
    stopComfyUi
};