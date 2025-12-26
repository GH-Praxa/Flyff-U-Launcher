import path from "path";
import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { MakerWix } from "@electron-forge/maker-wix";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
const config: ForgeConfig = {
    packagerConfig: {
        asar: true,
        icon: path.resolve(__dirname, "src/assets/icons/flyff.ico"),
    },
    rebuildConfig: {},
    makers: [
        new MakerSquirrel({}),
        new MakerWix({
            language: 1033,
            manufacturer: "Praxa",
            description: "Flyff-U-Launcher",
            icon: path.resolve(__dirname, "src/assets/icons/flyff.ico"),
            appIconPath: path.resolve(__dirname, "src/assets/icons/flyff.ico"),
            shortcutName: "Flyff-U-Launcher",
            shortcutFolderName: "Flyff-U-Launcher",
            programFilesFolderName: "Flyff-U-Launcher",
            ui: true,
            beforeCreate: (creator) => {
                console.log("MakerWix icon path:", path.resolve(__dirname, "src/assets/icons/flyff.ico"));
                creator.icon = path.resolve(__dirname, "src/assets/icons/flyff.ico");
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
};
export default config;
