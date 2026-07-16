# Certificado de conclusão de curso

## Arquivos

- `course-completion-front.pdf` — arte da frente (1 página), landscape 859.92 × 613.2 pt.
- `course-completion-back.pdf` — arte do verso (1 página), mesmas dimensões.
- `course-completion-template.pdf` — legado (2 páginas); a geração atual usa frente/verso separados.
- Fontes: `../fonts/NotoSans-Regular.ttf` e `NotoSans-Bold.ttf`.

## Geração

- **Frente e verso** (padrão do aluno / cache): junta os dois templates e preenche.
- **Somente frente** (ZIP em lote): gera só a partir de `course-completion-front.pdf` (sem cortar PDF de 2 páginas).

## Campos dinâmicos (overlay)

### Frente
| Campo | Fonte |
|--------|--------|
| Nome do aluno (UPPERCASE) | User / Student name |
| Frase com curso + horas | Course.name + workloadHours |
| Belém/PA, {data} | data de emissão |

### Verso
| Campo | Fonte |
|--------|--------|
| Curso de {nome} | Course.name |
| Carga Horária: Nh | workloadHours |
| 1. Título… | CourseModule.title (só título) |
| Belém, {data} | data de emissão |
| Assinatura + nome | Teacher.signatureUrl + Teacher.name |

Coordenadas: ver `src/lib/course-certificate-layout.ts`.
