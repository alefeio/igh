# Checklist de homologação visual — Diretor Fase 1C

Redirect **desligado**. Sem sessão autenticada nesta entrega automática, células abaixo ficam para o responsável.

Pastas de evidência local (não versionar binários): `tmp/homologacao-1c/`

URLs: `/diretor`, `/diretor/prioridades`, `/diretor/academico`, `/diretor/oferta-territorios`, `/diretor/impacto-social`, `/diretor/financeiro`, `/diretor/administrativo`, `/diretor/projetos-convenios`, `/diretor/relatorios`, `/diretor/guia`, `/dashboard`

| Rota | Perfil | Viewport | Filtros | Gráficos | Tabela | Estados | Resultado | Observação |
| ---- | ------ | -------: | ------- | -------- | ------ | ------- | --------- | ---------- |
| /diretor | DIRECTOR | 390 | ciclo + competência | n/a (sem gráficos completos) | n/a | carregar/vazio/parcial | ☐ | máx. 6 KPIs / 5 alertas |
| /diretor | DIRECTOR | 768 | ciclo + competência | n/a | n/a | | ☐ | |
| /diretor | DIRECTOR | 1366 | ciclo + competência | n/a | n/a | | ☐ | |
| /diretor | MASTER | 1366 | | n/a | n/a | banner preview | ☐ | não redireciona de /dashboard |
| /diretor/prioridades | DIRECTOR | 390 | | n/a | lista de alertas | vazio | ☐ | sem botões de conclusão |
| /diretor/prioridades | DIRECTOR | 768 | | n/a | | | ☐ | |
| /diretor/prioridades | DIRECTOR | 1366 | | n/a | | | ☐ | |
| /diretor/academico | DIRECTOR | 390 | ciclo | título/unidade/período | equivalente | | ☐ | |
| /diretor/academico | DIRECTOR | 768 | | | | | ☐ | |
| /diretor/academico | DIRECTOR | 1366 | | | | | ☐ | |
| /diretor/oferta-territorios | DIRECTOR | 390 | | | | | ☐ | |
| /diretor/oferta-territorios | DIRECTOR | 768 | | | | | ☐ | |
| /diretor/oferta-territorios | DIRECTOR | 1366 | | | | | ☐ | |
| /diretor/impacto-social | DIRECTOR | 390 | | | LGPD &lt;5 | | ☐ | |
| /diretor/impacto-social | DIRECTOR | 768 | | | | | ☐ | |
| /diretor/impacto-social | DIRECTOR | 1366 | | | | | ☐ | |
| /diretor/financeiro | DIRECTOR | 390 | competência | idade em aberto | | | ☐ | sem “vencido” |
| /diretor/financeiro | DIRECTOR | 768 | | | | | ☐ | |
| /diretor/financeiro | DIRECTOR | 1366 | | | | | ☐ | |
| /diretor/administrativo | DIRECTOR | 390 | | | | | ☐ | |
| /diretor/administrativo | DIRECTOR | 768 | | | | | ☐ | |
| /diretor/administrativo | DIRECTOR | 1366 | | | | | ☐ | |
| /diretor/projetos-convenios | DIRECTOR | 390 | | n/a | n/a | indisponível | ☐ | não é zero de portfólio |
| /diretor/projetos-convenios | MASTER | 1366 | | n/a | n/a | banner | ☐ | |
| /diretor/relatorios | DIRECTOR | 390 | | n/a | n/a | download blob | ☐ | PDF/XLSX/CSV/JSON |
| /diretor/relatorios | DIRECTOR | 768 | | n/a | n/a | | ☐ | |
| /diretor/relatorios | DIRECTOR | 1366 | | n/a | n/a | | ☐ | |
| /diretor/guia | DIRECTOR | 1366 | | n/a | n/a | | ☐ | alinhado ao catálogo |
| /dashboard | DIRECTOR | 1366 | | legado | | banner 1C | ☐ | flag false = sem redirect |
| /dashboard | MASTER | 1366 | | legado | | | ☐ | sem redirect para /diretor |

Homologação visual autenticada: ☐ pendente (responsável)
Autorização de redirect: ☐ não
