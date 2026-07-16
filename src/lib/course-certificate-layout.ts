/**
 * Layout do certificado de conclusão (overlay sobre
 * assets/certificates/course-completion-front.pdf e course-completion-back.pdf).
 * Página landscape: 859.92 × 613.2 pt. Origem pdf-lib: canto inferior esquerdo.
 *
 * Coordenadas derivadas do PPTX preenchido (CERTIFICADO INFORMÁTICA BÁSICA.pptx).
 */

export const COURSE_CERTIFICATE_PAGE = {
  width: 859.92,
  height: 613.2,
} as const;

export const COURSE_CERTIFICATE_CITY_FRONT = "Belém/PA";
export const COURSE_CERTIFICATE_CITY_BACK = "Belém";

/** Carga horária mínima exibida no certificado (cursos com menos horas usam este valor). */
export const COURSE_CERTIFICATE_MIN_WORKLOAD_HOURS = 40;

/** Frente */
export const FRONT_LAYOUT = {
  studentName: {
    x: 47.4,
    y: 340,
    width: 765,
    fontSize: 28,
    minFontSize: 12,
    align: "center" as const,
  },
  courseSentence: {
    x: 73.9,
    y: 308,
    width: 712,
    fontSize: 13,
    minFontSize: 8,
    align: "center" as const,
  },
  locationDate: {
    x: 563.8,
    y: 255,
    width: 220.1,
    fontSize: 12,
    align: "right" as const,
  },
} as const;

/** Verso */
export const BACK_LAYOUT = {
  courseTitle: {
    x: 40.5,
    y: 530,
    width: 340.4,
    fontSize: 16,
    minFontSize: 9,
    align: "left" as const,
  },
  workload: {
    x: 40.5,
    y: 508,
    width: 340.4,
    fontSize: 13,
    align: "left" as const,
  },
  locationDate: {
    x: 460.8,
    y: 530,
    width: 340.4,
    fontSize: 13,
    align: "right" as const,
  },
  modules: {
    x: 40.5,
    /** Y da primeira linha (topo da caixa de conteúdo). */
    startY: 455,
    width: 351.8,
    fontSize: 12,
    lineHeight: 22,
    maxLines: 14,
  },
  teacherSignature: {
    x: 555,
    y: 330,
    width: 150,
    height: 55,
  },
  teacherName: {
    x: 529.2,
    y: 295,
    width: 203.6,
    fontSize: 12,
    align: "center" as const,
  },
  teacherRole: {
    x: 529.2,
    y: 278,
    width: 203.6,
    fontSize: 11,
    align: "center" as const,
  },
} as const;
