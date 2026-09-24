# Quadro de Atividades — configuração e implantação

Documento técnico versionado (as variáveis não ficam em `.env.example` porque `.env*` está no `.gitignore`).

## Finalidade

Quadro operacional para planejar, acompanhar e concluir atividades internas por unidade (`PoloLocation`), com comentários, reações, histórico e aba de agenda dos professores (somente leitura a partir de `ClassSession`).

O mesmo código atende IGH e INAC; os bancos são separados. O piloto deve ser ativado somente no IGH.

## Variáveis de ambiente

| Variável | Papel |
|----------|--------|
| `BOARD_ACTIVITIES_ENABLED` | Liga o recurso. Só `true` (minúsculo) ativa. Ausente ou qualquer outro valor = desligado. |
| `BOARD_ACTIVITIES_POLO_LOCATION_ID` | UUID do `PoloLocation` (unidade operacional) do piloto. Obrigatório quando a flag está ativa. |

Comportamento seguro por padrão:

- sem `BOARD_ACTIVITIES_ENABLED=true`, o item some do menu e página/APIs negam acesso;
- com a flag ligada, mas sem ID ou com ID que não é UUID válido, o recurso permanece inativo; há mensagem administrativa no log do servidor e mensagem genérica para usuários comuns;
- o ID deve corresponder a um `PoloLocation` ativo no banco do ambiente; caso contrário as APIs falham de forma controlada (sem derrubar o restante do sistema).

Não fixe nome de cidade, slug ou ID no código-fonte.

## Escopo do piloto

- **IGH:** pode ativar após migration e validação da unidade.
- **INAC:** manter a flag ausente ou diferente de `true` neste momento.

## Migration

Nome: `20260924150000_board_activities_mvp`

Alterações aditivas (coluna em `User`, enums, tabelas do módulo, índices e FKs). Não remove nem renomeia campos existentes.

Aplicar a migration nos bancos compatíveis **antes** de publicar o código que depende do novo schema. Código antigo costuma conviver com a migration aplicada enquanto a flag estiver desligada.

## Ordem recomendada de implantação

1. Backup dos bancos envolvidos.
2. `prisma migrate deploy` (ou fluxo equivalente do projeto) em cada banco, sem ativar a flag.
3. Deploy do código com `BOARD_ACTIVITIES_ENABLED` desligado (ou ausente) em todos os ambientes.
4. Verificar health geral e ausência do menu do Quadro.
5. No IGH apenas: confirmar o UUID de um `PoloLocation` ativo; definir `BOARD_ACTIVITIES_POLO_LOCATION_ID` e `BOARD_ACTIVITIES_ENABLED=true`.
6. Homologar no IGH.

Não imprimir URLs, senhas ou IDs reais neste documento nem em commits.

## Desativação rápida

Defina `BOARD_ACTIVITIES_ENABLED` como ausente ou diferente de `true`. O menu e as APIs deixam de expor o recurso. **Desligar a flag não apaga dados.**

## Rollback da migration

Uma migration já aplicada não se “desfaz” com segurança apenas revertendo o deploy. Preferir desligar a flag. Rollback SQL manual só com plano explícito e backup.

## Homologação resumida

1. INAC (flag off): sem item de menu; APIs do quadro negam.
2. IGH (flag on + unidade válida): menu visível para papéis elegíveis; estudante não vê.
3. Usuário sem `canCreateBoardTasks` não cria; Master/Admin habilita pela UI **Quem pode criar atividades**.
4. Só criador ou responsável movem status; reassociação administrativa só pela ação explícita.
5. Período (hoje / semana / máx. 31 dias / limpar) e fuso America/Belem.
6. Agenda: filtro pela unidade, aulas canceladas, conflitos de horário do mesmo professor.
7. Comentários e reações; histórico somente leitura.
