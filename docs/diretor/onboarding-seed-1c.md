# Seed de onboarding do Diretor (Fase 1C)

O texto em `prisma/seeds/onboarding-guides.ts` (perfil DIRECTOR) já descreve a área multipágina. **Não foi aplicado nesta etapa de homologação.**

## Comando idempotente

No diretório do projeto, com URL de **aplicação** (não usuário de migração):

```
npm run seed:onboarding
```

Isso executa `tsx prisma/seed-onboarding-all.ts`, que faz upsert dos guias de **todos os perfis** a partir do repositório.

## Onde executar

Somente em ambiente local de homologação ou em staging **após** o deploy do código 1C. **Não executar em produção nesta etapa.**

## Quando implantar

Depois da homologação visual autenticada e antes de comunicar o novo Guia/tutorial aos diretores. Independente do redirect (que permanece desligado).

## Como verificar

1. Login DIRECTOR (ou MASTER no preview).
2. Abrir o onboarding/guia e conferir menção a `/diretor`, Visão Geral, Prioridades e páginas temáticas.
3. Confirmar que o painel legado em `/dashboard` ainda é citado como fallback.

## Rollback

Restaurar o conteúdo anterior do guia DIRECTOR no repositório e rodar de novo `npm run seed:onboarding` no mesmo ambiente (upsert). Não há migration associada.
