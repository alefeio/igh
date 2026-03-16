/**
 * Resultado do envio de um SMS pelo provider.
 */
export interface SmsSendResult {
  success: boolean;
  providerMessageId?: string | null;
  providerResponse?: Record<string, unknown> | null;
  errorMessage?: string | null;
}

/**
 * Interface desacoplada do provider de SMS.
 * Implementações: Twilio, Infobip, mock, etc.
 */
export interface SmsProvider {
  readonly name: string;
  send(to: string, body: string): Promise<SmsSendResult>;
  isConfigured(): boolean;
}

/**
 * Provider mock que não envia SMS (útil quando SMS_PROVIDER não está configurado).
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
 * Provider Twilio (configuração via env: SMS_ACCOUNT_SID, SMS_AUTH_TOKEN, SMS_FROM).
 */
export class TwilioSmsProvider implements SmsProvider {
  readonly name = "twilio";
  private accountSid: string;
  private authToken: string;
  private from: string;

  constructor() {
    this.accountSid = process.env.SMS_ACCOUNT_SID ?? "";
    this.authToken = process.env.SMS_AUTH_TOKEN ?? "";
    this.from = process.env.SMS_FROM ?? "";
  }

  isConfigured(): boolean {
    return Boolean(
      this.accountSid &&
        this.authToken &&
        this.from
    );
  }

  async send(to: string, body: string): Promise<SmsSendResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        errorMessage: "Twilio not configured",
      };
    }
    try {
      // Especificador dinâmico: evita que o Next resolva "twilio" no build (pacote opcional)
      const twilioPkg = "twilio";
      const twilioModule = await import(/* webpackIgnore: true */ twilioPkg).catch(() => null);
      if (!twilioModule?.default) {
        return {
          success: false,
          errorMessage: "Twilio SDK not installed (npm install twilio)",
        };
      }
      const client = twilioModule.default(this.accountSid, this.authToken);
      const msg = await client.messages.create({
        body,
        from: this.from,
        to: to.startsWith("+") ? to : `+55${to}`,
      });
      return {
        success: true,
        providerMessageId: msg.sid,
        providerResponse: {
          status: msg.status,
          sid: msg.sid,
        } as Record<string, unknown>,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        errorMessage: message,
        providerResponse: err instanceof Error ? { name: err.name } : undefined,
      };
    }
  }
}

let _provider: SmsProvider | null = null;

/**
 * Retorna o provider de SMS configurado (env SMS_PROVIDER: twilio | mock).
 * Se não configurado ou inválido, retorna MockSmsProvider.
 */
export function getSmsProvider(): SmsProvider {
  if (_provider) return _provider;
  const kind = (process.env.SMS_PROVIDER ?? "mock").toLowerCase();
  if (kind === "twilio") {
    const p = new TwilioSmsProvider();
    _provider = p.isConfigured() ? p : new MockSmsProvider();
  } else {
    _provider = new MockSmsProvider();
  }
  return _provider;
}
