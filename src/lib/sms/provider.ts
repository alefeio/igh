/**
 * Resultado do envio de um SMS pelo provider.
 * Padrão interno: isolado da API do provider (Zenvia, mock, etc.).
 */
export interface SmsSendResult {
  success: boolean;
  providerMessageId?: string | null;
  providerResponse?: Record<string, unknown> | null;
  errorMessage?: string | null;
}

/**
 * Interface desacoplada do provider de SMS.
 * Implementações: Zenvia, mock; preparado para futura central multicanal (SMS + e-mail).
 */
export interface SmsProvider {
  readonly name: string;
  send(to: string, body: string): Promise<SmsSendResult>;
  isConfigured(): boolean;
}

const ZENVIA_SMS_URL = "https://api.zenvia.com/v2/channels/sms/messages";

/**
 * Formata número para a API Zenvia (Brasil: 55 + DDD + número, sem +).
 */
function formatPhoneForZenvia(normalized: string): string {
  const digits = normalized.replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  return `55${digits}`;
}

/**
 * Provider mock: não envia SMS. Usado em desenvolvimento ou quando SMS_PROVIDER=mock.
 */
export class MockSmsProvider implements SmsProvider {
  readonly name = "mock";

  isConfigured(): boolean {
    return true;
  }

  async send(_to: string, body: string): Promise<SmsSendResult> {
    return {
      success: true,
      providerMessageId: `mock-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      providerResponse: { mock: true, bodyLength: body.length },
    };
  }
}

/**
 * Provider Zenvia (API v2). Configuração: ZENVIA_API_KEY, ZENVIA_FROM (alias do remetente na plataforma Zenvia).
 * Compatível com números brasileiros.
 */
export class ZenviaSmsProvider implements SmsProvider {
  readonly name = "zenvia";
  private readonly apiKey: string;
  private readonly from: string;

  constructor() {
    this.apiKey = (process.env.ZENVIA_API_KEY ?? process.env.ZENVIA_API_TOKEN ?? "").trim();
    this.from = (process.env.ZENVIA_FROM ?? process.env.SMS_FROM ?? "").trim();
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.from);
  }

  async send(to: string, body: string): Promise<SmsSendResult> {
    if (!this.apiKey) {
      return {
        success: false,
        errorMessage:
          "Zenvia não configurado. Defina ZENVIA_API_KEY (e ZENVIA_FROM) no .env.",
      };
    }
    if (!this.from) {
      return {
        success: false,
        errorMessage:
          "ZENVIA_FROM é obrigatório. Configure o alias do remetente SMS na plataforma Zenvia (Credentials).",
      };
    }

    const toFormatted = formatPhoneForZenvia(to);
    const payload = {
      from: this.from,
      to: toFormatted,
      contents: [{ type: "text" as const, text: body }],
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(ZENVIA_SMS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-TOKEN": this.apiKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const raw = await res.text();
      let data: Record<string, unknown> | null = null;
      try {
        data = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
      } catch {
        // resposta não-JSON
      }

      if (!res.ok) {
        const code = (data?.code as string) ?? "HTTP_ERROR";
        const message = (data?.message as string) ?? (raw || res.statusText);
        let userMessage = message;
        if (res.status === 401) {
          userMessage = "ZENVIA_API_KEY inválida ou expirada. Verifique no console da Zenvia.";
        } else if (res.status === 400) {
          userMessage = message || "Dados inválidos (remetente, destinatário ou conteúdo). Verifique ZENVIA_FROM e o número.";
        } else if (res.status === 404) {
          userMessage = "Recurso não encontrado. Confirme que o canal SMS está ativo na Zenvia.";
        }
        return {
          success: false,
          errorMessage: userMessage,
          providerResponse: data ?? { status: res.status, body: raw },
        };
      }

      const id = data?.id as string | undefined;
      return {
        success: true,
        providerMessageId: id ?? undefined,
        providerResponse: data ?? undefined,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isAbort = err instanceof Error && err.name === "AbortError";
      return {
        success: false,
        errorMessage: isAbort ? "Timeout ao enviar SMS (Zenvia)." : message,
        providerResponse: err instanceof Error ? { name: err.name } : undefined,
      };
    }
  }
}

let _provider: SmsProvider | null = null;

/**
 * Retorna o provider de SMS configurado (env SMS_PROVIDER: zenvia | mock).
 * Em desenvolvimento: se SMS_PROVIDER=zenvia mas ZENVIA_API_KEY não estiver definida, usa mock e registra aviso.
 */
export function getSmsProvider(): SmsProvider {
  if (_provider) return _provider;

  const kind = (process.env.SMS_PROVIDER ?? "mock").toLowerCase();
  const isDev = process.env.NODE_ENV === "development";
  const hasZenviaKey = Boolean(
    (process.env.ZENVIA_API_KEY ?? process.env.ZENVIA_API_TOKEN ?? "").trim()
  );

  if (kind === "zenvia") {
    const p = new ZenviaSmsProvider();
    if (p.isConfigured()) {
      _provider = p;
    } else {
      if (isDev) {
        console.warn(
          "[sms] Zenvia solicitado mas não configurado (ZENVIA_API_KEY e/ou ZENVIA_FROM). Usando provider mock."
        );
      }
      _provider = new MockSmsProvider();
    }
  } else {
    _provider = new MockSmsProvider();
  }

  return _provider;
}
