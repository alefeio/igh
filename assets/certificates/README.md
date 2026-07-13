# Certificado de conclusão de curso

## Arquivos

- `course-completion-template.pdf` — arte em branco (frente + verso), landscape 859.92 × 613.2 pt.
- Fontes: `../fonts/NotoSans-Regular.ttf` e `NotoSans-Bold.ttf`.

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
