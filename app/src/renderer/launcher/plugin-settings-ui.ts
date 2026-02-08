import { logErr } from "../../shared/logger";
import { el, showToast } from "../dom-utils";
import { t } from "../i18n";

export interface PluginSettingsDeps {
    snapshotThemeVars: () => Record<string, string>;
    applyThemeToIframe: (iframe: HTMLIFrameElement) => void;
}

export async function openPluginSettingsUI(
    deps: PluginSettingsDeps,
    plugin: { id: string; name: string; hasSettingsUI?: boolean; enabled?: boolean },
): Promise<void> {
    const { snapshotThemeVars, applyThemeToIframe } = deps;
    console.log("[PluginUI] open", { id: plugin.id, name: plugin.name, enabled: plugin.enabled, hasSettingsUI: plugin.hasSettingsUI });
    if (!plugin.hasSettingsUI) {
        showToast(t("config.plugins.noUI"), "info");
        return;
    }
    if (plugin.enabled === false) {
        showToast(t("config.plugins.isDisabled"), "warning");
        return;
    }
    const overlay = el("div", "pluginUiOverlay");
    const container = el("div", "pluginUiContainer");
    const header = el("div", "pluginUiHeader");
    const title = el("div", "pluginUiTitle", plugin.name);
    const closeBtn = el("button", "pluginUiClose", "x");
    const frame = document.createElement("iframe");
    frame.className = "pluginUiFrame";
    // Only allow-scripts, not allow-same-origin to prevent sandbox escape
    frame.setAttribute("sandbox", "allow-scripts");
    header.append(title, closeBtn);
    container.append(header, frame);
    overlay.append(container);
    document.body.append(overlay);

    const close = () => {

        window.removeEventListener("message", messageHandler);
        overlay.remove();
    };
    // Handle postMessage from iframe for IPC calls

    const messageHandler = async (evt: MessageEvent) => {

        if (evt.source !== frame.contentWindow) return;
        const { type, id, channel, args } = evt.data || {};
        if (type === "plugin:ipc:invoke" && channel && id) {
            try {
                const result = await window.api.pluginsInvokeChannel(plugin.id, channel, ...(args || []));
                frame.contentWindow?.postMessage({ type: "plugin:ipc:result", id, result }, "*");
            } catch (err) {
                frame.contentWindow?.postMessage({ type: "plugin:ipc:result", id, error: String(err) }, "*");
            }
        } else if (type === "plugin:theme:refresh") {
            applyThemeToIframe(frame);
        } else if (type === "plugin:theme:vars") {
            frame.contentWindow?.postMessage({ type: "plugin:theme:vars:result", vars: snapshotThemeVars() }, "*");
        }
    };
    window.addEventListener("message", messageHandler);
    closeBtn.addEventListener("click", close);
    overlay.addEventListener("click", (evt) => {
        if (evt.target === overlay)
            close();
    });
    frame.addEventListener("load", () => {
        console.log("[PluginUI] iframe loaded", plugin.id);
        applyThemeToIframe(frame);
    });
    try {
        const uiInfo = await window.api.pluginsGetSettingsUI(plugin.id);
        console.log("[PluginUI] settings UI info", uiInfo);
        if (!uiInfo) {
            throw new Error("No UI URL available");
        }
        if (uiInfo.width) {
            container.style.width = `${Math.max(360, uiInfo.width)}px`;
        }
        if (uiInfo.height) {
            container.style.height = `${Math.max(240, uiInfo.height)}px`;
        }
        if (uiInfo.html) {
            // Inject base tag to resolve relative URLs to plugin directory
            const baseTag = uiInfo.baseHref ? `<base href="${uiInfo.baseHref}">` : "";
            // Inject bridge script that provides window.plugin API via postMessage
            const bridgeScript = `<script>

(function() {

var pending = {};

var nextId = 1;

window.addEventListener("message", function(evt) {

    var data = evt.data || {};
    if (data.type === "plugin:ipc:result" && data.id && pending[data.id]) {
        if (data.error) {
            pending[data.id].reject(new Error(data.error));
        } else {
            pending[data.id].resolve(data.result);
        }
        delete pending[data.id];
    } else if (data.type === "plugin:theme:vars:result" && pending["theme:vars"]) {
        pending["theme:vars"].resolve(data.vars);
        delete pending["theme:vars"];
    }

});

window.plugin = {

    ipc: {
        invoke: function(channel) {
            var args = Array.prototype.slice.call(arguments, 1);
            var id = nextId++;
            return new Promise(function(resolve, reject) {
                pending[id] = { resolve: resolve, reject: reject };
                parent.postMessage({ type: "plugin:ipc:invoke", id: id, channel: channel, args: args }, "*");
            });
        }
    },
    theme: {
        refresh: function() {
            parent.postMessage({ type: "plugin:theme:refresh" }, "*");
        },
        vars: function() {
            return new Promise(function(resolve) {
                pending["theme:vars"] = { resolve: resolve };
                parent.postMessage({ type: "plugin:theme:vars" }, "*");
            });
        }
    }

};

})();

<\/script>`;

            const html = `${baseTag}${bridgeScript}${uiInfo.html}`;
            frame.srcdoc = html;
        } else if (uiInfo.url) {
            frame.src = uiInfo.url;
        } else {
            throw new Error("No UI URL available");
        }
    }
    catch (err) {
        console.error("[PluginUI] failed to load settings UI", plugin.id, err);
        frame.remove();
        const errorEl = el("div", "pluginsError muted", String(err));
        container.append(errorEl);
    }


}
