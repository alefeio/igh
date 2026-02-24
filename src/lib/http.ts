export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: { code: string; message: string } };
export type ApiResponse<T> = ApiOk<T> | ApiErr;

export function jsonOk<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ ok: true, data } satisfies ApiOk<T>, init);
}

export function jsonErr(code: string, message: string, status = 400): Response {
  return Response.json({ ok: false, error: { code, message } } satisfies ApiErr, { status });
}

export function isKnownError(err: unknown): err is Error {
  return err instanceof Error;
}
