export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: { code: string; message: string; details?: unknown } };
export type ApiResponse<T> = ApiOk<T> | ApiErr;

export function jsonOk<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ ok: true, data } satisfies ApiOk<T>, init);
}

export function jsonErr(code: string, message: string, status = 400, details?: unknown): Response {
  return Response.json(
    {
      ok: false,
      error: details !== undefined ? { code, message, details } : { code, message },
    } satisfies ApiErr,
    { status },
  );
}

export function isKnownError(err: unknown): err is Error {
  return err instanceof Error;
}
