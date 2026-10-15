import "server-only";

import { lookup } from "node:dns/promises";

import {
  MaterialUrlError,
  assertPublicHttpsUrl,
  isBlockedAddress,
} from "@/lib/teacher-class-material";

export async function assertResolvedPublicHttps(raw: string): Promise<string> {
  const normalized = assertPublicHttpsUrl(raw);
  const host = new URL(normalized).hostname;
  if (isBlockedAddress(host)) throw new MaterialUrlError("Endereço de arquivo não permitido.");
  if (host.includes(":") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return normalized;
  let records: { address: string }[];
  try {
    records = await lookup(host, { all: true });
  } catch {
    throw new MaterialUrlError("Não foi possível acessar o arquivo.");
  }
  if (records.length === 0 || records.some((record) => isBlockedAddress(record.address))) {
    throw new MaterialUrlError("Endereço de arquivo não permitido.");
  }
  return normalized;
}

/** Baixa um arquivo HTTPS público, seguindo no máximo alguns redirecionamentos também públicos. */
export async function fetchPublicHttps(startUrl: string): Promise<Response> {
  let current = await assertResolvedPublicHttps(startUrl);
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(current, { redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new MaterialUrlError("Não foi possível abrir o arquivo.");
      current = await assertResolvedPublicHttps(new URL(location, current).toString());
      continue;
    }
    return res;
  }
  throw new MaterialUrlError("Não foi possível abrir o arquivo.");
}
