import path from "path";
import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { MakerWix } from "@electron-forge/maker-wix";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { PublisherGithub } from "@electron-forge/publisher-github";
import fs from "fs";
import crypto from "crypto";

const iconPath = path.resolve(__dirname, "src/assets/icons/flyff.ico");
const WIX_UPGRADE_CODE = "f3dd0e42-5e61-4709-b2ad-820051fa8d2a"; // keep stable so MSI upgrades replace existing installs
const KILL_APP_ACTION = `
    <CustomAction Id="KillFlyffLauncher" Directory="TARGETDIR" ExeCommand="cmd.exe /C taskkill /F /IM Flyff-U-Launcher.exe /T" Execute="deferred" Impersonate="no" Return="ignore" />
`;
const KILL_APP_SEQUENCE = `
    <InstallExecuteSequence>
      <Custom Action="KillFlyffLauncher" After="InstallInitialize">1</Custom>
    </InstallExecuteSequence>
`;

const extraResource: string[] = [];

// app-update.yml is required by electron-updater
const appUpdateYml = path.resolve(__dirname, "resources", "app-update.yml");
if (fs.existsSync(appUpdateYml)) {
    extraResource.push(appUpdateYml);
}

// Ensure patchnotes are available in packaged builds (outside asar)
const patchnotesDir = path.resolve(__dirname, "patchnotes");
if (fs.existsSync(patchnotesDir)) {
    extraResource.push(patchnotesDir);
} else {
    // eslint-disable-next-line no-console
    console.warn("Patchnotes directory not found at", patchnotesDir, "- bundle will skip it.");
}

const tesseractDir = path.resolve(__dirname, "resources", "tesseract");
if (fs.existsSync(tesseractDir)) {
    extraResource.push(tesseractDir);
} else {
    // eslint-disable-next-line no-console
    console.warn("Tesseract payload not found at", tesseractDir, "- bundle will skip it.");
}
const ocrDir = path.resolve(__dirname, "ocr");
if (fs.existsSync(ocrDir)) {
    extraResource.push(ocrDir);
} else {
    // eslint-disable-next-line no-console
    console.warn("OCR worker directory not found at", ocrDir, "- bundle will skip it.");
}
const defaultPluginsDir = path.resolve(__dirname, "..", "plugins");
const pluginIdsToBundle = ["api-fetch", "cd-timer", "killfeed"];
if (fs.existsSync(defaultPluginsDir)) {
    for (const pluginId of pluginIdsToBundle) {
        const pluginPath = path.join(defaultPluginsDir, pluginId);
        if (fs.existsSync(pluginPath)) {
            extraResource.push(pluginPath);
        } else {
            // eslint-disable-next-line no-console
            console.warn(`Plugin '${pluginId}' not found at`, pluginPath);
        }
    }
} else {
    // eslint-disable-next-line no-console
    console.warn("Default plugins directory not found at", defaultPluginsDir);
}

const writeLatestYml = (setupExePath: string, version: string): string => {
    const fileName = path.basename(setupExePath);
    const dir = path.dirname(setupExePath);
    const stat = fs.statSync(setupExePath);
    const sha512 = crypto.createHash("sha512").update(fs.readFileSync(setupExePath)).digest("base64");
    const releaseDate = new Date().toISOString();
    const content = [
        `version: ${version}`,
        `releaseName: v${version}`,
        `releaseDate: "${releaseDate}"`,
        `path: ${fileName}`,
        `sha512: ${sha512}`,
        "files:",
        `  - url: ${fileName}`,
        `    sha512: ${sha512}`,
        `    size: ${stat.size}`,
    ].join("\n");
    const target = path.join(dir, "latest.yml");
    fs.writeFileSync(target, content, "utf-8");
    return target;
};

const config: ForgeConfig = {
    packagerConfig: {
        asar: true,
        icon: iconPath,
        extraResource,
    },
    rebuildConfig: {},
    hooks: {
        // Electron-Updater erwartet eine latest.yml pro Release.
        // Electron Forge erzeugt sie nicht automatisch, deshalb bauen wir sie nach dem Make für Squirrel.Windows.
        postMake: async (_forgeConfig, makeResults) => {
            for (const result of makeResults) {
                // Use the Squirrel setup executable as the download target (electron-updater expects .exe on Windows)
                const setupExe = result.artifacts.find((artifact) => artifact.toLowerCase().endsWith("setup.exe"));
                if (!setupExe) continue;

                const version = result.packageJSON?.version ?? "0.0.0";
                const latestPath = writeLatestYml(setupExe, version);
                // Ensure publisher uploads latest.yml as part of artifacts
                result.artifacts.push(latestPath);
            }
        },
    },
    makers: [
        new MakerSquirrel({
            name: "FlyffULauncher",
            authors: "Praxa",
            description: "Flyff-U-Launcher - Multi-Instance Launcher for Flyff Universe",
            setupIcon: iconPath,
            setupExe: "Flyff-U-Launcher-Setup.exe",
            noMsi: true,
            // Icon for the application shortcut (uses the exe icon from packagerConfig)
            // Desktop and Start Menu shortcuts are created via Update.exe --createShortcut in main.ts
        }),
        new MakerWix({
            language: 1033,
            manufacturer: "Praxa",
            description: "Flyff-U-Launcher",
            icon: iconPath,
            appIconPath: iconPath,
            shortcutName: "Flyff-U-Launcher",
            shortcutFolderName: "Flyff-U-Launcher",
            createDesktopShortcut: true,
            programFilesFolderName: "Flyff-U-Launcher",
            exe: "Flyff-U-Launcher",
            arch: "x64",
            upgradeCode: WIX_UPGRADE_CODE,
            defaultInstallMode: "perMachine",
            ui: {
                chooseDirectory: true,
            },
            beforeCreate: (creator) => {
                console.log("MakerWix icon path:", iconPath);
                creator.icon = iconPath;
                creator.upgradeCode = WIX_UPGRADE_CODE;
                // Force-close running instances without prompting the user
                if (!creator.wixTemplate.includes("KillFlyffLauncher")) {
                    creator.wixTemplate = creator.wixTemplate.replace(
                        "<!-- Don't allow downgrades -->",
                        `<!-- Don't allow downgrades -->${KILL_APP_ACTION}`
                    );
                    creator.wixTemplate = creator.wixTemplate.replace(
                        "<!-- {{AutoUpdatePermissions}} -->",
                        `${KILL_APP_SEQUENCE}\n<!-- {{AutoUpdatePermissions}} -->`
                    );
                }
            },
        }),
        new MakerZIP({}, ["darwin"]),
        new MakerRpm({}),
        new MakerDeb({}),
    ],
    plugins: [
        new VitePlugin({
            build: [
                {
                    entry: "src/main.ts",
                    config: "vite.main.config.ts",
                    target: "main",
                },
                {
                    entry: "src/preload.ts",
                    config: "vite.preload.config.ts",
                    target: "preload",
                },
            ],
            renderer: [
                {
                    name: "main_window",
                    config: "vite.renderer.config.ts",
                },
            ],
        }),
        new FusesPlugin({
            version: FuseVersion.V1,
            [FuseV1Options.RunAsNode]: false,
            [FuseV1Options.EnableCookieEncryption]: true,
            [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
            [FuseV1Options.EnableNodeCliInspectArguments]: false,
            [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
            [FuseV1Options.OnlyLoadAppFromAsar]: true,
        }),
    ],
    publishers: [
        new PublisherGithub({
            repository: {
                owner: "GH-Praxa",
                name: "Flyff-U-Launcher",
            },
            prerelease: false,
            draft: true,
        }),
    ],
};
export default config;
