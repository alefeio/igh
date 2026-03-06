import { getCoursesForSite, getFaqItems } from "@/lib/site-data";
import { jsonOk } from "@/lib/http";

/** Dados para o widget de atendimento: cursos (com link) e FAQ. Público, sem auth. */
export async function GET() {
  const [courses, faqItems] = await Promise.all([
    getCoursesForSite(),
    getFaqItems(),
  ]);

  const coursesForChat = courses.map((c) => ({
    name: c.name,
    slug: c.slug,
    url: `/cursos/${encodeURIComponent(c.slug)}`,
  }));

  const faqForChat = faqItems.map((f) => ({
    pergunta: f.question,
    resposta: f.answer,
  }));

  return jsonOk({
    courses: coursesForChat,
    faq: faqForChat,
  });
}
