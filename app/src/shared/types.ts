export type IpcWebviewReadyPayload = {
    profileId: string;
};

// Profile type alias (shared with schemas)
export type Profile = import("./schemas").Profile;

// ============================================================================
// IPC Result Types - Standardized response format for all IPC handlers
// ============================================================================

/**
 * Error codes for IPC operations.
 * Used to categorize errors for consistent handling in the renderer.
 */
export type IpcErrorCode =
    | "VALIDATION_ERROR"      // Invalid input parameters
    | "NOT_FOUND"             // Resource not found
    | "OPERATION_FAILED"      // Operation failed unexpectedly
    | "NETWORK_ERROR"         // Network-related failure
    | "PERMISSION_DENIED"     // Access denied
    | "INTERNAL_ERROR"        // Unexpected internal error
    | "RATE_LIMITED";         // Too many requests

/**
 * Successful IPC result.
 */
export type IpcSuccess<T> = {
    ok: true;
    data: T;
};

/**
 * Failed IPC result with error information.
 */
export type IpcError = {
    ok: false;
    error: string;
    code: IpcErrorCode;
};

/**
 * Standard IPC result type - either success with data or failure with error.
 * All IPC handlers should return this type for consistent error handling.
 */
export type IpcResult<T> = IpcSuccess<T> | IpcError;

/**
 * Helper to create a successful IPC result.
 */
export function ipcOk<T>(data: T): IpcSuccess<T> {
    return { ok: true, data };
}

/**
 * Helper to create a failed IPC result.
 */
export function ipcErr(error: string, code: IpcErrorCode = "OPERATION_FAILED"): IpcError {
    return { ok: false, error, code };
}
