-- Compat para shadow DB: esta migration pode estar antes da criação do enum dependendo da ordem no histórico.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmailAudienceType') THEN
    CREATE TYPE "EmailAudienceType" AS ENUM (
      'ALL_STUDENTS',
      'CLASS_GROUP',
      'STUDENTS_INCOMPLETE',
      'STUDENTS_COMPLETE',
      'STUDENTS_ACTIVE',
      'STUDENTS_INACTIVE',
      'BY_COURSE',
      'TEACHERS',
      'ADMINS',
      'ALL_ACTIVE_USERS'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'EmailAudienceType' AND e.enumlabel = 'ENROLLED_STUDENTS'
  ) THEN
    ALTER TYPE "EmailAudienceType" ADD VALUE 'ENROLLED_STUDENTS';
  END IF;
END $$;

