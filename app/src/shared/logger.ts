export const logErr = (err: unknown, moduleName?: string) => {
    console.error(`[${moduleName ?? "App"}]`, err);
};

export const logWarn = (msg: unknown, moduleName?: string) => {
    console.warn(`[${moduleName ?? "App"}]`, msg);
};