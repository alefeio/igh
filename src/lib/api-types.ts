export type ApiErr = { ok: false; error: { code: string; message: string; details?: unknown } };
export type ApiOk<T> = { ok: true; data: T };
export type ApiResponse<T> = ApiOk<T> | ApiErr;
