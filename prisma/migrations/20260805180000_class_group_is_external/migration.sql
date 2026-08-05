-- Escopo Interna/Externa separado do status operacional.
ALTER TABLE "ClassGroup" ADD COLUMN "isExternal" BOOLEAN NOT NULL DEFAULT false;

-- Turmas que eram EXTERNO passam a isExternal=true.
UPDATE "ClassGroup" SET "isExternal" = true WHERE "status" = 'EXTERNO';

-- Recria o enum sem INTERNO/EXTERNO, convertendo esses status para operacionais.
ALTER TYPE "ClassGroupStatus" RENAME TO "ClassGroupStatus_old";

CREATE TYPE "ClassGroupStatus" AS ENUM (
  'PLANEJADA',
  'ABERTA',
  'EM_ANDAMENTO',
  'ENCERRADA',
  'CANCELADA'
);

ALTER TABLE "ClassGroup" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "ClassGroup"
  ALTER COLUMN "status" TYPE "ClassGroupStatus"
  USING (
    CASE
      WHEN "status"::text IN ('INTERNO', 'EXTERNO') THEN
        CASE
          WHEN "endDate" IS NOT NULL AND "endDate" < (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
            THEN 'ENCERRADA'::"ClassGroupStatus"
          WHEN "startDate" <= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
            THEN 'EM_ANDAMENTO'::"ClassGroupStatus"
          ELSE 'PLANEJADA'::"ClassGroupStatus"
        END
      ELSE "status"::text::"ClassGroupStatus"
    END
  );

ALTER TABLE "ClassGroup" ALTER COLUMN "status" SET DEFAULT 'PLANEJADA'::"ClassGroupStatus";

DROP TYPE "ClassGroupStatus_old";
