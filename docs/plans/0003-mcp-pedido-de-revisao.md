# Pedido de revisão da solução: MCP só de leitura do Khi

És um engenheiro sénior a fazer uma **revisão da solução** antes de o ramo ser integrado. Não procuro uma lista de gralhas nem de estilo. Quero saber se esta é a solução certa para o problema, se está bem construída e o que falta para a pôr nas mãos de utilizadores. Responde em português de Portugal, de forma direta: diz «isto está errado» quando estiver.

## O produto

O **Khi** é uma app de macOS (Tauri 2, Rust e Svelte) que importa os destaques e as notas de um Kobo e os exporta para Markdown. Desde a v2 guarda tudo numa **Biblioteca** própria: uma base SQLite (rusqlite 0.31 bundled, modo WAL, migrações por `user_version`). A Biblioteca tem vários **Leitores** (pessoas que partilham o Kobo ou têm vários), livros por Leitor, destaques com nota, capítulo e progresso, destaques marcados como removidos do Kobo mas mantidos na Biblioteca, e a regra «Novo» (um destaque chegou depois de o livro ter sido aberto pela última vez na app).

## O problema

Os utilizadores querem perguntar a um agente (Claude Code, Claude Desktop, outros clientes MCP) coisas como:
- «o que destaquei sobre confiança?»;
- «que destaques novos tenho?»;
- «quantos destaques tem a Ana de cada autor?».

Hoje o agente só consegue isto a partir do Markdown exportado, e muitos utilizadores nunca exportam.

## A solução no ramo

- **Repositório:** `/Users/brunomonteiro/Projects/khi-project/.worktrees/mcp`, ramo `feat/mcp`.
- **Commits:** de `63f912b` (base) a `3b815ae` (HEAD), 29 commits.
- **Diff:** `git diff 63f912b..HEAD`.

Lê primeiro o desenho completo, com decisões, alternativas recusadas, riscos e questões em aberto: `docs/plans/0003-mcp.md`, em português.

**Forma:**
- Um binário stdio separado, `khi-mcp`, em `src-tauri/mcp/`, com rmcp 3.11.0 e tokio de um só fio.
- Reutiliza a biblioteca da app (`khi_lib`) num workspace Cargo.
- Abre a Biblioteca só para leitura: `SQLITE_OPEN_READ_ONLY` mais `PRAGMA query_only`, uma ligação e uma transação diferida por chamada, verificação do `user_version` em cada chamada e `busy_timeout` de 2 s.
- A camada de leitura nova está em `src-tauri/src/library/read.rs`.
- Não tem rede. O updater da app passou para uma feature por omissão, e o `build.rs` tira a permissão `updater:` quando essa feature está desligada.

**Cinco ferramentas** (`src-tauri/mcp/src/tools.rs`), todas com `readOnlyHint`, `outputSchema` e `structuredContent`:
- `list_readers`;
- `list_books`;
- `get_book`;
- `search_highlights`: pesquisa por início de palavra, sem acentos, sem FTS, com varrimento completo em Rust;
- `new_highlights`: modos `unseen` e `syncedSince`.

**Regras das respostas:**
- Paginação com cursor opaco ligado à chamada: SHA-256 do método, da ordem e dos filtros.
- Teto de 16 KB por resposta, com corte e `truncated`.
- O texto dos destaques é tratado como dado e não como instrução.

**Proteção do caminho** (`src-tauri/mcp/src/guard.rs`), em cada chamada:
- só abre `library.sqlite`, pelo caminho canónico, diretamente na pasta de dados;
- recusa `/Volumes/`;
- `--dev` usa a pasta de desenvolvimento e `--reader <id>` limita a um Leitor.

**Testes:**
- `cargo test --workspace` (a partir de `src-tauri/`): 274 a passar e 1 ignorado (teste de tempo).
- Uma avaliação com agente, a B9: `src-tauri/mcp/eval/`, com 15 perguntas, um juiz determinístico por IDs e números e uma Biblioteca sintética. As corridas estão em `eval/runs/`. A corrida 3 deu 15/15, 0 IDs inventados e 2,3 chamadas por pergunta.

**O que já foi revisto:**
- Uma revisão adversarial encontrou 4 falhas importantes e 6 menores, todas corrigidas. Estão na secção «Revisão adversarial» do 0003.
- **Não repitas esses achados**, a não ser que a correção esteja errada ou incompleta.

## O que quero que avalies

1. **Arquitetura.** O binário separado com leitura direta do SQLite é a escolha certa? Compara com as alternativas:
   - servidor dentro da app Tauri (HTTP ou socket);
   - ler o Markdown exportado;
   - Resources MCP em vez de Tools;
   - um processo que fala com a app por IPC.
   Pesa o acoplamento ao esquema da app: o MCP lê as tabelas diretamente e trava quando o `user_version` muda. Pesa também as atualizações, a assinatura e a distribuição de um segundo binário.
2. **Desenho das ferramentas para agentes.**
   - As cinco ferramentas são o conjunto certo?
   - Os nomes, as descrições, os parâmetros e as formas de resposta ajudam um modelo a acertar à primeira?
   - Falta alguma pergunta comum que obrigue o agente a fazer muitas chamadas? Por exemplo, a q13 (um livro que não existe) gasta 7 chamadas.
   - O teto de 16 KB e a paginação estão bem calibrados?
3. **Pesquisa.**
   - O varrimento completo sem índice demora 45,5 ms numa Biblioteca sintética maior do que a de avaliação (vê o teste `#[ignore]` em `src-tauri/tests/library_read_search.rs`, que diz o tamanho), para um orçamento de 50 ms. Como é que isto escala para 20 000 ou 100 000 destaques?
   - Vale a pena FTS5 (compilado no rusqlite bundled) já agora, ou mais tarde?
   - A pesquisa por início de palavra com prefixo é a semântica certa para destaques em português e inglês?
4. **Segurança e privacidade.**
   - Leitura só de leitura de verdade: sobra algum caminho de escrita, de checkpoint do WAL ou de criação de ficheiros?
   - A proteção do caminho e a janela entre a verificação e a abertura (TOCTOU).
   - Injeção de instruções através do texto dos destaques.
   - O que um cliente MCP malicioso ou descuidado consegue fazer.
   - Se o `--reader` chega para separar pessoas que partilham um Mac.
5. **Correção e robustez.**
   - Concorrência com a app a sincronizar.
   - Consistência entre páginas.
   - A regra «Novo» igual à da app.
   - Datas e fusos.
   - Unicode: o corte feito sobre os bytes do JSON escapado.
   - Panics e bloqueios, agora com `spawn_blocking`.
6. **Testes e avaliação.**
   - Os testes provam as promessas do 0003 ou só o caminho feliz?
   - A B9 mede o que importa? Sugere perguntas novas: por exemplo, um destaque acima de 16 KB, uma Biblioteca grande, perguntas ambíguas.
   - O juiz é fiável? Vê `run.py --self-test`.
7. **Prontidão para lançar.** O que falta para isto chegar a utilizadores:
   - pôr o binário na app como sidecar, com assinatura e notarização;
   - o painel «Agentes» nas Definições;
   - a documentação;
   - um interruptor para ligar e desligar.
   Diz o que bloqueia e o que pode esperar, e se a ordem proposta no 0003 está certa.
8. **As questões em aberto do 0003** (Q1, Q6, Q8, Q9, Q10 e Q11). Dá a tua recomendação para cada uma.

## Regras

- **Nunca abras a Biblioteca real** (`~/Library/Application Support/KoboHighlightsExporter`) nem nenhum `KoboReader.sqlite`. Usa só os fixtures e as Bibliotecas que os testes ou o `cargo run -p khi-mcp --example build_eval -- <pasta nova "KoboHighlightsExporter Dev">` criam.
- **Só leitura no repositório.** Não alteres ficheiros, não faças commits nem mudes de ramo. Podes correr `cargo test --workspace`, `cargo tree` e sondas descartáveis numa pasta temporária fora do repositório.
- **Não corras a B9** (`eval/run.py` sem `--self-test`), porque gasta a utilização de Claude do dono.
- Cita sempre `ficheiro:linha` e distingue o que **reproduziste** (comando e saída) do que é **raciocínio**.

## Formato da resposta

1. **Veredicto** numa linha: integrar, integrar com condições, ou repensar. Diz porquê.
2. **As 3 decisões mais discutíveis**, cada uma com a alternativa que escolherias e o custo de mudar agora em vez de mais tarde.
3. **Achados**, ordenados por gravidade (bloqueia, importante, menor). Cada um com:
   - `ficheiro:linha`;
   - um cenário concreto (entrada ou estado → resultado errado);
   - se foi reproduzido;
   - a correção proposta.
4. **O que está bem e não deve mudar**, em poucas linhas.
5. **Recomendações para as questões em aberto** e para a ordem até ao lançamento.
