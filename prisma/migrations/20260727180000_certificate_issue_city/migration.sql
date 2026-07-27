-- Cidade de emissão do certificado: por local do polo, com padrão institucional em SiteSettings.
ALTER TABLE "PoloLocation" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "PoloLocation" ADD COLUMN IF NOT EXISTS "state" TEXT;

ALTER TABLE "SiteSettings" ADD COLUMN IF NOT EXISTS "certificateCity" TEXT;
ALTER TABLE "SiteSettings" ADD COLUMN IF NOT EXISTS "certificateCityState" TEXT;
