import { authErrorResponse } from "@/lib/api-auth-guard";
import { getEmployeeBankCheck, requireEmployeePortal } from "@/lib/employee-portal";
import { readInvoiceAttachment } from "@/lib/financeiro-invoice-read";
import { jsonErr, jsonOk } from "@/lib/http";
import { readInvoiceSchema } from "@/lib/validators/employee-portal";

export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await requireEmployeePortal();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = readInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  try {
    const result = await readInvoiceAttachment({
      attachmentUrl: parsed.data.attachmentUrl,
      attachmentFileName: parsed.data.attachmentFileName,
    });
    const bankCheck = await getEmployeeBankCheck(ctx.employee.id, result.suggestion);
    return jsonOk({ ...result, bankCheck });
  } catch (e) {
    console.error("[colaborador/notas/ler]", e);
    return jsonErr("READ_FAILED", "Falha ao ler a nota. Preencha o formulário manualmente.", 500);
  }
}
