import "../prisma/load-env";
import {
  getDashboardMultiCertifiedShowcase,
  getPublicMultiCertifiedShowcase,
} from "../src/lib/student-multi-certification";

async function main() {
  const pub = await getPublicMultiCertifiedShowcase();
  const dash = await getDashboardMultiCertifiedShowcase();
  console.log("public entries:", pub?.entries.length ?? "null");
  console.log("dashboard entries:", dash?.entries.length ?? "null");
  console.log("sample:", pub?.entries[0]?.displayName, pub?.entries[0]?.certificationCount);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
