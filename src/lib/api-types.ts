export type ApiErr = { ok: false; error: { code: string; message: string } };
export type ApiOk<T> = { ok: true; data: T };
export type ApiResponse<T> = ApiOk<T> | ApiErr;
