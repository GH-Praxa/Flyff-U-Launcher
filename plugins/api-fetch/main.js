const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const http = require("http");
const https = require("https");
const { URL } = require("url");
const { spawn } = require("child_process");

const RATE_LIMIT = {
  maxRequests: 300,
  windowSeconds: 60,
  requestTimeout: 15_000,
  retries: 0,
  backoff: 1.5,
};

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

let ctxRef;
let currentJob = null;
let uiProcess = null;
let requestsMade = 0;

const pluginRoot = __dirname;
const endpointsPath = path.join(pluginRoot, "endpoints.json");
const outputDir = path.join(
  process.env.APPDATA ||
    path.join(process.env.HOME || process.cwd(), "AppData", "Roaming"),
  "Flyff-U-Launcher",
  "user",
  "cache",
);

function ensureDir(dirPath) {
  return fsp.mkdir(dirPath, { recursive: true });
}

function getPythonCommand() {
  return (
    process.env.FLYFF_API_FETCH_PYTHON ||
    process.env.FLYFF_OCR_PYTHON ||
    process.env.PYTHON ||
    process.env.PYTHON3 ||
    (process.platform === "win32" ? "py" : "python3") ||
    "python"
  );
}

function isUiRunning() {
  return uiProcess && uiProcess.exitCode === null && !uiProcess.killed;
}

async function launchUi() {
  if (isUiRunning()) {
    return { ok: true, alreadyRunning: true };
  }

  const scriptPath = path.join(pluginRoot, "main.py");
  if (!fs.existsSync(scriptPath)) {
    return { ok: false, error: "UI-Skript main.py nicht gefunden" };
  }

  const pythonCmd = getPythonCommand();

  return await new Promise((resolve) => {
    let settled = false;

    try {
      uiProcess = spawn(pythonCmd, [scriptPath], {
        cwd: pluginRoot,
        windowsHide: true,
      });
    } catch (err) {
      uiProcess = null;
      const message = err?.message || String(err);
      ctxRef?.logger?.error?.(`UI-Start fehlgeschlagen: ${message}`);
      return resolve({ ok: false, error: message });
    }

    const finish = (payload) => {
      if (settled) return;
      settled = true;
      resolve(payload);
    };

    uiProcess.once("error", (err) => {
      uiProcess = null;
      const message = err?.message || String(err);
      ctxRef?.logger?.error?.(`UI-Start fehlgeschlagen: ${message}`);
      finish({ ok: false, error: message });
    });

    uiProcess.once("spawn", () => {
      ctxRef?.logger?.info?.(`UI-Prozess gestartet (${pythonCmd})`);
      finish({ ok: true });
    });

    uiProcess.on("exit", (code, signal) => {
      uiProcess = null;
      const suffix = signal ? `Signal ${signal}` : `Code ${code}`;
      ctxRef?.logger?.info?.(`UI-Prozess beendet (${suffix})`);
    });

    if (uiProcess.stdout) {
      uiProcess.stdout.on("data", (data) => {
        const line = data.toString().trim();
        if (line) ctxRef?.logger?.info?.(`[UI] ${line}`);
      });
    }

    if (uiProcess.stderr) {
      uiProcess.stderr.on("data", (data) => {
        const line = data.toString().trim();
        if (line) ctxRef?.logger?.error?.(`[UI] ${line}`);
      });
    }
  });
}

function stopUiProcess() {
  if (!isUiRunning()) return;
  try {
    uiProcess.kill();
  } catch {
    // ignore
  }
  uiProcess = null;
}

async function readEndpoints() {
  const raw = await fsp.readFile(endpointsPath, "utf-8");
  const data = JSON.parse(raw);
  if (!data.base_url && !data.baseUrl) {
    throw new Error("Fehlendes Feld base_url in endpoints.json");
  }
  if (!Array.isArray(data.endpoints) || !data.endpoints.length) {
    throw new Error("Keine Endpunkte in endpoints.json definiert");
  }
  return data;
}

function safeName(name) {
  return String(name || "")
    .split(/[\\/]/g)
    .filter(Boolean)
    .map((part) =>
      part
        .replace(/[^a-zA-Z0-9-_]/g, "_")
        .replace(/_{2,}/g, "_")
        .replace(/^_+|_+$/g, ""),
    )
    .join(path.sep);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const rateWindow = [];
async function waitForSlot(cancelFlag) {
  while (true) {
    if (cancelFlag?.()) {
      throw new Error("abgebrochen");
    }
    const now = Date.now();
    while (rateWindow.length && now - rateWindow[0] > RATE_LIMIT.windowSeconds * 1000) {
      rateWindow.shift();
    }
    if (rateWindow.length < RATE_LIMIT.maxRequests) {
      rateWindow.push(now);
      return;
    }
    await sleep(100);
  }
}

function buildUrl(baseUrl, endpointPath, params) {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const cleanPath = endpointPath.startsWith("/") ? endpointPath : `/${endpointPath}`;
  const url = new URL(cleanBase + cleanPath);
  if (params && typeof params === "object") {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        url.searchParams.set(k, String(v));
      }
    });
  }
  return url.toString();
}

function httpRequest(urlString, expectJson, cancelFlag) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(urlString);
    const lib = urlObj.protocol === "https:" ? https : http;
    const options = {
      method: "GET",
      headers: { "User-Agent": USER_AGENT },
      timeout: RATE_LIMIT.requestTimeout,
    };
    const req = lib.request(urlObj, options, (res) => {
      const { statusCode, headers } = res;
      const chunks = [];

      res.on("data", (chunk) => {
        chunks.push(chunk);
      });

      res.on("end", () => {
        const body = Buffer.concat(chunks);
        resolve({ statusCode, headers, body });
      });
    });

    req.on("timeout", () => {
      req.destroy(new Error("timeout"));
    });
    req.on("error", (err) => reject(err));
    req.on("abort", () => reject(new Error("aborted")));

    if (cancelFlag) {
      const check = () => {
        if (cancelFlag()) {
          req.destroy(new Error("cancelled"));
        } else {
          setTimeout(check, 150);
        }
      };
      setTimeout(check, 150);
    }

    req.end();
  }).then(({ statusCode, headers, body }) => {
    if (statusCode >= 400) {
      const retryAfter = headers?.["retry-after"];
      const err = new Error(`HTTP ${statusCode}`);
      err.statusCode = statusCode;
      err.retryAfter = retryAfter ? Number(retryAfter) : undefined;
      err.body = body;
      throw err;
    }
    if (!expectJson) {
      return { headers, data: body };
    }
    try {
      const parsed = JSON.parse(body.toString("utf-8"));
      return { headers, data: parsed };
    } catch (e) {
      const err = new Error("Antwort ist kein JSON");
      err.body = body;
      throw err;
    }
  });
}

async function fetchJson(baseUrl, pathStr, params, cancelFlag) {
  if (cancelFlag?.()) throw new Error("abgebrochen");
  await waitForSlot(cancelFlag);
  requestsMade += 1;
  const url = buildUrl(baseUrl, pathStr, params);
  const result = await httpRequest(url, true, cancelFlag);
  return { payload: result.data, requests: 1 };
}

async function fetchBinary(baseUrl, pathStr, params, cancelFlag) {
  if (cancelFlag?.()) throw new Error("abgebrochen");
  await waitForSlot(cancelFlag);
  requestsMade += 1;
  const url = buildUrl(baseUrl, pathStr, params);
  const { data } = await httpRequest(url, false, cancelFlag);
  return { payload: data, requests: 1 };
}

function makeJobLog() {
  const entries = [];
  return {
    push(line) {
      const ts = new Date().toISOString().replace("T", " ").replace("Z", "");
      entries.push(`[${ts}] ${line}`);
      if (entries.length > 400) entries.shift();
    },
    snapshot() {
      return entries.slice(-200);
    },
  };
}

async function storeJson(targetDir, baseName, payload, pretty) {
  await ensureDir(targetDir);
  const filePath = path.join(targetDir, `${baseName}.json`);
  const data = pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload);
  await fsp.writeFile(filePath, data, "utf-8");
  return filePath;
}

function collectIds(payload, idField) {
  const ids = [];
  const add = (item) => {
    if (item == null) return;
    if (typeof item === "string" || typeof item === "number") {
      ids.push(String(item));
      return;
    }
    if (typeof item === "object" && idField in item) {
      ids.push(String(item[idField]));
    }
  };
  if (Array.isArray(payload)) {
    payload.forEach(add);
  } else if (typeof payload === "object" && payload) {
    add(payload);
    Object.values(payload).forEach((v) => {
      if (Array.isArray(v)) v.forEach(add);
    });
  }
  return ids;
}

function dedupe(list) {
  const seen = new Set();
  const result = [];
  for (const item of list) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return result;
}

function collectIconFilenames(payload, cfg) {
  const names = [];
  const add = (obj) => {
    if (!obj || typeof obj !== "object") return;
    if (cfg.filename_template) {
      try {
        const rendered = cfg.filename_template.replace(/\{(\w+)\}/g, (_, key) =>
          obj[key] !== undefined ? obj[key] : "",
        );
        if (rendered.trim()) names.push(rendered);
      } catch {
        return;
      }
      return;
    }
    if (cfg.filename_field && obj[cfg.filename_field]) {
      names.push(String(obj[cfg.filename_field]));
    }
  };
  if (Array.isArray(payload)) {
    payload.forEach(add);
  } else if (payload && typeof payload === "object") {
    add(payload);
    Object.values(payload).forEach((value) => {
      if (Array.isArray(value)) value.forEach(add);
    });
  }
  return dedupe(names);
}

async function downloadEndpoint(baseUrl, endpoint, job, cancelFlag) {
  const baseParams = endpoint.params || {};
  const safeDir = safeName(endpoint.output_subdir || endpoint.name || endpoint.path);
  const endpointDir = path.join(outputDir, safeDir || "endpoint");
  const pretty = Boolean(endpoint.write_pretty);
  let payload;

  if (endpoint.pagination) {
    const pageCfg = endpoint.pagination;
    const results = [];
    let current = pageCfg.start || 1;
    while (true) {
      const params = { ...baseParams };
      params[pageCfg.page_param || "page"] = current;
      if (pageCfg.limit_param && pageCfg.page_size) {
        params[pageCfg.limit_param] = pageCfg.page_size;
      }
      try {
        const { payload: pageData } = await fetchJson(baseUrl, endpoint.path, params, cancelFlag);
        results.push(pageData);
        if (pageCfg.stop_on_empty && (pageData == null || pageData.length === 0 || pageData === {})) {
          job.stepsDone += 1;
          break;
        }
        if (pageCfg.max_pages && current >= pageCfg.max_pages) {
          job.stepsDone += 1;
          break;
        }
        job.stepsDone += 1;
        current += 1;
        job.stepsTotal += 1;
      } catch (err) {
        job.stepsDone += 1;
        job.log.push(`Seite ${current} übersprungen: ${err?.message || err}`);
        break;
      }
    }
    payload = results;
  } else {
    const res = await fetchJson(baseUrl, endpoint.path, baseParams, cancelFlag);
    payload = res.payload;
    job.stepsDone += 1;
  }

  const baseName = safeName(endpoint.name || endpoint.path.replace(/[\\/]/g, "_")) || "data";
  const mainPath = await storeJson(endpointDir, baseName, payload, pretty);
  let detailPaths = "";
  let detailPayload = null;

  if (endpoint.bulk_ids) {
    const ids = collectIds(payload, endpoint.bulk_ids.id_field || "id");
    if (ids.length) {
      const joined = ids.join(endpoint.bulk_ids.join_with || ",");
      const destSub = endpoint.bulk_ids.dest_subdir || "parameter";
      const destDir = path.join(endpointDir, safeName(destSub));
      if (endpoint.bulk_ids.per_id) {
        job.stepsTotal += ids.length;
        const collected = [];
        for (const single of ids) {
          const pth = endpoint.bulk_ids.path_template
            ? endpoint.bulk_ids.path_template.replace("{id}", single).replace("{ids}", joined)
            : `${endpoint.path.replace(/\/+$/, "")}/${single}`;
          try {
            const res = await fetchJson(baseUrl, pth, null, cancelFlag);
            await storeJson(destDir, safeName(single), res.payload, pretty);
            collected.push(res.payload);
          } catch (err) {
            job.log.push(`Detail übersprungen (${pth}): ${err?.message || err}`);
          } finally {
            job.stepsDone += 1;
          }
        }
        const combinedName = `${baseName}_parameter`;
        detailPaths = await storeJson(endpointDir, combinedName, collected, pretty);
      } else {
        const pth = endpoint.bulk_ids.path_template
          ? endpoint.bulk_ids.path_template.replace("{ids}", joined)
          : `${endpoint.path.replace(/\/+$/, "")}/${joined}`;
        try {
          const res = await fetchJson(baseUrl, pth, null, cancelFlag);
          detailPayload = res.payload;
          detailPaths = await storeJson(destDir, `${baseName}_parameter`, res.payload, pretty);
        } catch (err) {
          job.log.push(`Details übersprungen (${pth}): ${err?.message || err}`);
        } finally {
          job.stepsDone += 1;
        }
      }
    } else {
      job.log.push(`Keine IDs für ${endpoint.name || endpoint.path} gefunden, Details ausgelassen.`);
    }
  }

  if (Array.isArray(endpoint.icons) && endpoint.icons.length) {
    const source = detailPayload || payload;
    for (const iconCfg of endpoint.icons) {
      const names = collectIconFilenames(source, iconCfg);
      if (!names.length) continue;
      const styles = iconCfg.styles && iconCfg.styles.length ? iconCfg.styles : [""];
      job.stepsTotal += names.length * styles.length;
      for (const style of styles) {
        const styleDir =
          iconCfg.include_style_dir === false
            ? endpointDir
            : path.join(endpointDir, iconCfg.dest_subdir ? safeName(iconCfg.dest_subdir) : "icons", safeName(style));
        await ensureDir(styleDir);
        for (const fname of names) {
          const remotePath = iconCfg.path_template
            ? iconCfg.path_template.replace("{style}", style).replace("{fileName}", fname)
            : `${endpoint.path}/${fname}`;
          try {
            const res = await fetchBinary(baseUrl, remotePath, null, cancelFlag);
            const target = path.join(styleDir, fname);
            await fsp.writeFile(target, res.payload);
          } catch (err) {
            job.log.push(`Icon fehlgeschlagen (${remotePath}): ${err.message}`);
          } finally {
            job.stepsDone += 1;
          }
        }
      }
    }
  }

  return detailPaths ? `${mainPath} ; ${detailPaths}` : mainPath;
}

async function runJob(ctx, endpoints) {
  const log = makeJobLog();
  currentJob = {
    running: true,
    cancelled: false,
    startedAt: Date.now(),
    stepsDone: 0,
    stepsTotal: endpoints.length,
    current: "",
    successes: 0,
    failures: 0,
    log,
    errors: [],
    outputDir,
    finishedManifest: "",
    statuses: (endpoints.endpoints || []).map((ep) => ({
      name: ep.name || ep.path,
      status: "Bereit",
      file: "",
    })),
  };
  requestsMade = 0;
  rateWindow.splice(0, rateWindow.length);
  await ensureDir(outputDir);
  const baseUrl = endpoints.base_url || endpoints.baseUrl;
  const items = endpoints.endpoints;

  const cancelFlag = () => currentJob?.cancelled;

  for (const ep of items) {
    if (currentJob.cancelled) break;
    currentJob.current = ep.name || ep.path;
    const statusEntry = currentJob.statuses.find((s) => s.name === currentJob.current);
    if (statusEntry) statusEntry.status = "Läuft";
    log.push(`Starte ${currentJob.current}`);
    try {
      const saved = await downloadEndpoint(baseUrl, ep, currentJob, cancelFlag);
      currentJob.successes += 1;
      log.push(`Fertig: ${currentJob.current} -> ${saved}`);
      if (statusEntry) {
        statusEntry.status = "OK";
        statusEntry.file = saved;
      }
    } catch (err) {
      currentJob.failures += 1;
      const msg = err?.message || String(err);
      log.push(`Fehler bei ${currentJob.current}: ${msg}`);
      currentJob.errors.push(`${currentJob.current}: ${msg}`);
      if (statusEntry) {
        statusEntry.status = "Fehler";
        statusEntry.file = "";
      }
    }
  }

  const finishedAt = Date.now();
  const manifest = {
    timestamp: new Date(finishedAt).toISOString(),
    duration_seconds: Math.max(0, (finishedAt - currentJob.startedAt) / 1000),
    requests: requestsMade,
    successes: currentJob.successes,
    failures: currentJob.failures,
  };
  const manifestPath = path.join(outputDir, "manifest.json");
  await fsp.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

  currentJob.finishedManifest = manifestPath;
  currentJob.running = false;
  currentJob.current = currentJob.cancelled ? "Abgebrochen" : "Fertig";
  log.push(
    currentJob.cancelled
      ? "Downloads abgebrochen."
      : `Downloads abgeschlossen. Erfolgreich: ${currentJob.successes}, Fehler: ${currentJob.failures}`,
  );
}

async function handleLoadConfig(ctx) {
  const config = await readEndpoints();
  let saved = [];
  try {
    saved = (await ctx.services.storage.get("api-fetch:selected")) || [];
  } catch {
    saved = [];
  }
  const endpoints = config.endpoints.map((ep) => {
    const enabledFromStorage = saved.includes(ep.name);
    return {
      name: ep.name,
      path: ep.path,
      enabled: saved.length ? enabledFromStorage : ep.enabled !== false,
    };
  });
  return {
    baseUrl: config.base_url || config.baseUrl || "",
    endpoints,
    outputDir,
    path: endpointsPath,
  };
}

async function handleStartDownloads(ctx, payload) {
  if (currentJob?.running) {
    throw new Error("Ein Download läuft bereits");
  }
  const config = await readEndpoints();
  const selectedNames = Array.isArray(payload?.endpoints) ? payload.endpoints : [];
  const selected = config.endpoints.filter(
    (ep) => selectedNames.includes(ep.name) || selectedNames.includes(ep.path) || (ep.enabled !== false && !selectedNames.length),
  );
  if (!selected.length) {
    throw new Error("Keine Endpunkte ausgewählt");
  }
  config.endpoints = selected;
  ctx.logger.info(`Starte Download für ${selected.length} Endpunkte`);
  runJob(ctx, config).catch((err) => {
    ctx.logger.error(`Download-Job fehlgeschlagen: ${err?.message || err}`);
    if (currentJob) {
      currentJob.running = false;
      currentJob.errors.push(err?.message || String(err));
    }
  });
  return { ok: true, total: selected.length };
}

async function handleGetStatus() {
  if (!currentJob) {
    return { running: false, log: [], progress: { done: 0, total: 0 }, current: "", successes: 0, failures: 0, errors: [] };
  }
  const total = Math.max(currentJob.stepsTotal, currentJob.stepsDone || 0);
  return {
    running: currentJob.running,
    cancelled: currentJob.cancelled,
    current: currentJob.current,
    successes: currentJob.successes,
    failures: currentJob.failures,
    log: currentJob.log.snapshot(),
    errors: currentJob.errors.slice(-50),
    progress: { done: currentJob.stepsDone, total },
    outputDir: currentJob.outputDir,
    manifest: currentJob.finishedManifest,
    statuses: currentJob.statuses || [],
    requests: {
      window: rateWindow.length,
      windowMax: RATE_LIMIT.maxRequests,
      total: requestsMade,
    },
  };
}

async function handleCancel() {
  if (currentJob?.running) {
    currentJob.cancelled = true;
    return { ok: true };
  }
  return { ok: false };
}

async function handleSetSelections(ctx, payload) {
  try {
    await ctx.services.storage.set("api-fetch:selected", payload || []);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

async function handleOpenOutputDir(payload) {
  const dir = (payload && payload.path) || outputDir;
  try {
    await ensureDir(dir);
    const command = process.platform === "win32" ? "explorer.exe" : "xdg-open";
    spawn(command, [dir], { detached: true, stdio: "ignore" }).unref();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

module.exports = {
  async init(ctx) {
    ctxRef = ctx;
    ctx.ipc.handle("load:config", () => handleLoadConfig(ctx));
    ctx.ipc.handle("job:start", (data) => handleStartDownloads(ctx, data));
    ctx.ipc.handle("job:status", handleGetStatus);
    ctx.ipc.handle("job:cancel", handleCancel);
    ctx.ipc.handle("selection:set", (data) => handleSetSelections(ctx, data));
    ctx.ipc.handle("output:open", handleOpenOutputDir);
    // settingsUI manifest references ui:launch – provide a stub handler to avoid missing IPC errors
    ctx.ipc.handle("ui:launch", launchUi);
    ctx.logger.info("api-fetch Plugin geladen");
  },
  async start() {},
  async stop() {
    if (currentJob) currentJob.cancelled = true;
    stopUiProcess();
  },
};
