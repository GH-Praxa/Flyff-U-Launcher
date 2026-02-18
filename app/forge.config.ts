import path from "path";
import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { MakerWix } from "@electron-forge/maker-wix";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerDMG } from "@electron-forge/maker-dmg";
import { MakerAppImage } from "@reforged/maker-appimage";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { PublisherGithub } from "@electron-forge/publisher-github";
import fs from "fs";
import crypto from "crypto";

const iconPath = process.platform === "darwin"
    ? path.resolve(__dirname, "src/assets/icons/flyff.icns")
    : path.resolve(__dirname, "src/assets/icons/flyff.ico");
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
const bundledNodeModulesDir = path.resolve(__dirname, "resources", "node_modules");
const appNodeModulesDir = path.resolve(__dirname, "node_modules");

function ensureBundledNodeModules(): void {
    const depsToBundle = ["sharp", "detect-libc", "semver", "@img"];

    fs.rmSync(bundledNodeModulesDir, { recursive: true, force: true });
    fs.mkdirSync(bundledNodeModulesDir, { recursive: true });

    for (const dep of depsToBundle) {
        const src = path.join(appNodeModulesDir, dep);
        const dst = path.join(bundledNodeModulesDir, dep);
        if (!fs.existsSync(src)) {
            // eslint-disable-next-line no-console
            console.warn(`[sharp-runtime] Missing dependency at ${src}`);
            continue;
        }
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.cpSync(src, dst, { recursive: true, force: true });
    }
}

// app-update.yml is required by electron-updater
const appUpdateYml = path.resolve(__dirname, "resources", "app-update.yml");
if (fs.existsSync(appUpdateYml)) {
    extraResource.push(appUpdateYml);
}
extraResource.push(bundledNodeModulesDir);

// Ensure patchnotes are available in packaged builds (outside asar)
const patchnotesDir = path.resolve(__dirname, "patchnotes");
if (fs.existsSync(patchnotesDir)) {
    extraResource.push(patchnotesDir);
} else {
    // eslint-disable-next-line no-console
    console.warn("Patchnotes directory not found at", patchnotesDir, "- bundle will skip it.");
}

// Ensure docs are available in packaged builds (outside asar)
const docsDir = path.resolve(__dirname, "docs");
if (fs.existsSync(docsDir)) {
    extraResource.push(docsDir);
} else {
    // eslint-disable-next-line no-console
    console.warn("Docs directory not found at", docsDir, "- bundle will skip it.");
}

// Ensure static data (monster/buff/skill references) are available in packaged builds
const dataDir = path.resolve(__dirname, "src", "data");
if (fs.existsSync(dataDir)) {
    extraResource.push(dataDir);
} else {
    // eslint-disable-next-line no-console
    console.warn("Data directory not found at", dataDir, "- bundle will skip it.");
}

// Bundle only platform-specific tesseract binaries (e.g. resources/tesseract/win32/)
// In packaged builds this becomes: resources/tesseract/<platform>/
const tesseractPlatformDir = path.resolve(__dirname, "resources", "tesseract", process.platform);
if (fs.existsSync(tesseractPlatformDir) && fs.readdirSync(tesseractPlatformDir).some((f) => f !== ".gitkeep")) {
    // Bundle the entire tesseract dir (contains only the current platform's subfolder after CI prep)
    const tesseractDir = path.resolve(__dirname, "resources", "tesseract");
    extraResource.push(tesseractDir);
} else {
    // eslint-disable-next-line no-console
    console.warn(`Tesseract payload not found for platform '${process.platform}' at`, tesseractPlatformDir, "- bundle will skip it.");
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

const writeLatestYml = (artifactPath: string, version: string, ymlName = "latest.yml"): string => {
    const fileName = path.basename(artifactPath);
    const dir = path.dirname(artifactPath);
    const stat = fs.statSync(artifactPath);
    const sha512 = crypto.createHash("sha512").update(fs.readFileSync(artifactPath)).digest("base64");
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
    const target = path.join(dir, ymlName);
    fs.writeFileSync(target, content, "utf-8");
    return target;
};

const isPrerelease = process.env.PUBLISH_PRERELEASE === "true";
const isDraft = process.env.PUBLISH_DRAFT === "true";
const config: ForgeConfig = {
    packagerConfig: {
        asar: true,
        icon: iconPath,
        executableName: "Flyff-U-Launcher",
        extraResource,
        osxSign: {
            identity: "-", // ad-hoc signing – kein Apple Developer Account nötig
        },
    },
    rebuildConfig: {},
    hooks: {
        prePackage: async () => {
            ensureBundledNodeModules();
        },
        // Electron-Updater erwartet eine latest.yml pro Release.
        // Electron Forge erzeugt sie nicht automatisch, deshalb bauen wir sie nach dem Make.
        postMake: async (_forgeConfig, makeResults) => {
            for (const result of makeResults) {
                const version = result.packageJSON?.version ?? "0.0.0";

                // Windows: Squirrel setup exe → latest.yml
                const setupExe = result.artifacts.find((a) => a.toLowerCase().endsWith("setup.exe"));
                if (setupExe) {
                    const latestPath = writeLatestYml(setupExe, version, "latest.yml");
                    result.artifacts.push(latestPath);
                    continue;
                }

                // macOS: DMG or ZIP → latest-mac.yml
                const macArtifact = result.artifacts.find((a) => a.endsWith(".dmg") || (a.endsWith(".zip") && result.platform === "darwin"));
                if (macArtifact) {
                    const latestPath = writeLatestYml(macArtifact, version, "latest-mac.yml");
                    result.artifacts.push(latestPath);
                    continue;
                }

                // Linux: AppImage or deb → latest-linux.yml
                const linuxArtifact = result.artifacts.find((a) => a.endsWith(".AppImage") || a.endsWith(".deb"));
                if (linuxArtifact) {
                    const latestPath = writeLatestYml(linuxArtifact, version, "latest-linux.yml");
                    result.artifacts.push(latestPath);
                    continue;
                }
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
        new MakerDMG({
            format: "ULFO",
            icon: path.resolve(__dirname, "src/assets/icons/flyff.icns"),
        }),
        new MakerZIP({}, ["darwin"]),
        new MakerDeb({
            options: {
                name: "flyff-u-launcher",
                productName: "Flyff-U-Launcher",
                genericName: "Game Launcher",
                description: "Multi-Instance Launcher for Flyff Universe",
                categories: ["Game"],
                icon: path.resolve(__dirname, "src/assets/icons/flyff.png"),
            },
        }),
        new MakerRpm({
            options: {
                name: "flyff-u-launcher",
                productName: "Flyff-U-Launcher",
                genericName: "Game Launcher",
                description: "Multi-Instance Launcher for Flyff Universe",
                categories: ["Game"],
                icon: path.resolve(__dirname, "src/assets/icons/flyff.png"),
            },
        }),
        // AppImage deaktiviert - @reforged/maker-appimage hat Strukturprobleme
        // mit Electron Forge (kopiert App in /usr/lib/<name>/ statt Root)
        // DEB/RPM funktionieren korrekt und sind vorzuziehen
        // new MakerAppImage({
        //     options: {
        //         categories: ["Game"],
        //         icon: path.resolve(__dirname, "src/assets/icons/flyff.png"),
        //         bin: "Flyff-U-Launcher",
        //     },
        // }),
    ],
    plugins: (() => {
        const plugins = [
            new AutoUnpackNativesPlugin({}),
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
        ];
        // Fuses nur für Windows aktivieren.
        // Auf macOS: EnableEmbeddedAsarIntegrityValidation + OnlyLoadAppFromAsar erfordern
        // eine gültige Apple-Signatur – ohne diese zeigt macOS "damaged and can't be opened"
        // statt dem normalen "unidentified developer"-Dialog.
        // Auf Linux: AppImage-Probleme mit Electron Forge.
        if (process.platform === "win32") {
            plugins.push(new FusesPlugin({
                version: FuseVersion.V1,
                [FuseV1Options.RunAsNode]: false,
                [FuseV1Options.EnableCookieEncryption]: true,
                [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
                [FuseV1Options.EnableNodeCliInspectArguments]: false,
                [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
                [FuseV1Options.OnlyLoadAppFromAsar]: true,
            }));
        } else if (process.platform === "darwin") {
            // Nur sichere Fuses ohne Signierungspflicht
            plugins.push(new FusesPlugin({
                version: FuseVersion.V1,
                [FuseV1Options.RunAsNode]: false,
                [FuseV1Options.EnableCookieEncryption]: true,
                [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
                [FuseV1Options.EnableNodeCliInspectArguments]: false,
                [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: false,
                [FuseV1Options.OnlyLoadAppFromAsar]: false,
            }));
        }
        return plugins;
    })(),
    publishers: [
        new PublisherGithub({
            repository: {
                owner: "GH-Praxa",
                name: "Flyff-U-Launcher",
            },
            // Wenn der Workflow mit input `prerelease=true` läuft, veröffentlichen wir als Pre-Release
            // Stable-Releases müssen ebenfalls veröffentlicht sein (kein Draft), damit electron-updater sie sieht.
            prerelease: isPrerelease,
            draft: isDraft,
        }),
    ],
};
export default config;
