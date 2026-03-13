require("dotenv").config();

module.exports = {
    port: process.env.PORT || 3001,
    comfyUrl: process.env.COMFY_URL || "http://127.0.0.1:8188",
    workflowsDir: process.env.WORKFLOWS_DIR,
    dataDir: process.env.DATA_DIR || "./src/data",
    comfyInputDir: process.env.COMFY_INPUT_DIR,
    comfyOutputDir: process.env.COMFY_OUTPUT_DIR,
    comfyStartCommand: process.env.COMFY_START_COMMAND || "",
    comfyStartArgs: process.env.COMFY_START_ARGS ? process.env.COMFY_START_ARGS.split(" ").filter(Boolean) : [],
    comfyWorkingDir: process.env.COMFY_WORKING_DIR || ""
};