import { describe, expect, it } from "vitest";

import { hasAdminManagementAccess, hasAdminManagementWriteAccess } from "@/lib/staff-access";
import { parseSearchParams, academicQuerySchema } from "@/lib/diretor/search-params";

describe("Diretor — sem mutação/Gerência", () => {
  it("DIRECTOR não tem acesso de leitura/escrita à Gerência", () => {
    expect(hasAdminManagementAccess({ role: "DIRECTOR" })).toBe(false);
    expect(hasAdminManagementWriteAccess({ role: "DIRECTOR" })).toBe(false);
  });

  it("filtros acadêmicos válidos passam no schema", () => {
    const url = new URL(
      "http://x/api?scope=current&courseId=11111111-1111-4111-8111-111111111111",
    );
    const q = parseSearchParams(academicQuerySchema, url);
    expect(q.scope).toBe("current");
    expect(q.courseId).toBe("11111111-1111-4111-8111-111111111111");
  });
});
