-- Mescla comentário legado em commentTeacher e remove a coluna legada.
UPDATE "PlatformExperienceFeedback"
SET "commentTeacher" = CASE
  WHEN "comment" IS NULL OR BTRIM("comment") = '' THEN "commentTeacher"
  WHEN "commentTeacher" IS NULL OR BTRIM("commentTeacher") = '' THEN "comment"
  ELSE BTRIM("commentTeacher") || E'\n\n' || BTRIM("comment")
END
WHERE "comment" IS NOT NULL AND BTRIM("comment") <> '';

ALTER TABLE "PlatformExperienceFeedback" DROP COLUMN "comment";
