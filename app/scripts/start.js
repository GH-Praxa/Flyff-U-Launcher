const { spawn } = require("child_process");
const path = require("path");

const bin = path.join(
    __dirname,
    "..",
    "node_modules",
    ".bin",
    process.platform === "win32" ? "electron-forge.cmd" : "electron-forge",
);

const env = { ...process.env };

// Linux default: "normal" profile (stable enough for everyday use).
if (process.platform === "linux") {
    if (!env.FLYFF_ENABLE_LINUX_OCR) env.FLYFF_ENABLE_LINUX_OCR = "1";
    if (!env.FLYFF_LINUX_OCR_PRESET) env.FLYFF_LINUX_OCR_PRESET = "plus";
    if (!env.FLYFF_ENABLE_X11_SIDEPANEL_BUTTON) env.FLYFF_ENABLE_X11_SIDEPANEL_BUTTON = "1";
}

const child = spawn(bin, ["start"], {
    stdio: "inherit",
    env,
});

child.on("exit", (code, signal) => {
    if (signal) {
        process.kill(process.pid, signal);
        return;
    }
    process.exit(code ?? 0);
});

