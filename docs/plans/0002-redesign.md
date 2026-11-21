# Redesign da v2: plano de implementação
> **Para quem executa:** usar `superpowers:executing-plans` e seguir task a task, sem subagentes. Os passos usam checkboxes (`- [ ]`).

**Objetivo:** a interface aprovada no Figma (ficheiro KHI, 10 ecrãs mais Q-U e Q-V) passa a código, e a v2 sai com ela.

**Arquitetura:**

- O Tailwind passa para a v4, e os tokens do Figma tornam-se variáveis CSS com os nomes do shadcn.
  
- Os componentes da D7 são copiados do shadcn-svelte (bits-ui por baixo) e ajustados aos tokens.
  
- Os ecrãs trocam os componentes antigos um a um, pela ordem de construção.
  
- No backend, só entra o que o desenho pede: o destaque «novo» e a hora da sincronização.
  

**Tech stack:** Svelte 5 (runes), SvelteKit SPA em Tauri 2, Tailwind 4.3.5 (`@tailwindcss/vite`), shadcn-svelte 1.8.1, bits-ui 2.21.0, tailwind-merge 3.7.0, clsx 2.1.1, tailwind-variants 4.0.2, tw-animate-css 1.4.0, svelte-sonner 1.2.3, Literata (Fontsource, OFL), Vitest 4, Rust com rusqlite.

**Spec:** `khi-ui-redesign/DECISIONS.md`, fora do git. As secções são citadas pelo título: D1 a D8, «Fundações», «Componentes (D7) · N», «Ecrãs · N», «Âmbito da v2». Inventário: `khi-ui-redesign/COMPONENTES-INVENTARIO.md`. O critério de aceitação de cada ecrã são os nós do Figma, em Claro e em Escuro, indicados na Fase 5.
## Âmbito deste plano
O redesign tem sete fases que dependem umas das outras.

- A **Fase 1** está detalhada abaixo, task a task.
  
- Cada fase seguinte ganha as suas tasks neste mesmo ficheiro quando chegar a vez dela. O Bruno revê-as antes do código, como nesta revisão.
  
- A ordem e as interfaces de cada fase já ficam fixadas aqui.
  

| Fase | O que entrega | Pode sair sozinha? |
| --- | --- | --- |
| 0   | Linha de base verde na worktree | sim (sem commit) |
| 1   | Tailwind v4, tokens do Figma, tipografia e base do shadcn-svelte. A interface antiga continua igual | sim |
| 2   | Os 24 componentes da D7 (níveis 0 a 4), cada um com testes | sim, os componentes ficam sem uso |
| 3   | Backend: destaque «novo», livro aberto e hora da sincronização | sim |
| 4   | Janela: barra `Overlay` e Definições numa janela própria (D1) | sim |
| 5   | Os 10 ecrãs, por moldura: 1 → 4 → 5 → 2 → 3 → 6 → 7, 8, 9 → 10. Paragem para aprovação em cada ecrã | ecrã a ecrã |
| 6   | Menus, textos em inglês e release: versão, notas e teste do updater | é a release |
## Restrições globais
- **Ramo:** `feat/redesign`, na worktree `.worktrees/redesign`. O checkout principal fica em `feat/updater`. Nunca mudar de ramo, nem fazer stash ou reset.
  
- **Commits:** um por task, com mensagem convencional e o trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. O trailer do Copilot App sai (Bruno, na revisão: «retira»). Push e PR só com o «sim» do Bruno.
  
- **macOS mínimo: 13.3** (`bundle.macOS.minimumSystemVersion`). O Tailwind v4 precisa do Safari 16.4 («Âmbito da v2»).
  
- **Nenhuma release sai do** `main` **com o updater e o mínimo abaixo de 13.3.**
  
  - A v1.3.0 publicada não tem updater, por isso quem está no macOS 11 ou 12 não recebe a v2 sozinho.
    
  - O `main` já tem o updater, com o mínimo em 11.0. Uma 1.3.x feita a partir dele daria o updater a esses Macs, que depois receberiam a v2 e deixariam de abrir a app.
    
  - O endpoint do updater não sabe a versão do sistema, por isso não os consegue filtrar.
    
- **Modo escuro por classe:** o `settings` store põe a classe `dark` no `<html>` (D5: Claro, Escuro ou Sistema). Em v4 isto exige `@custom-variant dark (&:where(.dark, .dark *));`.
  
- **Tokens:** a fonte é a exportação das variáveis do Figma, com os valores resolvidos por modo, e não a prosa do DECISIONS. Nenhum componente leva um hex literal. Exceções escritas: os semáforos e o raio de 10 da janela («Ecrãs · 1»).
  
- **Nomes do Figma no CSS:** `var(--nome)`, com `/` passado a `-` (por exemplo, `cover/verde` → `--cover-verde`), como no código WEB das variáveis.
  
- **Diferenças para o shadcn** («Fundações»; P7):
  
  - nos menus, o item realçado usa `primary`, não `accent`;
    
  - o Botão Secundário é a variante `outline`;
    
  - não há botão fantasma com texto. Cada componente copiado tem de ser editado para isto.
    
- **Fontes:** a interface usa a fonte do sistema (`-apple-system, BlinkMacSystemFont, system-ui`); a SF Pro não é embutida. A Literata é embutida (OFL) e serve os destaques e o texto das capas (Tipo 2, Capas 1).
  
- **Textos:** cada texto novo entra em `pt.json` e em `en.json` no mesmo commit. Nunca fica texto escrito diretamente no código.
  
- **Acessibilidade:** cada componente responde a `prefers-contrast: more` (Tema 3) e a `prefers-reduced-motion: reduce` (D6: só fade), e passa a revisão de foco e VoiceOver («Revisão · Foco, VoiceOver e Reduzir transparência»).
  
- **No fim de cada task tem de passar:**
  
  - `npx vitest run`;
    
  - `npm run check`;
    
  - `npm run build`;
    
  - `cargo test`, em `src-tauri/` e em background, quando a task mexe no Rust.
    
- **Verificação visual:** só com `npm run dev:app`, que usa o identificador `com.bruno.khi.dev` e a pasta Dev. Antes de lançar, explicar ao Bruno o que vai abrir. O `KoboReader.sqlite` pessoal nunca é lido.
  
## Review Focus
Casos que nenhuma task testa por si e que mais provavelmente afetam quem usa o Khi. O teste de cada um está na task indicada.

1. **Tema Escuro escolhido nas Definições com o macOS em Claro.** As variantes `dark:` têm de seguir a classe, não o `prefers-color-scheme`. _Task 1._
  
2. **Interface antiga durante a transição.** Entre a Fase 1 e a Fase 5, os componentes antigos continuam a usar `neutral-*` com os valores do `tailwind.config.js`. A paleta neutra do Tailwind v4 não os substitui. _Task 1._
  
3. `cn()` **a juntar um estilo de texto e uma cor.** O tailwind-merge trata `text-body` como cor e apagaria o `text-foreground`. Os estilos de texto do Khi entram na configuração do `cn()`. _Task 4._
  
4. **Contraste aumentado.** O desativado sobe para `#636366` no Claro e `#8E8E92` no Escuro («Fundações»). _Task 2._
  
5. **Reduzir movimento.** As distâncias de entrada passam a 0, e os tempos de fade ficam. _Task 2._
  
## Decisões deste plano
- **D1. «Novo»** (Bruno: «Quando abres o livro»; ver «Âmbito da v2»). Um destaque é novo se chegou à Biblioteca numa sincronização depois da última abertura do livro. Exportar não muda nada. Implementação na Fase 3. As três regras seguintes foram confirmadas pelo Bruno a 2026-11-18, todas na opção recomendada:
  
  - a primeira sincronização de um leitor (com a Biblioteca dele ainda vazia) não marca nada como novo. A regra é por leitor e não por Kobo: o segundo Kobo de um leitor traz destaques que a Biblioteca nunca viu, e esses têm de ficar novos;
    
  - os destaques anteriores à migração não ficam novos;
    
  - o «desde 9 nov.» é a data da sincronização mais antiga que trouxe destaques ainda por ver.
    
- **D2. Abrir o livro** (confirmada pelo Bruno a 2026-11-18). O Detalhe recebe os destaques com a marca «novo» e logo a seguir chama `markBookOpened`. As marcas ficam à vista até sair do livro, porque o ecrã usa o que recebeu ao abrir.
  
- **D3. Sem galeria de componentes** (Bruno, 2026-11-18: «Não: comparo no próprio ecrã da app»). A comparação com o Figma faz-se na app, com `npm run dev:app`. Na Fase 1 a interface antiga não muda, por isso os tokens e a tipografia verificam-se pelos testes de contrato com a exportação do Figma. Cada componente da Fase 2 tem testes, e a comparação visual em Claro e Escuro faz-se quando o componente entra no seu primeiro ecrã, na Fase 5.
  - Rejeitada: uma rota `/dev/componentes`, só em desenvolvimento, com cada componente em todos os estados e os dois temas lado a lado.
  
- **D4. Pendente de design** criado pela D1: o ecrã 8 tem de ser revisto no Figma antes da Fase 5, com 3 opções, um cartão e a recomendação primeiro. **Fechada a 2026-11-21** pela ronda Q-Y (Figma `137:34168`, Bruno: «Y1 · Botão e aviso»); ver a Task 47.
  
  - A revisão cobre o cabeçalho e não só as etiquetas: depois de exportar, ele continua em «Novos».
    
  - Cobre também o «Exportar N livros», que volta a contar livros já exportados enquanto não forem abertos.
    
## Estrutura de ficheiros (Fase 1)
| Ficheiro | Responsabilidade |
|---|---|
| `vite.config.ts` | Junta o plugin `@tailwindcss/vite` |
| `src/app.css` | `@import "tailwindcss"`, a variante `dark`, a paleta `neutral` antiga e o import dos tokens |
| `src/lib/styles/tokens.css` | As variáveis do Figma por modo, com contraste aumentado, movimento reduzido e o `@theme inline` |
| `src/lib/styles/typography.css` | `@font-face` da Literata e um `@utility` por estilo de texto do Figma |
| `design/tokens.json`, `design/text-styles.json` | A exportação do Figma, que é a fonte de verdade dos testes |
| `src/lib/styles/*.test.ts` | Testes de contrato entre o CSS e a exportação |
| `components.json`, `src/lib/utils.ts` | Configuração do shadcn-svelte e `cn()` |
| `tailwind.config.js`, `postcss.config.js` | Apagados |

## Estrutura de ficheiros (Fase 2)
| Ficheiro | Responsabilidade |
|---|---|
| `src/lib/components/ui/<nome>/` | Um componente por pasta, com `index.ts` e `<nome>.test.ts` |
| `src/lib/components/ui/ui-rules.test.ts` | Regras comuns (sem cores literais nem classes interpoladas, só `lucide-svelte`, variantes declaradas, par `motion-reduce:`) |
| `src/lib/test/css.ts`, `src/lib/test/disabled.ts` | Ajudas só de teste: CSS compilado com o `app.css` real, e o desativado inerte; fora do `@source` |
| `design/components-sample.json` | Ligações do Figma de três nós de risco, exportadas pelo coordenador («Proposta», versão pequena) |
| `src/lib/components/ui/menu/menu-classes.ts` | Superfície e item de menu, partilhados pelo Pop-up, o Menu e o Título-menu |
| `src/lib/styles/shadcn-variants.css` | As variantes `data-*` do estilo vega |
| `src/lib/styles/components.css` | `@utility focus-ring` |
| `design/effects.json` | Os quatro estilos de sombra do Figma |
| `design/accent-tones.json`, `src/lib/accent/` | Tabela aprovada de tons de cada cor de destaque, com a origem de cada valor, e a sua aplicação |

* * *
## Fase 0 · Linha de base
### Task 0: worktree pronta e verde
- [x] 
  
  **Passo 1:** commit deste plano, depois da aprovação do Bruno (`docs: redesign implementation plan`). O `@tailwindcss/upgrade` da Task 1 recusa correr com a árvore suja. Depois, `npm ci` na worktree.
  
- [x] 
  
  **Passo 2:** correr `npx vitest run` (215 testes, todos a passar), `npm run check` (0 erros) e `npm run build`. Em background, `cargo test` em `src-tauri/`, com tudo verde.
  
- [x] 
  
  **Passo 3 (saltado, Bruno 2026-11-18):** ~~capturas de referência com `npm run dev:app`~~. A Biblioteca Dev está vazia e a app não tem modo simulado, por isso sem Kobo só se vê «No Kobo connected». Além disso, o Computer Use não grava ficheiros. A Task 1 verifica-se com o Vitest e pela vista do Bruno.
  

* * *
## Fase 1 · Tailwind v4, tokens e base do shadcn-svelte
### Task 0b: harness de paridade visual (Bruno, 2026-11-18: «Sim, harness com Playwright WebKit»)
**Ficheiros:** criar `tests/visual/` (harness, mocks do IPC, cenários, comparador, `allowlist.json` e a linha de base) e `playwright.config.ts`; juntar o `@playwright/test`, com versão fixa, e o script `test:visual`. O código da app não muda.

- [x] **Passo 1:** o harness serve o build de produção e corre-o no Playwright WebKit, com o IPC do Tauri simulado antes de a app carregar. Uma chamada de IPC desconhecida faz o teste falhar, mesmo que a app a apanhe.
- [x] **Passo 2:** os cenários são a Biblioteca sem Kobo, a grelha, a lista, o Detalhe e as Definições. Correm em Claro, Escuro escolhido com o macOS em Claro, e Sistema com o macOS em Escuro, mais o contraste aumentado e o movimento reduzido. A viewport, o DPR, o idioma, o fuso e o relógio ficam fixos, e espera-se pelas fontes.
- [x] **Passo 3:** o harness regista os estilos calculados (com `::before`, `::after`, `::placeholder` e o foco por teclado), as caixas dos elementos e uma captura. As cores normalizam-se para RGBA.
- [x] **Passo 4:** a linha de base é tirada na árvore intacta, e duas corridas seguidas dão zero diferenças. Um teste de controlo muda uma cor e confirma que o comparador a apanha.
- [x] **Passo 5:** revisão independente (GPT‑6.2 Sol), os quatro comandos verdes e o commit `test(ui): visual parity harness with WebKit baseline`.

A partir daqui, o critério de «sem mudança visual» das Tasks 1 a 4 é o `npm run test:visual` sem diferenças fora da `allowlist.json`, e cada entrada da allowlist leva a sua razão.

**Resultado (2026-11-18):** 63 capturas e 10 controlos. Três revisões do GPT‑6.2 Sol: as duas primeiras encontraram falsas passagens (foco, hover, seleção, separador Atualizações, fotogramas das animações), todas corrigidas. Juntaram-se capturas no tamanho mínimo da janela e corrigiu-se uma falha intermitente de 1 px no scroll. 5 corridas limpas seguidas. A 3.ª revisão deixou uma lacuna média, que o Bruno aceitou como conhecida: uma alteração que só impeça o scroll do painel enquanto há foco não é apanhada (ver Limitations no README). O `bun.lock` já estava desatualizado e fica para um commit à parte.

### Task 1: Tailwind v4 sem mudança visual
**Ficheiros:**

- alterar `package.json`, `vite.config.ts`, `src/app.css` e `src-tauri/tauri.conf.json`;
  
- apagar `tailwind.config.js` e `postcss.config.js`;
  
- criar `src/lib/styles/app-css.test.ts`.
  

**Interfaces que produz:** classes `neutral-50` a `neutral-950` com os valores antigos; `dark:` por classe.

- [x] 
  
  **Passo 1: testes que falham** (`app-css.test.ts`, que lê os ficheiros com `fs`):
  
  - `dark_variant_follows_class`: `app.css` contém `@custom-variant dark (&:where(.dark, .dark *));`;
    
  - `old_neutral_palette_is_kept`: dentro do `@theme`, `--color-neutral-500: #6B7280`, `--color-neutral-600: #525252` e `--color-neutral-900: #171717` (os 11 valores do `tailwind.config.js` atual, um `expect` por valor);
    
  - `macos_minimum_is_13_3`: `tauri.conf.json` › `bundle.macOS.minimumSystemVersion === "13.3"`.
    
  
- [x] 
  
  **Passo 2:** `npx vitest run src/lib/styles/app-css.test.ts` falha nos três.
  
- [x] 
  
  **Passo 3:** com a árvore limpa, correr `npx @tailwindcss/upgrade@4.3.5`. Rever o diff linha a linha, com atenção a três pontos:
  
  - trocas de nome do v4: `outline-none` → `outline-hidden`, `shadow-sm` → `shadow-xs`, `rounded` → `rounded-sm`;
    
  - a cor por omissão de `border` passou a `currentColor`: repor `border-neutral-200` onde a classe ficou sem cor;
    
  - o `ring` passou de 3 px para 1 px. Depois, `@tailwindcss/vite` no `vite.config.ts` e `minimumSystemVersion` em `"13.3"`. Retirar `postcss` e `autoprefixer` das dependências, se nada mais as usar.
    
  
- [x] 
  
  **Passo 4:** os testes do Passo 1 passam, e passam também os quatro comandos das restrições globais.
  
- [x] 
  
  **Passo 5:** o Bruno abre a app com `npm run dev:app` e confirma à vista que a interface, em Claro e Escuro, não mudou (sem capturas de referência; ver a Task 0). Mudar o tema nas Definições com o macOS em Claro também tem de funcionar.
  
- [x] 
  
  **Passo 6:** commit `build(ui): migrate to Tailwind v4 and require macOS 13.3`.

**Resultado (2026-11-18):** harness 73/73 sem diferenças nem entradas na allowlist; a ferramenta de migração deixou cerca de 15 diferenças, corrigidas à mão em `app.css` (paleta usada fixada nos hex do v3, fonte, transições, outline, degradê, bordas e placeholder por omissão, `dark:focus` em dois campos). A revisão do GPT‑6.2 Sol apanhou o «copiado» a meia opacidade com o rato na linha (`group-hover` do v4 com menos especificidade), corrigido com `@custom-variant group-hover`. O CSS cresceu de 5,7 para 7,3 kB gzip, sobretudo pela paleta fixada, que a Task 2 substitui. Bruno confirmou à vista com o Kobo ligado.

### Task 2: tokens do Figma
**Ficheiros:**

- criar `design/tokens.json`, `src/lib/styles/tokens.css` e `src/lib/styles/tokens.test.ts`;
  
- alterar `src/app.css`, para importar os tokens.
  

**Interfaces que produz** (pelos espaços de nomes do Tailwind v4):

- [x] 
  
  **cores:** as cores da coleção Cor ficam em `:root` e `.dark` com o nome do Figma (`--background`, `--primary`, …). O `@theme inline` liga cada uma a `--color-<nome>: var(--<nome>)`, o que dá `bg-background`, `text-foreground`, `border-border`, `bg-primary`, `text-tertiary-foreground`, `bg-cover-verde` e afins. _Nota (exportação de 2026-11-18): a coleção cresceu para 58 cores, amostras `swatch` incluídas (`tooltip*`, `destructive-text`, `disabled-mark`, `switch-thumb`, `segmented-selected-count`, …); o `design/tokens.json` é a fonte. `ring-opacity` (0,5) não é cor: fica só no `:root`, sem `--color-`;_
  
- [x] 
  
  **raios:** `--radius-control`, `--radius-group`, `--radius-menu`, `--radius-cover`, `--radius-badge`, `--radius-checkbox`, `--radius-segment` e `--radius-thumb` diretamente no `@theme static`, o que dá `rounded-control` e afins. O `static` põe-nos sempre no `:root`, por isso `var(--radius-control)` continua a funcionar;
  
- [x] 
  
  **medidas:** `--size-control`, `--size-toolbar`, `--size-icon`, … ficam no `:root` com o nome do Figma. O v4 não tem o espaço `--size-*`, por isso as que servem de altura ou tamanho ganham um alias no `@theme inline` (`--spacing-control: var(--size-control)`, `--spacing-toolbar`, `--spacing-icon`, …), o que dá `h-control`, `size-icon` e afins;
  
- [x] 
  
  **movimento:** durações e distâncias no `:root`; as três curvas em `--ease-<nome>` (no mesmo `@theme static`), o que dá `ease-<nome>`. `ease-out` e `ease-in-out` substituem as curvas do Tailwind; a interface antiga passou a `ease-[cubic-bezier(0.4,0,0.2,1)]`, a curva anterior;
  
- [x] 
  
  **spacing:** a coleção do Figma segue a escala de 4 px, a mesma do `--spacing` do v4, por isso não se redefine.
  
- [x] 
  
  **Passo 1:** exportar do Figma (figma-console, ficheiro KHI, cuja chave está no DECISIONS) as coleções Cor (`47:32143`, modos Claro e Escuro), Raio (`47:32188`), Medidas (`47:32194`), Movimento (`47:32205`) e Spacing (`6:1053`). Os valores vão resolvidos (sem alias) para `design/tokens.json`, com esta forma: `{ "cor": { "claro": { "background": "#FFFFFF", … }, "escuro": { … } }, "raio": { "control": 6, … }, "medidas": { … }, "movimento": { … }, "spacing": { … } }`.
  
- [x] 
  
  **Passo 2: testes que falham** (`tokens.test.ts`, que lê `tokens.css` como texto e separa os blocos `:root`, `.dark`, `@media (prefers-contrast: more)` e `@media (prefers-reduced-motion: reduce)`):
  
  - `every_light_color_matches_figma`: para cada chave de `cor.claro`, o `:root` tem `--<chave>` com o mesmo valor (sem distinguir maiúsculas);
    
  - `every_dark_color_matches_figma`: o mesmo, para `cor.escuro` e `.dark`;
    
  - `no_color_outside_figma`: o `:root` e o `.dark` não definem cores que não estejam no JSON, e os blocos `@media` só redefinem variáveis que existem no `:root`;
    
  - `radii_and_sizes_in_px`: o `@theme` tem `--radius-control: 6px` e as restantes chaves de `raio`; o `:root` tem `--size-control: 28px`, `--size-toolbar: 52px` e as restantes chaves de `medidas`; e o `@theme inline` tem `--spacing-control: var(--size-control)`;
    
  - `figma_spacing_is_tailwind_scale`: cada valor de `spacing` no JSON é o índice vezes 4 (por exemplo, `spacing/6` vale 24), por isso `p-6` corresponde a `spacing/6`;
    
  - `increased_contrast_raises_disabled` (Review Focus 4): no bloco de contraste aumentado, a variável do texto e dos ícones desativados (o nome sai da exportação do Passo 1 e fica numa constante do teste) vale `#636366`, e no `.dark` desse bloco vale `#8E8E92`;
    
  - `reduced_motion_drops_distance` (Review Focus 5): no bloco de movimento reduzido, `--distance-enter: 0px`, e as durações de fade iguais às do `:root`.
    
  
- [x] 
  
  **Passo 3:** `npx vitest run src/lib/styles/tokens.test.ts` falha porque o ficheiro não existe.
  
- [x] 
  
  **Passo 4:** escrever `tokens.css` a partir do JSON:
  
  - `:root` e `.dark`;
    
  - os dois blocos `@media`;
    
  - o `@theme`, com os raios e as curvas;
    
  - o `@theme inline`, com as cores e os aliases das medidas. Nenhuma variável do `@theme inline` pode apontar para si mesma. As curvas de Movimento entram como `cubic-bezier(...)`, copiadas do texto da variável.
    
  
- [x] 
  
  **Passo 5:** os testes passam, a interface antiga não muda (os tokens ainda não são usados) e passam os quatro comandos.
  
- [x] 
  
  **Passo 6:** commit `feat(ui): design tokens from Figma as CSS variables`.
  
**Resultado (2026-11-18):** 58 cores (Claro/Escuro), 8 raios, medidas com alias de spacing e 3 curvas, todos do `design/tokens.json`; harness 73/73 sem diferenças (os tokens ainda não são usados); 10 testes de tokens. A revisão do GPT‑6.2 Sol encontrou dois buracos nos testes (ordem dos blocos de contraste e movimento reduzido; última declaração sem `;`), fechados e provados por mutação. CSS 7,3 → 8,3 kB gzip.

### Task 3: tipografia
**Ficheiros:**

- criar `design/text-styles.json`, `src/lib/styles/typography.css` e `src/lib/styles/typography.test.ts`;
  
- juntar `@fontsource-variable/literata` 5.3.0 às dependências. Se não tiver o eixo `opsz`, usar `@fontsource/literata` 5.3.0 com os pesos 400 e 500 e o itálico 400.
  

**Interfaces que produz:** as utilidades `text-title-1`, `text-title-3`, `text-body`, `text-body-medium`, `text-callout`, `text-subheadline`, `text-subheadline-semibold`, `text-reading` (Leitura/Destaque), `text-cover-title`, `text-cover-title-sm` e `text-cover-author`. A lista exata sai da exportação dos estilos de texto, que são 11.

**Nota (execução):** a exportação tem 13 estilos, não 11: entram também `text-body-semibold` e `text-callout-medium` (ver `_meta.exceptions` em `design/text-styles.json`). O `@fontsource-variable/literata` 5.3.0 tem o eixo `opsz` (7–72, confirmado no `fvar` dos woff2), por isso não é preciso o `@fontsource/literata`. Só os subconjuntos latin e latin-ext (normal e itálico, ~404 kB) entram no bundle. O `--font-sans` fica com a pilha da v3 até à Fase 5: trocá-lo dá 10 625 diferenças de `font-family` calculado em 63 capturas (sem diferenças de caixa nem de píxeis). A pilha do sistema está em `--font-system`, e é essa que os estilos de interface usam. Na Fase 5, quando a interface antiga sai, o `--font-sans` passa para a pilha do sistema (aprovado pelo coordenador). A licença OFL da Literata (aviso de copyright e texto, OFL §2) vai em `static/licenses/Literata-OFL.txt`, que entra no `build/` e, por isso, nos recursos embutidos da app.

- [x] 
  
  **Passo 1:** exportar os estilos de texto do Figma (tamanho, entrelinha, peso, família e estilo) para `design/text-styles.json`.
  
- [x] 
  
  **Passo 2: testes que falham** (`typography.test.ts`):
  
  - `every_text_style_has_a_utility`: cada estilo do JSON tem um `@utility text-<nome>` com o mesmo `font-size`, `line-height` e `font-weight`;
    
  - `reading_uses_literata_with_optical_sizing`: `text-reading` usa `font-family: "Literata Variable"` (ou `"Literata"`, conforme o pacote) e `font-optical-sizing: auto`;
    
  - `interface_uses_system_font`: o `@theme` define `--font-sans` a começar por `-apple-system`.
    
  
- [x] 
  
  **Passo 3:** implementar `typography.css`. Confirmar no pacote o eixo `opsz`; se faltar, registar no DECISIONS que o tamanho ótico cai e avisar o Bruno.
  
- [x] 
  
  **Passo 4:** os testes passam e passam os quatro comandos.
  
- [x] 
  
  **Passo 5:** commit `feat(ui): system font, embedded Literata and Figma text styles`.
  
**Resultado (2026-11-18):** 13 estilos do Figma em `text-<nome>`; Literata 5.3.0 com eixo `opsz` (latin e latin-ext, normal e itálico, cerca de 400 KB), licença OFL em `static/licenses/`; `--font-system` para a interface e `--font-sans` só na Fase 5 (aprovado). Harness 73/73 sem diferenças. A revisão do GPT‑6.2 Sol apanhou a licença em falta e testes que passavam com a folha desligada; corrigidos e provados por mutação.

### Task 4: base do shadcn-svelte e `cn()`
**Ficheiros:**

- criar `components.json`, `src/lib/utils.ts` e `src/lib/utils.test.ts`;
  
- dependências: bits-ui 2.21.0, tailwind-merge 3.7.0, clsx 2.1.1, tailwind-variants 4.0.2 e tw-animate-css 1.4.0.
  

**Interfaces que produz:**

- [x] 
  
  `cn(...inputs: ClassValue[]): string`, em `$lib/utils`;
  
- [x] 
  
  aliases do shadcn-svelte: `components` → `$lib/components`, `ui` → `$lib/components/ui`, `utils` → `$lib/utils`;
  
- [x] 
  
  o `@import "tw-animate-css"` em `app.css`.
  
- [x] 
  
  **Passo 1: testes que falham** (`utils.test.ts`):
  
  - `later_padding_wins`: `cn('px-2', 'px-4') === 'px-4'`;
    
  - `text_style_and_color_coexist` (Review Focus 3): `cn('text-body', 'text-foreground')` contém as duas classes;
    
  - `later_text_style_wins`: `cn('text-body', 'text-callout') === 'text-callout'`.
    
  
- [x] 
  
  **Passo 2:** `npx shadcn-svelte@1.8.1 init`. O `init` escreve no `app.css` variáveis próprias em `oklch`. Apagam-se todas, porque as do Khi vêm de `tokens.css`, e o diff do `app.css` não pode deixar nenhuma.
  
- [x] 
  
  **Passo 3:** `cn()` com `extendTailwindMerge`: os estilos de texto da Task 3 entram no grupo `font-size`.
  
- [x] 
  
  **Passo 4:** os testes passam e passam os quatro comandos.
  
- [x] 
  
  **Passo 5:** commit `build(ui): shadcn-svelte base and cn() aware of Khi text styles`.
  
- **Resultado (2026-11-19):**
  
  - O `init` 1.8.1 pede um preset; correu com `--preset vega --base-color neutral --no-deps-install` e os aliases por flag. Além das variáveis `oklch`, do `@layer base` e das cores `sidebar`/`chart`, pôs no `app.css` `@import "shadcn-svelte/tailwind.css"` e a Inter, e no `package.json` `cn`, `shadcn-svelte`, `@lucide/svelte` e `@fontsource-variable/inter`. Tudo revertido: o `cn()` usa clsx e tailwind-merge, como neste plano. O `components.json` fica como o `init` o escreveu (estilo `vega`, `iconLibrary: lucide`).
    
  - **Para a Fase 2:** os componentes do estilo `vega` usam as variantes `data-open:`, `data-closed:`, `data-checked:`, etc., que vêm de `shadcn-svelte/tailwind.css`. Quando o primeiro componente as pedir, ou se declaram em `app.css` ou se importa esse ficheiro (com o `shadcn-svelte` como dependência).
    
  - O `cn()` também conhece os raios, as medidas (`h-control`, `size-icon`) e o `ease-hover` do Figma; um teste compara as chaves com `design/text-styles.json` e `design/tokens.json`.
    
  - O `tw-animate-css` acrescenta 1,7 kB ao CSS (0,2 kB em gzip), só `@property` e variáveis `--tw-enter-*`/`--tw-exit-*`; o harness visual fica igual.
    

**Resultado (2026-11-18):** `cn()` conhece os 13 estilos de texto, os raios, as medidas e as curvas do Figma, com um teste que falha se divergir dos JSON; o `init` (preset vega) teve os efeitos laterais revertidos e o `app.css` só ganhou o `tw-animate-css`. Harness 73/73 sem diferenças; CSS +219 B gzip. Revisão do GPT‑6.2 Sol sem problemas.

**Paragem:** o Bruno aprova a Fase 1, e as tasks da Fase 2 são escritas aqui.

* * *
## Fase 2 · Componentes da D7
- **Ordem:** a do inventário, um nível de cada vez, em `src/lib/components/ui/<nome>/`. Um desvio: o Tooltip passa para a frente do nível 1, porque os desativados do Botão, da Caixa e do Pop-up precisam dele (Componentes 5).
  - **Base:** Task 5 (variantes, sombras, anel, ajudas de teste) e Task 6 (contraste aumentado, a partir dos modos do Figma).
  - **0:** Task 7, Ícone.
  - **1:** Tasks 8 a 14: Tooltip, Etiqueta, Botão, Botão de toolbar, Caixa, Campo de texto e Pop-up.
  - **2:** Tasks 15 a 23: Grupo de vista, Segmentado, Menu, Linha e Grupo de formulário com Switch, Separador das Definições, investigação da cor de destaque, Amostra de cor, Aviso e Janela modal.
  - **3:** Tasks 24 a 28: Capa e Miniatura, Cartão do livro, Linha da lista e Cabeçalho de coluna, Destaque e Cabeçalho da Biblioteca.
  - **4:** Tasks 29 e 30: Título-menu e Barra da janela.
  - **Dependências que mudam a ordem:** as Tasks 12, 13, 15, 16, 18, 19 e 23 usam `input-strong`, `switch-on` ou `scrim`, que chegam com a Task 6. A Task 21 espera pela Paragem da Task 20 e pela tabela de tons (Questão 1).
- **Nenhum ecrã usa os componentes nesta fase.** O harness visual fica sem diferenças em todas as tasks. A comparação com os nós do Figma, em Claro e Escuro, é na app, quando o componente entra no seu primeiro ecrã (Fase 5; D3). O `TooltipProvider` e o `Toaster` só se montam nos testes; a ligação à raiz da app é feita pelo primeiro ecrã que os usa.
- **Revisão por lotes.** Cada task tem o seu commit e o seu número; a revisão (GPT‑6.2 Sol, verificada pelo coordenador) junta-as:
  - 7 + 9 + 13;
  - 8 + 10 + 11, revisto antes das tasks que os usam;
  - 12 + 18;
  - 14 + 17;
  - 15 + 16 + 19;
  - 20 é uma paragem de decisão, não um lote;
  - 21, 22 e 23, cada uma sozinha;
  - 24 + 25 + 26;
  - 27 e 28, cada uma sozinha;
  - 29 + 30.
- **Regras de todas as tasks da Fase 2:**
  - **Base shadcn:** `npx shadcn-svelte@1.8.1 add <x> -y --no-deps-install`. Depois do `add`:
    - os imports de `@lucide/svelte` passam a `lucide-svelte/icons/<nome>`;
    - o diff do `package.json` só fica com as dependências que a task nomeia (o `add` volta a pedir `@lucide/svelte`);
    - saem as classes `dark:` (os modos vivem em `tokens.css`), as cores com opacidade inventadas (`bg-input/30`, `ring-ring/50`), `shadow-xs` e `aria-invalid:`; entram os tokens abaixo.
  - **Tokens:** só utilitários do `@theme`, com os nomes do Figma (`/` passa a `-`): `bg-primary`, `rounded-control`, `h-control`, `text-body-medium`, `shadow-sombra-menu`, `duration-hover ease-hover`. `spacing/N` do Figma é `N` no Tailwind (base de 4 px): `spacing/2` = `px-2`, `spacing/0-5` = `p-0.5`. Sem hex, sem `[#…]`, sem `rgb(`. Uma cor que falte vai primeiro para o Figma (decisão do Bruno, 2026-11-18); o `no_color_outside_figma` da Task 2 não se relaxa.
  - **Classes estáticas:** nenhuma classe se constrói com texto (`bg-swatch-${nome}`); os tons vêm de mapas com as classes inteiras, para o Tailwind as encontrar.
  - **Estados** (Componentes 4 e 5):
    - hover com `transition-colors duration-hover ease-hover`, e só quando não está desativado (`not-data-disabled:hover:`);
    - premido com `active:`, sem transição;
    - foco com `focus-visible:focus-ring` (Task 5), sem animação, nunca no clique do rato;
    - **desativado no próprio primitivo**, não só nos callbacks: o Bits UI muda o estado interno sozinho (a Caixa muda com o Espaço). Cada task diz como: `readonly` do Bits UI onde existe (Caixa, Amostras), uma ligação de função que recusa a escrita onde não existe (Switch, abertura do Pop-up), `readonly` nativo no Campo, `aria-disabled` e um clique ignorado no Botão. O controlo fica na ordem do Tab, com `aria-disabled="true"` e `data-disabled`, e mostra `disabledReason` num Tooltip ao receber o foco, ligado por `aria-describedby`. **Exceções:** os itens desativados dos menus e o segmento com contagem 0 saem da ordem do Tab e das setas, como no macOS (Tasks 16 e 17).
    - os testes do desativado usam `expectDisabledInert` (Task 5): depois do Espaço, do Return, do clique no controlo e do clique no rótulo, o valor ligado não muda, o pop-up não abre e o callback foi chamado 0 vezes; e o motivo lê-se com o foco.
  - **Contraste aumentado:** os modos «Claro · Contraste» e «Escuro · Contraste» do Figma, pela Task 6; os contornos de 1 px por dentro (Tema 3) são variáveis do Figma desde 2026-11-19 (decisão do Bruno): `contrast-outline` (botões de ícone), `contrast-outline-tint` (selecionado e etiquetas), `contrast-outline-primary` (Principal) e `contrast-outline-strong` (segmento e separador escolhidos, 2026-11-19). São transparentes nos modos normais e têm cor nos de contraste, e o componente desenha sempre `inset-ring inset-ring-<variável>`, sem `contrast-more:`. Os contornos que ainda não estão no Figma (item da barra lateral) entram no Figma, como variável, na task de cada um; a vista usa os do Botão de toolbar e o grupo usa `contrast-outline`.
  - **Movimento** (Movimento 6): com `motion-reduce:` saem o deslocamento, a escala e a rotação; ficam os fades e as mudanças de cor.
  - **Textos:** chaves novas em `ui.<componente>` (ou nas secções que já existem, como `book.*`), em `pt.json` e `en.json` no mesmo commit, com plurais `_one`/`_other`. Os testes verificam o texto aprovado, palavra a palavra.
  - **Testes** (`<nome>.test.ts`, ao lado do componente; o conteúdo dos portais do Bits UI procura-se com `screen`):
    - **no jsdom:** papéis, nomes, valores ligados, sequências de teclado (`@testing-library/user-event`), temporizadores, e as classes que levam cada ligação do Figma (uma ligação, uma classe);
    - **no ecrã, não no jsdom:** área de clique, quebra de linha, forma do anel, toque do ponteiro, fade sem deslocamento e o que o VoiceOver diz. Cada task lista-os numa linha **Verificar no ecrã**, que entra na comparação do primeiro ecrã (Fase 5; D3). Não se escrevem testes jsdom a fingir estas coisas;
    - não há testes que só confirmam que algo saiu (como «o `badgeVariants` já não existe»): o `npm run check` apanha uma variante que não existe.

### Task 5: base da Fase 2
**Ficheiros:**
- criar `src/lib/styles/shadcn-variants.css`, `src/lib/styles/components.css`, `design/effects.json` e `src/lib/styles/effects.test.ts`;
- criar `src/lib/test/css.ts` (o `compileAppCss` que hoje vive em `typography.test.ts`, mais `selectorFor`), `src/lib/test/disabled.ts` e `src/lib/components/ui/ui-rules.test.ts`;
- alterar `src/app.css` (dois imports e as exclusões do `@source`), `src/lib/styles/typography.test.ts` (passa a importar o `compileAppCss`), `src/lib/styles/tokens.css` (sombras no `@theme`) e `package.json` (`@testing-library/user-event` 14.6.13, versão exata, em devDependencies).

**Interfaces que produz:**
- as variantes do estilo vega (nota da Task 4): as `@custom-variant` de `shadcn-svelte/tailwind.css` 1.8.1 que os componentes usam, copiadas com a licença MIT (`data-open:`, `data-closed:`, `data-checked:`, `data-unchecked:`, `data-disabled:`, `data-active:`, `data-horizontal:` e `data-vertical:`); o pacote `shadcn-svelte` não entra, porque traz 940 kB para oito linhas. As variantes de presença que o Tailwind 4 já tem (`data-highlighted:`, `data-selected:`) não se copiam;
- `@source not './**/*.test.ts'` e `@source not './lib/test/**'` em `app.css` (substituem as exclusões ficheiro a ficheiro), para as classes escritas nos testes não esconderem uma classe que falta no componente;
- `shadow-sombra-segmento`, `shadow-sombra-menu`, `shadow-sombra-janela` e `shadow-sombra-aviso`: os quatro estilos de efeito do Figma, que não são variáveis e faltam ao `tokens.json`;
- `focus-ring`: `outline: var(--stroke-ring) solid color-mix(in srgb, var(--ring) calc(var(--ring-opacity) * 100%), transparent)` com `outline-offset: 0`. É `outline` e não `box-shadow` para não apagar as sombras nem os contornos `inset-ring` do contraste aumentado.
  - **Quem tem o foco e quem pinta o anel:** por omissão são o mesmo elemento (`focus-visible:focus-ring`). Quando não são (o Cartão: o `gridcell` tem o foco e o anel abraça a capa ou a moldura de seleção), o elemento com foco é um `group/<nome>` e o elemento pintado usa `group-focus-visible/<nome>:focus-ring`; nenhum antepassado até ao contentor da grelha tem `overflow-hidden`, para o anel não ser cortado;
  - o `outline` segue o raio desde o Safari 16.4 (o WebKit do macOS 13.3); confirma-se na primeira comparação da Fase 5 e, se falhar, passa a `box-shadow` composto com o `--tw-ring-shadow`;
- `src/lib/test/css.ts`: `compileAppCss(candidates)` e `selectorFor(candidate)`, que compila uma classe com o `app.css` real e devolve o seletor; os testes usam-no com `element.matches(selector)` para provar que a variante apanha o atributo que o Bits UI põe mesmo (`data-state="checked"`, `data-highlighted=""`);
- `src/lib/test/disabled.ts`: `expectDisabledInert({ control, label?, read, popup?, callback, user?, settle? })`, que carrega no Espaço, no Return, clica no controlo e no rótulo, espera depois de cada ação (`settle`: microtarefas, `tick()` e 150 ms de temporizadores, avançados com `vi.useFakeTimers()`) e verifica o valor (`read()`), o pop-up fechado, o callback a 0, `aria-disabled`, o foco e o motivo em `aria-describedby`.

- [x] **Passo 1: testes que falham:**
  - `effects.test.ts`:
    - `effects_json_has_four_shadows`;
    - `shadows_match_figma_effects`: deslocamento, desfoque, espalhamento 0 e opacidade de cada `--shadow-sombra-*` iguais aos de `effects.json`.
  - `ui-rules.test.ts`, sobre todos os `.svelte` e `.ts` de `src/lib/components/ui/` que não são testes:
    - `ui_has_no_color_literals`: nem hex (3, 4, 6 ou 8 dígitos), nem `[#`, nem funções de cor (`rgb(`, `rgba(`, `hsl(`, `hsla(`, `oklch(`, `oklab(`, `lab(`, `lch(`, `hwb(`, `color(`); o `color-mix(` de tokens é permitido;
    - `ui_imports_lucide_svelte_only`: nenhum `@lucide/svelte`;
    - `ui_data_variants_are_declared`: cada `data-<x>:` usado está em `shadcn-variants.css` ou é uma variante de presença do Tailwind; nenhuma das copiadas fica sem uso no fim da Fase 2;
    - `ui_has_no_interpolated_classes`: nenhum `${` (nem `{…}` do Svelte) dentro de uma classe de cor, fundo ou contorno, também depois de `/`, `[` ou de variantes (`bg-primary/${o}`, `bg-[var(--swatch-${n})]`);
    - `ui_motion_has_reduced_pair`: cada `animate-*` (menos `animate-in`/`animate-out`), `slide-in`/`slide-out`, `zoom-in`/`zoom-out`, `spin-in`/`spin-out`, e cada `translate`, `scale` ou `rotate` com variante ou em `class:`, tem no mesmo elemento (atributo `class` e diretivas `class:`) um `motion-reduce:` que repõe a mesma propriedade (`animate-none`, `translate-none`/`-0`, `scale-none`/`-100`, `rotate-none`/`-0`, `zoom-in-100`…) com as mesmas variantes de estado (`hover:scale-105` → `motion-reduce:hover:scale-100`), senão a regra do estado ganha;
    - `focus_ring_uses_ring_tokens`: o `@utility focus-ring` usa `--stroke-ring`, `--ring` e `--ring-opacity`, e nenhum valor literal;
    - `test_files_are_not_scanned`: as `sources` do `compileAppCss` excluem `./**/*.test.ts` e `./lib/test/**`; o `Scanner` do Tailwind não lê nenhum teste e uma classe só escrita nos testes não chega ao CSS.
- [x] **Passo 2:** `npx vitest run src/lib/styles/effects.test.ts src/lib/components/ui` falha.
- [x] **Passo 3:** exportar os efeitos com `figma_execute`, só leitura, `fileKey` `nU5CnQTJobxVE8mHMr7iZL`: `figma.getLocalEffectStylesAsync()` → nome, `offset`, `radius`, `spread` e cor de cada `DROP_SHADOW`, gravados em `design/effects.json`. Valores esperados: Segmento 0 1 2 a 12 %, Menu 0 8 24 a 16 %, Janela 0 8 24 a 18 %, Aviso 0 4 16 a 14 %; os mesmos nos dois modos.
- [x] **Passo 4:** as variantes em `shadcn-variants.css`; as sombras no `@theme` estático de `tokens.css` (`--shadow-sombra-menu: 0 8px 24px rgb(0 0 0 / 0.16)`); `@utility focus-ring` em `components.css`; os dois imports e as duas exclusões em `app.css`.
- [x] **Passo 5:** `src/lib/test/css.ts` e `disabled.ts`; `npm i -D -E @testing-library/user-event@14.6.13`.
- [x] **Passo 6:** os testes passam e passam os quatro comandos.
- [x] **Passo 7:** commit `build(ui): data-state variants, Figma shadows, focus ring and test helpers`.
- **Resultado (2026-11-19):** 275 testes (1 saltado até à Task 30), `check` 0, build OK, harness 73/73. Desvios aceites: `@testing-library/user-event` 14.6.11 e não 14.6.13 (o `min-release-age=3` do npm recusou a versão com uma hora); `expectDisabledInert` pede `reason` e aceita `user` e `settle`; o Passo 3 (efeitos do Figma) foi feito pelo coordenador. Revisão do Sol: cinco médios (ajudante sem esperar por reações atrasadas, `\&` escapado no `selectorFor`, cores `hsl`/`oklch` e hex curto, interpolação com `/` e `[`, pares de `motion-reduce` que não anulavam o movimento) e um do coordenador (testes fora de `ui/` lidos pelo Tailwind; agora `@source not './**/*.test.ts'`). Todos corrigidos com testes que falhavam antes.
- **Nota para as tasks seguintes:** o jsdom engana-se com `not-data-disabled:` em `element.matches`; verificar essa variante pela classe. Transforms fixos (sem variante de estado) não contam como movimento.

### Task 6: contraste aumentado a partir dos modos do Figma
**Pré-requisitos, feitos pelo coordenador (não são passos do agente):**
- o Bruno aprovou os valores de contraste (2026-11-18);
- na coleção Cor (`47:32143`) do KHI estão os modos «Claro · Contraste» (`90:0`) e «Escuro · Contraste» (`90:1`) e as variáveis `scrim` (`#00000026` em todos os modos), `input-strong` (= `input` nos modos normais) e `switch-on` (= `primary`, menos no Escuro · Contraste);
- o `design/tokens.json` já foi exportado de novo e está na worktree, sem commit: `cor` tem `claro`, `escuro`, `claro-contraste` e `escuro-contraste`, cada um com 61 cores, e `ring-opacity`; o `_meta.not_in_figma` saiu. Por isso, três testes de `tokens.test.ts` falham de propósito até esta task.

**Ficheiros:** alterar `src/lib/styles/tokens.css` (as três variáveis e o bloco `prefers-contrast: more`) e `src/lib/styles/tokens.test.ts`; `design/tokens.json` entra no commit desta task, tal como o coordenador o exportou.

**Interfaces que produz:**
- `bg-scrim`, `border-input-strong`, `inset-ring-input-strong` e `bg-switch-on`, nos dois modos;
- o bloco `@media (prefers-contrast: more)` inteiro é a diferença entre os modos do Figma, sem valores escolhidos à mão: em `:root`, cada variável de «Claro · Contraste» diferente da de «Claro»; em `.dark`, cada uma de «Escuro · Contraste» diferente da de «Escuro» e ainda as do `:root` de contraste, com o valor de «Escuro · Contraste» (o `:root` também vale em `<html class="dark">` e vem depois do `.dark` base; assim nada do contraste claro passa para o escuro). Hoje dá, Claro / Escuro: `border` e `highlight-line` `#8D8D91` / `#757579`, `highlight-line-new` `#1D1D1F` / `#F5F5F7`, `disabled-foreground` `#636366` / `#8E8E92`, `input-strong` `#858589` / `#838387`, e `switch-on` `#0A84FF` só no Escuro. O `--disabled-foreground` da Review Focus 4 passa a vir daqui;
- os contornos de 1 px por dentro ficam nos componentes (Tema 3; «Revisão · Contraste do que não é texto», Opção 2): `contrast-more:inset-ring-input-strong` no segmento, na vista e no separador selecionados; `primary-tint-foreground` no Botão de toolbar selecionado e nas etiquetas; `primary-foreground` no botão Principal.

- [x] **Passo 1: testes que falham** (`tokens.test.ts`):
  - `contrast_modes_exist_with_every_color`: os quatro modos têm as mesmas chaves;
  - `contrast_block_is_figma_mode_diff`: o bloco tem, em `:root` e em `.dark`, exatamente as variáveis que mudam, com os valores do Figma, e nenhuma outra;
  - `contrast_effective_palettes_are_figma_modes`: aplicadas pela ordem da cascata, as regras dão exatamente «Claro · Contraste» e «Escuro · Contraste»; e há um só bloco `prefers-contrast: more`, só com `:root` e depois `.dark`;
  - `contrast_raises_disabled_as_foundations`: os valores do modo batem com os da Review Focus 4 (`#636366` / `#8E8E92`), que ficam como juiz de fora;
  - `new_colors_come_from_figma`: `scrim`, `input-strong` e `switch-on` em `:root` e `.dark` com os valores do `tokens.json`;
  - os três testes que já falham hoje passam; o `no_color_outside_figma` não se relaxa.
- [x] **Passo 2:** `npx vitest run src/lib/styles/tokens.test.ts` falha.
- [x] **Passo 3:** as três variáveis nos blocos de modo e no `@theme inline`; o bloco de contraste gerado da diferença por um script em `scripts/` (sem dependências novas) e colado em `tokens.css`, com um comentário que aponta para os modos do Figma; o teste do Passo 1 é o que garante que o bloco e o JSON não divergem.
- [x] **Passo 4:** os testes passam e passam os quatro comandos.
- [x] **Passo 5:** commit `feat(tokens): increased-contrast modes and scrim, input-strong, switch-on from Figma`.
- **Resultado (2026-11-19):** 247 testes, `check` 0, harness 73/73. Desvio aceite: sem script em `scripts/`; a diferença calculou-se com `node -e` e o teste é a guarda. Revisão do Sol: dois buracos médios nos testes (regras extra no bloco; fuga de um valor só do Claro para o Escuro). Corrigidos com a verificação da estrutura, o `.dark` com a união das chaves e a paleta efetiva em cascata; verificados por mutação.

### Task 7: Ícone
**Ficheiros:** criar `src/lib/components/ui/icon/icon.svelte`, `index.ts` e `icon.test.ts`. Sem base shadcn.

**Interfaces que produz:** `<Icon icon={Download} size="md" label?="…" class? />` (Componentes (D7) · 0 · Ícones):
- `size`: `sm` 12 (`size/icon-sm`), `md` 16 (`size/icon`), `lg` 20 (`size/icon-lg`);
- traço de 1,333 px em todos os tamanhos (`absoluteStrokeWidth`), cor `currentColor`; a cor vem do pai (`text-muted-foreground`, etc.);
- sem `label`, `aria-hidden="true"`; com `label`, `role="img"` e `aria-label`.

- [x] **Passo 1: testes que falham** (`icon.test.ts`):
  - `decorative_icon_is_hidden`;
  - `labelled_icon_has_img_role`;
  - `sizes_use_figma_tokens`: `size-icon-sm`, `size-icon`, `size-icon-lg`;
  - `stroke_is_1_333_at_every_size`;
  - `figma_icons_exist_in_lucide`: os 22 do Figma (os 21 do ledger, `55:33` a `55:136`, e `copy`, `69:6930`) importam de `lucide-svelte/icons/<nome>`.
- [x] **Passo 2:** `npx vitest run src/lib/components/ui/icon` falha.
- [x] **Passo 3:** o componente.
- [x] **Passo 4:** os testes passam e passam os quatro comandos.
- [x] **Passo 5:** commit `feat(ui): Icon wrapper with Figma sizes and 1.333 stroke`.

**Verificar no ecrã:** o traço igual a 12, 16 e 20.
- **Resultado (2026-11-19):** 281 testes, `check` 0, harness 73/73. Extras: `shrink-0` e um teste da cor herdada do pai. Revisão no lote 7 + 9 + 13.

### Task 8: Tooltip
**Ficheiros:** `npx shadcn-svelte@1.8.1 add tooltip`; adaptar `src/lib/components/ui/tooltip/*`; criar `tooltip.test.ts`.

**Interfaces que produz** (Componentes (D7) · 7 · Tooltip, `55:2128`; Movimento 5):
- `<Tooltip text="Sincronizar com o Kobo" shortcut?="⌘R">{trigger}</Tooltip>` e `<TooltipProvider delayDuration={500} skipDelayDuration={300}>` (o 300 é o valor por omissão do Bits UI; o DECISIONS só diz «há pouco»). Nesta fase o provider só existe nos testes;
- aspeto: altura 24, `px-2`, `gap-4` até ao atalho, `rounded-control`, `bg-tooltip`, `border border-tooltip-border`, `text-callout text-tooltip-foreground`, atalho em `text-tooltip-secondary-foreground`, sem sombra; por baixo do botão, com `sideOffset` 4 (fica para o código, pelo DECISIONS);
- movimento: o primeiro entra com fade de `duration-tooltip` 125 e `ease-out`; o seguinte aparece logo, sem fade; ao sair, desaparece logo (Movimento 5; ver «Discrepâncias resolvidas»). Com Reduzir movimento, o fade fica (só opacidade, como diz o Figma `55:2128` e a regra Movimento 6), e o atraso também;
- abre também com o foco do teclado; o gatilho fica descrito pelo tooltip (`aria-describedby`).

- [x] **Passo 1: testes que falham** (`tooltip.test.ts`, com `vi.useFakeTimers()`):
  - `opens_after_500ms_of_hover`;
  - `does_not_open_before_500ms`;
  - `opens_on_keyboard_focus`;
  - `next_tooltip_opens_without_delay`;
  - `closes_immediately_on_leave`: o conteúdo sai do DOM sem esperar por animação;
  - `shortcut_uses_secondary_foreground`;
  - `trigger_is_described_by_tooltip`.
- [x] **Passo 2:** `npx vitest run src/lib/components/ui/tooltip` falha.
- [x] **Passo 3:** adaptar o componente do vega aos tokens e às durações acima.
- [x] **Passo 4:** os testes passam e passam os quatro comandos.
- [x] **Passo 5:** commit `feat(ui): Tooltip with 500 ms delay, instant follow-up and instant exit`.

**Verificar no ecrã:** o fade só no primeiro; o fade mantém-se com Reduzir movimento; o VoiceOver lê o tooltip como descrição.
- **Resultado (2026-11-19):** 301 testes, `check` 0, build OK, harness 73/73. A mutação `bg-tooltip` → `bg-popover` foi apanhada, e o fade em todos os tooltips também. Desvios: a duração escreve-se `duration-(--duration-tooltip)`, porque o Tailwind não gera `duration-tooltip`; vale o mesmo para `duration-hover` na Task 10. Há `data-closed:hidden` para a saída ser instantânea, sem esperar pelo frame do Bits UI. O tooltip aberto pelo foco aparece logo, sem fade. O conteúdo não aceita o ponteiro. O gatilho é um snippet com `{ props }`. Correção do coordenador: com Reduzir movimento o fade **fica** (Figma `55:2128` «só opacidade», regra Movimento 6). O plano dizia o contrário e foi corrigido.

### Task 9: Etiqueta
**Ficheiros:** `npx shadcn-svelte@1.8.1 add badge`; adaptar `src/lib/components/ui/badge/*`; criar `badge.test.ts`.

**Interfaces que produz** (Componentes (D7) · 1 · Etiqueta, `55:584`; Cor 2, «Etiquetas»): `<Badge>{texto}</Badge>`, uma só variante:
- `px-1` (o Figma liga `spacing/1` só à esquerda e à direita; em cima e em baixo é 0), `rounded-badge`, `bg-primary-tint`, `text-subheadline-semibold text-primary-tint-foreground`, altura pelo texto (14);
- algarismos tabulares;
- com Contraste aumentado, contorno `inset-ring inset-ring-contrast-outline-tint` (Tema 3, variável do Figma).

- [x] **Passo 1: testes que falham** (`badge.test.ts`):
  - `badge_uses_tint_tokens`;
  - `badge_is_tabular`;
  - `badge_has_contrast_outline`.
- [x] **Passo 2:** `npx vitest run src/lib/components/ui/badge` falha.
- [x] **Passo 3:** adaptar o componente; sai o `badgeVariants` do vega.
- [x] **Passo 4:** os testes passam e passam os quatro comandos.
- [x] **Passo 5:** commit `feat(ui): Badge in tonal accent`.

**Verificar no ecrã:** altura de 14 com o texto.
- **Resultado (2026-11-19):** 284 testes, `check` 0, harness 73/73. O coordenador confirmou no nó `55:584` que o `spacing/1` só está à esquerda e à direita (altura 14): `px-1` e não `p-1`, verificado por mutação. Sem `href` (uma só variante, sem estados). Revisão no lote 7 + 9 + 13.
- **Lição:** o texto do DECISIONS não chega para os paddings; as tasks seguintes confirmam as ligações no nó do Figma (o coordenador exporta-as antes de cada task).
- **Atualização (2026-11-19):** o contorno de contraste passou a `inset-ring inset-ring-contrast-outline-tint`, ligado no Figma `55:584` (variável transparente fora dos modos de contraste).

### Task 10: Botão
**Ficheiros:** `npx shadcn-svelte@1.8.1 add button`; adaptar `src/lib/components/ui/button/*`; criar `button.test.ts`.

**Interfaces que produz** (Componentes (D7) · 2 · Botão, `55:787`; Componentes 4 e 5):
- `<Button variant="principal" | "secundario" | "ligacao" icon? disabled? disabledReason? onclick>{texto}</Button>`. Só três variantes, no tipo: Secundário é o `outline` do shadcn e Ligação o `link`; saem `default`, `ghost`, `destructive`, `secondary` e os tamanhos (P7);
- comum: `h-control px-4 gap-2 rounded-control text-body-medium`; ícone à esquerda de 16;
- Principal: `bg-primary text-primary-foreground`, hover `bg-primary-hover`, premido `bg-primary-pressed`; desativado `bg-primary-disabled text-disabled-foreground`;
- Secundário: `bg-background border border-input-strong text-foreground` (Figma `55:787`, corrigido de `input` para `input-strong` em 2026-11-19), hover `bg-accent`, premido `bg-accent-pressed`; desativado `bg-disabled border-disabled-border text-disabled-foreground`;
- Ligação: sem fundo, `text-link`, sublinhado só no hover, premido `text-primary-pressed`; desativado `text-disabled-foreground`;
- Contraste aumentado: Principal (menos o desativado) com `inset-ring inset-ring-contrast-outline-primary`; o Secundário não leva contorno extra, porque o `input-strong` já escurece nos modos de contraste (Tema 3, Figma);
- as transições escrevem-se `duration-(--duration-hover) ease-hover` (o Tailwind não gera `duration-hover`; ver a Task 8);
- desativado: `<button>` sem `disabled`, com `aria-disabled` e o `onclick` ignorado (não há estado interno do Bits UI);
- as reticências ficam no texto, não numa propriedade (`buttons.md`).

- [x] **Passo 1: testes que falham** (`button.test.ts`):
  - `principal_uses_primary_tokens_per_state`;
  - `secundario_uses_input_border_and_accent_states`;
  - `ligacao_underlines_only_on_hover`;
  - `disabled_is_inert_and_explains_itself`: `expectDisabledInert` com o `onclick` a 0;
  - `disabled_has_no_hover_class` (`not-data-disabled:hover:`);
  - `focus_ring_only_on_focus_visible`;
  - `principal_has_contrast_outline`.
- [x] **Passo 2:** `npx vitest run src/lib/components/ui/button` falha.
- [x] **Passo 3:** adaptar o `tv()` do vega às três variantes e ligar o Tooltip.
- [x] **Passo 4:** os testes passam e passam os quatro comandos.
- [x] **Passo 5:** commit `feat(ui): Button with primary, secondary and link variants`.

**Verificar no ecrã:** o anel com o teclado e não com o rato; o VoiceOver lê «esbatido» e o motivo.
- **Resultado (2026-11-19):** `src/lib/components/ui/button/`, 11 testes, com FIGMA_BINDINGS de `55:787`. Secundário `border-input-strong`; Principal com `inset-ring-contrast-outline-primary`, transparente quando desativado; Secundário é a variante por omissão. O hover anima com `duration-(--duration-hover) ease-hover`, e o premido é instantâneo (`not-data-disabled:active:transition-none`, corrigido pelo coordenador). `buttonVariants` tem `shape: text | toolbar` interno; `withTrigger` e `guardClick` exportados (um submit desativado não submete). Sem `href`. Com `disabledReason`, precisa de `TooltipProvider`. Mutações (`border-input`, sem contorno Principal, premido com transição) apanhadas. 319 testes, check 0, build OK, harness 73.

### Task 11: Botão de toolbar
**Ficheiros:** criar `src/lib/components/ui/toolbar-button/toolbar-button.svelte`, `index.ts` e `toolbar-button.test.ts`, sobre o `buttonVariants` da Task 10.

**Interfaces que produz** (Componentes (D7) · 3 · Botão de toolbar, `55:1346`):
- `<ToolbarButton icon label tooltip shortcut? pressed? disabled? disabledReason? onclick />`;
- `size-toolbar-button rounded-control`, ícone de 16 em `text-foreground`, sem fundo nem contorno visível no Normal (`toolbars.md`); com Contraste aumentado, `inset-ring inset-ring-contrast-outline` em todos os estados (Figma `55:1346`);
- hover `bg-accent`, premido `bg-accent-pressed`;
- selecionado (`pressed`): `aria-pressed="true"`, `bg-primary-tint text-primary-tint-foreground`, e o contorno passa a `inset-ring-contrast-outline-tint`;
- desativado: ícone `text-toolbar-icon-disabled`, com o tooltip do motivo (por exemplo «Liga o Kobo para sincronizar»);
- `aria-label` = `label`; o Tooltip mostra `tooltip` e `shortcut`.

- [x] **Passo 1: testes que falham** (`toolbar-button.test.ts`):
  - `has_aria_label_and_tooltip_with_shortcut`;
  - `normal_has_no_background_or_border`;
  - `pressed_sets_aria_pressed_and_tint`;
  - `disabled_is_inert_and_explains_itself`: `expectDisabledInert`, e o ícone em `text-toolbar-icon-disabled`;
  - `pressed_has_contrast_outline`.
- [x] **Passo 2:** `npx vitest run src/lib/components/ui/toolbar-button` falha.
- [x] **Passo 3:** o componente.
- [x] **Passo 4:** os testes passam e passam os quatro comandos.
- [x] **Passo 5:** commit `feat(ui): ToolbarButton with tonal selected state`.

**Verificar no ecrã:** área de clique de 32; o anel segue o raio.
- **Resultado (2026-11-19):** `src/lib/components/ui/toolbar-button/`, 7 testes. 32 × 32 (`size-toolbar-button`, como o Figma `55:1346`; o «28» do Verificar no ecrã estava errado). Contorno `inset-ring-contrast-outline` em todos os estados, `-tint` no selecionado; o selecionado não muda no hover nem no premido. `aria-pressed` só quando `pressed` é dado. Desativado: o tooltip mostra o motivo em vez do nome, sem atalho; o nome fica no `aria-label`. Precisa de `TooltipProvider`. Mutação do contorno selecionado apanhada.

### Task 12: Caixa
**Ficheiros:** `npx shadcn-svelte@1.8.1 add checkbox`; adaptar `src/lib/components/ui/checkbox/*`; criar `checkbox.test.ts`. Depende da Task 6 (`input-strong`).

**Interfaces que produz** (Componentes (D7) · 4 · Caixa, `55:1684`):
- `<Checkbox bind:checked label disabled? disabledReason? />`; o rótulo fica à direita, a `gap-2`, em `text-body text-foreground`, e clicar nele muda a caixa;
- caixa de 14 × 14, `rounded-checkbox`, marca `check` de 10;
- desligada: `bg-background border border-input-strong` (Figma `55:1684`, ligado a `input-strong` em 2026-11-19; era `input`), premido `bg-accent-pressed`;
- ligada (`data-checked:`): `bg-primary`, marca `text-primary-foreground`, premido `bg-primary-pressed`;
- desativada: `readonly` do Bits UI (fica focável e não muda), com `aria-disabled` e `data-disabled`; desligada `bg-disabled border-disabled-border`; ligada `bg-toolbar-icon-disabled` com a marca em `text-disabled-mark`; rótulo `text-disabled-foreground`;
- o anel segue o raio da caixa.

- [x] **Passo 1: testes que falham** (`checkbox.test.ts`):
  - `role_checkbox_with_label_name`;
  - `space_and_label_click_toggle`;
  - `checked_variant_matches_bits_ui_state`: `selectorFor('data-checked:bg-primary')` apanha a caixa ligada e não a desligada;
  - `checked_uses_primary_tokens`;
  - `disabled_is_inert_and_explains_itself`: `expectDisabledInert` sobre `bind:checked`, com o Espaço, o clique e o clique no rótulo;
  - `disabled_checked_uses_toolbar_icon_disabled_and_disabled_mark`;
  - `matches_figma_sample`: a marca da caixa ligada e desativada liga a `disabled-mark` em `design/components-sample.json` («Proposta», versão pequena).
- [x] **Passo 2:** `npx vitest run src/lib/components/ui/checkbox` falha.
- [x] **Passo 3:** adaptar.
- [x] **Passo 4:** os testes passam e passam os quatro comandos.
- [x] **Passo 5:** commit `feat(ui): Checkbox with Khi states`.

**Verificar no ecrã:** área de clique com o rótulo; o anel segue o raio da caixa.
- **Resultado (2026-11-19):** `src/lib/components/ui/checkbox/`, 13 testes, com FIGMA_BINDINGS de `55:1684` e `matches_figma_sample` sobre `design/components-sample.json`. Contorno `input-strong` (o Figma foi corrigido de `input`). O premido é instantâneo: a Caixa não tem hover, como o Botão. Marca de 10 com traço de 4/3 px (convenção do Ícone). Desativado com `readonly` do Bits UI, sem `aria-readonly`; o `data-state` do Bits é reposto depois do tooltip. Mutações (`border-input`, marca desativada) apanhadas. 341 testes.

### Task 13: Campo de texto
**Ficheiros:** `npx shadcn-svelte@1.8.1 add input`; adaptar `src/lib/components/ui/input/*`; criar `input.test.ts`. Depende da Task 6 (`input-strong`).

**Interfaces que produz** (Componentes (D7) · 5 · Campo de texto, `55:1908`):
- `<Input bind:value placeholder? disabled? class? />`; largura por omissão 220 (`w-55`), que o pai pode mudar;
- `h-control px-2 rounded-control bg-background border border-input-strong text-body text-foreground`, texto de exemplo em `placeholder:text-tertiary-foreground`, texto longo com reticências;
- foco: anel, e o contorno não muda;
- desativado: `readonly` nativo e `aria-disabled` (continua a receber o foco), com `bg-disabled border-disabled-border text-disabled-foreground`.

- [x] **Passo 1: testes que falham** (`input.test.ts`):
  - `default_width_is_220`;
  - `placeholder_uses_tertiary_foreground`;
  - `focus_keeps_border_and_shows_ring`;
  - `disabled_is_inert`: escrever não muda `bind:value`; o campo recebe o foco.
- [x] **Passo 2:** `npx vitest run src/lib/components/ui/input` falha.
- [x] **Passo 3:** adaptar; saem as classes de `file:` e `aria-invalid:`.
- [x] **Passo 4:** os testes passam e passam os quatro comandos.
- [x] **Passo 5:** commit `feat(ui): Input with Khi tokens`.

**Verificar no ecrã:** reticências no texto longo.
- **Resultado (2026-11-19):** 290 testes, `check` 0, build OK, harness 73/73; mutação `border-input-strong` → `border-input` apanhada. Antes da task, o coordenador exportou as ligações do nó `55:1908`: o contorno estava ligado a `input` e foi corrigido no Figma para `input-strong` (Normal e Foco), com a descrição atualizada (decisão A, aprovada pelo Bruno). Desvios: a espessura usa `border-(length:--stroke-border)` (token `stroke/border`); `disabled_is_inert` testa diretamente, porque o campo não tem motivo nem Tooltip; o anel aparece também ao clicar, como nos campos de texto do macOS (`:focus-visible` dos browsers), o que corresponde ao estado Foco do Figma.
- **Revisão (lote 7 + 9 + 13, GPT‑6.2 Sol):** Icon e Badge sem problemas. Input: dois médios corrigidos. Os props reencaminhados (`readOnly`, `aria-disabled`, `data-disabled`) já não anulam o desativado: o spread vem primeiro e esses nomes são filtrados. O `type` passa a ser uma lista fechada de tipos de texto, e qualquer outro vale `text`. 292 testes.

### Task 14: Pop-up
**Ficheiros:** `npx shadcn-svelte@1.8.1 add select`; adaptar `src/lib/components/ui/select/*`; criar `select.test.ts`. As classes da superfície e do item de menu ficam em `src/lib/components/ui/menu/menu-classes.ts`, para a Task 17 as reusar.

**Interfaces que produz** (Componentes (D7) · 6 · Pop-up, `55:2116`; 10 · Menu):
- `<Select bind:value items={{ value, label }[]} label disabled? disabledReason? />`, sempre com uma escolha (sem estado vazio, `pop-up-buttons.md`);
- gatilho com o aspeto do Secundário: `h-control pl-4 pr-2 gap-2 rounded-control bg-background border border-input-strong` (Figma `55:2116`, corrigido de `input` para `input-strong` em 2026-11-19, Decisão A; sem contorno extra no contraste), valor `text-body text-foreground`, `chevrons-up-down` de 12 em `text-muted-foreground`; hover `bg-accent`, premido `bg-accent-pressed` (instantâneo, como o Botão); desativado `bg-disabled border-disabled-border`, valor e seta em `text-disabled-foreground`;
- o caso do Pop-up entra no `control_is_named_by_row_label` de `form.test.ts` (Task 18);
- desativado: o Bits UI não tem `readonly` no Select, por isso `bind:open` é uma ligação de função que recusa abrir; o gatilho fica focável;
- lista com a superfície do Menu (Task 17): `bg-popover border border-border rounded-menu shadow-sombra-menu p-1`; item realçado (`data-highlighted:`) em `bg-primary text-primary-foreground`, sem transição; marca no valor em vigor;
- abre em `duration-in` 200 com `ease-out` e fecha em `duration-out` 150; com Reduzir movimento, só fade.

- [x] **Passo 1: testes que falham** (`select.test.ts`):
  - `trigger_shows_value_and_chevrons`;
  - `opens_with_space_and_arrows_move_highlight`;
  - `highlighted_item_uses_primary`: com `selectorFor`, sobre o `data-highlighted` do Bits UI;
  - `open_variant_matches_bits_ui_state`;
  - `current_value_has_check`;
  - `disabled_is_inert_and_explains_itself`: `expectDisabledInert` com o pop-up fechado e o valor igual;
  - `content_uses_menu_surface`.
- [x] **Passo 2:** `npx vitest run src/lib/components/ui/select` falha.
- [x] **Passo 3:** adaptar; `menu-classes.ts` com `menuContent` e `menuItem`.
- [x] **Passo 4:** os testes passam e passam os quatro comandos.
- [x] **Passo 5:** commit `feat(ui): Select pop-up with shared menu surface`.

**Verificar no ecrã:** a lista abre sobre o valor em vigor; fade sem deslocamento com Reduzir movimento.
- **Resultado (2026-11-19):** 9 testes em `select.test.ts` (mais `always_has_a_choice` e `without_reason_needs_no_tooltip_provider`) e o caso do Pop-up em `form.test.ts`; 381 testes, `check` 0, build OK, harness 73/73. Mutações apanhadas: `border-input-strong` → `border-input`, `data-highlighted:bg-primary` → `bg-accent`, as guardas de `bind:value` e `bind:open`, o `motion-reduce:zoom-in-100` e a escolha por omissão. Desvios: o `Select` é um componente composto (gatilho, lista e itens a partir de `items`); saem as peças do shadcn sem uso (grupo, rótulo, botões de deslocamento, separador, `select-value`) e o `separator/` que o shadcn trouxe. O desativado recusa também `bind:value`, porque o typeahead do Bits UI escolhe com o gatilho fechado. A lista abre por baixo do gatilho, não sobre o valor em vigor: o Bits UI 2.21 não tem posição alinhada ao item (fica para o ecrã). O movimento é fade com escala 95 → 100; com Reduzir movimento a escala volta a 100 e fica só o fade (o DECISIONS só fixa durações). `menu-classes.ts` exporta também `menuMark`, `menuShortcut` e `menuSeparator` para a Task 17. O jsdom não tem `hasPointerCapture`, que o gatilho do Bits UI chama: o teste define-o.
- **Revisão (2026-11-19):** um item desativado não fica realçado sob o ponteiro, tem `aria-disabled` e a ligação e o `onValueChange` recusam o seu valor; `open` vindo do pai é recusado com o Pop-up desativado; o campo do formulário é um `<select>` próprio, invisível (como no Switch), com `form`, `required` só ativo e o valor; desativado continua a submeter, como a Caixa e o Switch. 8 testes novos.

### Task 15: Grupo de vista
**Ficheiros:** criar `src/lib/components/ui/view-group/view-group.svelte`, `index.ts` e `view-group.test.ts`, sobre o `RadioGroup` do Bits UI com o aspeto do Botão de toolbar (Task 11). O `toggle-group` do shadcn não serve: em escolha única deixa limpar o valor, e as setas movem o foco sem escolher. Depende da Task 6 (`input-strong`).

**Interfaces que produz** (Componentes (D7) · 8 · Grupo de vista, `55:2440`):
- `<ViewGroup bind:value={'grid' | 'list'} />`: dois botões (`layout-grid`, `list`) a `gap-1`, sem animação;
- `role="radiogroup"` com nome; cada botão é `radio` com `aria-label` «Ver em grelha» / «Ver em lista» e tooltip «Grelha ⌘1» / «Lista ⌘2»;
- uma só paragem do Tab; as setas escolhem;
- os dois botões são instâncias do Botão de toolbar (Task 11) no Figma: o escolhido no estado Selecionado (`primary-tint`, `inset-ring-contrast-outline-tint`) e o outro no Normal (`inset-ring-contrast-outline`), com os mesmos hover, premido e foco; não há contorno próprio do grupo (corrigido 2026-11-19 a partir das ligações de `55:2440`).

- [x] **Passo 1: testes que falham** (`view-group.test.ts`):
  - `is_radiogroup_with_two_named_radios`;
  - `arrows_select`;
  - `clicking_selected_keeps_value`;
  - `single_tab_stop`;
  - `selected_uses_tint_and_contrast_outline`;
  - `tooltips_show_shortcuts`.
- [x] **Passo 2:** `npx vitest run src/lib/components/ui/view-group` falha.
- [x] **Passo 3:** o componente e as chaves `ui.viewGroup.*`.
- [x] **Passo 4:** os testes passam e passam os quatro comandos.
- [x] **Passo 5:** commit `feat(ui): grid/list ViewGroup on a radio group`.

**Verificar no ecrã:** o VoiceOver lê «Ver em grelha, botão de opção, 1 de 2».
- **Resultado (2026-11-19):** `src/lib/components/ui/view-group/`, 6 testes, com FIGMA_BINDINGS de `55:2440`. Sobre o `RadioGroup` do Bits UI, com `loop` e as setas nos dois eixos. Cada botão usa as classes do Botão de toolbar (`buttonVariants({ shape: 'toolbar' })` e `toolbarButtonVariants`, agora exportado de `toolbar-button/`, o único ficheiro da Task 11 que muda). O teste compara as classes com as do Botão de toolbar, por isso não há cópia. O `data-state` do rádio é reposto depois do tooltip. Chaves `ui.viewGroup.*`: `label` «Vista», o nome do grupo (não estava aprovado; pode passar-se `aria-label`), e os tooltips «Grelha» e «Lista». Os atalhos ⌘1 e ⌘2 são literais. «Sem animação» lê-se como «sem indicador que deslize»: fica o fade do hover do Botão de toolbar. Mutações apanhadas: o escolhido no Normal, o contorno `-tint` tirado do `toolbarButtonVariants`, o `data-state` perdido, `gap-2`, duas paragens do Tab e o tooltip sem atalho. 413 testes (todo o lote), `check` 0, build OK, harness 73/73.

### Task 16: Segmentado
**Ficheiros:** criar `src/lib/components/ui/segmented/segmented.svelte`, `index.ts` e `segmented.test.ts`, sobre o `RadioGroup` do Bits UI (o `tabs` do shadcn não serve: é um filtro, não separadores). Depende da Task 6 (`input-strong`).

**Interfaces que produz** (Componentes (D7) · 9 · Segmentado, `55:2574` e `55:2588`; Q-C):
- `<Segmented bind:value label segments={{ value, label, count }[]} />`;
- calha `bg-muted rounded-control p-0.5`; segmentos `h-segment rounded-segment`, de largura igual (`segmented-controls.md`);
- rótulo `text-callout text-foreground`, contagem a `gap-1` em `text-tertiary-foreground`, com algarismos tabulares;
- escolhido: `bg-segmented-selected shadow-sombra-segmento`, rótulo `text-callout-medium`, contagem em `text-segmented-selected-count` (ver «Discrepâncias resolvidas»). O fundo muda em `duration-hover` 120 com `ease-hover`, sem deslizar;
- sem hover;
- contagem 0 (Q-C): `disabled` do Bits UI no item, com rótulo e contagem em `text-disabled-foreground`; não se escolhe e as setas saltam-no. **Fica fora da regra do desativado focável:** um segmento vazio não é paragem, como no macOS; o tooltip «Não há destaques novos neste livro» (e o equivalente para notas) aparece com o ponteiro, e o VoiceOver lê-o como esbatido dentro do grupo;
- Contraste aumentado: o escolhido com `inset-ring inset-ring-contrast-outline-strong` (variável nova no Figma em 2026-11-19, ligada a `55:2562`: transparente nos modos normais, `input-strong` nos de contraste, 3:1 contra a calha; o `contrast-outline` dava 2,7 e 2,5);
- VoiceOver: o grupo chama-se `label` («Mostrar») e cada segmento lê «Novos, 5».

- [x] **Passo 1: testes que falham** (`segmented.test.ts`):
  - `radiogroup_named_mostrar`;
  - `segment_name_includes_count`;
  - `arrows_select_and_skip_zero_count_segment`;
  - `clicking_selected_keeps_value`;
  - `single_tab_stop`;
  - `zero_count_segment_cannot_be_selected`: o clique não muda `bind:value`; o tooltip tem o motivo;
  - `selected_uses_segmented_selected_and_shadow`;
  - `matches_figma_sample`: a contagem do escolhido liga a `segmented-selected-count` em `design/components-sample.json`;
  - `no_hover_class_on_segments`;
  - `selected_has_contrast_outline`.
- [x] **Passo 2:** `npx vitest run src/lib/components/ui/segmented` falha.
- [x] **Passo 3:** o componente e as chaves `ui.segmented.*`.
- [x] **Passo 4:** os testes passam e passam os quatro comandos.
- [x] **Passo 5:** commit `feat(ui): Segmented filter with disabled zero-count segments`.

**Verificar no ecrã:** largura igual com contagens diferentes; o fundo muda sem deslizar.
- **Resultado (2026-11-19):** `src/lib/components/ui/segmented/`, 10 testes, com FIGMA_BINDINGS de `55:2574` e `55:2588`, e `matches_figma_sample` sobre `segment-selected-count`. A interface é `segments={{ value, label, count, emptyReason? }[]}`. O valor por omissão é o primeiro segmento (Todos). A calha é `inline-grid grid-flow-col auto-cols-fr` e cada segmento tem `min-w-24` (96 no Figma). O nome de cada segmento é `aria-label` «Novos, 5». As classes do escolhido escolhem-se no Svelte (strings estáticas completas), não com `data-checked:` nos filhos. Desvio no segmento vazio: fica o `disabled` do Bits UI (`data-disabled`, as setas saltam-no, o clique é ignorado), mas sem o `disabled` nativo, que pode engolir os eventos do ponteiro e, com eles, o tooltip. Leva `aria-disabled` e `preventDefault` no `mousedown`, para o clique não o focar. O `tabindex` é o do Bits (-1 fora da paragem). O `data-disabled` do Bits é reposto depois do tooltip, que o apagava. Chaves `ui.segmented.*`; a frase das notas, «Não há destaques com notas neste livro», é minha e falta aprovar. Mutações apanhadas: sem `inset-ring-contrast-outline-strong`, `bg-segmented-selected` → `bg-background`, Medium → `font-semibold`, o segmento vazio escolhível, o `data-disabled` perdido, a contagem do escolhido em `tertiary-foreground`, sem `auto-cols-fr` e o `mousedown` sem guarda.

### Task 17: Menu
**Ficheiros:** `npx shadcn-svelte@1.8.1 add dropdown-menu`; adaptar `src/lib/components/ui/dropdown-menu/*` com `menu-classes.ts` (Task 14); criar `dropdown-menu.test.ts`.

**Interfaces que produz** (Componentes (D7) · 10 · Menu, `55:3156`, `55:3159` e `55:3185`):
- `DropdownMenu.Content` com 200 de largura por omissão, `p-1 bg-popover border border-border rounded-menu shadow-sombra-menu`;
- `DropdownMenu.Item` com `shortcut?` e `checked?` (propriedades «Atalho» e «Marcado» do Figma): altura 24, `px-2 py-1 gap-2 rounded-control text-body text-foreground`, atalho em `text-tertiary-foreground`, marca `check` de 12;
- realçado (`data-highlighted:`, a variante de presença do Tailwind): `bg-primary`, texto e atalho `text-primary-foreground`, sem transição (Fundações: não o `accent` do shadcn);
- desativado: `disabled` do Bits UI no item, tudo em `text-disabled-foreground`; as setas saltam-no (exceção à regra, como no macOS);
- `DropdownMenu.Separator`: 1 px `bg-border`, `my-1 mx-2`;
- abre em 200 com `ease-out`, fecha em 150; com Reduzir movimento, só fade;
- os itens que pedem mais informação levam reticências no texto (`menus.md`).

- [x] **Passo 1: testes que falham** (`dropdown-menu.test.ts`):
  - `content_is_200_wide_with_menu_surface`;
  - `highlighted_item_uses_primary_without_transition`: com `selectorFor('data-highlighted:bg-primary')` sobre o item que o Bits UI realça;
  - `matches_figma_sample`: o item realçado liga a `primary` e `primary-foreground` em `design/components-sample.json`;
  - `shortcut_turns_primary_foreground_when_highlighted`;
  - `checked_item_shows_check`;
  - `disabled_item_is_skipped_and_does_not_fire`;
  - `separator_uses_border_and_spacing`;
  - `open_and_close_durations`.
- [x] **Passo 2:** `npx vitest run src/lib/components/ui/dropdown-menu` falha.
- [x] **Passo 3:** adaptar; saem as variantes `destructive` e `inset` do vega.
- [x] **Passo 4:** os testes passam e passam os quatro comandos.
- [x] **Passo 5:** commit `feat(ui): DropdownMenu with macOS highlight`.

**Verificar no ecrã:** o realce segue o ponteiro sem atraso; fade sem deslocamento com Reduzir movimento.
- **Resultado (2026-11-19):** 9 testes em `dropdown-menu.test.ts` (mais `content_width_can_be_overridden`); 381 testes, `check` 0, build OK, harness 73/73. Mutações apanhadas: `data-highlighted:bg-primary` → `bg-accent`, o atalho sem `primary-foreground` no realce, o separador do shadcn (`-mx-1 h-px`), a largura `w-56`, o fecho em `duration-in`, o desativado em `opacity-50` e a marca sempre visível. Desvios: um `Item` com `checked` (mesmo `false`) é um `CheckboxItem` do Bits UI (`menuitemcheckbox` com `aria-checked`) e ganha a coluna da Marca; sem `checked` não tem coluna. O atalho é a propriedade `shortcut` do item, por isso sai o `DropdownMenuShortcut`; saem também as peças sem desenho no Figma (checkbox e radio items, submenus, rótulo e cabeçalho de grupo). O separador tem a altura de `stroke/border` (`h-(--stroke-border)`), não `h-px`. O atalho segue o item pelas variantes de grupo (`group/menu-item`), que o jsdom avalia mal: o teste divide o seletor por ramos, como em `checkbox.test.ts`.
- **Revisão (2026-11-19):** o teste do movimento passa a exigir por nome `data-open:animate-in`, `data-closed:animate-out`, os fades, as durações e as escalas de Reduzir movimento (no Menu e na lista do Pop-up); apagar `data-closed:animate-out` já falha.

### Task 18: Switch, Linha e Grupo de formulário
**Ficheiros:**
- `npx shadcn-svelte@1.8.1 add switch label`; adaptar `src/lib/components/ui/switch/*`;
- criar `src/lib/components/ui/form/form-row.svelte`, `form-group.svelte`, `index.ts`, `form.test.ts` e `form-fixture.svelte` (um consumidor pequeno, só para o teste);
- criar `switch.test.ts`.
Depende da Task 6 (`switch-on`, `input-strong`).

**Interfaces que produz** (Componentes (D7) · 11 · Linha e Grupo de formulário, `55:3471`, `55:3552`, `55:3553`):
- `<Switch bind:checked disabled? disabledReason? aria-labelledby? aria-describedby? />`:
  - 32 × 18 à vista e área de clique de 32 × 20 (1 px de padding transparente; Amostra de cor, opção B);
  - `p-0.5`, raio 9 (`rounded-full`, metade da altura);
  - botão de 14 em `bg-switch-thumb shadow-sombra-segmento`;
  - calha desligada `bg-input-strong`, ligada `bg-switch-on` (Figma `55:3471`, ligadas em 2026-11-19; eram `input` / `primary`);
  - desativado: o Bits UI não tem `readonly` no Switch, por isso `bind:checked` é uma ligação de função que recusa a escrita; desligado `bg-disabled-border`, ligado `bg-primary-disabled`;
  - o botão desliza em `duration-in` 200 com `ease-out`; com Reduzir movimento, muda sem deslizar;
  - `role="switch"` com `aria-checked`.
- `<FormRow label help? divider?>{#snippet control({ labelId, helpId })}…{/snippet}</FormRow>`:
  - a linha cria os ids e passa-os ao controlo, que põe `aria-labelledby={labelId}` e `aria-describedby={helpId}` (o Switch, o Pop-up, o Campo e a Caixa aceitam-nos);
  - `min-h-form-row px-4 py-2 gap-4`; rótulo `text-body text-foreground`; ajuda a `gap-1`, em `text-callout text-tertiary-foreground`;
  - `divider` põe um filete `border-t border-border` (da segunda linha em diante);
  - os tipos do Figma (Pop-up, Campo de 160, Botão «Escolher…», Switch, Caixas, Amostras) são o conteúdo do snippet.
- `<FormGroup heading?>{linhas}</FormGroup>`: cabeçalho `text-body-semibold` com `px-4`, `gap-2` até ao cartão; cartão `bg-card rounded-group`, sem contorno visível; com Contraste aumentado, `inset-ring inset-ring-contrast-outline` (Figma `55:3553`, traço ligado em 2026-11-19).

- [x] **Passo 1: testes que falham:**
  - `switch.test.ts`:
    - `is_read_as_switch`;
    - `space_toggles`;
    - `checked_variant_matches_bits_ui_state`;
    - `track_uses_input_strong_off_and_switch_on_on`;
    - `disabled_is_inert_and_explains_itself`: `expectDisabledInert` sobre `bind:checked`;
    - `disabled_tracks_use_disabled_tokens`.
  - `form.test.ts`, com `form-fixture.svelte`:
    - `control_is_named_by_row_label`: o Switch, o Campo e a Caixa do fixture têm o nome do rótulo (o Pop-up só chega na Task 14, que acrescenta o seu caso a este teste);
    - `control_is_described_by_help`;
    - `divider_adds_top_border`;
    - `group_card_has_no_border_but_contrast_outline`.
- [x] **Passo 2:** `npx vitest run src/lib/components/ui/switch src/lib/components/ui/form` falha.
- [x] **Passo 3:** os componentes.
- [x] **Passo 4:** os testes passam e passam os quatro comandos.
- [x] **Passo 5:** commit `feat(ui): mini Switch, FormRow and FormGroup`.

**Verificar no ecrã:** área de clique de 20; o botão não desliza com Reduzir movimento; o VoiceOver lê o rótulo e a ajuda.
- **Resultado (2026-11-19):** `switch/` (9 testes), `label/`, `form/` (5 testes). Calha `input-strong` / `switch-on` (o Figma foi ligado a estas variáveis); o botão desliza com `margin-left` em `duration-(--duration-in) ease-out`, e não com translate, porque a regra do movimento repõe os translates com Reduzir movimento; com Reduzir movimento só se desliga a transição. Desativado: a ligação recusa a escrita e `onCheckedChange` não é chamado. FormGroup com `<h2>` no cabeçalho, `inset-ring-contrast-outline` (traço novo no Figma `55:3553`). O fixture usa Switch, Campo e Caixa; o Pop-up entra na Task 14. O tipo Caixas (Metadados) fica para a Task 19. Mutações (6) apanhadas. 355 testes, check 0, build OK, harness 73.

### Task 19: Separador das Definições
**Ficheiros:** `npx shadcn-svelte@1.8.1 add tabs`; adaptar `src/lib/components/ui/tabs/*`; criar `tabs.test.ts`. Depende da Task 6 (`input-strong`).

**Interfaces que produz** (Componentes (D7) · 12 · Separador das Definições, `55:4977`; Q-K):
- `<Tabs bind:value>` com `<TabsTrigger value icon>{rótulo}</TabsTrigger>`, ativação automática (as setas escolhem); barra centrada, `gap-1`, filete `border-b border-border`;
- separador: `px-2 py-1 gap-1 rounded-control`, ícone de 20 em cima, rótulo `text-subheadline` (Regular nos três estados, Q-K);
- Normal `text-muted-foreground`; hover `bg-accent` em `duration-hover`; Selecionado (`data-active:`) `bg-primary-tint text-primary-tint-foreground`, com `inset-ring inset-ring-contrast-outline-strong` (Figma `55:4973`, 2026-11-19);
- a troca de separador não tem transição;
- uma paragem do Tab, setas lá dentro;
- os três da v2: Exportação (`file-output`), Aparência (`palette`), Kobo (`tablet`), com chaves `settings.tabs.*`.
- vem da Task 18: o tipo Caixas da Linha de formulário (`55:3488`, Metadados a incluir): três colunas de Caixas, `gap-4` entre colunas e `gap-2` dentro, padding `p-4`; no Figma a linha não tem rótulo visível, por isso é um `role="group"` com nome dado por um `label` obrigatório (só para leitores de ecrã). Testes `checkbox_row_is_group_named_by_label` e `checkbox_row_has_three_columns` em `form.test.ts`.

- [x] **Passo 1: testes que falham** (`tabs.test.ts`):
  - `tablist_single_tab_stop_and_arrows_select`;
  - `active_variant_matches_bits_ui_state`;
  - `selected_uses_tint_regular_weight`: sem `font-semibold`;
  - `hover_uses_accent_with_hover_duration`;
  - `icon_is_20`;
  - `selected_has_contrast_outline`.
- [x] **Passo 2:** `npx vitest run src/lib/components/ui/tabs` falha.
- [x] **Passo 3:** adaptar.
- [x] **Passo 4:** os testes passam e passam os quatro comandos.
- [x] **Passo 5:** commit `feat(ui): Settings tabs`.

**Verificar no ecrã:** a barra centrada; o VoiceOver lê «separador, 1 de 3».
- **Resultado (2026-11-19):** `src/lib/components/ui/tabs/` (do shadcn 1.8.1, `package.json` reposto), 6 testes, com FIGMA_BINDINGS de `55:4977`. Saem o `tabsListVariants`, o `text-sm`, o sublinhado `after:`, o `dark:` e as opacidades. A raiz fixa `activationMode="automatic"` e a orientação horizontal. O `TabsTrigger` recebe `icon` (Ícone `lg`) e põe o rótulo num `span`. O hover é `not-data-disabled:not-data-active:hover:bg-accent`, para não tapar o tint do escolhido (o `:hover` é mais específico que o `:where` do `data-active:`). A transição também só existe com o rato sobre um separador não escolhido. Assim a troca é instantânea nos dois separadores, e sair do hover também é instantâneo (dúvida). O contorno é `data-active:inset-ring data-active:inset-ring-contrast-outline-strong`, para o normal não ter um anel em `currentColor`. As chaves `settings.tabs.*` substituem a string `settings.tabs`, que passa a `settings.tabs.label`; o `SettingsPanel.svelte` muda uma linha e o texto lido fica igual (harness 73/73). Tipo Caixas: `FormRow` com `columns: Snippet[]` em vez de `control`, `role="group"` com `aria-label`, `flex min-h-form-row gap-4 p-4` e Colunas `flex min-w-0 flex-1 flex-col gap-2`; 2 testes em `form.test.ts`, e o fixture ganhou `metadata`. Mutações apanhadas: sem contorno, `bg-accent` no escolhido, `font-semibold`, ícone de 16, hover sem guarda, transição sempre ligada, ativação manual, e no Caixas o `role`, o padding, a largura e o `gap` das colunas. 413 testes, `check` 0, build OK, harness 73/73.

### Task 20: investigação da cor de destaque
**Ficheiros:** nenhum no código. Uma sonda temporária no Khi Dev, revertida no fim, como a do `prefers-contrast`. O resultado vai para o DECISIONS, Cor 2, «Por verificar antes de construir».

**Interfaces que produz:** a resposta às três perguntas da Cor 2:
- **Ler a cor:** o CSS `AccentColor` no WKWebView, ou o Rust?
- **Valores do sistema:** os da tabela «Cor · 3» batem com os do macOS?
- **Atualização:** a cor muda com a app aberta?

- [x] **Passo 1: registo do ambiente.** A versão do macOS (`sw_vers`), a do WebKit (`navigator.userAgent` na sonda) e a escolha atual do Bruno (`defaults read -g AppleAccentColor`, e se a chave não existe), para a repor no fim.
- [x] **Passo 2: referência de cor.** `swift -e 'import AppKit; print(NSColor.controlAccentColor.usingColorSpace(.sRGB)!)'`, corrido na mesma aparência (Claro ou Escuro) que a app. É um processo novo: dá a cor certa, mas não prova que a app é avisada de uma mudança.
- [x] **Passo 3: sonda** no Khi Dev, com `npm run dev:app` e o Bruno avisado antes: um elemento com `color: AccentColor` e o `getComputedStyle` em sRGB, mostrado na própria janela.
- [x] **Passo 4: experiência**, com o Khi Dev sempre aberto e sem recarregar: Multicolor → Azul explícito → uma cor bem diferente (Rosa). Em cada passo, o valor da sonda, o do `swift` e se a sonda mudou sozinha.
- [x] **Passo 5: critério.**
  - O CSS chega se a sonda bater com o `swift` (±1 por canal), **distinguir** Multicolor do Azul **e** mudar sem reabrir.
  - Se não distinguir ou não mudar sozinho, pára o teste do CSS e verifica-se o caminho nativo: um comando Rust que lê `AppleAccentColor` e `NSColor.controlAccentColor`, e um evento na notificação `AppleColorPreferencesChangedNotification`, emitido para a janela; o mesmo Multicolor → Azul → Rosa, com a app aberta.
- [x] **Passo 6: tabela das oito cores** (grafite, vermelho, laranja, amarelo, verde, azul, roxo, rosa), em Claro e Escuro, com o valor do `swift` e o do caminho escolhido; vai para a tabela de tons (Questão 1).
- [x] **Passo 7:** repor a escolha do Bruno (Passo 1) e confirmar com o `defaults read`; reverter a sonda; escrever o resultado no DECISIONS (Cor 2) e nesta task.

- **Resultado (2026-11-19):** o CSS `AccentColor` falha os dois critérios: dá `#007AFF` em Multicolor e em Azul, e não muda com a app aberta (sistema em Rosa durante 3 min, a sonda continuou azul). O caminho nativo passa: `NSColor.systemColorsDidChangeNotification` chega na hora, com `AppleAccentColor` já atualizado (ausente = Multicolor). A tabela das oito cores, medida em Claro e Escuro, está no DECISIONS, Cor 2, «Verificado». A sonda (no `+layout.svelte` e um ouvinte temporário no `vite.config.ts`) foi revertida; a escolha do Bruno (Multicolor, chave ausente) foi reposta e confirmada com o `defaults read`. Consequência para a Task 21: comando e evento em Rust, e os tons das cores do sistema recalculados a partir dos valores medidos.

**Paragem:** o Bruno lê o resultado e aprova a forma de ler a cor. Bloqueia só a Task 21.

**Aprovado (2026-11-19):** caminho nativo no padrão da app Cmdr (`objc2-app-kit`, `NSSystemColorsDidChangeNotification`, evento à janela), mais a leitura de `AppleAccentColor` para o Multicolor. Pesquisa e alternativas no DECISIONS, Cor 2.

### Task 21: Amostra de cor e tons de destaque
**Pré-requisitos:** a Paragem da Task 20 e a tabela de tons aprovada pelo Bruno (Questão 1).

**Ficheiros:**
- criar `design/accent-tones.json`, a tabela aprovada: para cada uma das 8 cores do sistema e das 7 amostras, em Claro e Escuro, `primary`, `primary-foreground`, `primary-hover`, `primary-pressed`, `link`, `primary-tint`, `primary-tint-foreground` e `ring`, cada um com o valor e a origem (`figma:<nó>`, `sistema:<Task 20>` ou `derivado:<regra>`; o azul do sistema, igual a `tokens.json`, tem `tokens:cor/<modo>/<tom>`);
- criar `src/lib/accent/accent.ts` e `accent.test.ts`;
- criar `src/lib/components/ui/swatch/swatch-group.svelte`, `swatch.svelte`, `swatch-classes.ts`, `index.ts` e `swatch.test.ts` (base: `npx shadcn-svelte@1.8.1 add radio-group`, só o Bits UI por baixo);
- se a Task 20 pedir o Rust: o comando e o evento em `src-tauri/src/`, com teste em Rust.

**Interfaces que produz** (Componentes (D7) · 13 · Amostra de cor, `56:5146`; Cor 2):
- `applyAccent(choice: 'system' | SwatchName, system: SystemAccent, mode)` escreve as variáveis da tabela em `document.documentElement`; `Sistema` em Multicolor dá Azul-tinta;
- `<SwatchGroup bind:value />`:
  - `role="radiogroup"` com nome «Cor de destaque»;
  - oito amostras de 18 × 18 a `gap-2`, com área de clique de 20 × 20; cada uma tem nome (Sistema, Azul-tinta, Verde-folha, Turquesa, Laranja, Amarelo, Rosa, Violeta) e tooltip com o nome;
  - Sistema: `bg-background`, contorno `primary` de `stroke/swatch` 2 e ponto `primary` de 6;
  - Cor: fundo de `SWATCH_BG[nome]` em `swatch-classes.ts` (`'azul-tinta': 'bg-swatch-azul-tinta'`, …), um mapa estático;
  - Selecionada: anel `foreground` de `stroke/swatch` a 2 px, raio 11;
  - Foco: o anel da Task 5, encostado;
  - as setas escolhem; a cor aplica-se no momento, sem movimento.

- [x] **Passo 1: testes que falham:**
  - `accent.test.ts`:
    - `every_accent_has_all_tones_with_source_in_both_modes`;
    - `blue_matches_tokens_exactly`: o azul da tabela é igual ao de `tokens.json`, em Claro (`#0066D6` → `#005BBF` → `#0050A8`) e em Escuro (`#62A6FF` → `#7FB6FF` → `#9CC6FF`, mais claro ao premir, texto `#051A36`);
    - `contrast_holds_unrounded`: com a fórmula da WCAG e sem arredondar, em Claro e Escuro, `primary-foreground` sobre `primary`, `primary-hover` e `primary-pressed` ≥ 4,5; `link` sobre `background` e `card` ≥ 4,5; `primary-tint-foreground` sobre `primary-tint` ≥ 4,5 e ≥ 3 como contorno (Tema 3);
    - `multicolor_maps_to_azul_tinta`;
    - `apply_accent_sets_css_variables`.
  - `swatch.test.ts`:
    - `radiogroup_named_cor_de_destaque`;
    - `each_swatch_has_name_and_tooltip`;
    - `arrows_select`;
    - `swatch_classes_are_compiled`: cada classe de `SWATCH_BG` existe no CSS que o `compileAppCss` gera a partir das fontes de produção;
    - `system_swatch_has_ring_and_dot`.
- [x] **Passo 2:** `npx vitest run src/lib/accent src/lib/components/ui/swatch` falha.
- [x] **Passo 3:** gravar a tabela aprovada em `accent-tones.json`.
- [x] **Passo 4:** `accent.ts`, os componentes e as chaves `settings.accent.*`; o Rust, se for preciso.
- [x] **Passo 5:** os testes passam e passam os quatro comandos (e `cargo test`, se houver Rust).
- [x] **Passo 6:** commit `feat(ui): accent swatches and precomputed accent tones`.

- **Feito (2026-11-19):** tabela aprovada em `design/accent-tones.json`, gerada por `design/accent-tones/generate.py` (reprodutível ao byte, com autoverificação); `src-tauri/src/system_accent.rs` no padrão da Cmdr (comando `get_system_accent`, evento `system-accent-changed`, 4 testes em Rust); `applyAccent` e as Amostras. Decisões do implementador: um `AppleAccentColor` desconhecido conta como Multicolor; Amostras desativadas mostram o motivo no tooltip; `applyAccent` escreve no estilo da raiz e tem de ser chamado de novo ao mudar claro/escuro. **Em aberto:** `contrast-outline-tint` e `contrast-outline-primary` (Contraste aumentado) não seguem a cor de destaque.

**Verificar no ecrã:** área de clique de 20; o anel de seleção e o de foco juntos; a cor muda com as Definições do Sistema abertas ao lado.

### Task 22: Aviso
**Ficheiros:** `src/lib/components/ui/toast/*` (com o svelte-sonner ou à mão, pelo Passo 1) e `toast.test.ts`.

**Interfaces que produz** (Componentes (D7) · 14 · Aviso, `57:6346`; Movimento 3; Cor 6 e 7):
- `<Toaster />`, montado só nos testes nesta fase: em baixo ao centro, a 24 da margem, um visível de cada vez, 4 s; sem `mode-watcher` (o tema vem de `tokens.css`);
- `notify(text, { action?: { label, onClick } })`;
- aspeto: `px-4 py-2 gap-2 rounded-group bg-popover border border-border shadow-sombra-aviso`, ícone `circle-check` de 16 em `text-foreground`, texto `text-body-medium text-foreground`, ação como ligação `text-link` sublinhada no hover, com o anel da Task 5;
- movimento: entra em `duration-toast-in` 300 com fade e 8 px de baixo (`--distance-enter`, `ease-out`); sai em 200 com o inverso; com Reduzir movimento, só fade;
- tempos em sequência (Movimento 3: «entra em 300 ms, fica 4 s e sai em 200 ms»): os 4 s contam do fim da entrada (`animationend`, ou 300 ms se não houver animação), não do `notify`; a saída começa aos 4,3 s e o aviso sai do DOM aos 4,5 s. Se o ponteiro ou o foco já estiver por cima quando a entrada acaba, os 4 s ficam inteiros em pausa. Revisão de 2026-11-19;
- pausa com o ponteiro **ou** o foco por cima, e retoma com o tempo que faltava (WCAG 2.2.1); `aria-live="polite"`.

- [x] **Passo 1: verificação do svelte-sonner, no máximo duas horas, antes de adaptar.** Num ramo de rascunho na worktree (`npm i -E svelte-sonner@1.2.3` e `npx shadcn-svelte@1.8.1 add sonner`), ver, só com a API pública e CSS sobre `[data-sonner-toast]`:
  - a entrada e a saída acima;
  - só fade com Reduzir movimento;
  - a pausa e a retoma do tempo com o ponteiro e com o foco.
  Se as três passam, fica o svelte-sonner. Se uma falha, sai tudo (`git checkout -- .` só nos ficheiros desta task) e o Aviso faz-se à mão: uma região `aria-live`, um temporizador com pausa e retoma, e as classes acima. A decisão e o porquê ficam escritos nesta task.
  - **Decisão (2026-11-19): à mão.** O svelte-sonner 1.2.3 falha a pausa com o foco; sai tudo (`package.json` e `package-lock.json` voltam ao HEAD, a pasta `sonner/` apaga-se).
    - **Pausa com o ponteiro: passa.** O `mouseenter` do `<ol>` põe `expanded`, e o `Toast.svelte` guarda o tempo que falta (`pauseTimer`). No jsdom, com `vi.useFakeTimers()`: 1 s, 10 s com o ponteiro por cima, e o aviso sai 3 s depois de o ponteiro sair.
    - **Pausa com o foco: falha.** O temporizador só para com `expanded || interacting || página escondida`. O `onfocus` do `<ol>` só guarda o elemento anterior (`isFocusWithin`) e não põe `expanded`; só o atalho (⌥T) o põe. No jsdom: com o foco no botão da ação desde 1 s, o aviso sai aos 4 s. O `Toaster` não expõe `expanded`, e trocar a `duration` com `toast(…, { id })` recomeça o tempo do início (`toast.updated`), por isso não há retoma do tempo que faltava só com a API pública.
    - **Entrada e saída: só com CSS por cima da biblioteca.** Por omissão entra com `translateY(100%)` em 400 ms e a da frente sai a deslizar 100 %; dá para trocar o `--y` e as transições sobre `[data-sonner-toast]`, mas contra as regras dela.
    - **Só fade com Reduzir movimento: só com `!important`.** A biblioteca tira todas as transições (`transition: none !important`), também o fade; teríamos de a contrariar com outro `!important`.
    - **Antes do Passo 1 (Passo 0, pesquisa):** o Bits UI 2.21 não tem Toast; o Melt `Toaster` (0.44, antes da 1.0) pausa só com o ponteiro e traz `focus-trap` e `jest-axe` como dependências; o Ark UI e o Skeleton (Zag) trazem dezenas de pacotes `@zag-js/*`; o `@zerodevx/svelte-toast` (2024) e o `svelte-french-toast` (Svelte 3/4) estão parados. Nenhum era claramente melhor que o svelte-sonner ou que fazer à mão.
    - **Porquê à mão:** a pausa com o foco é uma das quatro condições da Cor 6 (WCAG 2.2.1); à mão são um ficheiro de estado e um componente, sem dependências, com as classes dos tokens e o `tw-animate-css` que já temos, e sem `mode-watcher`.
- [x] **Passo 2: testes que falham** (`toast.test.ts`, com `vi.useFakeTimers()`):
  - `announces_politely`;
  - `stays_4s_then_leaves`;
  - `pauses_on_hover_and_resumes_remaining_time`;
  - `pauses_on_focus_and_resumes_remaining_time`;
  - `action_is_link_styled_button`;
  - `only_one_visible`.
- [x] **Passo 3:** `npx vitest run src/lib/components/ui/toast` falha.
- [x] **Passo 4:** o componente pelo caminho do Passo 1.
- [x] **Passo 5:** os testes passam e passam os quatro comandos.
- [x] **Passo 6:** commit `feat(ui): export toast with 4 s hold and pause on hover or focus`.

**Verificar no ecrã:** entra de baixo, e só com fade com Reduzir movimento; o VoiceOver lê o texto uma vez.

### Task 23: Janela modal
**Ficheiros:** `npx shadcn-svelte@1.8.1 add dialog alert-dialog`; adaptar `src/lib/components/ui/dialog/*` e `alert-dialog/*`; criar `dialog.test.ts`. Depende da Task 6 (`scrim`).

**Interfaces que produz** (Componentes (D7) · 15 · Janela modal, Q-A, Q-E a Q-G, K1; Movimento 4; «Revisão · Foco, VoiceOver e Reduzir transparência»):
- `Dialog` (Kobo novo, `role="dialog"`) e `AlertDialog` (Apagar livro, atualização, `role="alertdialog"`), com `aria-modal`, nome no título e descrição no texto;
- aspeto (`58:6822`): 380 de largura, `p-6 gap-2 rounded-menu bg-popover border border-border shadow-sombra-janela`; título `text-title-3`, texto `text-body text-foreground`; botões à direita, `pt-4 gap-2`;
- escurecer: `bg-scrim`, a variável do Figma (Q-G);
- foco (Q-E): só vai para um campo de texto, se houver (`initialFocus`); senão, para a própria janela (`tabindex="-1"`), como na correção do `UpdateDialog`. Fica preso, e volta ao controlo que a abriu;
- teclas: Esc e ⌘. fazem o mesmo que Cancelar; Return carrega no botão por omissão, se houver. O Apagar não tem botão por omissão (Q-A);
- `destructive`: Secundário com `text-destructive-text` (Q-A), não uma variante nova do Botão;
- movimento: abre em 200 com opacidade de 0 a 1 e escala de 0,97 a 1, a partir do centro, `ease-out`; fecha em 150 com o inverso; o escurecer em fade no mesmo tempo; com Reduzir movimento, só fade;
- as janelas concretas (Apagar livro e Kobo novo, K1) montam-se na Fase 5, com os textos do `pt.json`.

- [x] **Passo 1: testes que falham** (`dialog.test.ts`):
  - `alert_dialog_role_name_and_description`;
  - `focus_goes_to_window_without_text_field`;
  - `focus_goes_to_text_field_when_present`;
  - `focus_is_trapped_and_returns_to_opener`;
  - `escape_and_cmd_period_cancel`;
  - `return_does_not_confirm_without_default_button`;
  - `return_confirms_default_button`;
  - `destructive_action_is_secondary_with_destructive_text`;
  - `overlay_uses_scrim`.
- [x] **Passo 2:** `npx vitest run src/lib/components/ui/dialog` falha.
- [x] **Passo 3:** adaptar; ⌘. num `keydown` da janela.
- [x] **Passo 4:** os testes passam e passam os quatro comandos.
- [x] **Passo 5:** commit `feat(ui): Dialog and AlertDialog with macOS focus and keys`.

**Verificar no ecrã:** a escala a partir do centro, e só fade com Reduzir movimento; o VoiceOver lê o título e o texto ao abrir.

### Task 24: Capa e Miniatura
**Ficheiros:** criar `src/lib/components/ui/cover/cover.svelte`, `thumbnail.svelte`, `cover-tone.ts`, `index.ts` e `cover.test.ts` (sem base shadcn; o `aspect-ratio` do vega não acrescenta nada a `aspect-2/3`).

**Interfaces que produz** (Componentes (D7) · 16 · Capa e 17 · Miniatura, `63:3281` e `63:3295`; Biblioteca):
- `<Cover src? title author bookId newCount? class? />`:
  - 2:3, `rounded-cover`, contorno `cover-border`;
  - com imagem: `object-fit: cover`;
  - sem imagem: fundo de `COVER_BG[coverTone(bookId)]`, um mapa estático com as oito classes inteiras (`verde: 'bg-cover-verde'`, …), escolhido de forma estável; título `Capa/Título` em `text-cover-foreground` até quatro linhas com reticências, e autor `Capa/Autor`; `p-3 gap-1`; o texto pintado fica `aria-hidden`;
  - etiqueta «N novos» (Task 9) a 8 px das margens, em baixo à esquerda; sai em fade de 150 com `ease-out` quando os novos acabam (Movimento 3);
  - a Capa não tem foco: é o elemento pintado do anel do Cartão (Task 25), por isso aceita a classe `group-focus-visible/card:focus-ring` e não corta o que está fora (`overflow-hidden` só na imagem, não no contorno);
- `<Thumbnail src? bookId />`: 24 × 36, `rounded-thumb`, contorno `cover-border`, decorativa.

- [x] **Passo 1: testes que falham** (`cover.test.ts`):
  - `cover_tone_is_stable_per_book`;
  - `cover_tone_uses_all_eight_tones`;
  - `cover_classes_are_compiled`: cada classe de `COVER_BG` existe no CSS gerado pelas fontes de produção;
  - `painted_text_is_hidden_from_voiceover`;
  - `title_uses_line_clamp_4`;
  - `badge_shows_new_count_and_leaves_when_zero`;
  - `thumbnail_is_24_by_36_and_decorative`.
- [x] **Passo 2:** `npx vitest run src/lib/components/ui/cover` falha.
- [x] **Passo 3:** os componentes.
- [x] **Passo 4:** os testes passam e passam os quatro comandos.
- [x] **Passo 5:** commit `feat(ui): Cover and Thumbnail`.

**Verificar no ecrã:** quatro linhas com reticências; o fade da etiqueta; o contorno sobre capas claras.

### Task 25: Cartão do livro
**Ficheiros:** criar `src/lib/components/ui/book-card/book-card.svelte`, `index.ts` e `book-card.test.ts` (o `card` do shadcn não entra: P2, não há Card genérico).

**Interfaces que produz** (Componentes (D7) · 18 · Cartão do livro, `65:4268`; Q-B, Q-J):
- `<BookCard book selected? />`: `role="gridcell"` com `aria-selected` e `group/card`; a grelha, as setas e a seleção múltipla ficam no ecrã (Fase 5);
- Capa (Task 24) e, por baixo, a `gap-2`: título `text-body-medium text-foreground` até duas linhas; autor `text-callout text-muted-foreground`, ou «Autor desconhecido»; ícone `highlighter` de 12 e a contagem em `text-tertiary-foreground`, com algarismos tabulares;
- selecionado (Q-B): moldura de 175 × 260 com `stroke/ring` em `primary` e `rounded-control`; visto de 20 com fundo `primary` e contorno `background`; sem animação;
- foco (Task 5): o `gridcell` tem o foco; o anel pinta-se na Capa quando não está selecionado, e na moldura de seleção, encostado, com raio 9, quando está (Q-J, F1); nunca à volta do título;
- VoiceOver: «Os Maias, Eça de Queirós, 58 destaques, 11 novos», e «selecionado».

- [x] **Passo 1: testes que falham** (`book-card.test.ts`):
  - `name_reads_title_author_counts`;
  - `unknown_author_fallback`;
  - `selected_sets_aria_selected_and_frame`;
  - `title_uses_line_clamp_2`;
  - `count_is_tabular`;
  - `focus_ring_is_painted_on_cover_or_selection_frame`: a classe `group-focus-visible/card:focus-ring` está na Capa sem seleção e na moldura com seleção, e não no título.
- [x] **Passo 2:** `npx vitest run src/lib/components/ui/book-card` falha.
- [x] **Passo 3:** o componente e as chaves em `book.*`.
- [x] **Passo 4:** os testes passam e passam os quatro comandos.
- [x] **Passo 5:** commit `feat(ui): BookCard with selection frame and focus halo`.

**Verificar no ecrã** (WebKit do macOS 13.3 como mínimo): o anel com o teclado e não com o rato; selecionado e não selecionado; o anel segue o raio e não é cortado pela grelha; o VoiceOver lê o nome e «selecionado».

### Task 26: Linha da lista e Cabeçalho de coluna
**Ficheiros:** `npx shadcn-svelte@1.8.1 add table`; adaptar `src/lib/components/ui/table/*`; criar `book-row.svelte`, `column-header.svelte` e `table.test.ts` na mesma pasta.

**Interfaces que produz** (Componentes (D7) · 19 · Linha da lista e Cabeçalho de coluna, `66:4618` e `66:4649`):
- `<BookRow book selected? />`:
  - `h-11 px-2 gap-4 rounded-control`; colunas Título (o resto), Autor 200, Destaques 88 à direita, Última leitura 120;
  - Título: Miniatura (Task 24), título `text-body-medium` numa linha, etiqueta a 8 px; Autor e Última leitura em `text-body text-muted-foreground`; Destaques em `text-body text-foreground` com algarismos tabulares;
  - filete `border` entre linhas, escondido no hover e na selecionada;
  - hover `bg-accent` em `duration-hover` com `ease-hover`;
  - selecionada (e com foco, Componentes 4): `bg-primary`, todo o texto `text-primary-foreground`, a etiqueta fica com o seu fundo; sem anel e sem animação; `aria-selected`;
- `<ColumnHeader label sort="none" | "asc" | "desc" align="start" | "end" onclick />`:
  - altura 28, `px-2 gap-1`, `text-callout-medium text-muted-foreground`;
  - ativa: `text-foreground` com `arrow-up`/`arrow-down` de 12;
  - à direita, a seta vem antes do rótulo;
  - `aria-sort` no `th`: `asc` → `ascending`, `desc` → `descending`, `none` → `none`; o clique chama `onclick` e quem usa decide a ordem.

- [x] **Passo 1: testes que falham** (`table.test.ts`):
  - `row_columns_have_figma_widths`;
  - `selected_row_is_primary_with_badge_kept`;
  - `separator_hidden_on_hover_and_selected`;
  - `highlights_count_is_tabular_and_right_aligned`;
  - `header_maps_sort_to_aria_sort`: `ascending`, `descending` e `none`;
  - `header_click_calls_onclick`;
  - `right_aligned_header_puts_arrow_first`.
- [x] **Passo 2:** `npx vitest run src/lib/components/ui/table` falha.
- [x] **Passo 3:** adaptar e criar os dois componentes.
- [x] **Passo 4:** os testes passam e passam os quatro comandos.
- [x] **Passo 5:** commit `feat(ui): BookRow and sortable ColumnHeader`.

**Verificar no ecrã:** reticências no título; o VoiceOver lê a ordem da coluna.

### Task 27: Destaque
**Ficheiros:** criar `src/lib/components/ui/highlight/highlight.svelte`, `index.ts` e `highlight.test.ts`.

**Interfaces que produz** (Componentes (D7) · 20 · Destaque, `67:5072`; Q-D, Q-H, Q-I):
- `<Highlight highlight state="normal" | "novo" | "removido" oncopy />`:
  - linha à esquerda de `stroke/highlight-line` 2: `highlight-line-new` (Novo), `highlight-line` (Normal), tracejada 4/4 (Removido); `pl-4 gap-2`;
  - metadados `text-callout text-muted-foreground`; texto `Leitura/Destaque` em `text-foreground`; nota `text-body text-muted-foreground`, com o ícone `message-square` e `aria-label` «Nota» (Q-D);
  - removido: «Removido do Kobo» em `text-callout text-tertiary-foreground`, com `unlink` `aria-hidden`;
- hover e foco (Q-I, C3 com fade): fundo `bg-accent` com `p-4 -m-4`, em fade de 120 com `ease-hover` (fica com Reduzir movimento); o botão «Copiar citação» (24, `copy`) aparece e é a paragem seguinte do Tab; depois de copiar, `check` durante 2 s; se falhar, «Erro ao copiar»;
- o espaço de 48 entre destaques (Q-H, `gap-12`) é da lista, no ecrã (Fase 5);
- VoiceOver: «Capítulo 2, 10 de novembro, novo, com nota» e depois o texto.

- [x] **Passo 1: testes que falham** (`highlight.test.ts`):
  - `line_token_per_state`;
  - `removed_is_dashed_with_label`;
  - `note_icon_is_labelled_nota`;
  - `copy_button_appears_on_focus_and_is_next_tab_stop`;
  - `copy_shows_check_for_2s`;
  - `copy_error_label`;
  - `accessible_summary_reads_chapter_date_new_note`: o texto do nome acessível, não o que o VoiceOver diz.
- [x] **Passo 2:** `npx vitest run src/lib/components/ui/highlight` falha.
- [x] **Passo 3:** o componente e as chaves em `highlight.*`.
- [x] **Passo 4:** os testes passam e passam os quatro comandos.
- [x] **Passo 5:** commit `feat(ui): Highlight with copy on hover and focus`.

**Verificar no ecrã:** o fundo do hover em fade, também com Reduzir movimento; o tracejado 4/4; o VoiceOver.

### Task 28: Cabeçalho da Biblioteca
**Ficheiros:** criar `src/lib/components/ui/library-header/library-header.svelte`, `index.ts`, `library-header.test.ts` e `library-header-fixture.svelte` (consumidor pequeno, só para o teste).

**Interfaces que produz** (Componentes (D7) · 21 · Cabeçalho da Biblioteca, `67:5835`; Movimento 2 e 3):
- `<LibraryHeader state onShowOnly onExport onRetry />`, com `state` = `novos { highlights, books, since }`, `aSincronizar { done, total }`, `semNovidades { syncedAt }` ou `erro { message }`, e `exporting`/`exported` vindos de quem usa;
- `min-h-control`, mensagem `text-title-3 text-foreground`, detalhe `text-body` (`text-tertiary-foreground`; `text-muted-foreground` no Erro), `flex-wrap` com `gap-y-1` e `items-baseline`; ações a `gap-2`;
- textos: «N destaques novos em M livros» e «desde 9 nov.», com «Mostrar só estes» e «Exportar M livros»; «A sincronizar com o Kobo · N de M livros»; «Sem destaques novos» e «sincronizado às 10:42»; no Erro, `circle-alert` de 16 em `text-destructive` e «Tentar de novo». Datas e horas com `Intl` no idioma da app;
- botão de exportar: «Exportar N livros» → «A exportar…» → «✓ Exportado» durante 2 s, trocas sem animação (Movimento 3);
- movimento: a faixa entra em `duration-reveal` 250 com `ease-out`; sai em fade de 150; com Reduzir movimento, só fade;
- anúncios: uma região `aria-live="polite"` à parte, que diz só o início («A sincronizar com o Kobo») e o fim (a mensagem de Novos ou Sem novidades); o «N de M livros» muda no ecrã mas não se anuncia; `role="alert"` no Erro.
- O ícone que roda (Movimento 2) é o Sincronizar da Barra (Task 30).

- [x] **Passo 1: testes que falham** (`library-header.test.ts`, com o fixture):
  - `novos_text_with_plurals`;
  - `syncing_text_counts_books`;
  - `no_news_shows_sync_time`;
  - `announces_start_and_end_only`: o texto da região muda no início e no fim, e não a cada livro;
  - `error_is_alert_and_retry_calls_on_retry`;
  - `show_only_and_export_call_callbacks`;
  - `export_button_shows_exported_for_2s`.
- [x] **Passo 2:** `npx vitest run src/lib/components/ui/library-header` falha.
- [x] **Passo 3:** o componente e as chaves em `screens.library.*`.
- [x] **Passo 4:** os testes passam e passam os quatro comandos.
- [x] **Passo 5:** commit `feat(ui): LibraryHeader with sync, news and error states`.

**Verificar no ecrã:** a quebra de linha com um erro longo; só fade com Reduzir movimento; o VoiceOver diz o início e o fim.

### Task 29: Título-menu
**Ficheiros:** criar `src/lib/components/ui/title-menu/title-menu.svelte`, `index.ts` e `title-menu.test.ts`, sobre o Menu da Task 17.

**Interfaces que produz** (Componentes (D7) · 22 · Título-menu, `68:6124`):
- `<TitleMenu readers activeReaderId onselect />`;
- com um leitor: «Biblioteca», texto sem seta e sem menu;
- com vários: «Biblioteca de <leitor>», botão `h-toolbar-button px-2 gap-1 rounded-control`, `text-title-3 text-foreground`, `chevron-down` em `text-muted-foreground`; aberto `bg-accent-pressed`; `aria-haspopup="menu"` e `aria-expanded`;
- menu de 200 a 4 px por baixo, só com os leitores, marca no ativo.

- [x] **Passo 1: testes que falham** (`title-menu.test.ts`):
  - `single_reader_is_plain_text`;
  - `several_readers_open_menu_with_check_on_active`;
  - `has_menu_popup_and_expanded_state`;
  - `open_uses_accent_pressed`;
  - `selecting_reader_calls_onselect`.
- [x] **Passo 2:** `npx vitest run src/lib/components/ui/title-menu` falha.
- [x] **Passo 3:** o componente e as chaves em `screens.library.*`.
- [x] **Passo 4:** os testes passam e passam os quatro comandos.
- [x] **Passo 5:** commit `feat(ui): TitleMenu for reader switching`.

**Verificar no ecrã:** o menu a 4 px por baixo do título.

### Task 30: Barra da janela
**Ficheiros:** criar `src/lib/components/ui/window-bar/window-bar.svelte`, `index.ts` e `window-bar.test.ts`.

**Interfaces que produz** (Componentes (D7) · 23 · Barra da janela, `69:6427`; D-Toolbar; Movimento 2 e 5):
- `<WindowBar screen="library" | "detail" canDelete? syncing? syncDisabledReason? … />`, `h-toolbar px-4 gap-4 bg-background border-b border-border`, `gap-1` dentro de cada grupo;
- Biblioteca: Título-menu · Grupo de vista e Ordenar (`arrow-up-down`, com o Menu «Ordenar por») · Sincronizar (`refresh-cw`) e Exportar (`download`);
- Detalhe: Voltar (`chevron-left`) · (Apagar `trash-2`) e Exportar;
- tooltips aprovados: «Sincronizar com o Kobo ⌘R», «Exportar N livros ⌘E», «Voltar ⌘[», «Apagar livro… ⌘⌫», «Ordenar por», «Grelha ⌘1», «Lista ⌘2» («Grelha» e «Lista» são nomes, não verbos); cada ícone com `aria-label`;
- Sincronizar a rodar: `animate-spin` de 1 s linear, que no fim espera pelo `animationiteration` para parar direito; com Reduzir movimento, não roda;
- a zona de arrastar e os semáforos (janela `Overlay`) ficam para a Fase 4; os atalhos e o menu da app também.

- [x] **Passo 1: testes que falham** (`window-bar.test.ts`):
  - `library_has_title_view_sort_sync_export_in_order`;
  - `detail_has_back_and_export_and_optional_delete`;
  - `tooltips_are_the_approved_strings`: os textos acima, palavra a palavra, em `pt.json`, e os de `en.json`;
  - `sync_stop_waits_for_animationiteration`: só prova o handler (despachar o evento no jsdom não prova a animação);
  - `disabled_sync_is_inert_and_explains_itself`.
- [x] **Passo 2:** `npx vitest run src/lib/components/ui/window-bar` falha.
- [x] **Passo 3:** o componente e as chaves `ui.windowBar.*`.
- [x] **Passo 4:** os testes passam e passam os quatro comandos.
- [x] **Passo 5:** commit `feat(ui): WindowBar for library and detail`.

**Verificar no ecrã:** o ícone pára direito no fim da volta; não roda com Reduzir movimento.

**Paragem:** o Bruno aprova a Fase 2. A comparação visual de cada componente fica para o seu primeiro ecrã (Fase 5). **Aprovada a 2026-11-19** (ver DECISIONS, «Paragem da Fase 2»).

### «Proposta»: juiz de fora para os componentes
- **Adotado agora, em pequeno:** o coordenador exporta do Figma, só com leitura, `design/components-sample.json` com as ligações a variáveis de três nós de risco alto: o item de menu realçado (`55:3185`), a contagem do segmento escolhido (`55:2588`) e a marca da caixa ligada e desativada (`55:1684`). Os testes `matches_figma_sample` das Tasks 12, 16 e 17 comparam-nas com os mapas de classes e com o CSS compilado. Custo: uma exportação e três testes. Escolhi estes porque são os sítios onde o shadcn, o DECISIONS e o Figma já divergiram.
- **Adiado:** a matriz completa (`design/components.json` com medidas, raios, paddings e ligações de todas as variantes e estados) e a página WebKit só de teste que lê o `getComputedStyle`. Custo de dois a três dias, mais tempo em cada `test:visual`, e o D3 rejeitou a galeria.
- **Recomendação:** a amostra agora. A matriz em jsdom só se o Figma voltar a mudar depois da Fase 2; a página WebKit só se as comparações da Fase 5 mostrarem desvios que os testes não apanharam.

### Discrepâncias resolvidas
- **Saída do Tooltip:** «Componentes (D7) · 7» (e a descrição do nó) diz que sai em `duration/out` 150; «Movimento 5» diz que desaparece logo. Fica o Movimento 5, que é a secção do movimento e a mais recente.
- **Contagem do segmento escolhido:** o texto da «Componentes (D7) · 9» diz `tertiary-foreground`; o nó liga `segmented-selected-count`. Fica o Figma.
- **Sombras:** as «Fundações» listam três; a `Sombra/Aviso` veio com a «Componentes (D7) · 14». Ficam as quatro, exportadas na Task 5.
- **Separador do menu:** «proposta por confirmar» no DECISIONS, descrito sem reservas no Figma. Fica o Figma.

### Questões para o Bruno
1. **Tabela de tons de destaque, antes da Task 21.** Recomendo uma tabela calculada antes, não uma regra aplicada a todas as cores: cada campo (botão, hover, premido, texto do botão, ligação, tom, texto do tom e anel) com a origem escrita (Figma, sistema pela Task 20, ou derivado e como); o azul aprovado fica igual (no Escuro, o premido é mais claro e o texto escuro); as amostras claras, como o Amarelo, podem ter texto escuro; e cada linha passa o contraste sem arredondar, em Claro e Escuro, para o normal, o hover, o premido, a ligação e o tom. Bloqueia só a Task 21. **Decidido (2026-11-19, Bruno: «Ok, concordo»): tabela pré-calculada, como recomendado.** A Task 21 continua à espera da Paragem da Task 20.

## Fase 3 · Backend do «novo» e da sincronização
**Tasks aprovadas pelo Bruno a 2026-11-19** (DECISIONS, «Tasks das Fases 3 e 4»).

**Pesquisa prévia:** não há candidatos externos. É o esquema interno da Biblioteca, sem biblioteca ou plugin que o resolva; o problema é a ordem dos eventos, não uma API.

**Implementadores (proposta):** Opus nas Tasks 31 e 32 (backend, §6); Sonnet na 33, com testes que fixam a ordem.

**Regras desta fase (do DECISIONS, «Âmbito da v2», «Novo»):**
- **número de sincronização, não relógio.** Cada sincronização recebe um `sync_seq` monotónico (em `meta`, incrementado dentro da transação; se a transação falha, o número não avança). Um destaque inserido guarda o seu `synced_seq`. Um livro guarda o `opened_seq`, **até onde o Bruno viu**: o maior `synced_seq` dos dados carregados quando abriu o livro, **nunca o «agora»**. Assim, abrir um livro a meio de uma sincronização não engole os destaques que ela traz;
- um destaque é novo se `synced_seq IS NOT NULL AND synced_seq > COALESCE(books.opened_seq, 0)`;
- `synced_seq` e `synced_at` só se escrevem na **inserção real** (o ramo `else` de `upsert_highlight`, `src-tauri/src/library/sync.rs:167-179`); um update ou um restauro nunca lhes toca. O `synced_at` é só para mostrar (o «desde 9 nov.»), com o mesmo `now` e o mesmo formato do `last_sync_at`;
- primeira sincronização do leitor = **zero linhas em `highlights` desse `reader_id`** (removidos incluídos) antes do ciclo, contadas dentro da transação. Nesse caso, `synced_seq` e `synced_at` ficam nulos. Nunca `kobos.last_sync_at IS NULL`, que é por Kobo;
- **comportamento assumido:** um leitor que apaga todos os livros volta a ter a Biblioteca vazia, e a sincronização seguinte não marca nada como novo;
- marca-se o livro **ao abrir**, e o Detalhe guarda um **snapshot** dos novos, tirado antes de marcar. Marcar ao sair faria os destaques chegados a meio da leitura deixarem de ser novos.

### Task 31: Migração v2, número de sincronização e `synced_seq`
**Ficheiros:** `src-tauri/src/library/schema.rs`, `src-tauri/src/library/mod.rs`, `src-tauri/src/library/sync.rs`; criar `src-tauri/tests/library_new.rs` (os helpers de `library_sync.rs:25-84` que fizerem falta passam para `tests/common/mod.rs`).

**Interfaces que produz:**
- `MIGRATIONS[1]` (v2): `ALTER TABLE highlights ADD COLUMN synced_seq INTEGER; ALTER TABLE highlights ADD COLUMN synced_at TEXT; ALTER TABLE books ADD COLUMN opened_seq INTEGER;`. A v1 não se edita;
- `meta('sync_seq')`, lido e incrementado dentro da transação `IMMEDIATE` do `sync`;
- um relógio no `Library`: o campo `clock: Box<dyn Fn() -> DateTime<Utc> + Send>`, que por omissão é `Utc::now`, e `#[doc(hidden)] pub fn with_clock(self, f) -> Self` para os testes de integração (só para as datas mostradas; a regra do «novo» não depende dele);
- `upsert_highlight` recebe `Option<(seq, &str)>`, que é `None` na primeira sincronização do leitor.

- [x] **Passo 1: testes que falham** (`library_new.rs`):
  - `migration_v2_keeps_v1_data`: uma base v1 com destaques migra para `user_version = 2`, e as linhas antigas ficam com `synced_seq` nulo;
  - `first_sync_of_reader_marks_nothing`;
  - `seq_increments_per_sync`, e `failed_sync_does_not_advance_seq`;
  - `insert_after_first_sync_gets_seq_and_at`;
  - `second_kobo_unseen_bookmarks_get_seq` (cenário `SERIAL-A`/`SERIAL-B` de `library_sync.rs:12-23`);
  - `same_bookmark_again_keeps_seq`: o update e o restauro não mudam o valor.
- [x] **Passo 2:** `(cd src-tauri && cargo test --test library_new)` falha.
- [x] **Passo 3:** migração, número de sincronização e escrita na inserção.
- [x] **Passo 4:** passa o `cargo test` inteiro (incluindo `library_sync.rs`, sem mudanças de comportamento), e os quatro comandos do frontend.
- [x] **Passo 5:** commit `feat(library): v2 migration and sync sequence`.

### Task 32: `isNew`, `markBookOpened` e resumo do leitor
**Ficheiros:** `src-tauri/src/library/mod.rs` (`BOOK_COLUMNS` :116, `query_books` :362-406), `src-tauri/src/commands/library.rs`, `src-tauri/src/lib.rs` (`collect_commands!`), `src/lib/bindings.ts` (regenerado), `src-tauri/tests/library_new.rs`, `src/lib/contract.test.ts`.

**Interfaces que produz:**
- `LibraryHighlight.is_new: bool` (`isNew`) e `synced_seq: Option<u32>` (`syncedSeq`), calculados no SELECT. As colunas novas entram **no fim** dos SELECT posicionais, para não deslocar índices;
- o command `mark_book_opened(reader_id: u32, book_id: u32, seen_seq: u32) -> ()`: faz `opened_seq = MAX(COALESCE(opened_seq, 0), seen_seq)`, sem nunca baixar. Um livro de outro leitor dá `NotFound`;
- o command `library_summary(reader_id: u32, kobo_serial: Option<String>) -> LibrarySummary { new_since: Option<String>, last_sync_at: Option<String> }`:
  - `new_since` é o `MIN(synced_at)` dos destaques novos do leitor (o «desde 9 nov.»);
  - `last_sync_at` é o `kobos.last_sync_at` **do Kobo ligado** (o «sincronizado às 10:42»; Bruno, 2026-11-19). O frontend passa o `connectedDevice.serialNumber` (`library.svelte.ts:162-163`). Sem Kobo ligado, ou com um Kobo de outro leitor, vem `None` e o texto não se mostra;
- bindings: `UPDATE_BINDINGS=1 cargo test bindings_are_up_to_date`.

- [x] **Passo 1: testes que falham:**
  - `never_opened_book_is_new`;
  - `opening_with_seen_seq_clears_new`;
  - `sync_while_open_is_new_next_open`: carregar, marcar com o que foi carregado, sincronizar, reabrir. Os destaques dessa sincronização vêm `isNew`;
  - `open_during_sync_is_new_next_open`, **a corrida**: carregar (seq 1), correr a sincronização 2 que traz destaques para o livro, e só depois marcar com `seen_seq = 1`. Reabrir: os da 2 vêm `isNew`;
  - `mark_never_lowers_opened_seq`;
  - `mark_book_opened_other_reader_is_not_found`;
  - `new_since_is_oldest_unseen` e `new_since_none_when_nothing_new`;
  - `last_sync_at_is_the_connected_kobos`, `last_sync_at_none_without_kobo` e `last_sync_at_none_for_other_readers_kobo`;
  - `export_output_unchanged`: o Markdown exportado é igual byte a byte;
  - `contract.test.ts`: `markBookOpened` e `librarySummary` existem com os argumentos certos.
- [x] **Passo 2:** os testes falham.
- [x] **Passo 3:** os SELECT, os dois commands e os bindings.
- [x] **Passo 4:** passa o `cargo test` inteiro, e os quatro comandos do frontend.
- [x] **Passo 5:** commit `feat(library): isNew, markBookOpened and library summary`.

### Task 33: snapshot dos novos no `LibraryStore`
**Ficheiros:** `src/lib/stores/library.svelte.ts`, `src/lib/stores/library.svelte.test.ts`, `src/routes/+page.svelte` (`handleBookClick` :256-264 e `handleCloseBookDetails` :266-269, só as chamadas).

**Interfaces que produz:**
- `library.openBook(bookId)` é **o único ponto de entrada** para abrir um livro. A ordem é esta:
  1. tira o snapshot `viewingNewIds: ReadonlySet<string>` (os ids dos destaques são `string` nos bindings) com os ids `isNew` do livro;
  2. calcula `seenSeq`, o maior `syncedSeq` dos destaques carregados desse livro (ou 0);
  3. chama `commands.markBookOpened(readerId, bookId, seenSeq)`;
  4. se der certo, põe `isNew = false` **só nos ids do `viewingNewIds`**. Os que tenham chegado entretanto num reload ficam novos.
- `library.closeBook()`. O `setViewingBookId` deixa de ser público. Na Fase 5, o Enter da grelha e da lista também tem de passar pelo `openBook`;
- `viewingNewIds` só muda ao abrir outro livro. O reload do `syncFinished` (`openReader`, `library.svelte.ts:84-90`) não lhe toca;
- se o `markBookOpened` falhar, os novos ficam como estavam e o erro vai para o log (não se mostra ao utilizador).

- [x] **Passo 1: testes que falham:**
  - `snapshot_taken_before_mark`: no mock do `invoke`, o `mark_book_opened` vê o snapshot já preenchido e recebe o `seenSeq` dos dados carregados;
  - `snapshot_survives_sync_reload`: um `openReader` com dados novos não muda o `viewingNewIds`;
  - `mark_clears_only_snapshot_ids`: um reload que chega antes da resposta do `markBookOpened` traz um destaque novo, e esse fica `isNew`;
  - `mark_failure_keeps_new`;
  - `reopen_takes_fresh_snapshot`;
  - `open_book_is_the_only_entry`: um teste de fonte confirma que nada fora do store chama o `setViewingBookId`.
- [x] **Passo 2:** `npx vitest run src/lib/stores` falha.
- [x] **Passo 3:** o store e as chamadas em `+page.svelte`.
- [x] **Passo 4:** passam os testes e os quatro comandos.
- [x] **Passo 5:** commit `feat(library): snapshot new highlights when opening a book`.

**Fim da Fase 3:**
- review GPT‑6.2 Sol do lote 31–33;
- suite completa (`cargo test` e Vitest) uma vez;
- 2–3 mutações por task. Exemplos: `>=` no lugar de `>`, `synced_seq` escrito no UPDATE, `opened_seq` com o seq atual em vez do `seen_seq`, snapshot tirado depois de marcar.

**Paragem:** o Bruno aprova a Fase 3. **Aprovada a 2026-11-19**, depois da review do lote 31–33 e das correções `391c815` (DECISIONS, «Review do lote 31–33»).

## Fase 4 · Janela
**Tasks aprovadas pelo Bruno a 2026-11-19** (DECISIONS, «Tasks das Fases 3 e 4»).

**Versões instaladas (verificadas no `Cargo.lock`):** tauri 2.12.5, tao 0.37.2, wry 0.57.2, `@tauri-apps/api` 2.12.4. Não há `tauri-plugin-store`: as definições vivem num ficheiro, lido e escrito pelos commands `load_settings` e `save_settings` (`src-tauri/src/commands/mod.rs:67`, `:83`).

**Pesquisa prévia e benchmarking (2026-11-19)** (as fontes estão no relatório da pesquisa; o coordenador confirmou as linhas marcadas com ✓ no código instalado):

| Problema | Opções | Escolha | Razão |
|---|---|---|---|
| Semáforos na posição certa | config `Overlay` + `trafficLightPosition`; reaplicar em Rust (objc2) nos eventos; `tauri-plugin-decorum` 1.1.1; `tauri-plugin-decor` 1.0 | **Só a config** | A tao 0.37.2 já reaplica a posição no `drawRect:`, ao sair do ecrã inteiro e ao mudar o título (tao#1254). O decorum está parado desde set/2024, e a compatibilidade com a 2.12 não está confirmada. Só reaplicamos em Rust se o ecrã mostrar desvio (wry#1747) |
| Arrastar pela barra | `data-tauri-drag-region="deep"`; o atributo em cada filho; `startDragging()` à mão | **`"deep"` no contentor** ✓ | Existe desde a 2.11 (`drag.js:46`, `:64`). Os `<button>`, os `[tabindex]` e os roles interativos continuam clicáveis; o duplo clique faz zoom. A documentação oficial ainda não fala disto |
| Definições entre janelas | evento global depois de guardar; `emitTo("main")`; `tauri-plugin-store`; estado partilhado em Rust | **`app.emit("settings-changed")`** no fim de um `save_settings` com sucesso | Usa o `emit`/`listen` que já temos e não acrescenta dependências; a fonte continua a ser o ficheiro. O store obrigava a migrar os formatos v1 e v2 |
| Uma só janela de Definições | criar em Rust quando é pedida; criar em JS; declarar no `tauri.conf.json` escondida | **Rust, quando é pedida**: `get_webview_window("settings")` → `unminimize`, `show`, `set_focus`, senão o builder | Fica garantido que há uma só e não é preciso dar permissões de criação ao JS. Declarar a janela escondida carregava um segundo webview em cada arranque |
| Rota `/definicoes` em produção | fallback do adapter-static; prerender | **O fallback que já existe** ✓ | `adapter({ fallback: "index.html" })`, e o `get_asset` do tauri cai no `index.html` (`manager/mod.rs:410`) |

**Implementadores (proposta):** Sonnet na Task 34 (config e marcação); Opus na 35 (janelas, eventos e fecho).

### Task 34: Barra `Overlay` na janela principal
**Passo 0 (coordenador, só leitura no Figma):** medir em `69:6427` o `x` e o `y` dos semáforos e a largura que a barra lhes reserva; escrevê-los aqui antes de entregar a task.
**Medido a 2026-11-19** (`69:6427`, as três variantes iguais):
- a barra tem 52 de altura, `px-4` e `gap-4`;
- o bloco «Semáforos (sistema)» tem 52 × 12 e fica em x=16, y=20: três círculos de 12 com 8 de intervalo, centrados na linha média da barra (y=26);
- o primeiro controlo começa em x=84, que é 16 + 52 + 16;
- `trafficLightPosition: { "x": 16, "y": 20 }` é o **valor de partida**. Na tao 0.37.2 (`view.rs:1017-1047`), o `x` é a margem do primeiro botão e o `y` é a margem do topo até à moldura do botão, que no AppKit é um pouco maior do que o círculo. O valor final acerta-se no ecrã (±2) e fica escrito aqui;
- a `WindowBar` reserva um bloco de 52 × 12 que não é interativo e entra na zona de arrasto, antes do primeiro controlo; o `gap-4` faz o resto.

**Mudança aprovada a 2026-11-19** (Bruno: «Prepara agora, liga no ecrã 1»). A `WindowBar` ainda não está montada em nenhum ecrã: o `+page.svelte` usa o `<header>` antigo e a `LibraryToolbar`. Por isso, a troca para `Overlay` no `tauri.conf.json`, o teste `main_window_is_overlay` e as verificações no ecrã passam para o **ecrã 1 da Fase 5**, quando a Barra for montada. Assim, a app no ramo nunca fica com os semáforos por cima do cabeçalho antigo.

**Ficheiros:** `src-tauri/capabilities/default.json`, `src/lib/components/ui/window-bar/window-bar.svelte` e o seu teste; criar `src/lib/window-config.test.ts`.

**Interfaces que produz:**
- ~~janela `main` com Overlay~~ → ecrã 1 da Fase 5;
- `core:window:allow-start-dragging` na capability `default` (sem ela, o arrasto falha em silêncio);
- `WindowBar` com `data-tauri-drag-region="deep"` no contentor, e o espaço dos semáforos reservado à esquerda.

- [x] **Passo 1: testes que falham:**
  - `window-config.test.ts`: `default_capability_allows_start_dragging`, que lê o JSON do disco (o `main_window_is_overlay` entra no ecrã 1);
  - `window-bar.test.ts`: `bar_is_deep_drag_region`, `every_control_is_semantic` (todo o interativo é `button` ou tem um role interativo, para não arrastar) e `reserves_traffic_light_space`.
- [x] **Passo 2:** os testes falham.
- [x] **Passo 3:** a config, a capability e a marcação.
- [x] **Passo 4:** passam os quatro comandos e `(cd src-tauri && cargo check)`.
- [x] **Passo 5:** commit `feat(window): drag region and traffic-light space in WindowBar`.

**Verificar no ecrã (Bruno, com `npm run dev:app`), no ecrã 1 da Fase 5:**
- os semáforos ficam no sítio depois de redimensionar, de entrar e sair do ecrã inteiro (⌃⌘F), de fazer zoom com duplo clique, de mudar entre Claro e Escuro e de perder o foco;
- a barra arrasta e os botões clicam;
- com a janela inativa, o primeiro clique na barra arrasta (tauri#4316). Se não arrastar, decide-se se se usa o `acceptFirstMouse`.

### Task 35: Definições numa janela própria
**Ficheiros:** `src-tauri/src/window.rs` (o command `open_settings`), `src-tauri/src/lib.rs` (`collect_commands!`), `src-tauri/src/commands/mod.rs` (`save_settings` emite), criar `src-tauri/capabilities/settings.json`, criar `src/routes/definicoes/+page.svelte`, `src/routes/+layout.svelte`, `src/lib/menu.ts`, `src/lib/stores/settings.svelte.ts`, `src/routes/+page.svelte` (o `Modal` e o `listen('open-settings')` saem), `tests/visual/scenarios.ts`, e os bindings.

**Interfaces que produz:**
- o command `open_settings(title: String)`: se a janela `settings` existe, faz `unminimize`, `show` e `set_focus`. Se não existe, cria-a com `WebviewUrl::App("definicoes")`, o `title`, `resizable(false)` e a **barra normal** do macOS (sem Overlay). **Proposta:** a barra normal é a convenção das janelas de definições do macOS, e o Figma Q-M não mostra a moldura da janela;
- **o título** vem traduzido do JS (o Rust não tem i18n). Quando o idioma muda e é guardado, a própria janela faz `setTitle`;
- o item ⌘, do menu (`menu.ts:10-16`) chama `commands.openSettings(t('settings.windowTitle'))` em vez de `emit('open-settings')`;
- **⌘W:** hoje o menu não tem «Fechar janela». Entra o `PredefinedMenuItem` `CloseWindow` (com o `Minimize`) num submenu «Janela». O resto da barra de menus continua fora deste plano;
- a capability `settings` (só a janela `settings`): `core:default`, `core:event:default`, `core:window:allow-set-theme`, `core:window:allow-set-title`, `core:window:allow-close` (o Esc fecha com o `close()`), `core:window:allow-destroy` (o `onCloseRequested` do JS acaba num `destroy()`) e `dialog:default` (para escolher a pasta). Nada de `updater`, `process` nem `opener`;
- **escritas das duas janelas** (verificado: a principal muda `libraryViewMode` e `librarySort` no store, `+page.svelte:319-320`, e hoje só o `save()` das Definições os grava):
  - as Definições têm uma lista fechada de campos, a constante `SETTINGS_WINDOW_FIELDS` (os que o `SettingsPanel` edita);
  - o `save()` da janela `settings` relê o ficheiro, põe por cima só esses campos do rascunho e grava. Assim, uma mudança que a principal tenha gravado entretanto não se perde;
  - `save_settings` faz `app.emit("settings-changed", &settings)` quando guarda; se falhar, não emite;
  - na principal, o evento atualiza só os `SETTINGS_WINDOW_FIELDS`. Na das Definições, atualiza a base guardada e os campos que não foram mexidos, nunca o rascunho;
- **o idioma pré-visto** muda só a janela das Definições; a principal muda quando se guarda. Fechar sem guardar (botão vermelho, ⌘W, Esc) chama o `revertUnsavedLanguage` no `onCloseRequested` e não emite nada;
- o `+layout.svelte` só emite o `app-ready` e só corre o `updater.checkOnLaunch` na janela `main`. Na das Definições correm só o i18n, o tema e o `settings.init()`;
- os cenários `settings*` do harness passam a abrir a rota `/definicoes` diretamente, e o mock do `getCurrentWindow()` devolve o label `settings` (senão o layout corre o `app-ready` e o updater, e as baselines mudam por outra razão). As baselines `settings--*` são regeneradas, e o coordenador revê o diff de cada uma. O total de cenários continua 73.

- [x] **Passo 1: testes que falham:**
  - Rust: `settings_window_spec` (uma função pura devolve o label, o URL, o título, `resizable` e o estilo da barra, e o teste fixa-os); `save_emits_only_on_success`;
  - Vitest: `menu_settings_invokes_open_settings` (com o título traduzido); `menu_has_close_window`; `layout_skips_app_ready_and_updater_outside_main`; `settings_changed_updates_only_settings_fields_in_main`; `event_keeps_unsaved_draft`; `settings_save_keeps_main_changes`; `close_without_save_reverts_language`; `saved_language_updates_window_title`; `page_has_no_settings_modal`; `settings_capability_is_minimal` (lê o JSON, e inclui `allow-close` e `allow-set-title`).
- [x] **Passo 2:** os testes falham.
- [x] **Passo 3:** a implementação; os bindings regenerados.
- [x] **Passo 4:** passam os quatro comandos, o `cargo test` e o `npm run test:visual`, com as baselines novas revistas. O `npm run build` também tem de passar, porque a rota tem de existir no build de produção.
- [x] **Passo 5:** commit `feat(window): settings in their own window`.

**Verificar no ecrã (Bruno):**
- ⌘, repetido, com a janela minimizada, com as Definições em foco, e depois de as fechar e reabrir: há sempre uma só janela;
- guardar atualiza a principal sem recarregar (idioma, tema, cor de destaque);
- com o build de produção, a janela abre a rota sem dar 404.

**Fim da Fase 4:** review GPT‑6.2 Sol do lote 34–35; suite completa uma vez; 2–3 mutações por task (ex.: tirar o `allow-start-dragging`, emitir antes de guardar, correr o updater na janela `settings`).

**Paragem:** o Bruno aprova a Fase 4. Depois vem a Fase 5, um ecrã de cada vez.

**Feita e aprovada a 2026-11-19** (Bruno: «Aprovo»).
- **Review do lote 34–35:** a review independente foi feita pelo `dod-guard:adversarial-reviewer` (Opus), porque não há GPT. As correções estão em `323f717`:
  - `update_settings(patch)`, com lock no Rust;
  - a principal lembra a ordenação e a vista;
  - o `confirm()` passa a ser esperado com `await`;
  - guarda no updater;
  - fechar a principal sai da app;
  - lock no `open_settings`;
  - `settings_reader`;
  - `readers-changed`;
  - a janela é criada escondida.
- **Verificado no ecrã com `npm run dev:app`:**
  - ⌘, repetido e com a janela minimizada;
  - fechar a principal sai da app;
  - ⌘Q limpo;
  - não há flash;
  - Guardar atualiza a principal;
  - a ordenação e a vista mantêm-se entre arranques;
  - Repor padrões e Cancelar pedem confirmação.
- **Fica para a Fase 5 (ecrã 7):**
  - as Definições mostram o Leitor que a principal tem aberto;
  - renomear um Leitor atualiza a principal.
  
  Os dados dev não têm nenhum Kobo sincronizado. Até lá, estes dois pontos estão cobertos pelos testes `shows the Reader the main window has open`, `settings_reader_keeps_a_name_draft` e `reloads the readers when Settings renamed one`.
- **Ainda por verificar:** a rota sem 404 no build de produção (passa o `npm run build`, mas não se abriu a `.app`).

## Fase 5 · Ecrãs, por moldura (tasks a escrever)
Cada ecrã fica feito em Claro e Escuro, comparado com o Figma, com captura. O Bruno aprova antes do seguinte («Ecrãs · Ordem de construção»).

| Ordem | Ecrã | Figma (Claro / Escuro) | O que muda no comportamento |
|---|---|---|---|
| 1 | Biblioteca, grelha | `71:8040` / `71:8273` | Etiquetas «N novos» e cabeçalho, a partir da Fase 3. Monta a `WindowBar` e liga o Overlay: `titleBarStyle: "Overlay"`, `hiddenTitle: true` e `trafficLightPosition` (Task 34, Passo 0), com o teste `main_window_is_overlay`, o `cargo check` e as verificações no ecrã da Task 34 |
| 2 | A sincronizar | `71:8575` / `71:8590` | O `ImportingState` sai e a Biblioteca fica à vista (D5, R17). Exportar fica desativado, com o tooltip «Espera pelo fim da sincronização» |
| 3 | Kobo desligado, sem novidades | `71:9162` / `71:9177` | Sincronizar desativado, com o tooltip «Liga o Kobo para sincronizar» |
| 4 | Lista | `71:9740` / `71:9755` | A mesma ordem da grelha |
| 5 | Detalhe | `71:10560` / `71:10965` | Filtro Todos · Novos · Com notas, e `markBookOpened` (D2) |
| 6 | Primeiro arranque e Kobo novo | `72:11425` / `72:11443`, `72:11461` / `72:11500` | Texto novo do Kobo novo em pt e en |
| 7 | Definições | secção `73:12021` e Q-M (`74:18560`) | Pop-up de leitor com dois ou mais leitores, e 4 textos novos. Verificar no ecrã, com um Kobo sincronizado na build dev: as Definições mostram o Leitor da principal, e renomear um Leitor atualiza a principal (adiado da Fase 4) |
| 8 | Exportação | Q-Y, Y1: `137:34169` / `137:35323`, erro `137:34750` / `137:35904` | O erro segue `folderNotWritable`, não «a pasta já não existe» (Task 47) |
| 9 | Apagar livro | `74:16535` / `74:16671`, `74:16868` / `74:16918` | ⌘⌫ e a janela modal Q-A |
| 10 | Vários leitores | `74:17138` / `74:17195` e seguintes | Título-menu como seletor (R4) |

O diálogo de atualização (Q-U, Q-V) passa aos componentes novos junto com o ecrã 7.

**Teste de UI obrigatório no ecrã 5 (Detalhe):** `detail_keeps_new_marks_through_sync`. Com o Detalhe aberto e marcas «Novo» à vista, um `syncFinished` que traz destaques novos para o mesmo livro não apaga as marcas visíveis nem acrescenta as novas; fechar e reabrir mostra só as que chegaram durante a leitura. Lê o `viewingNewIds` da Task 33, e não o `isNew`.

### Task 36: Ecrã 1 · Biblioteca, grelha
**Decisões do Bruno a 2026-11-19** (AskUserQuestion, as quatro na opção recomendada; ver DECISIONS, «Ecrã 1»): «Mostrar só estes» adiado e escondido; atalhos com um `keydown` na página; avisos no cabeçalho e no toast; um livro deixa de ser novo quando se abre ou quando entra numa exportação.

**Figma:** `71:8040` (Claro) e `71:8273` (Escuro), secção «1 · Biblioteca · Grelha»; nota `71:8468`. Medido a 2026-11-19, só em leitura:
- a janela tem 1000 × 700 (mínimo 800 × 600). A Barra tem 52 de altura. O conteúdo tem `p-6` e `gap-6` em coluna;
- o Cabeçalho da Biblioteca ocupa 952 × 28. A grelha começa a 24 por baixo dele, e a 1.ª linha de capas fica a 128 do topo (52 + 24 + 28 + 24);
- a grelha tem colunas de 171, com mínimo de 160 e sem largura máxima. Os intervalos são de 24 × 24. Mais largura dá mais colunas, e a capa fica entre 170 e 173;
- o Cartão do livro (componente 18) tem 171 × 318, ou 334 com o título em duas linhas. A etiqueta «N novos» fica sobre a capa;
- a Barra não tem engrenagem, indicador do Kobo nem logótipo.

**Pesquisa (2026-11-19).** O Overlay já foi pesquisado na Fase 4. Os dois problemas novos são estes:

| Problema | Opções | Proposta | Razão |
|---|---|---|---|
| Teclado e seleção na grelha | um Tab por cartão, como hoje; `listbox` com `aria-multiselectable` e roving tabindex; `grid` da ARIA | **`listbox` multisseleção com roving tabindex** | No APG, a listbox multisseleção separa o foco da seleção: as setas movem o foco sem selecionar e o Espaço alterna a seleção. Só há uma paragem de Tab (o item ativo tem `tabindex=0` e os outros `-1`). O `grid` da ARIA é para células tabulares, o que um conjunto de capas não é. Um Tab por cartão dá dezenas de paragens |
| «Mostrar só estes» | toggle como o filtro do Mail; desenhar o estado filtrado no Figma; adiar o botão | **Adiar e esconder** (Bruno) | O Figma não tem o estado filtrado desenhado. No Mail, o botão Filtro alterna entre «só não lidos» e tudo, e muda de cor quando está ativo |

Fontes: [W3C APG, Listbox Pattern](https://w3.org/WAI/ARIA/apg/patterns/listbox), [MDN, aria-multiselectable](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-multiselectable), [MDN, grid role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/grid_role), [Apple, Mail: filtrar e-mails](https://support.apple.com/guide/mail/mlhl1f6cf15a/mac).

**Implementador (proposta):** Sonnet.

**O que sai do ecrã antigo e para onde vai** (cada linha é intencional; a review não a marca como regressão):

| Sai | Vai para |
|---|---|
| `<header>` com o logótipo «khi» | sai; o título é o Título-menu da Barra |
| Indicador do Kobo (`kobo-indicator`) | sai; com `!library.canSync`, o Sincronizar fica desativado com um `syncDisabledReason`. **Proposta:** antecipar já o texto do ecrã 3, «Liga o Kobo para sincronizar» |
| `ReaderPicker` | `TitleMenu` dentro da Barra (`readers`, `activeReaderId` e `onselectReader` → `handleSelectReader`) |
| Engrenagem da `LibraryToolbar` | sai; as Definições ficam no ⌘, (o Figma não a tem) |
| `LibraryToolbar` (ordenar, vista, sincronizar, exportar, limpar a seleção) | a `WindowBar` (`screen="library"`) |
| `InlineNotification` | aprovado pelo Bruno a 2026-11-19 (o `<Toaster>` é montado na página): o erro de sincronização vai para o estado `erro` do `LibraryHeader`, com `onRetry` → `handleSync`. O sucesso da exportação vai para o botão («✓ Exportado») e para o `ui/toast`, um aviso neutro «N livros exportados», ainda sem «Mostrar no Finder», que entra no ecrã 8. Os outros erros (associar, criar ou abrir um Leitor) vão para o toast |

**Ficheiros:**
- `src-tauri/tauri.conf.json`;
- `src/lib/window-config.test.ts`;
- `src/routes/+page.svelte`;
- `src/lib/components/LibraryView.svelte` (só o ramo da grelha);
- criar `src/lib/components/ui/library-grid/` (`library-grid.svelte`, `index.ts`, `library-grid.test.ts`);
- `src/lib/stores/library.svelte.ts` (o resumo);
- `src/lib/i18n/locales/{pt,en}.json`;
- `tests/visual/{scenarios,mock-ipc}.ts` e as baselines.

**Comportamento:**
1. **Overlay.** A janela `main` no `tauri.conf.json` fica com `"titleBarStyle": "Overlay"`, `"hiddenTitle": true` e `"trafficLightPosition": { "x": 16, "y": 20 }` (o valor de partida da Task 34). O valor final acerta-se no ecrã (±2) e fica escrito na Task 34. As Definições são criadas pelo builder em Rust e não herdam nada disto (verificado: o builder não chama `title_bar_style`).
2. **A Barra em todos os estados.** A `WindowBar` sai do `<main>` e fica sempre à vista, para os semáforos nunca ficarem por cima de conteúdo antigo:
   - em `library`, `no-device` e durante o `ImportingState`, com `screen="library"`;
   - em `book-details`, com `screen="detail"`, `onback` → `handleCloseBookDetails` e `onexport` a exportar esse livro;
   - o `canDelete` fica `false` até ao ecrã 9;
   - o `BookDetailsView` mantém o seu cabeçalho até ao ecrã 5. A duplicação do «voltar» é provisória e aceite;
   - Exportar sem livros não faz nada (provisório até aos ecrãs 2 e 6);
   - o fundo e as linhas da página passam aos tokens (`bg-background`, `border-border`); saem os `bg-white` e `dark:bg-neutral-*`.
3. **Barra da Biblioteca:**
   - `view` e `onview` → `handleViewModeChange`; `sort` e `onsort` → `handleSortChange`. Gravam no clique e nunca num `$effect` (§7);
   - `syncing` = `library.isImporting`, e `onsync` → `handleSync`;
   - `exportCount` é o tamanho da seleção, se houver, ou então o número de livros. `onexport` exporta essa seleção ou todos (`handleExportSelected` ou `handleExportAll`).
4. **Cabeçalho da Biblioteca** (Biblioteca 4, F3), dentro da área que desliza, antes da grelha:
   - **contagens**, derivadas de `library.books`, que são reativos e mudam no `openBook`:
     - `highlights` = número de destaques com `isNew` e sem `removedAt`;
     - `books` = número de livros com pelo menos um desses destaques;
   - **datas**, do `commands.librarySummary(readerId, connectedSerial)`: `since` = `newSince` e `syncedAt` = `lastSyncAt`. O store guarda o resumo em `library.summary` e recarrega-o:
     - no fim do `openReader`, que já corre depois de cada sincronização e do `syncFinished`;
     - ao ligar e ao desligar o Kobo;
   - **o Rust não muda.** O `lastSyncAt` é a hora do Kobo ligado, e sem Kobo ligado é `null`. É a decisão do Bruno em DECISIONS, «Tasks das Fases 3 e 4»: «sem Kobo ligado, não se mostra». A moldura do ecrã 3 (`71:9162`) mostra a hora com o Kobo desligado e contradiz esta decisão. Isso resolve-se no ecrã 3;
   - **estados:**
     - novos > 0 → `novos`. Se o `newSince` for nulo, omite-se o «desde»: o componente aceita o `since` opcional, um ajuste pequeno coberto por teste;
     - novos = 0 → `semNovidades`, «Sem destaques novos». O «sincronizado às 10:42» só aparece com `lastSyncAt`; o `syncedAt` do componente passa a opcional, com o teste `no_news_without_sync_time_omits_time`;
     - sem livros, não há cabeçalho (o estado vazio é do ecrã 6);
     - erro de sincronização → `erro`, até à próxima sincronização ou ao «Tentar de novo». Vale para o `catch` do `handleSync` e para o do `handleDeviceConnected`;
     - `aSincronizar` → fica para o ecrã 2 (o `ImportingState` mantém-se até lá);
   - «Exportar M livros» no cabeçalho exporta os M livros com novos: exporta esses ids sem mexer na seleção do utilizador (correção I6 da review; antes substituía a seleção);
   - `exporting` = `library.isExporting`; `exported` liga-se no fim de uma exportação com sucesso;
   - **exportar limpa os «novos»** (Bruno, 2026-11-19: um livro deixa de ser novo quando se abre ou quando entra numa exportação). Cumpre a Cor 6: depois de exportar, o cabeçalho passa a «Sem destaques novos» e as etiquetas saem. No `library.exportIds(bookIds)`:
     - antes de exportar, guarda por livro o snapshot dos ids com `isNew` e o `seenSeq` (o máximo do `syncedSeq`), como o `openBook`;
     - com o export bem-sucedido, chama o `commands.markBookOpened(readerId, bookId, seenSeq)` para cada livro e limpa o `isNew` só dos ids do snapshot. Um destaque que chegue a meio da exportação continua novo;
     - o `openBook` e o export partilham um helper privado (por exemplo, `#markSeen(bookId, snapshot, seenSeq)`). O comportamento do `openBook` não muda: o `viewingNewIds` continua a ser só dele;
     - um `markBookOpened` que falhe é registado e não desfaz a exportação. Esse livro fica novo;
     - um export que falhe não toca nos novos;
     - não há nada a mudar no Rust: o `mark_book_opened` já faz `MAX(opened_seq, seen_seq)`;
   - «Mostrar só estes»: **adiado e escondido** (Bruno, 2026-11-19). O estado filtrado desenha-se no Figma numa ronda própria (3 opções), e o botão entra quando for aprovado. O `LibraryHeader` passa a mostrar o botão **só quando recebe o `onShowOnly`**, com o teste `show_only_hidden_without_handler`; hoje aparece sempre (`library-header.svelte:137`). A página não lhe passa o `onShowOnly`.
5. **Grelha** (`LibraryGrid`, usada pelo `LibraryView` quando `viewMode === 'grid'`; a lista não muda até ao ecrã 4):
   - `grid-template-columns: repeat(auto-fill, minmax(160px, 1fr))` e `gap-6`, com o `BookCard` de `ui/book-card`;
   - `highlightCount` = `highlights.length` (o mesmo número que a ordenação `highlight_count` usa); `newCount` = a contagem do ponto 4 para esse livro; `coverSrc` como hoje;
   - teclado e seleção (proposta: listbox): `role="listbox"`, `aria-multiselectable="true"` e `aria-label`;
     - cada cartão recebe `role="option"` pela grelha. O `BookCard` tem `role="gridcell"` (`book-card.svelte:56`), mas o `{...restProps}` vem depois e sobrepõe-no. O componente e os seus testes não mudam;
     - setas ← → ↑ ↓ movem o foco (↑ e ↓ saltam uma linha, com o número de colunas medido no DOM), e Home e End vão ao primeiro e ao último;
     - Enter abre o livro com o foco;
     - Espaço alterna a seleção;
     - Esc limpa a seleção;
     - **⌘A fica de fora:** o menu nativo tem o `SelectAll` predefinido (`menu.ts:79`), que apanha o atalho antes do webview;
   - rato: clique simples abre; ⌘-clique alterna; ⇧-clique seleciona o intervalo desde o último clicado (a lógica que já existe no `LibraryView`);
   - **abrir um livro passa sempre por uma só função da página, `openBook(book)`**, que chama `library.openBook(id)` e `library.setUiState('book-details')`. O clique e o Enter chamam-na. Não se passa um `KeyboardEvent` ao `handleBookClick(book, event: MouseEvent)`, porque o `check` deixava de dar 0/0. O `viewingBookId` nunca se escreve à mão.
6. **Atalhos dos tooltips** (⌘R, ⌘E, ⌘1, ⌘2): um `keydown` na página, sem tocar na barra de menus (Bruno, 2026-11-19). Os itens de menu ficam para a Fase 6.
   - ⌘R sincroniza só com `library.canSync`;
   - ⌘E faz o mesmo que o Exportar da Barra;
   - ⌘1 e ⌘2 mudam a vista e gravam-na, como o clique;
   - os atalhos não disparam com o foco num campo de texto, com uma janela modal aberta (Kobo novo, atualização) nem fora da Biblioteca. O ⌘E dispara também no Detalhe, onde exporta esse livro.

- [x] **Passo 1: testes que falham:**
  - `window-config.test.ts`: `main_window_is_overlay` (lê o JSON: `titleBarStyle`, `hiddenTitle` e `trafficLightPosition` `{16, 20}`);
  - `library-grid.test.ts`:
    - `grid_is_multiselect_listbox_with_one_tab_stop`;
    - `arrows_move_focus_without_selecting`;
    - `enter_opens_focused_book`;
    - `space_toggles_selection`;
    - `cmd_click_toggles_and_shift_click_selects_range`;
    - `escape_clears_selection`;
    - `card_shows_new_count`;
  - `src/routes/page.svelte.test.ts` (o que já existe, com o mesmo mock e um `AppSettings` completo, §4):
    - `window_bar_is_mounted_in_every_state` (`library`, `no-device`, a importar, `book-details`);
    - `opening_a_book_goes_through_open_book` (o Enter e o clique chamam o `library.openBook` com o id);
    - `header_state_follows_counts_and_summary` (os casos do ponto 4, com e sem Kobo ligado);
    - `header_export_exports_books_with_news`;
    - `sync_error_shows_header_error_and_retry_syncs`;
  - `page.svelte.test.ts`, os atalhos: `shortcuts_sync_export_and_switch_view` e `shortcuts_ignored_in_text_field_and_modal`;
  - `library.svelte.test.ts` (ou o teste do store que já existe):
    - `export_clears_new_of_exported_books`;
    - `export_keeps_new_that_arrived_during_export`;
    - `failed_export_keeps_new`;
    - `open_book_behaviour_unchanged`: os testes do `openBook` que já existem continuam verdes;
  - `library-header.test.ts`: `novos_without_since_omits_date`, `no_news_without_sync_time_omits_time` e `show_only_hidden_without_handler`.
- [x] **Passo 2:** os testes falham pela razão certa.
- [x] **Passo 3:** a config, o store, a grelha, a página e as chaves em `pt` e `en`.
- [x] **Passo 4:** o gate completo:
  - `cargo test`, e o `cargo clippy` com os mesmos 7 avisos;
  - `cargo check`;
  - Vitest duas vezes;
  - `npm run check` e `npm run build`;
  - `npm run test:visual`, com um mock de `library_summary` no `mock-ipc.ts`. **Primeiro**, muda-se a espera de `scenarios.ts:128` (`getByRole('group', { name: books[0].title })`), senão todos os cenários da principal partem nesse ponto;
  - os cenários antigos que dependem do `<header>`, da `LibraryToolbar` ou da caixa de seleção do cartão antigo são substituídos por cenários da Barra, do Cabeçalho e da grelha nova, em Claro e Escuro;
  - **as baselines novas são revistas uma a uma** pelo coordenador, contra o `71:8040` e o `71:8273`.
- [x] **Passo 5:** commit `feat(library): screen 1, library grid with window bar and overlay`.

**Mutações do coordenador:**
- tirar o `titleBarStyle` do conf (o `main_window_is_overlay` falha);
- tirar a Barra do estado `book-details` (o `window_bar_is_mounted_in_every_state` falha);
- abrir o livro escrevendo o `uiState` sem chamar o `openBook` (o `opening_a_book_goes_through_open_book` falha);
- limpar todos os `isNew` do livro depois de exportar, e não só os do snapshot (o `export_keeps_new_that_arrived_during_export` falha).

**Verificar no ecrã (Bruno, com `npm run dev:app`):**
- as verificações da Task 34: os semáforos depois de redimensionar, ⌃⌘F, zoom com duplo clique, Claro e Escuro, e perder o foco; a barra arrasta e os botões clicam; o primeiro clique com a janela inativa arrasta;
- a grelha comparada com o Figma a 1000 × 700, e mais colunas ao alargar;
- o VoiceOver na grelha («Os Maias, Eça de Queirós, 58 destaques, 11 novos», e «selecionado»);
- as setas, o Enter e o Espaço;
- o ⌘A seleciona o texto da página e não os livros (fica assim até à Fase 6).

**Verificação no ecrã do ecrã 1 (Bruno, 2026-11-19):**
- arrastar a barra e clicar nos botões: funciona;
- exportar e o toast: funcionam;
- **semáforos desalinhados:** o centro estava a ≈ 17,5 pt do topo, e o centro da barra está a 26.
  - Causa (tao 0.37.2, `view.rs:1017-1047`): o `y` é a altura do contentor da barra de título menos a do botão, e o botão mantém o `origin.y`, que conta a partir de baixo. O centro fica a cerca de `y + h/2 − origin.y`.
  - Correção: `trafficLightPosition` passa de `{16, 20}` a `{16, 28}`. Confirmado no ecrã pelo Bruno (segunda captura).
- **Seleção:** o Bruno pede uma caixa de seleção visível em cada livro, como na v1: «O command + clique não é intuitivo». Fica para uma **ronda de design própria, depois do ecrã 1**: pesquisa, 3 opções no Figma e a escolha do Bruno. Muda o Cartão do livro (Q-B, B2) e a grelha.

**Ecrã 1 aprovado a 2026-11-19** (Bruno: «Aprovo o ecrã 1»). Na captura final, medida ao píxel: 16 pt da borda ao vermelho, ≈ 16 pt do verde ao título, semáforos e título centrados na mesma linha, e sem cabeçalho quando não há novos. Ficam para depois: a ronda de design da caixa de seleção e, na Fase 6, os semáforos no macOS 13–15.

### Task 36b: espaço dos semáforos medido no arranque
**Decisão do Bruno, 2026-11-19** («Medir no arranque», a opção recomendada).
- **Problema:** no macOS do Bruno (Darwin 27), cada semáforo tem 14 pt e os centros estão a 23 pt. O bloco vai de x=16 a 76 (60 pt). O Figma (`69:6427`) e a `WindowBar` assumem 12 pt e um passo de 20, ou seja, 52 pt. Por isso o título ficava a 9 pt dos semáforos, e não a 16.
- **Rejeitados:**
  - 60 fixo: no macOS 13–15 o título ficava a 24 pt;
  - um valor por versão do macOS: parte na próxima mudança da Apple.
- **Implementador:** Opus (código nativo `unsafe` no fio principal).

**Comportamento:**
1. Rust: um command `traffic_lights_max_x(window) -> Option<f64>`.
   - No fio principal, lê `standardWindowButton(ZoomButton)` e converte o frame para coordenadas da janela (`convertRect:toView: nil`). Devolve o `maxX` em pontos.
   - Devolve `None` se faltar o botão ou o `ns_window`.
   - Segue o padrão do `system_accent.rs` (`MainThreadMarker`, `objc2-app-kit`), com as features mínimas no `Cargo.toml`. Fica registado no `specta` e nos bindings.
2. `WindowBar`: um prop `trafficLightsWidth?: number`, com 52 por omissão. O bloco `data-traffic-lights` fica com essa largura e mantém o `h-3` e o `shrink-0`.
3. A página:
   - no arranque, chama o command e passa `max(0, maxX − 16)` (o `px-4` da Barra);
   - em ecrã inteiro (`isFullscreen()`), passa 0;
   - volta a medir no `onResized`;
   - sem medida (um erro ou `null`), fica com os 52.
4. O `mock-ipc.ts` devolve 68, o que dá 52 e deixa as baselines como estão.

- [x] **Testes que falham:**
  - `window-bar.test.ts`: `traffic_light_space_follows_measured_width` e `traffic_light_space_defaults_to_52`. O `reserves_traffic_light_space` adapta-se;
  - `page.svelte.test.ts`: `bar_reserves_measured_traffic_lights` (76 dá 60), `bar_keeps_52_when_measure_fails` e `fullscreen_reserves_no_traffic_light_space`.
- [x] **Gate completo** e `UPDATE_BINDINGS=1 cargo test bindings_are_up_to_date`.
- [x] **Verificar no ecrã (Bruno):** 16 pt entre o semáforo verde e «Biblioteca» (aprovado com o ecrã 1, 2026-11-19).

### Task 37: caixa de seleção no Cartão (B com a E1)
**Decisões do Bruno a 2026-11-19** (ver DECISIONS, «Componentes · 7» e «Componentes · 8»):
- **Quando se vê (B):** em repouso, nada. Aparece com o ponteiro sobre o cartão e com o foco do teclado (`focus-visible`). A partir do primeiro livro selecionado, aparece em todas as capas, até a seleção ficar vazia.
- **Desenho (E1):** anel claro com halo. A recomendação era a E3; o Bruno escolheu a E1 e aceitou os 1,3:1 sobre a capa branca.
- **Clique na capa durante a seleção:** abre sempre, como no Gmail (Bruno, contra a recomendação «alterna durante a seleção»). Só a caixa seleciona.
- **Rejeitadas:** A (sempre visível), C (a v1 literal), E2 (disco de vidro), E3 (anel com contorno) e «a capa alterna durante a seleção».

**Task aprovada pelo Bruno a 2026-11-19** («Aprovo a Task 37»).

**Figma:** «Iteração · Componentes», secções `115:28070` (quando se vê) e `116:29048` (desenho, com lupa a 3×); notas `116:29026` e `116:29711`. O Cartão é o `65:4268`.

**Implementador (proposta):** Sonnet. O Opus acrescenta antes, no Figma, as variantes `Estado=Ponteiro` e `Estado=Em seleção` ao `65:4268` (Passo 0), para o componente acompanhar o código.

**Medidas (E1):**
- círculo de 20 × 20 pt, a 8 pt da direita e de baixo da capa, no sítio do visto. **Um só elemento de 24 × 24**, a 6 pt da direita e de baixo (`right-1.5 bottom-1.5`), desenha o círculo de 20 ao centro: a caixa E1 quando o livro não está selecionado, o visto quando está. A área de clique é a mesma nos dois estados;
- vazia: interior `rgb(0 0 0 / 0.10)`, anel branco de 2 pt por dentro (`inset`), halo `0 0 4px rgb(0 0 0 / 0.35)` e sombra `0 1px 2px rgb(0 0 0 / 0.20)`;
- com o ponteiro sobre o cartão: interior `rgb(0 0 0 / 0.30)`;
- igual no Claro e no Escuro (está sobre a capa, não sobre o fundo);
- selecionada: o mesmo elemento desenha o visto do Q-B aprovado (primary, anel da cor `background` de 2 pt: branco no Claro, escuro no Escuro) com a moldura de 3 px. Nunca aparecem os dois;
- entra e sai com um fade de 150 ms (`--duration-out`, 150 ms em `tokens.css:90`, ease-out); com Reduzir movimento, sem fade.

**Ficheiros:**
- `src/lib/components/ui/book-card/book-card.svelte` e `book-card.test.ts`;
- `src/lib/components/ui/library-grid/library-grid.svelte` e `library-grid.test.ts`;
- `tests/visual/scenarios.ts` e as baselines que mudam (`hover-book-card`, `focus-book-card`, `grid-selected`, `hover-selected-card`) mais o cenário novo.

**Comportamento:**
1. `BookCard` ganha a prop `selecting?: boolean` (por omissão `false`) e põe `data-selecting` no cartão quando é verdadeira.
2. O controlo é um `<span data-slot="selection-box" aria-hidden="true">` de 24 × 24, sem `tabindex`, sem `role` e sem `<button>`: o cartão é um `role="option"` e uma option não pode ter filhos interativos. Tem `data-state="checked"` quando o livro está selecionado (desenha o visto, e substitui o `selection-check` de hoje) e `data-state="unchecked"` quando não está (desenha a caixa E1).
3. Com `unchecked`, está escondido (opacidade 0 e `pointer-events-none`, para o clique cair na capa) e aparece (opacidade 1 e `pointer-events-auto`) com qualquer destes: `group-hover/card`, `group-focus-visible/card` ou `data-selecting`. O interior passa a 30 % com `group-hover/card`. Com `checked`, está sempre visível e clicável.
4. `LibraryGrid` passa a cada cartão `selecting`, verdadeiro quando algum livro de `books` está em `selectedBookIds` (contam só os ids que existem na grelha; um id antigo não acende as caixas).
5. Em `handleClick`, um clique cujo alvo está dentro de `[data-slot="selection-box"]` conta como um clique com modificador: alterna a seleção desse livro (e passa a ser a âncora) e **não abre**. Com ⇧ sobre a caixa, segue a regra do intervalo que já existe. O clique no resto do cartão continua a abrir.
6. No teclado nada muda: o Espaço alterna, o Enter abre, o Esc limpa. O VoiceOver continua a ler o rótulo do cartão e «selecionado» pelo `aria-selected`.
7. O ⌘-clique e o ⇧-clique continuam a funcionar como hoje.

- [x] **Passo 0 (Opus, Figma):** as variantes `Estado=Ponteiro` (`116:29747`) e `Estado=Em seleção` (`116:29757`) no `65:4268`, com a caixa E1.
- [x] **Passo 1: testes que falham:**
  - `book-card.test.ts`:
    - `selection_box_is_hidden_from_assistive_tech`: a caixa tem `aria-hidden="true"`, não tem `tabindex` e não é um `button`;
    - `selection_box_shows_check_when_selected`: com `selected`, a caixa tem `data-state="checked"`; sem ela, `unchecked`. Há um só `selection-box` e nenhum outro visto;
    - `selection_box_is_24_in_both_states`: as classes de tamanho e posição são as mesmas com e sem `selected`;
    - `selecting_marks_card`: com `selecting`, o cartão tem `data-selecting`; sem ela, não tem;
  - `library-grid.test.ts`:
    - `click_on_selection_box_selects_without_opening`: `onOpen` não é chamado e `onSelectionChange` recebe `[id]`;
    - `click_on_checked_box_deselects_without_opening`: o clique na caixa de um livro selecionado tira-o da seleção e não abre;
    - `shift_click_on_selection_box_selects_range`;
    - `click_on_cover_still_opens`;
    - `click_on_cover_opens_while_selecting`: com um livro selecionado, o clique na capa de outro abre-o e não mexe na seleção;
    - `cards_are_selecting_when_any_book_is_selected`: sem seleção, nenhum cartão tem `data-selecting`; com um selecionado, todos têm;
    - `stale_selected_id_does_not_mark_selecting`: um id em `selectedBookIds` que não está em `books` não acende as caixas.
- [x] **Passo 2:** os testes falham pela razão certa.
- [x] **Passo 3:** o Cartão e a grelha.
- [x] **Passo 4:** o harness visual:
  - cenário novo `select-by-box`, com o ponteiro real (`hover()` e depois `click()` na caixa; **não** o `dispatchEvent` do `selectBooks`, para o `pointer-events` ser testado): seleciona sem abrir, e as outras capas mostram a caixa;
  - as baselines que mudam revistas uma a uma, em Claro e Escuro.
- [x] **Passo 5:** o gate completo (`cargo test`, clippy com os mesmos 7 avisos, Vitest duas vezes e com `--sequence.shuffle`, `npm run check` 0/0, `npm run build`, `npm run test:visual`).
- [x] **Passo 6:** commit `feat(library): selection box on book cards`.

**Feito (2026-11-20).** Implementado pelo Sonnet; gate: Vitest 664 passam e 1 ignorado (duas corridas), `npm run check` 0/0, build OK, `cargo test` verde, `test:visual` 79/79 duas vezes sobre a árvore final. Mutações do coordenador apanhadas (as três; a do `pointer-events` só pelo `select-by-box`).
- **Desvio aceite:** `group-[:hover]/card:` em vez de `group-hover/card:`, porque `src/app.css:15` redefine o `group-hover` e a forma normal não gera CSS. Os valores da E1 são tokens em `app.css` (`--color-selection-box`, `--color-selection-box-hover`, `--shadow-selection-box`), porque `ui/` não aceita cores literais.
- **Review adversarial (Opus): aprovar com correções.** Corrigidos pelo coordenador: o controlo `control.spec.ts` ainda escondia o `selection-check`; o `select-by-box` verifica também o `pointer-events` das outras capas; o teste de opacidade espera `100%`.
- **Aceite por desenho (Menor 3):** o `pointer-events` passa a `auto` logo com o hover, enquanto a opacidade sobe em 150 ms; um clique nos primeiros ~50 ms seleciona por uma caixa quase invisível.
- **Aprovada pelo Bruno a 2026-11-20** («Sim, aprovo»), depois de a ver na app: «A caixa de selecção parece estar a funcionar bem».
- **Visto à margem (fora da task), já corrigido em `e819b75`:** `highlight.svelte:145` usa `group-hover/highlight:opacity-100`, que não gera CSS: o botão de copiar do destaque só aparece com o foco, nunca com o hover. As falhas com `--sequence.shuffle` em `library.svelte.test.ts` e `table.test.ts` são anteriores (confirmadas em HEAD com as mesmas seeds).

**Mutações do coordenador:**
- tirar a deteção da caixa em `handleClick` (o clique na caixa abre o livro);
- `selecting` sempre falso (as outras capas não mostram a caixa durante a seleção);
- tirar o `aria-hidden` da caixa;
- tirar o `pointer-events-auto` do hover (o clique na caixa cai na capa e abre o livro; só o cenário `select-by-box` o apanha, porque o jsdom não avalia CSS).

**Verificar no ecrã (Bruno, com `npm run dev:app`):**
- passar o ponteiro mostra a caixa; clicar nela seleciona sem abrir;
- com um livro selecionado, todas as capas mostram a caixa; o Esc limpa e as caixas desaparecem;
- clicar no visto desmarca sem abrir; clicar na capa abre;
- em capas claras e escuras, nos dois temas.

### Task 38: Ecrã 2 · A sincronizar
**Task aprovada pelo Bruno a 2026-11-20** («Aprovo a Task 38»).
**Decisões do Bruno a 2026-11-20** (AskUserQuestion): a seleção mantém-se no fim, o Detalhe fica aberto e o Título-menu fica desativado (as três na opção recomendada). A Biblioteca vazia a sincronizar foi decidida na ronda Q-W do Figma (secção `121:29779`): **W2, centrado como o primeiro arranque** («Sim, a W2», a recomendada). A animação da ilustração foi decidida na ronda Q-X (`121:30902`): **X2, as linhas enchem com o progresso** (a recomendada).
**Decisões do Bruno na review adversarial (2026-11-20):**
- M3: um Kobo de outro leitor troca logo a Biblioteca ao ligar (Bruno, «Troca logo ao ligar»; rejeitadas: ficar no leitor atual; como está). Só com a sincronização ao ligar ativa; o Detalhe e a seleção do leitor anterior não passam.
- M3, Kobo de outro leitor a meio de outra sincronização (coordenador, coerente com «Troca logo ao ligar»): espera que essa acabe e só depois troca para a Biblioteca do outro leitor e a sincroniza; o mesmo leitor continua a juntar-se à sincronização em curso. A troca faz parte da sincronização e é um só passo: o livro aberto fica até a Biblioteca nova chegar. Se a Biblioteca nova não se puder ler, mostra-se vazia e o erro fica nela, não no leitor anterior. O leitor escolhido para um Kobo desconhecido a meio de uma sincronização só aparece no fim dela (com a sincronização ao ligar, pela mesma troca num só passo).
- m5: o cabeçalho entra duas vezes na primeira sincronização — aceite por desenho (efeito pequeno, durante um IPC); rejeitada: corrigir.
- A guarda redundante do ⌘R e do ⌘E fica — precedente do `isExporting`; rejeitada: tirar.

**Figma:** secção `71:8571`: janela Claro `71:8575`, Escuro `71:8590`, nota `71:9084` (DECISIONS, «Ecrãs · 4 · Biblioteca a sincronizar», aprovado a 2026-11-18). Medido a 2026-11-20, só em leitura:
- é a moldura do ecrã 1 sem mudar nenhuma medida: Barra 52, Cabeçalho da Biblioteca 952 × 28 a 24 da Barra (y 76) e grelha a 128;
- o Cabeçalho fica em `Estado=A sincronizar`, «A sincronizar com o Kobo · 12 de 42 livros», sem botões;
- os cartões ficam em `Estado=Normal`, sem a etiqueta «N novos»;
- Sincronizar fica em `Estado=Hover`, o que quer dizer ativo e não desativado. O tooltip é `Conteúdo=Só texto`, «A sincronizar · 12 de 42 livros», sem atalho. Fica 4 abaixo do botão, preso a 8 da margem direita (a borda está em 992). O `sideOffset` 4 já é o valor por omissão de `tooltip-content.svelte:8`;
- Exportar fica em `Estado=Desativado`. Grelha, lista e Ordenar continuam ativos.

**Pesquisa (2026-11-20).** O desenho já está decidido (D5, Movimento 2, Movimento 6, «Ecrãs · 4»). Ficam por decidir as arestas que o Figma não mostra:

| Problema | Opções | Proposta | Razão |
|---|---|---|---|
| Seleção no fim da sincronização | limpar, como hoje (`openReader` faz `selectedBookIds = []`); manter os ids que continuam na Biblioteca | **Manter os ids presentes** | Com a Biblioteca à vista, pode-se selecionar a meio. Perder a seleção quando a sincronização acaba é a queixa mais repetida nas grelhas que se atualizam sozinhas. A solução habitual é guardar a seleção por id e voltar a aplicá-la depois de carregar. O critério é o mesmo da Task 37 (contam só os ids presentes) |
| Detalhe aberto quando a sincronização começa ou acaba | fecha e volta à grelha (o `showLibraryOrEmpty` força `'library'`); fica aberto, sem salto | **Fica aberto, sem salto** | O teste obrigatório do ecrã 5, `detail_keeps_new_marks_through_sync`, já pressupõe o Detalhe aberto durante a sincronização. Ligar o Kobo enquanto se lê não deve tirar o livro da frente. HIG: um indicador de progresso deixa as pessoas decidirem se fazem outra coisa enquanto esperam |
| Biblioteca vazia na primeira sincronização | só o cabeçalho «A sincronizar…»; o cabeçalho e o estado vazio «Sem livros»; o `ImportingState` só neste caso | **Só o cabeçalho** | «Sem livros» com um botão Sincronizar, por baixo de «A sincronizar», contradiz-se. Manter o `ImportingState` para um caso contraria a D5. O texto do primeiro arranque fica para o ecrã 6 |
| Título-menu durante a sincronização (com dois ou mais leitores) | ativo; desativado até ao fim | **Desativado até ao fim** | O `runSync` acaba com `openReader(readerId)` do leitor do Kobo. Trocar de leitor a meio seria desfeito sem aviso no fim. Só acontece com dois ou mais leitores (ecrã 10) |

Fontes: [Apple HIG, Progress indicators](https://developer.apple.com/design/human-interface-guidelines/progress-indicators); [Mendix, seleção perdida no refresh](https://community.mendix.com/link/space/microflows/questions/112667); [Syncfusion, persistência da seleção](https://www.syncfusion.com/forums/179907/selection-persistence-after-grid-refresh) (relatos de utilizadores e respostas de fornecedores, não guias de design).

**Implementador (proposta):**
- **Sonnet:** a Barra, o Cabeçalho, as etiquetas, os atalhos, o i18n e o harness.
- **Opus (subagente):** o fim da sincronização, porque é lógica de estado delicada: a seleção, o Detalhe sem salto, a ordem do `headerState` e a guarda do Título-menu (Comportamento 1 a 5).

**O que sai e para onde vai** (intencional; a review não o marca como regressão):

| Sai | Vai para |
|---|---|
| `ImportingState` em `<main>` | sai; a Biblioteca ou o Detalhe ficam à vista. O ficheiro fica, como código morto listado (precedente da Task 36) |
| a guarda `!library.isImporting` em `detailBook` (`+page.svelte:56`) | sai: o Detalhe fica aberto durante a sincronização |
| o `return` geral do `isImporting` em `handleShortcut` | fica só para ⌘R e ⌘E; ⌘1 e ⌘2 continuam |

**Ficheiros:**
- `src/routes/+page.svelte` e `src/routes/page.svelte.test.ts` (os testes das linhas ≈307 e ≈599 mudam);
- `src/lib/stores/library.svelte.ts` e `library.svelte.test.ts`;
- `src/lib/components/ui/window-bar/window-bar.svelte` e `window-bar.test.ts`;
- `src/lib/components/ui/library-header/library-header.svelte` e o teste;
- `src/lib/components/ui/library-grid/library-grid.svelte` e o teste;
- `src/lib/components/ui/title-menu/` (só se faltar a prop `disabled`);
- `src/lib/i18n/locales/{pt,en}.json`;
- `tests/visual/{scenarios,mock-ipc}.ts` e as baselines novas.

**Comportamento:**
1. **`headerState`:** com `library.isImporting`, devolve `{ kind: 'aSincronizar', done, total }` **antes** do `syncFailed` e antes do `books.length === 0`. A sincronização ao ligar só limpa o `syncFailed` depois de `'synced'`, e a primeira sincronização tem a Biblioteca vazia.
2. **Sem salto no fim:** o `showLibraryOrEmpty()` no fim do `handleSync` e do `handleDeviceConnected` não tira o ecrã de `'book-details'`. Só põe `'library'` ou `'no-device'` quando o ecrã não é o Detalhe, ou quando o livro aberto deixou de existir.
3. **Primeira sincronização (I1):** o `handleChooseReader` põe a Biblioteca no ecrã (`showLibraryOrEmpty()`) logo depois do `openReader` e antes do `handleDeviceConnected`. Assim, durante a sincronização vê-se a Biblioteca vazia com o cabeçalho, e não o `EmptyStateNoDevice`.
4. **Seleção (Bruno):** o `openReader` chamado pelo `runSync` mantém os ids de `selectedBookIds` que continuam em `books`. A troca de leitor (`handleSelectReader`) continua a limpar. O `openReader` ganha uma opção, por exemplo `{ keepSelection: true }`, e a troca de leitor não a usa.
5. **Título-menu (Bruno):** desativado enquanto `isImporting`, com dois ou mais leitores.
6. **Biblioteca vazia a sincronizar (Bruno, W2):** com `books.length === 0` e `isImporting`, não há cabeçalho nem `empty-state`. Ao centro fica o estado vazio do primeiro arranque (o L1 do ecrã 6, `72:11428`), com o Kobo sem tracejado, o título «A sincronizar com o Kobo» e, por baixo, «N de M livros». Com `total === 0`, só o título. **Bruno, 2026-11-20:** a frase «Os livros aparecem aqui quando a sincronização acabar.» sai («não faz sentido»). Tem `role=status` e anuncia só o início e o fim. Figma: `121:29854` (Claro) e `121:30434` (Escuro).
   - **Ilustração (Bruno, X2):** as 7 linhas do ecrã do Kobo mostram o progresso. As primeiras `floor(7 × done / total)` usam `highlight-line-new` e as outras `highlight-line`. Cada troca de cor dura 250 ms, com `ease-out` (`--duration-reveal`), e é igual com Reduzir movimento, porque é só cor (Movimento 6). Com `total === 0`, ficam todas vazias. O corpo do Kobo usa traço contínuo, sem tracejado. A ilustração é `aria-hidden`. Contraste entre a linha cheia e a vazia: 5,42:1 no Claro e 3,56:1 no Escuro. Figma: `121:30902`, linha X2.
7. **Barra, Biblioteca:**
   - Sincronizar fica ativo e roda (Movimento 2, já feito). O tooltip passa a `tooltip`, «A sincronizar · N de M livros», sem `shortcut`. O clique sai logo, sem mexer no `syncFailed`, no `exported` nem no ecrã. Com Reduzir movimento, o ícone fica parado e o tooltip é o mesmo;
   - Exportar fica desativado com a prop nova `exportDisabledReason`, «Espera pelo fim da sincronização» (en: «Wait for the sync to finish»).
8. **Barra, Detalhe:** o Exportar também fica desativado, com o mesmo texto.
9. **Contagem por saber:** com `total === 0` (o `{ done: 0, total: 0 }` inicial), o cabeçalho diz só «A sincronizar com o Kobo» e o tooltip só «A sincronizar», sem «· 0 de 0 livros», como o `ImportingState` fazia.
10. **Etiquetas «N novos»:** a `LibraryGrid` ganha `hideNew?: boolean`; durante a sincronização, nenhum cartão mostra a etiqueta. No fim, a faixa e as etiquetas entram **juntas**, em 250 ms com `ease-out` (Movimento 2); com Reduzir movimento, só fade (Movimento 6). A passagem de `aSincronizar` a `novos` acontece no mesmo `{#if}`, e o `animate-in` não se repete. A entrada é forçada com um `{#key}` sobre o `kind` **sem** o `out:fade` nessa troca, para não ficarem dois cabeçalhos durante 150 ms. O `out:fade` só se aplica quando o cabeçalho sai de vez (depois de exportar).
11. **Atalhos:** com `isImporting`, ⌘R e ⌘E não fazem nada; ⌘1 e ⌘2 trocam a vista.
12. **Leitor de ecrã:** o cabeçalho já anuncia só o início e o fim (`announcement`). Não se anuncia o progresso.
13. **Lista:** a lista é refeita no ecrã 4. Aqui só tem de funcionar durante a sincronização (cabeçalho, sem etiquetas se for simples); se não for, fica registado para o ecrã 4.

- [x] **Passo 1: testes que falham:**
  - `page.svelte.test.ts`:
    - `library_stays_on_screen_while_syncing`: com `isImporting`, a grelha está à vista e não há `ImportingState`;
    - `header_shows_sync_progress`: «A sincronizar com o Kobo · 12 de 42 livros»;
    - `header_hides_count_before_total_known`: com `total 0`, sem «0 de 0»;
    - `syncing_wins_over_previous_error`: com `syncFailed` de antes e uma sincronização ao ligar a correr, o cabeçalho é `aSincronizar`;
    - `detail_stays_open_through_sync`: com um livro aberto, uma sincronização que começa e acaba deixa o Detalhe no ecrã;
    - `selection_survives_sync`: os ids selecionados que continuam na Biblioteca ficam selecionados no fim; um que desapareceu sai;
    - `switching_reader_still_clears_selection`;
    - `first_sync_shows_library_not_no_device`: no `handleChooseReader` de um primeiro leitor, durante a sincronização o `uiState` é `'library'`;
    - `empty_library_while_syncing_shows_centered_state`: sem `empty-state` e sem cabeçalho; o estado centrado mostra «A sincronizar com o Kobo» e a contagem;
    - `sync_illustration_fills_lines_with_progress`: com 0/42, 1/42, 12/42, 30/42, 41/42 e 42/42, ficam cheias 0, 0, 2, 5, 6 e 7 linhas; com total 0, nenhuma (o 1/42 e o 41/42 separam o `floor` do `ceil` e do `round`);
    - `view_shortcuts_work_while_syncing` e `export_and_sync_shortcuts_blocked_while_syncing`;
    - `sync_click_while_syncing_does_nothing`: não chama o `syncKobo` outra vez e não mexe no `exported`;
  - `window-bar.test.ts`: `export_disabled_with_reason` (Biblioteca e Detalhe); `sync_tooltip_shows_progress_without_shortcut`;
  - `library-grid.test.ts`: `hide_new_hides_badges`;
  - `title-menu` (ou `window-bar`): `title_menu_disabled_while_syncing` com dois leitores.
- [x] **Passo 2:** os testes falham pela razão certa.
- [x] **Passo 3 (Opus):** Comportamento 1 a 5.
- [x] **Passo 4 (Sonnet):** Comportamento 6 a 13.
- [x] **Passo 5: o harness visual:**
  - `mock-ipc.ts`: o `sync_kobo` fica preso até o cenário o libertar; o `sync-progress` é emitido com o `emitWhenListening` ({ done: 12, total: 42 });
  - cenários novos, em Claro e Escuro: `library-syncing` (cabeçalho e sem etiquetas), `library-syncing-tooltip` (hover no Sincronizar, tooltip aberto, comparado com o `71:8575`), `library-syncing-export-disabled` (tooltip do Exportar) e `sync-finished-enters` (no fim, o cabeçalho `novos` e as etiquetas à vista);
  - as baselines que mudam revistas uma a uma.
- [x] **Passo 6:** o gate completo (`cargo test`; clippy com os mesmos 7 avisos; Vitest duas vezes e com `--sequence.shuffle`, ignorando as falhas antigas conhecidas; `npm run check` 0/0; `npm run build`; `npm run test:visual`).
- [x] **Passo 7:** review adversarial (Opus) com o foco no fim da sincronização. Depois, o commit `feat(library): keep the library on screen while syncing`.

**Mutações do coordenador:**
- pôr o `aSincronizar` depois do `syncFailed` (o cabeçalho mostra o erro antigo a meio da sincronização);
- repor o `setUiState('library')` incondicional no fim (o Detalhe salta para a grelha);
- tirar o `hideNew` (as etiquetas ficam à vista durante a sincronização);
- repor o `return` geral do `isImporting` em `handleShortcut` (⌘1 e ⌘2 deixam de funcionar);
- tirar o `keepSelection` (a seleção perde-se no fim);
- trocar o `floor` por `ceil` nas linhas cheias (com 1/42 encheria uma linha antes de haver um sétimo).

**Feito (2026-11-20).** Lógica da página e da store pelo Opus; componentes, i18n, testes e harness pelo Sonnet. Review adversarial: «aprovar com correções» (M1–M3, m1–m4, m6 corrigidos; m5 e a guarda dos atalhos aceites); re-review das correções do M3: «aprovar com correções», os 3 minors corrigidos. O m4 passou os anúncios de início e fim para uma região `sr-only` sempre montada na página (`sync-announcer`), sem texto novo; o cabeçalho e a W2 deixaram de ser regiões vivas. Gate sobre a árvore final: Vitest 743 passam e 1 ignorado (duas corridas), shuffle só com a falha antiga `export_clears_new_of_exported_books`, `npm run check` 0/0, build OK, `test:visual` 94/94 duas vezes (baselines atualizados: só o caminho DOM do anunciador e da W2, 0 píxeis diferentes), `cargo test` verde, clippy com os mesmos 7 avisos. Mutações do coordenador apanhadas: as seis de cima, mais a guarda de geração do `openReader`, a espera pela sincronização de outro leitor, o `show` da troca e a guarda do `handleChooseReader`. Fica por tratar, fora desta task: o BUSY nas marcas do `exportIds` durante uma sincronização ao ligar.

**Verificar no ecrã (Bruno, com `npm run dev:app` e um Kobo):**
- ligar o Kobo: a Biblioteca fica à vista, o cabeçalho conta os livros e as etiquetas desaparecem;
- passar o ponteiro no Sincronizar mostra o progresso; Exportar está desativado e diz porquê;
- selecionar um livro e mudar para a lista a meio; no fim, a seleção fica e o cabeçalho e as etiquetas entram juntos;
- abrir um livro a meio: no fim, continua aberto;
- em Claro e Escuro.

**Ecrã 2 aprovado a 2026-11-20** (Bruno: «Aprovo o ecrã 2»), depois de o verificar no ecrã com a sua Biblioteca. A W2 (Biblioteca vazia na primeira sincronização) não se vê com uma Biblioteca já feita; foi aprovada pelas capturas do harness (`library-empty-syncing`, Claro e Escuro).

### Task 39: Ecrã 3 · Kobo desligado, sem novidades
**Task aprovada pelo Bruno a 2026-11-20** («Aprovo a Task 39»).
**Decisão do Bruno a 2026-11-20** (AskUserQuestion, a recomendada): com o Kobo de **outro** leitor ligado e a sincronização ao ligar desligada, o Sincronizar fica desativado com o tooltip «O Kobo ligado é de {leitor}» (en: «The connected Kobo belongs to {reader}»). Não há efeitos escondidos: troca-se de leitor pelo Título-menu. Rejeitadas: o clique trocar de leitor e sincronizar; ficar «Liga o Kobo para sincronizar», que é falso com o Kobo ligado. Fecha o ponto aceite na review da Task 36 («afina-se no ecrã 3»).

**Figma:** secção `71:9158`: janela Claro `71:9162`, Escuro `71:9177` (DECISIONS, «Ecrãs · 5», aprovado a 2026-11-18). A moldura ainda mostra o Cabeçalho «Sem destaques novos · sincronizado às 10:42». Prevalece a decisão posterior «Sem novidades, sem cabeçalho» (2026-11-19): sem cabeçalho, a grelha começa a 24 da Barra, como no `grid-no-news`. A moldura não se mexe nesta task (Figma só em leitura). O resto é a moldura do ecrã 1:
- nenhuma capa tem etiqueta;
- Sincronizar desativado, com o tooltip «Liga o Kobo para sincronizar», na posição do tooltip do ecrã 2 (4 abaixo do botão, preso a 8 da margem direita);
- Exportar, Grelha, Lista e Ordenar ativos, porque os destaques ficam guardados.

**Já feito (ecrã 1, Task 36):** o `canSync`, a prop `syncDisabledReason` da `WindowBar` com o texto `screens.library.syncDisabledReason`, a Biblioteca à vista sem o Kobo (R17), a hora e o erro limpos ao desligar, e o cabeçalho só com novos. Esta task não os refaz; acrescenta o que falta e as provas.

**Implementador:** Sonnet (é ligação de props, i18n, testes e harness; não há lógica de estado delicada).

**Ficheiros:**
- `src/routes/+page.svelte` e `src/routes/page.svelte.test.ts`;
- `src/lib/i18n/locales/{pt,en}.json`;
- `tests/visual/{scenarios,mock-ipc}.ts` e as baselines novas.

**Comportamento:**
1. **Motivo do Sincronizar** (por esta ordem; a sincronização em curso continua sem motivo, Task 38):
   - sem Kobo ligado: «Liga o Kobo para sincronizar» (como hoje);
   - com o Kobo de outro leitor (`connectedDevice` presente, `connectedReaderId` não nulo e diferente do `activeReaderId`): «O Kobo ligado é de {leitor}», com o nome de `library.readers`. Chave nova `screens.library.syncOtherReaderReason`, pt e en no mesmo commit. Se o nome não estiver em `readers`, cai no texto de cima;
   - um Kobo ligado sem leitor (`connectedReaderId` nulo) é o ecrã 6 (Kobo novo); aqui fica o texto de cima.
   O motivo passa para um `$derived` na página (`syncDisabledReason`), em vez da expressão no atributo.
2. **⌘R** sem `canSync` não faz nada (não chama o `syncKobo`, não mexe no `exported` nem no erro).
3. **Exportar** fica ativo sem Kobo: a Barra e o ⌘E exportam da Biblioteca guardada.
4. **Desligar e voltar a ligar** o mesmo Kobo: o Sincronizar passa a ativo sem recarregar a página.

- [x] **Passo 1: testes que falham** (`page.svelte.test.ts`):
  - `sync_disabled_without_kobo`: sem Kobo, o Sincronizar tem `aria-disabled` e o tooltip «Liga o Kobo para sincronizar»; não há cabeçalho sem novos;
  - `sync_disabled_with_other_readers_kobo`: com dois leitores, o A aberto e o Kobo do B ligado (sincronização ao ligar desligada), o tooltip é «O Kobo ligado é de B»;
  - `sync_reason_falls_back_without_reader_name`;
  - `sync_shortcut_does_nothing_without_kobo`;
  - `export_works_without_kobo`: a Barra e o ⌘E chamam o export;
  - `sync_enables_on_reconnect`: desligar e voltar a ligar o mesmo Kobo reativa o botão.
  Os testes que já passam por causa da Task 36 ficam como regressão; o `sync_disabled_with_other_readers_kobo` tem de falhar antes.
- [x] **Passo 2:** os testes novos falham pela razão certa (só o do outro leitor, e o do nome em falta, por desenho).
- [x] **Passo 3 (Sonnet):** Comportamento 1 a 4.
- [x] **Passo 4: o harness visual**, em Claro e Escuro:
  - `mock-ipc.ts`: um modo sem Kobo ligado (sem `device-detected`) e um modo com o Kobo de outro leitor;
  - `library-disconnected`: a grelha sem novos e sem cabeçalho, Sincronizar desativado, Exportar ativo (comparado com o `71:9162` menos o cabeçalho);
  - `library-disconnected-tooltip`: hover no Sincronizar, tooltip «Liga o Kobo para sincronizar» aberto;
  - `library-other-reader-tooltip`: o tooltip «O Kobo ligado é de …»;
  - as baselines que mudam revistas uma a uma (não deve mudar nenhuma das que existem).
- [x] **Passo 5:** o gate completo (`cargo test`; clippy com os mesmos 7 avisos; Vitest duas vezes e com `--sequence.shuffle`, ignorando as falhas antigas conhecidas; `npm run check` 0/0; `npm run build`; `npm run test:visual`, a contar a linha «N failed»).
- [x] **Passo 6:** review adversarial (Opus), com o foco no motivo do Sincronizar e nas transições ligar/desligar/trocar de leitor. Depois, o commit `feat(library): explain why Sync is disabled`.

**Feito (2026-11-20).** Implementado pelo Sonnet. Antes do código, só falhou o `sync_disabled_with_other_readers_kobo` («Connect your Kobo to sync» em vez de «… belongs to Ana»); os outros cinco já passavam pelo trabalho da Task 36 e ficam como regressão. Os Comportamentos 2 a 4 já funcionavam, por isso não mudou código para eles. O `mock-ipc.ts` não precisou de mudar: o `MockConfig` já tinha os leitores e os donos dos Kobos. Review adversarial (Opus): «aprovar», sem bloqueadores nem majors. Confirmou no caminho real que o `deviceConnected` grava o `connectedReaderId` do dono antes de olhar para a sincronização ao ligar, e que a troca pelo Título-menu, desligar, voltar a ligar e o `readers-changed` dão o motivo certo. Um minor corrigido: uma espera repetida no cenário `library-other-reader-tooltip`. Gate: Vitest 749 passam e 1 ignorado (duas corridas e shuffle), `npm run check` 0/0, build OK, `cargo test` verde, clippy com os mesmos 7 avisos, `test:visual` 103/103 (9 baselines novas, nenhuma das antigas mudou). As quatro mutações do coordenador foram apanhadas.

**Mutações do coordenador:**
- comparar o `connectedReaderId` com o `activeReaderId` ao contrário (`===`): o motivo do outro leitor aparece com o próprio Kobo;
- tirar a guarda do `canSync` no ⌘R;
- desativar o Exportar sem Kobo;
- usar o `activeReaderId` para o nome (mostra o leitor aberto em vez do dono do Kobo).

**Verificar no ecrã (Bruno, com `npm run dev:app`):**
- sem o Kobo: Sincronizar desativado com o tooltip, Exportar funciona, sem cabeçalho;
- ligar o Kobo: o Sincronizar fica ativo;
- se tiveres dois leitores: com o outro aberto e a sincronização ao ligar desligada, o tooltip diz de quem é o Kobo;
- em Claro e Escuro.

**Ecrã 3 aprovado a 2026-11-20** (Bruno: «Avança», ao pedido de aprovação dos ecrãs 3 e 4).

### Task 40: Ecrã 4 · Biblioteca, lista
**Task aprovada pelo Bruno a 2026-11-20** («Aprovo a Task 40»).

**Decisões do Bruno a 2026-11-20:**
- **Seleção com o rato, Q-L:** a L1, que era a recomendada. Figma `124:31347`, página «Iteração · Componentes», com a nota `125:32255`.
  - Há uma ranhura de 24 pt, sempre reservada, antes da miniatura, mais 8 pt de espaço. A caixa segue a regra B da grelha: aparece com o ponteiro na linha, com o foco e em todas as linhas enquanto houver seleção.
  - Clicar na caixa seleciona; clicar no resto da linha abre o livro.
  - A área de clique é a faixa inicial de 36 × 44: margem 8, ranhura 24 e mais 4.
  - **O desenho da caixa é idêntico ao da grelha** (Bruno: «O desenho da checkbox deve ser idêntico à grelha»). Vazia é a E1 (`bg-selection-box`, `shadow-selection-box`, e com o ponteiro `bg-selection-box-hover`); selecionada é o visto `primary` com o anel `background`, também na linha `primary`.
  - Rejeitadas: L2, a miniatura vira caixa, porque esconde a capa enquanto se escolhe e a capa seleciona na lista mas abre na grelha; L3, uma coluna sempre visível, porque são 14 círculos em repouso e contradiz a regra B. O modelo do Finder (clique seleciona, duplo clique abre) já tinha sido posto de lado.
- **Direção da ordem:** fica guardada nas preferências, como o critério.
  - Clicar no cabeçalho da coluna ativa inverte a direção.
  - Clicar noutra coluna escolhe esse critério na direção natural.
  - Escolher no menu Ordenar repõe a direção natural.
  - Rejeitadas: só em memória; não inverter.

**Figma:** secção `71:9736`, com a janela Claro `71:9740` e a Escuro `71:9755` (DECISIONS, «Ecrãs · 2 · lista»); Linha `66:4618`; Cabeçalho `66:4649`; a caixa na L1 de `124:31347`.
- As linhas têm 44 px, separadores de 1 px e nenhum fundo alternado. As células ficam 8 px para dentro da margem de 24 px.
- Colunas:
  - Título ocupa o resto: ranhura da caixa, miniatura 24 × 36, título Medium e a etiqueta «N novos» 8 px depois;
  - Autor 200;
  - Destaques 88, à direita e com algarismos tabulares;
  - Última leitura 120.
- O cabeçalho das colunas tem 28 px e o rótulo «Título» fica alinhado com a miniatura. A lista começa a 128 px do topo, como a grelha, e cabem 12 linhas a 1000 × 700.
- Por defeito ordena por Última leitura, descendente. Um livro sem data mostra «—» e fica no fim.

**Já existe:**
- `BookRow` e `ColumnHeader`, em `src/lib/components/ui/table/` (Task 26). A linha tem `role=row`, `aria-selected` e os estados idle e selecionada; o cabeçalho tem `aria-sort` e devolve o clique.
- `LibraryGrid`, que serve de modelo do teclado, da seleção, do `hideNew` com o fade da etiqueta e do `initialActiveId`.
- O cabeçalho da Biblioteca, que já se desenha por cima das duas vistas.

**Implementador:** um Sonnet para tudo, com a `LibraryGrid` como molde. A lógica da seleção copia regras que já existem e não inventa nenhuma nova. A review adversarial (Opus) concentra-se nela.

**Ficheiros:**
- `src-tauri/src/settings/mod.rs` e `src/lib/bindings.ts`, este gerado;
- `src/lib/stores/settings.svelte.ts`;
- `src/routes/+page.svelte` e `src/routes/page.svelte.test.ts`;
- novos: `src/lib/components/ui/library-list/{library-list.svelte,index.ts,library-list.test.ts}`;
- `src/lib/components/ui/table/book-row.svelte`, `column-header.svelte` e `table.test.ts`;
- `src/lib/components/LibraryView.svelte`;
- uma função de data relativa em `src/lib/utils/`, com o seu teste;
- `src/lib/i18n/locales/{pt,en}.json`;
- `tests/visual/scenarios.ts` e as baselines;
- a apagar: `BookListItem.svelte` e o `BookListItem.svelte.test.ts`.

**Comportamento:**
1. **A definição, no Rust:**
   - `UiPreferences.library_sort_reversed: bool`, por defeito `false`, com `#[serde(default)]`, para que um ficheiro antigo sem o campo continue a abrir;
   - o mesmo campo, opcional, no `SettingsPatch` e no `apply_to`;
   - os bindings regenerados.
   O store ganha `setSortReversed`. O `setSortPreference` (o menu) passa a repor `reversed=false`.
2. **A ordem, em `sortedBooks`:**
   - a direção natural fica como hoje: Título e Autor ascendentes, Última leitura e Destaques descendentes. `reversed` inverte-a;
   - um livro sem data, ou sem autor quando se ordena por Autor, fica **sempre no fim**, nas duas direções;
   - a mesma ordem serve a grelha e a lista.
3. **O cabeçalho das colunas** (`ColumnHeader` × 4, pela ordem Título, Autor, Destaques, Última leitura):
   - a coluna ativa mostra a seta da direção real: `asc` ou `desc` no `aria-sort`;
   - clicar na ativa inverte e grava `reversed`;
   - clicar noutra grava o critério com `reversed=false`;
   - o cabeçalho fica preso ao topo da área que rola (`sticky top-0`, fundo `background`), como no Finder;
   - o rótulo «Título» começa 32 pt para dentro, alinhado com a miniatura.
4. **`LibraryList`**, uma tabela com `role="grid"`, `aria-multiselectable="true"` e `aria-label` igual ao da grelha:
   - cada `BookRow` é uma linha focável com tabindex itinerante (um só ponto de Tab) e o `aria-label` do Cartão (título, autor, destaques, novos);
   - o teclado é o da grelha: ↑ e ↓ movem o foco sem selecionar, Home e End vão às pontas, Enter abre, Espaço marca ou desmarca, e Esc limpa a seleção (se não houver seleção, não consome a tecla);
   - o rato também é o da grelha: o clique abre; a caixa, ⌘ e ⇧ selecionam; o ⇧ seleciona um intervalo a partir da âncora, guardada como id;
   - `initialActiveId` dá o foco à linha ao voltar do Detalhe;
   - `hideNew` esconde as etiquetas durante a sincronização e fá-las entrar com fade no fim, como na grelha.
5. **`BookRow`:**
   - a ranhura com a caixa, como no Comportamento da Q-L. A caixa é `aria-hidden`, não é `<button>` e não tem `tabindex`, e quem lê o clique é a lista. Aparece com o ponteiro na linha, com `:focus-visible` e com `data-selecting`, com fade de 150 ms e respeitando o Reduzir movimento;
   - o foco numa linha que não está selecionada mostra o `focus-ring`; numa linha selecionada, nenhum anel (Componentes 4);
   - a Última leitura em data relativa: «Hoje», «Ontem», «Há N dias» até 6, «Há N semanas» até 4, «Há N meses» até 11, e depois «Há N anos». Usa `Intl.RelativeTimeFormat` na língua da interface, com a primeira letra em maiúscula, e conta dias de calendário locais. Sem data, mostra «—».
6. **`LibraryView`:** o ramo da lista passa a ser a `LibraryList`. Saem o `BookListItem`, o `handleBookClick`, o `lastSelectedIndex` e a prop `onBookClick`. A página deixa de passar o `handleBookClick` se ele ficar sem uso.

- [x] **Passo 1: testes que falham.**
  - Rust:
    - `library_sort_reversed_defaults_false`;
    - `old_settings_without_reversed_load`;
    - `patch_sets_reversed`.
  - `library-list.test.ts`:
    - `click_opens`;
    - `box_click_selects_without_opening`;
    - `cmd_click_toggles`;
    - `shift_click_selects_range_from_anchor`;
    - `arrows_move_focus_without_selecting`;
    - `home_end`;
    - `space_toggles_enter_opens`;
    - `escape_clears_only_with_selection`;
    - `single_tab_stop`;
    - `initial_active_row_gets_focus`;
    - `hide_new_hides_badges`;
    - `box_shows_while_selecting`.
  - `page.svelte.test.ts`:
    - `header_click_reverses_active_sort`;
    - `header_click_other_column_resets_direction`;
    - `menu_sort_resets_direction`;
    - `missing_date_stays_last_both_directions`;
    - `missing_author_stays_last_both_directions`;
    - `reversed_applies_to_grid_too`.
  - A data relativa: hoje, ontem, 6 dias, 1 semana, meses, anos, sem data, e pt e en.
- [x] **Passo 2:** os testes novos falham pela razão certa.
- [x] **Passo 3 (Sonnet):** os Comportamentos 1 a 6.
- [x] **Passo 4: harness visual,** em Claro, Escuro e Escuro do sistema:
  - o `selectBooks` da lista passa a clicar na caixa da linha;
  - `list` (os estados passam a ser hover na linha, hover na caixa e foco numa linha) e `list-selected` são revistos contra o `71:9740` e a L1;
  - novo `list-selecting`, com uma linha selecionada e as caixas à vista;
  - novo `list-reversed`, com o cabeçalho clicado duas vezes e a seta para cima;
  - as baselines que mudam são revistas uma a uma.
- [x] **Passo 5:** o gate completo:
  - `cargo test`;
  - clippy com os mesmos 7 avisos;
  - Vitest duas vezes e com `--sequence.shuffle`;
  - `npm run check` com 0/0;
  - `npm run build`;
  - `npm run test:visual`, contando a linha «N failed».
- [x] **Passo 6:** a review adversarial (Opus), centrada na seleção e no teclado, no sticky e no foco, na ordem com nulos e inversão e na compatibilidade da definição. Depois, o commit `feat(library): list view with selection box and reversible sort`.

**Feito (2026-11-20).** Implementado pelo Sonnet. Antes do código, os testes de Rust falharam por compilação (o campo `library_sort_reversed` não existia) e os da lista e da página falharam por não haver linhas nem o módulo `library-list`; o `relative-date` falhou por não existir. Desvios: o menu Ordenar passa a gravar também `librarySortReversed: false` (o `main_sort_change_persists` mudou em conformidade); a lista usa um `<table>` próprio em vez do `Table` (o invólucro com scroll quebraria o cabeçalho sticky) com `display: block` no corpo e no cabeçalho, e o `ColumnHeader` ganhou a prop `flush`; a lógica do teclado e da seleção foi duplicada da grelha, não extraída; o invólucro da `LibraryView` passou a `p-6` nas duas vistas; o `table.test.ts` ganhou um `afterEach` que remove as tabelas soltas (o shuffle dependia da ordem). A caixa em hover no harness é aberta primeiro na linha e depois na caixa, porque é transparente ao clique em repouso. Gate: Vitest 771 passam e 1 ignorado (duas corridas e shuffle), `npm run check` 0/0, build OK, `cargo test` verde, clippy com os mesmos 7 avisos, `test:visual` 109/109 (baselines novas `list-selecting` e `list-reversed`; mudaram `list` e `list-selected`).

**Review adversarial (Opus): aprovada, sem bloqueadores nem majors.** Dois menores corrigidos antes do commit: (1) o `numeric: 'auto'` dava «Semana passada», «Mês passado» e «Ano passado» para contagens de 7, 30 e 365 dias que não são a semana, o mês ou o ano de calendário anteriores; agora só os dias usam `auto` («Hoje», «Ontem») e o resto diz «Há 1 semana», «Há 1 mês», «Há 1 ano»; (2) roles explícitos em toda a tabela (`rowgroup`, `row` no cabeçalho, `columnheader`, `gridcell`), como as linhas já tinham, porque o `display: block/flex` pode apagar os implícitos no WebKit e com eles o `aria-sort`. As baselines da lista foram regeneradas (só muda o texto das datas). **Mutações (9, todas apanhadas):** ignorar `reversed`; livros sem valor a subir na inversão; o menu não repõe a direção; outra coluna herda `reversed`; a caixa abre o livro; Espaço abre; Esc consumido sem seleção; valor errado gravado; `serde(default)` removido (4 testes de Rust). Gate final: Vitest 771/1, check 0/0, `test:visual` 109/109.

**Mutações do coordenador:**
- ignorar o `reversed` em `sortedBooks`;
- inverter também os livros sem data, que passam para o topo;
- o menu Ordenar não repor a direção;
- clicar noutra coluna manter o `reversed`;
- o clique na caixa abrir o livro;
- o Espaço abrir em vez de marcar;
- o Esc consumir a tecla sem seleção;
- tirar o `#[serde(default)]` do campo novo.

**Verificar no ecrã (Bruno, com `npm run dev:app`):**
- a lista com a caixa: aparece com o ponteiro, seleciona e o resto da linha abre o livro;
- o ⇧-clique e o ⌘-clique;
- o teclado;
- clicar duas vezes num cabeçalho inverte a ordem, a ordem fica ao reabrir a app e o menu Ordenar repõe-na;
- voltar do Detalhe devolve o foco à linha;
- em Claro e Escuro.

**Ecrã 4 aprovado a 2026-11-20** (Bruno: «Avança», depois das Tasks 41 e 42 e do pedido de aprovação dos ecrãs 3 e 4).

### Task 41: Lista · densidade M2 e caixa sempre visível
**Task aprovada pelo Bruno a 2026-11-20** («Aprovo a Task 41»).

**Decisões do Bruno a 2026-11-20** (DECISIONS, «Componentes · 10 · Densidade da lista: M2 escolhida»): a M2 · Confortável da ronda Q-M. Figma `127:32392`, M2 `127:32889`, nota `128:33401`. As medidas exatas lêem-se da M2; os números abaixo são os da ronda.

**Já existe:** a lista da Task 40 (`LibraryList`, `BookRow`, `ColumnHeader`, `Thumbnail`) e o ⇧ com as setas (`a93f533`).

**Implementador:** um Sonnet. Review adversarial (Opus) no fim, centrada no contraste dos tokens, no foco da linha selecionada e no corte da coluna abaixo de 900 px.

**Ficheiros:** `src/app.css` (token novo), `src/lib/components/ui/cover/thumbnail.svelte`, `src/lib/components/ui/table/{book-row,column-header}.svelte` e `table.test.ts`, `src/lib/components/ui/library-list/library-list.svelte` e o seu teste, `tests/visual/scenarios.ts` e as baselines da lista.

**Comportamento:**
1. **Token `selection-outline`** (nota `128:33401`, proposta `129:33536`/`129:33537`):
   - Claro: repouso = Figma `neutral/300` (3,26:1 sobre `background`); com o ponteiro = Figma `neutral/400` (5,37:1 sobre `accent`).
   - Escuro: `neutral/300` nos dois estados (5,11:1 e 4,27:1).
   - **Atenção:** os primitivos `--color-neutral-300/400` do `app.css` (#D1D5DB, #9CA3AF) **não** são os do Figma. Ler o hex das variáveis do Figma (ficheiro KHI `nU5CnQTJobxVE8mHMr7iZL`, nunca o `123ROaxISSoGiEDMT8AswI`) e escrevê-lo no token semântico; não mexer nos primitivos existentes. Um teste mede ≥ 3:1 nos quatro pares.
2. **Miniatura** 32 × 48, raio 3, contorno interior de 1 px a 20 % como hoje. Só a lista a usa.
3. **Linha** de 56 px; capa → título 16 px; o texto do título começa onde a M2 o põe (≈ 88 px do início da linha).
4. **Caixa sempre visível** em todas as linhas, sem regra B na lista: disco de 20 px; vazio com contorno de 1,5 px em `selection-outline` (com o ponteiro na linha, o valor de hover); selecionado como hoje. Área de clique 36 × 56. Clicar na caixa seleciona, no resto da linha abre; ⌘ e ⇧ como hoje. A grelha não muda.
5. **Cabeçalho:** «Título» alinhado com o texto do título.
6. **Foco na linha selecionada:** anel interior de 2 px em `primary-foreground`, recuado 2 px. A linha não selecionada mantém o `focus-ring` de hoje.
7. **Janela estreita:** abaixo de 900 px de largura da janela, a coluna «Última leitura» (cabeçalho e células) desaparece e o Autor passa de 200 a 160. Ordenar por data continua no menu Ordenar; se essa for a ordem ativa, não há seta visível e o `aria-sort` não fica órfão.

**Passos:**
- [x] **Passo 1:** testes que falham: a caixa existe e está visível em repouso em todas as linhas; clicar nela seleciona e no resto abre; abaixo de 900 px não há `columnheader` «Última leitura» nem células; a linha selecionada e focada tem o indicador.
- [x] **Passo 2:** token, miniatura, linha, caixa, cabeçalho, foco e coluna estreita.
- [x] **Passo 3:** cenários visuais: atualizar `list`, `list-selected`, `list-selecting`, `list-reversed`; o `--min` (800) mostra a coluna a sair; acrescentar o foco numa linha selecionada.
- [x] **Passo 4:** gate completo (Vitest, check, build, `test:visual`).
- [x] **Passo 5:** review adversarial (Opus) e mutações minhas; commit `feat(library): comfortable list density with always-visible selection box`. Feito: a review encontrou 0 blockers e 0 majors, e 2 minors que foram corrigidos (`scroll-pt-7` sob o header sticky; asserções de visibilidade da caixa reforçadas). Mutações: 9/9 mortas (token Light rest e hover, limiar 900, coluna de data no header e nas células, Autor estreito, anel na linha selecionada, alinhamento do header, caixa escondida em repouso).

**Feito (2026-11-20).** Passo 1: 12 testes falharam primeiro (2 de contraste, 1 miniatura, 4 linha, 5 lista). Implementado com as métricas do Figma M2 (linha h-14, caixa 20 px a 8 px, capa 32×48 r3, «Título» a 88 px, anel de foco 2 px inset 2 px em `primary-foreground`). Token `selection-outline` com os hex do Figma `neutral/300` e `neutral/400` (os primitivos de `app.css` ficam intactos): Claro #8E8E92 / hover #636366; Escuro #8E8E92 / #8E8E92. Rácios medidos: Claro 3,26:1 sobre `background` e 5,37:1 (hover) sobre `accent`; Escuro 5,11:1 e 4,27:1. Coluna estreita: largura da janela (`innerWidth`, < 900 px) remove cabeçalho e células de «Última leitura» do DOM; com ordenação por data não resta seta nem `aria-sort`. Desvios: removidos `selecting`/`data-selecting` da lista (a caixa é sempre visível; a grelha não mudou); miniatura com `rounded-[3px]` porque `--radius-thumb` é 2 px; os testes de contraste leem `background`/`accent` de `tokens.css`, importado por `app.css`. Novo estado visual `focus-selected-row`. Review: (1) `scroll-pt-7` no contentor de scroll de `LibraryView`, para o cabeçalho fixo de 28 px não tapar a linha focada com ↑ (sem teste: o jsdom do Vitest não faz scroll nem layout); (2) o cenário `list-selecting` passou a verificar `toBeVisible()` e `border-top-color` `rgb(142, 142, 146)` no disco vazio, e `selection_box_is_visible_at_rest_in_every_row` passou a exigir `border-[1.5px]` e `border-selection-outline`. Gate (antes e depois do review): Vitest 788 passed / 1 skipped, check 0/0, build ok, test:visual 109 passed.

**Verificar no ecrã (Bruno):** as capas reais reconhecem-se; as caixas vêem-se em repouso no Claro; com a janela estreita, «Última leitura» sai sem saltos; navegar com as setas sobre linhas selecionadas mostra sempre onde está o foco.

### Task 42: Lista · separador do cabeçalho, caixa de 16 px e datas absolutas
**Task aprovada pelo Bruno a 2026-11-20** («Aprovo a Task 42»).

**Decisões do Bruno a 2026-11-20** (DECISIONS, «Componentes · 11»): caixa da lista a 16 px com visto de 10; datas relativas até 30 dias e depois data curta («9 nov.», «9 nov. 2025» noutro ano). O separador do cabeçalho já estava no Figma (Componentes · 17) e é um bug da Task 40.

**Já existe:** a lista M2 (`75146fe`), `formatRelativeDate` em `src/lib/utils/relative-date.ts`, e a data curta do resumo («desde 9 nov.») em `library-header`.

**Implementador:** um Sonnet. No Figma, um Opus atualiza a M2 (`127:32889`) com a caixa de 16 px. Review adversarial (Opus) leve no fim, centrada nas fronteiras das datas e no fuso.

**Ficheiros:** `src/lib/components/ui/library-list/library-list.svelte`, `src/lib/components/ui/table/book-row.svelte`, `src/lib/utils/relative-date.ts` e testes, `tests/visual/scenarios.ts` e as baselines da lista.

**Comportamento:**
1. **Separador:** 1 px em `border` por baixo da linha de cabeçalhos, em Claro e Escuro, alinhado com os separadores das linhas.
2. **Caixa da lista:** disco de 16 px; vazio com contorno de 1,5 px em `selection-outline` (hover como hoje); selecionado em `primary` com visto de 10 px e o anel de `background` de hoje. Mesma posição horizontal do centro e área de clique de 36 × 56. A grelha não muda.
3. **Datas:** 0–6 dias «Hoje», «Ontem», «Há N dias»; 7–30 dias «Há N semanas»; a partir de 31 dias, data curta com o mesmo formatador do resumo, sem ano no ano corrente e com ano noutro. Sem data, «—». Em inglês, o mesmo esquema.
4. **Cabeçalho a 36 px** (acrescento do Bruno a 2026-11-20, no ecrã): a linha de cabeçalhos passa de 28 a 36 px, 8 px acima e abaixo do rótulo, sempre (sem mudar ao colar); o `scroll-pt-7` do contentor passa a `scroll-pt-9`.

**Passos:**
- [x] **Passo 1:** testes que falham: o cabeçalho tem o separador; o disco mede 16 e o visto 10 na lista e 20 na grelha; datas nas fronteiras 30/31 dias, na passagem de ano (31 dez → 1 jan) e noutro ano, em pt e en.
- [x] **Passo 2:** implementação; Figma M2 com a caixa de 16 px. Feito: código; Figma M2 `127:32889` com a caixa de 16 px e visto de 10, datas absolutas a partir de 31 dias e cabeçalho a 36 px (linhas `127:32896`, `127:33065`, `127:33234`; nota `129:33593`).
- [x] **Passo 3:** baselines visuais da lista.
- [x] **Passo 4:** gate completo (Vitest, check, build, `test:visual`).
- [x] **Passo 5:** review adversarial e mutações minhas; commit `fix(library): list header rule, smaller selection box, absolute dates past a month`. Feito: review com 0 blockers, 0 majors e 3 minors, todos corrigidos (traço do visto via `Icon` `xs`; vírgula do ano em inglês; o fuso já estava fixo no harness). Mutações: 9 aplicadas, 8 mortas à primeira; a sobrevivente (centro da caixa, `pl-2.5` → `pl-2`) passou a morrer com a nova asserção.

**Feito (2026-11-20).** Passo 1: 10 testes falharam primeiro (7 do `relative-date`, por a função ainda se chamar `formatRelativeDate`; 2 da caixa em `table.test.ts`, disco 16 e visto 10; 1 do separador do cabeçalho). Implementado: `HeaderRow` perde o `border-b-0` e herda o `border-b border-border` do `table-row`, igual às linhas; disco `size-4` nos dois estados com o visto a `size-2.5` (10 px; o `Icon` não tem esse tamanho, passa-se a classe sem mexer nos tamanhos existentes) e `pl-2.5` na tira de 36 × 56, para o centro ficar nos 18 px de antes; a grelha não mudou (o teste dos 20 px do `book-card` continua verde). `formatRelativeDate` passou a `formatLastRead`: 0–6 dias relativo, 7–30 «Há N semanas», a partir de 31 dias data curta; o formatador do resumo foi extraído para `src/lib/utils/short-date.ts` (`formatShortDate`) e é partilhado com `library-header`. Desvios: em inglês o ano vem depois de um espaço («Nov 20 2026»), o mesmo esquema do resumo, sem vírgula; o `formatShortDate` usa o locale tal e qual (com `pt-PT` o WebKit dá «9 11»); o cenário visual `listView` ganhou asserções (linha do cabeçalho com 1 px, «2 out.» e «Há 5 dias», só quando a coluna existe), e as datas das fixtures não mudaram (2 out. = 44 dias, 15 ago., 1 jul. deixam de ser «Há N meses» e passam a data curta). Baselines: só as 14 da lista (`list`, `list-selected`, `list-selecting`, `list-reversed`, mais `list--min` em claro e escuro). Acrescento do Bruno (cabeçalho a 36 px): `h-7` passou a `h-9` na linha de cabeçalhos e no `ColumnHeader`, `scroll-pt-7` a `scroll-pt-9` na `LibraryView`, mantendo o separador de 1 px; testes da altura ajustados e baselines da lista atualizadas de novo. Correções da review: o `Icon` ganhou o tamanho `xs` (10 px, `size-2.5`) para o visto, porque com `size="sm"` o lucide recebia 12 e o traço, com `absoluteStrokeWidth`, saía a ≈1,11 px em vez de 1,333 (teste: `width="10"` no svg); o ano em `formatShortDate` passou a vir do Intl (`year: 'numeric'`, só o « de » português vira espaço): «9 nov. 2025» e «Nov 9, 2025» (o teste inglês ganhou a vírgula, e a nota anterior sobre «Nov 20 2026» fica sem efeito); o fuso dos testes visuais já estava fixo em `Europe/Lisbon` no `newContext` do harness (`harness.ts`), por isso a config do Playwright não mudou; a mutação `pl-2.5`→`pl-2` sobrevivia e agora o teste da caixa fixa o `pl-2.5` (centro do disco a 18 px). Baselines da lista atualizadas de novo. Gate final: Vitest 790 passam e 1 ignorado, `npm run check` 0/0, build OK, `test:visual` 109/109.

**Verificar no ecrã (Bruno):** a linha por baixo do cabeçalho; a caixa proporcional à capa; livros lidos há mais de um mês mostram a data.

### Task 43: Ecrã 5 · Detalhe do livro
**Task aprovada pelo Bruno a 2026-11-20** («Aprovo a task 43»).

**Decisões do Bruno a 2026-11-20** (DECISIONS, «Ecrãs · 5 · Detalhe»): destaques que chegam com a sincronização entram logo, com o scroll compensado; ⌘1–⌘3 ficam para a Fase 6; um livro sem destaques não tem desenho (só uma guarda no código).

**Figma:** `71:10560` (Claro) e `71:10965` (Escuro), secção `71:10556`, cartão `71:11054`. Medidas lidas no levantamento:
- coluna de 560 centrada, a 32 do topo, `gap` 32 entre cabeçalho e Segmentado;
- cabeçalho do livro: Capa 96 × 144, 24 até ao texto; Title 1 `foreground`, autor Body `muted-foreground`, contagens Callout `tertiary-foreground` («26 destaques · 5 novos · 1 removido do Kobo»; sem removidos, sem a última parte), 8 entre eles;
- Segmentado «Todos · Novos · Com notas» com contagens (292 × 28, segmentos 96 × 24), 48 até ao primeiro destaque;
- destaques a 48 uns dos outros: linha de metadados Callout («Capítulo 2 · 10 nov.») com a Etiqueta «Novo» ou o `unlink` «Removido do Kobo» na mesma linha; texto Literata 16/24; nota com ícone de 12; hover com o fundo `accent` a −16 de cada lado; botão Copiar de 24 centrado na linha de metadados;
- Barra: Voltar e Exportar (o Apagar fica para o ecrã 9; `canDelete` continua falso).

**Já existe:** `ui/highlight` (Task 27, por usar), `ui/segmented`, `ui/cover`, `ui/badge`, `WindowBar` no ramo Detalhe (Voltar com tooltip ⌘[, Exportar), `formatShortDate` (`src/lib/utils/short-date.ts`), `openBook`/`viewingNewIds`/`markBookOpened` no store, e a reposição do foco com `initialActiveId`.

**Implementador:** um Sonnet, em duas passagens (A: componente; B: ecrã e comportamento). Review adversarial (Opus) no fim, centrada no `viewingNewIds` contra o `isNew`, na compensação do scroll, no Esc em conflito com menus, tooltips e janelas modais, e no título da janela ao voltar.

**Ficheiros:** `src/lib/components/ui/highlight/*`, `src/lib/components/ui/segmented/segmented.svelte` (só se a guarda do `$effect.pre` o pedir), `src/lib/components/BookDetailsView.svelte` e o seu teste, `src/routes/+page.svelte`, `src/lib/stores/library.svelte.ts` (só leitura, salvo bug), `src-tauri/capabilities/` da janela principal, `pt.json` e `en.json`, `tests/visual/scenarios.ts` e as baselines do Detalhe.

**Comportamento:**
1. **Destaque (A):** a Etiqueta «Novo» e o «Removido do Kobo» com `unlink` passam para a linha de metadados; ícone da nota a 12 (`Icon` `sm`); data com `formatShortDate`; Copiar centrado na linha de metadados. A API passa a receber `isNew` como prop vinda de fora (o ecrã dá-lhe o `viewingNewIds`), nunca do `highlight.isNew`. Um destaque novo e removido mostra só o removido.
2. **Ecrã (B):** `BookDetailsView` reescrito com as medidas acima, sem toolbar própria, sem a caixa «Mostrar removidos» (sai `showRemoved` e a chave `screens.bookDetails.showRemoved` do `pt.json`/`en.json`), sem a janela modal de apagar. Os removidos aparecem no seu lugar, com a marca do Detalhe 2.
3. **Contagens e filtro:** «N destaques» inclui os removidos; «N novos» conta os do `viewingNewIds` que não estão removidos; «N removidos do Kobo» só aparece com removidos. O filtro começa em Todos; «Novos» e «Com notas» com 0 ficam desativados (Q-C), e o Segmentado nunca fica num segmento desativado. Mudar de filtro leva a lista ao topo. Sem destaques: «0 destaques», sem Segmentado nem lista.
4. **Sincronização com o Detalhe aberto:** os destaques novos do mesmo livro entram logo no seu lugar, sem marca «Novo»; as marcas à vista mantêm-se. Se entram acima da zona visível, o `scrollTop` sobe pela altura acrescentada, para o texto à vista não se mexer. Fechar e reabrir mostra como «Novo» só os que chegaram.
5. **Teclado:** ⌘[ e Esc voltam à Biblioteca, sem animação, e o foco volta ao livro (`initialActiveId`). O Esc só volta se nenhum menu, tooltip ou janela modal o consumiu (`defaultPrevented`) e não atua dentro de campos de texto. Voltar pelo botão mantém o fade de 150 ms.
6. **Título da janela:** ao abrir, `setTitle(livro.title)`; ao voltar, o título de antes. Acrescentar `core:window:allow-set-title` à capability da janela principal (e atualizar qualquer teste que fixe essa lista).

**Passos:**
- [x] **Passo 1 (A):** testes que falham do `ui/highlight`: Etiqueta e removido na linha de metadados; novo e removido mostra só o removido; data curta; nota a 12. Implementar.
- [x] **Passo 2 (B):** testes que falham do Detalhe: `detail_keeps_new_marks_through_sync` (Fase 5); contagens do cabeçalho e do Segmentado; novo e removido fora de «Novos»; filtro desativado com 0; filtro leva ao topo; sem `show-removed`; ⌘[ e Esc voltam e devolvem o foco; Esc com um menu ou tooltip aberto não volta; `setTitle` ao abrir e ao voltar; compensação do `scrollTop` (com `scrollHeight` simulado, já que o jsdom não faz layout). Implementar.
- [x] **Passo 3:** cenário visual `detail` reescrito (o seletor `blockquote button` morre), em Claro e Escuro, comparado com o Figma; mais `detail-new-removed` (novo, removido e com nota à vista) e `detail--min` (800 × 600).
- [x] **Passo 4:** gate completo (Vitest, check, build, `test:visual`, `cargo check` pela capability).
- [x] **Passo 5:** review adversarial (Opus) e mutações minhas; commit `feat(detail): book detail screen with highlight filter and live sync`. Feito: review com 0 blockers, 1 major (Segmentado → primeiro destaque a 32 em vez de 48) e 3 minors (linha de metadados forçada a 24 px; filtro que voltava sozinho a um segmento depois de cair para Todos; `HighlightItem` e `Modal` sem uso), todos corrigidos, e quatro testes reforçados. Mutações: 13/13 mortas (marcas pelo `isNew`; novo e removido contado como novo; filtro sem reposição; sem compensação do scroll; âncora sem substituta; filtro sem ir ao topo; contagem de removidos escondida; novo a ganhar ao removido no Destaque; Esc a ignorar o `defaultPrevented`; Esc dentro de um campo; título sem `setTitle` ao abrir; título não reposto ao voltar; espaço de 32 antes da lista, apanhado pelos 8 cenários visuais `detail`). Gate final: Vitest 786 passam e 1 ignorado, check 0/0, build OK, `test:visual` 112/112, `cargo check` OK.

**Feito (2026-11-20).** `ui/highlight`: 8 testes falharam antes (a prop `isNew` passou a vir de fora, a Etiqueta «Novo» e o «Removido do Kobo» ficam na linha de metadados, novo e removido mostra só o removido, data curta com `formatShortDate`, nota a 12); o `state` deu lugar a `isNew` e o removido deriva de `removedAt`. `BookDetailsView` reescrito de raiz: 13 testes falharam antes (cabeçalho com Capa 96 × 144 e contagens, Segmentado «Todos / Novos / Com notas», filtro nunca sobre um segmento desativado e a levar ao topo, marcas só de `viewingNewIds`, sem barra própria, sem `show-removed`, sem janela de apagar); a chave `screens.bookDetails.showRemoved` saiu e entrou `book.removedCount`. Na página, 5 testes falharam antes: `detail_keeps_new_marks_through_sync`, ⌘[ e Esc (sem animação, só se ninguém consumiu o Esc, nem num campo de texto, nem com um diálogo aberto), `setTitle` ao abrir e ao voltar (capability `core:window:allow-set-title` na janela principal, com teste em `window-config.test.ts`). Desvios: a compensação do `scrollTop` ancora-se no primeiro destaque visível, em vez de somar a diferença de `scrollHeight` (assim só conta o que entra acima do texto à vista; o jsdom simula `getBoundingClientRect` e `scrollTop`); não existe hoje nenhum deslize nem fade ao abrir/voltar (Movimento 1 por fazer), portanto «⌘[ e Esc sem animação» é verdade por omissão. Visual: `detail` reescrito (sem novidades, com nota e removido), `detail-new-removed` e `detail--min`, Claro e Escuro; o mock de IPC passou a responder a `plugin:window|title`; `control.spec.ts` acompanha o novo botão de copiar. Gate (1.ª ronda): Vitest 804 passed / 1 skipped / 0 failed; `npm run check` 0 erros e 0 avisos; `npm run build` ok; `test:visual` 112 passed; `cargo check` ok.

**Review:** a distância Segmentado → primeiro destaque era 32, não 48 como se dizia (o `-m-4 p-4` do destaque anula o `gap-8`): `mt-4` só na lista, com asserção no cenário visual (fundo do `radiogroup` → topo da linha = 48). A linha de metadados deixou o `min-h-6` (a citação descia ~9 px); o botão de copiar passou a `top-3`, a sobressair da linha. O filtro com contagem 0 volta a «Todos» de verdade (`filter`, não só `active`), e não regressa se a contagem voltar. A compensação do `scrollTop` guarda todos os destaques visíveis e, se a âncora sai da lista (removida, fora do filtro), usa o seguinte; testes com «Novos»: o que entra acima e não passa no filtro não mexe, e a âncora que sai desce 100. Apagados `HighlightItem`, `Modal` e o teste daquele, mais a chave `app.close`. Testes reforçados: `detail_keeps_new_marks_through_sync` confirma `mark_book_opened` com `seenSeq: 3`; `escape_waits_for_the_update_dialog` passa agora pelo diálogo a sério (Esc fecha-o e o livro fica; ⌘[ com o diálogo aberto fica). Falharam antes: 3 (meta row/copiar, filtro que volta a «Todos», âncora que sai). Gate final: Vitest 786 passed / 1 skipped / 0 failed (menos os testes do `HighlightItem` apagados); `check` 0/0; `build` ok; `test:visual` 112 passed; `cargo check` não necessário (capabilities intactas).

**Verificar no ecrã (Bruno):** abrir um livro com novidades e ver as marcas; ⌘[ e Esc voltam ao mesmo livro; o título no menu Janela; ligar o Kobo com um livro aberto e ver que o texto não salta.

**Ecrã 5 aprovado a 2026-11-20** (Bruno: «Aprovo o ecrã 5»).

### Task 44: Ecrã 6 · Primeiro arranque e Kobo novo
**Decisões do Bruno a 2026-11-20** (AskUserQuestion, uma a uma; ver DECISIONS, «Ecrãs · 6 · … o que ficava por decidir antes do código»):
- **Q1 · mantém-se o R1** (contra a minha recomendação): sem nenhum leitor, o Khi não pergunta, cria o leitor com o nome do aparelho e sincroniza. A variante `Kobo novo · Sem leitores` (`62:2125`) e as molduras `72:11461` / `72:11500` não entram no código;
- **Q2:** depois de Cancelar, o Sincronizar fica ativo e volta a perguntar; desligar e ligar também;
- **Q3:** o pop-up vem no leitor da Biblioteca aberta; sem nenhum aberto, o `lastReader`; sem esse, o primeiro;
- **Q4:** o campo do nome em «Novo leitor…» começa vazio.

**Figma** (só leitura, medido a 2026-11-20):
- **Primeiro arranque** (`72:11425` Claro, `72:11443` Escuro), janela 1000 × 700:
  - a Barra da janela tem tudo à vista e desativado: Título-menu «Biblioteca», Grupo de vista, Ordenar, Sincronizar e Exportar;
  - o Estado vazio fica centrado, com 320 de largura e `gap` 24. Leva o Kobo tracejado de 96 (`highlight-line`, estático) e, por baixo, o Texto (`gap` 8);
  - o título é «Liga o teu Kobo», em Title 3 `foreground`;
  - a explicação é «Os destaques ficam guardados na Biblioteca, mesmo com o Kobo desligado.», em Body `muted-foreground`, centrada.
- **Kobo novo · Com leitores** (`58:6794`, 380 × 212) e **Novo leitor** (`62:2147`, 380 × 248):
  - o título é «De quem é este Kobo?» e o texto «Os destaques ficam na Biblioteca de quem escolheres.»;
  - os campos têm `pt-4 gap-2`, em linhas de 28 com um rótulo de 56 (Body), `gap` 8 e o controlo a 268;
  - a linha «Leitor» tem o Pop-up com os leitores, um separador e «Novo leitor…»;
  - com «Novo leitor…» entra a linha «Nome», com o Campo de texto;
  - os botões ficam à direita, com `pt-4 gap-2`: Cancelar (Secundário) e «Escolher» (Principal, o botão por omissão), ou Cancelar e «Criar leitor» com «Novo leitor…»;
  - o fundo é `bg-scrim` (Q-G).

**Ficheiros:**
- `src/lib/components/EmptyStateNoDevice.svelte` e um teste novo;
- `src/lib/components/UnknownKoboDialog.svelte`, reescrito sobre o `Dialog` da Task 23, o `Select` e o `FormRow`, e o seu teste;
- `src/lib/stores/library.svelte.ts` e `src/routes/+page.svelte` (com `page.svelte.test.ts`);
- `src/lib/components/ui/window-bar/window-bar.svelte`, só se precisar de um `disabled` global;
- `pt.json` e `en.json`;
- `tests/visual/scenarios.ts` e as baselines.

**Comportamento:**
1. **Primeiro arranque (sem leitor ativo, `uiState` `no-device`):**
   - o `EmptyStateNoDevice` passa ao esqueleto do `EmptyStateSyncing` (`gap-6`, `w-[320px]`, `text-title-3`, `text-body text-muted-foreground`, `bg-background`), com o `KoboIcon` `dashed` de 96;
   - os textos são `screens.noKobo.title` «Liga o teu Kobo» e `subtitle`, a frase da L1, e mudam em pt e en;
   - mantém `role="status"`;
   - a Barra tem tudo desativado: Título-menu, Grupo de vista, Ordenar, Sincronizar e Exportar. Nenhum atalho de teclado da Biblioteca dispara.
2. **R1 fica como está:** sem leitores, `deviceConnected` cria o leitor e sincroniza. Os testes atuais disso não mudam; se algum falhar, a implementação está errada, não o teste.
3. **Janela «De quem é este Kobo?» (há leitores):**
   - abre como `Dialog` (`role="dialog"`, `aria-modal`, nome no título, descrição no texto). Saem o `bg-black/40`, o `max-w-md` e os botões por leitor;
   - **Com leitores:** pop-up na pré-escolha da Q3, Cancelar e «Escolher». O foco vai para a janela, não para o pop-up (Q-E). Return carrega no «Escolher», que chama `onChoose(id)`;
   - **Novo leitor…:** aparece a linha «Nome», com o campo vazio e o foco nele. O botão principal passa a «Criar leitor», desativado sem texto (`trim`); Return com texto cria o leitor (`onCreate(nome)`). Voltar a um leitor no pop-up esconde o campo e o texto escrito não se perde;
   - **Cancelar, Esc e ⌘.:** fecham sem escolher (`onCancel`), e o Kobo não sincroniza;
   - **Teclas com o pop-up aberto:** Return e Esc atuam só no pop-up; nem confirmam nem cancelam a janela.
4. **Depois de Cancelar (Q2):**
   - a Biblioteca aberta fica à vista;
   - a recusa fica guardada para esta ligação (o número de série), até `deviceDisconnected`. O `device-detected` repetido do monitor não reabre a janela;
   - o Sincronizar fica ativo enquanto o Kobo sem dono está ligado. Carregar nele reabre a janela, em vez de sincronizar a Biblioteca aberta;
   - desligar e voltar a ligar volta a perguntar.
5. **Desligar com a janela aberta:** fecha a janela, sem escolher nem criar.
6. **Textos (pt e en):**
   - `unknownKoboTitle` passa a «De quem é este Kobo?» / «Whose Kobo is this?»;
   - `unknownKoboSubtitle` passa a «Os destaques ficam na Biblioteca de quem escolheres.» / «Highlights go to the Library of whoever you choose.»;
   - entram `choose` «Escolher» / «Choose», `newReaderOption` «Novo leitor…» / «New Reader…», `name` «Nome» / «Name» e `cancel` «Cancelar» / «Cancel» (se já existir uma chave comum de Cancelar, usa-se essa);
   - saem `existing`, `newReader` e `newReaderName`, se ficarem sem uso.

**Passos:**
- [x] **Passo 1:** testes que falham do `EmptyStateNoDevice` (textos, Kobo de 96, `role="status"`) e da Barra sem leitores (os cinco controlos desativados; ⌘E, ⌘R e afins não fazem nada). Implementar.
- [x] **Passo 2:** testes que falham do `UnknownKoboDialog`:
  - `role` e nome;
  - pré-escolha da Q3, com os três casos;
  - Return escolhe, e Return e Esc com o pop-up aberto não fecham a janela;
  - «Novo leitor…» mostra o campo vazio com o foco;
  - «Criar leitor» desativado com espaços;
  - o texto mantém-se ao voltar a um leitor;
  - Cancelar, Esc e ⌘. chamam `onCancel`.
  
  Implementar.
- [x] **Passo 3:** testes que falham da página e da store:
  - `cancel_keeps_library_and_does_not_sync`;
  - `repeated_device_detected_after_cancel_does_not_reopen`;
  - `sync_after_cancel_asks_again`;
  - `reconnect_after_cancel_asks_again`;
  - `disconnect_closes_unknown_kobo_dialog`;
  - `first_kobo_without_readers_does_not_ask` (o R1, se ainda não existir com este alcance).
  
  Implementar.
- [x] **Passo 4:** cenários visuais, em Claro e Escuro, comparados com o Figma: `first-launch` (com a Barra desativada), `unknown-kobo` (Com leitores) e `unknown-kobo-new-reader` (com um nome escrito), mais `first-launch--min` (800 × 600).
- [x] **Passo 5:** gate completo (Vitest, check, build, `test:visual`, `cargo check` se mexer em Rust).
- [x] **Passo 6:** review adversarial (Opus) e mutações minhas; commit `feat(readers): first start and whose-Kobo dialog from the redesign`.

**Feito (2026-11-20).** Aprovada pelo Bruno («Aprovo a Task 44»). Implementada pelo Sonnet com TDD; revista pelo Opus (review adversarial independente); mutações minhas.
- **1.ª ronda:** `EmptyStateNoDevice` no esqueleto do `EmptyStateSyncing` (Kobo tracejado de 96, «Liga o teu Kobo» e a frase da L1); `WindowBar` e `ViewGroup` com `disabled`; `UnknownKoboDialog` reescrito sobre `Dialog`, `Select` (ganhou `separatorBefore`) e `FormRow`; recusa por número de série na store (`declineKobo`, `declinedKobo`, limpa ao desligar ou com outro Kobo); `canSync` também com o Kobo recusado, e o Sincronizar volta a perguntar; desligar fecha a janela. O cenário `empty` passou a `first-launch`.
- **Review:** 0 blockers, 1 major e 7 minors. Corrigidos:
  - **major:** Return depois de usar o pop-up reabria a lista; agora o foco volta à janela;
  - Cancelar durante um `device-detected` em curso reabria a janela;
  - sem Biblioteca aberta, a Q2 falhava e o Título-menu ficava desativado com leitores. Agora o menu só se desativa sem leitores, o Sincronizar fica isento (`syncExempt`) com o Kobo recusado e o ⌘R funciona em `no-device`;
  - Cancelar ou Esc durante o `create_reader` deixava um leitor órfão, e o duplo clique criava dois (estado `busy`);
  - com «Sincronizar ao ligar» desligado, Sincronizar → Escolher não sincronizava;
  - três guardas sem teste;
  - «New reader…».
- **Comparação com o Figma (minha):** rótulos «Leitor» e «Nome» alinhados à direita (`textAlignHorizontal: RIGHT`); o Grupo de vista desativado sem o fundo de selecionado (`Estado=Desativado`).
- **Mutações:** 11. Nove morreram sozinhas. Duas sobreviveram por haver uma segunda guarda: o `if (busy)` (também trava o `disabled` do botão) e o retorno antecipado da store (também trava a página). Tiradas com a outra guarda, morrem. Mortas: guarda depois do `await`, `askedBySync`, ⌘R em `no-device`, `syncExempt`, foco na janela, Esc com `busy`, ordem da Q3, limpeza ao desligar, `trim`.
- **Gate final:** Vitest 837 passam e 1 ignorado; `npm run check` 0/0; build OK; `test:visual` 120/120; `cargo check` não necessário (sem Rust).
- **Fica por fazer (registado, não corrigido):**
  - a corrida antiga de «Escolher» durante um `device-detected` em curso (pede um pedido sequenciado em `deviceConnected`);
  - o `disabled` nativo do Grupo de vista contra o `aria-disabled` dos outros controlos;
  - a altura da janela, 214 contra 212 (borda de 1 px do `Dialog` da Task 23);
  - «Liga o teu Kobo» à vista com um Kobo recusado em `no-device`.

**Verificar no ecrã (Bruno):** o Bruno já tem leitores, por isso o primeiro arranque aprova-se pelas capturas. No ecrã, com a build dev:
- um Kobo sem dono abre a janela no leitor aberto;
- Cancelar deixa a Biblioteca e o Sincronizar volta a perguntar;
- desligar fecha a janela.

**Ecrã 6 aprovado a 2026-11-20** (Bruno: «Aprovo o ecrã 6»), pelas capturas e pela build dev. Frase do primeiro arranque encurtada pelo Bruno no Figma (`a16bfe3`).

### Task 45: Ecrã 7 · Definições (janela, Exportação, Aparência e Kobo)
**Decisões** (ver DECISIONS):
- **Janela 3 · P3 (2026-11-16):**
  - as opções aplicam-se no momento, sem Guardar, Cancelar nem aviso;
  - sai «Vista da Biblioteca»;
  - a altura acompanha o painel;
  - o título é o nome do painel;
  - minimizar e ampliar ficam esbatidos;
  - a janela reabre no último painel;
- **Q-M (M2):** com dois ou mais leitores, o painel Kobo tem pop-up «Leitor» e campo «Nome»;
- **Q1 (Bruno, 2026-11-20):** Repor padrões sai;
- **divisão:** a Atualizações (V2) e a janela de atualização ficam para a Task 46. Nesta task, o separador Atualizações já existe, com o conteúdo de hoje, sem redesenho.

**Figma** (só leitura, medido a 2026-11-20):
- Exportação `73:12025` / `73:12283`, 540 × 382;
- Aparência `73:12147` / `73:12405`, 540 × 287;
- Kobo com um leitor `73:12219` / `73:12477`, 540 × 243;
- Kobo com dois leitores `74:18916` / `74:18931`, 540 × 320;
- separadores com Atualizações em `78:25710`.

As alturas incluem o contorno de 1 px; o conteúdo manda.
- **Barra** (89 de altura, `py-2 gap-2`, filete `border` em baixo):
  - na 1.ª linha, o título do painel em Body Semibold, centrado, e os semáforos a x 20, y 10 (fechar a cor, minimizar e ampliar esbatidos);
  - na 2.ª linha, os Separadores (componente 12, `ui/tabs`), centrados, `gap-1`: Exportação, Aparência, Kobo e Atualizações. O ativo fica em Selecionado.
- **Conteúdo:** `p-6 gap-6`. Os grupos são `FormGroup`, com cabeçalho Body Semibold a `px-4` e cartão; as linhas são `FormRow`, `px-4 py-2 gap-4`.
  - **Exportação:**
    - grupo «Ficheiros»:
      - «Pasta de exportação», com a ajuda «{caminho} · os livros de {leitor} vão para aqui.» e o Botão «Escolher…»;
      - «Formato da data», com o Pop-up dos formatos de hoje;
    - grupo «Metadados a incluir»: uma linha `columns` com 3 colunas de Caixas (Autor e Data de leitura; ISBN e Idioma; Editora e Descrição).
  - **Aparência** (grupo sem cabeçalho):
    - «Tema», Pop-up Sistema / Claro / Escuro;
    - «Cor de destaque», com a ajuda «Sistema usa a cor escolhida no macOS.» e o `SwatchGroup` (Sistema e as sete);
    - «Idioma», com a ajuda «Também usado no Markdown exportado.» e o Pop-up «English» / «Português», cada um no seu idioma.
  - **Kobo, um leitor** (grupo sem cabeçalho):
    - «Nome do leitor», com a ajuda «Aparece no título com dois ou mais leitores.» e o Campo de texto;
    - «Sincronizar ao ligar», com a ajuda «Sincroniza quando ligas um Kobo conhecido.» e o Switch.
  - **Kobo, dois ou mais leitores (M2):**
    - 1.º grupo:
      - «Leitor», com a ajuda «O leitor cujo nome queres mudar.» e o Pop-up;
      - «Nome», com a ajuda «Aparece no título da Biblioteca.» e o Campo;
    - 2.º grupo: «Sincronizar ao ligar», com a ajuda «Vale para todos os leitores: sincroniza quando ligas um Kobo conhecido.».
  - **Kobo, sem leitores (proposta minha, sem Figma):** só o grupo do «Sincronizar ao ligar», com a ajuda de um leitor.

**Ficheiros:**
- `src/lib/components/SettingsPanel.svelte`, reescrito; podem nascer `settings/ExportPane.svelte`, `AppearancePane.svelte` e `KoboPane.svelte`, com os seus testes;
- `src/routes/definicoes/+page.svelte` e o seu teste;
- `src/lib/stores/settings.svelte.ts`;
- `src-tauri/src/window.rs` (`settings_window_spec` e o seu teste), `src-tauri/capabilities/settings.json` (+ `core:window:allow-set-size`) e o teste da capability;
- o campo do último painel em `UiPreferences` (Rust e bindings);
- `pt.json` e `en.json`;
- `tests/visual/scenarios.ts`, o README e as baselines `settings*`.

**Comportamento:**
1. **Janela** (`settings_window_spec`):
   - 540 de largura, não redimensionável, `minimizable(false)` e `maximizable(false)`;
   - barra `Overlay`, com o título nativo à vista (sem `hiddenTitle`) e `trafficLightPosition` a 20 × 10, para o título e os semáforos ficarem na 1.ª linha da barra desenhada pela página.
   - **Altura:** a página mede o painel ativo e faz `setSize(540, altura)` ao abrir e ao mudar de separador, sem animação. Com isto, a janela abre já no tamanho certo (continua criada escondida).
   - **Título:** `setTitle` com o nome do painel, também quando o idioma muda.
   - **Último painel:** gravado em `uiPreferences` e reaberto. Sem valor, abre em Exportação.
2. **Aplicar no momento:**
   - cada controlo grava logo com `settings.persist(patch)` (o `update_settings` com lock), e a principal recebe o `settings-changed`;
   - saem o rascunho, `hasChanges`, `save()`, `handleSave`, `handleCancel`, `handleReset`, a confirmação de alterações por guardar, `revertUnsavedLanguage` e `resetAndSave`, se ficarem sem uso;
   - o idioma muda nas duas janelas ao mesmo tempo;
   - Esc, ⌘W e o botão vermelho só fecham;
   - **pasta:** «Escolher…» grava logo a pasta do leitor aberto (`setReaderExportPath`, R21) ou, sem leitor, a `exportPath`;
   - dois cliques rápidos (Caixas) e uma escrita da principal ao mesmo tempo (vista, ordenar) não se perdem.
3. **Nome do leitor:**
   - grava com Return ou ao sair do campo;
   - vazio (depois do `trim`) volta ao nome guardado;
   - Esc dentro do campo repõe o nome guardado e não fecha a janela;
   - mudar o pop-up «Leitor» com um nome por gravar grava-o primeiro, se não for vazio;
   - o pop-up abre no leitor da principal (`settings_reader`);
   - renomear atualiza o título da principal e a lista do pop-up (`readers-changed`);
   - um leitor criado com as Definições abertas (R1, Kobo novo) troca o painel ao vivo, de um leitor para o M2.
4. **Sai das Definições:** Vista da Biblioteca e Repor padrões, com as suas chaves `pt.json` e `en.json`, se ficarem sem uso.
5. **Textos novos** em pt e en:
   - os títulos dos grupos;
   - as ajudas acima;
   - «Escolher…»;
   - o separador Kobo;
   - «Nome do leitor».

**Passos:**
- [x] **Passo 1:** testes que falham da janela.
  - Rust:
    - `settings_window_spec` (540, `Overlay`, título visível, posição dos semáforos, não minimizável nem ampliável);
    - o teste da capability (`allow-set-size`);
    - o campo do último painel com valor por omissão.
  - Vitest:
    - altura medida e `setSize` ao mudar de separador;
    - `setTitle` com o nome do painel e ao mudar de idioma;
    - reabrir no último painel.

  Implementar.
- [x] **Passo 2:** testes que falham da Exportação e da Aparência:
  - grava no momento, sem botões;
  - «Escolher…» com e sem leitor;
  - Caixas em 3 colunas;
  - tema, cor e idioma gravados logo, e o idioma muda a principal;
  - sem Vista da Biblioteca nem Repor padrões;
  - dois cliques rápidos não se perdem.

  Implementar.
- [x] **Passo 3:** testes que falham do Kobo:
  - um leitor;
  - M2 com dois;
  - sem leitores;
  - Return e sair do campo gravam;
  - vazio volta atrás;
  - Esc no campo repõe e não fecha;
  - mudar o pop-up grava o nome pendente;
  - pré-escolha do `settings_reader`;
  - `readers-changed` troca para o M2 ao vivo.

  Implementar.
- [x] **Passo 4:** cenários visuais `settings-export`, `settings-appearance`, `settings-kobo`, `settings-kobo-readers` e `settings-kobo-none`, em Claro e Escuro, cada um com a altura do seu painel, comparados com o Figma.
  - Os cenários `settings*` de hoje são revistos ou substituídos.
  - O separador Atualizações fica com o cenário de hoje, só com a moldura nova.
- [x] **Passo 5:** gate completo (Vitest, check, build, `test:visual`, `cargo test`, `cargo clippy --all-targets`).
- [x] **Passo 6:** review adversarial (Opus), mutações minhas e comparação com o Figma. Commit `feat(settings): live settings window with export, appearance and Kobo panes`.

**Verificar no ecrã (Bruno), com a build dev:**
- a janela muda de altura entre separadores e reabre no último;
- mudar o tema, a cor ou o idioma muda as duas janelas logo;
- ⌘, repetido abre sempre uma só janela;
- renomear o leitor muda o título da principal;
- ligar um Kobo e ver o leitor nas Definições, o que fecha as duas verificações adiadas da Fase 4.

**Feito (2026-11-21).** Aprovada pelo Bruno («Aprovo a Task 45»). Implementada pelo Sonnet com TDD; revista pelo Opus (review adversarial independente); mutações minhas.
- **1.ª ronda:**
  - janela de 540 com barra `Overlay`, título visível e semáforos em (20,10), sem minimizar nem ampliar;
  - altura medida no painel, com `setSize` antes de `show`;
  - `settings_pane` e `accent_color` gravados no Rust;
  - painéis `ExportPane`, `AppearancePane` e `KoboPane` sobre `FormGroup` e `FormRow`;
  - sem Guardar: cada controlo grava logo com `settings.commit(fields)`, e só os eventos `settings-changed` aplicam;
  - saem Repor padrões, `save`, `resetAndSave` e `revertUnsavedLanguage`;
  - com Multicolor fica o azul da app (`tones.sistema.azul`, Q2).
- **Review:** 1 blocker, 2 majors e vários minors, todos corrigidos:
  - **blocker:** um valor desconhecido num enum do `settings.json` apagava as definições. Agora usa `or_default` nos enums;
  - **major:** «Escolher…» gravava a pasta global depois de `readers-changed`. Agora usa `currentReaderId()`;
  - **major:** uma resposta antiga sobrepunha-se a um ficheiro mais novo. Agora o `persist` não aplica;
  - **minors:**
    - o nome da pasta passou a vir dos commands `reader_export_folder` e `reader_default_export_folder` (`safe_dir_name`);
    - o `saveError` limpa-se ao gravar outra vez;
    - o foco fica no campo ao passar para o M2;
    - ⌘W com um nome a meio grava-o antes de fechar (o `beforeClose` envolve o `commitName` num `try/catch`, e o `destroy()` corre sempre);
    - o `control.spec` ganhou asserções.
  - O `allow-destroy` fica, porque o `onCloseRequested` do Tauri chama `destroy()`.
- **Mutações minhas:** 11, todas mortas no fim:
  - `or_default` no `accent_color` e no `unwrap_or_default`;
  - `currentReaderId`;
  - `persist` com `applySaved`;
  - `onerror(null)` na Exportação, na Aparência e no interruptor do Kobo;
  - `commitName` e `destroy` no fecho;
  - Multicolor;
  - `show` sem esperar pelo `setSize`.
  - A Aparência, o Kobo e a ordem `setSize`/`show` sobreviviam no início e ganharam testes.
- **Comparação com o Figma (minha):**
  - o campo do nome passou de 220 para 160 px (`w-40`), e a dica cabe numa linha;
  - a dica da pasta abrevia a pasta pessoal para `~`, como no Finder, com `abbreviateHome` em `src/lib/home-path.ts`. É só apresentação, e o valor gravado continua absoluto;
  - os fixtures visuais passaram a usar `~/Documents/Kobo`.

  | Painel | Medido | Figma (com 2 px do contorno) |
  |---|---|---|
  | Exportação | 377 | 382 |
  | Aparência | 285 | 287 |
  | Kobo, um leitor | 240 | 243 |
  | Kobo, M2 | 315 | 320 |

- **Gate final:**
  - Vitest: 893 passam, 1 ignorado;
  - `npm run check`: 0/0;
  - build OK;
  - `test:visual`: 124 passam;
  - `cargo test`: 179 passam;
  - `clippy`: os 7 avisos de antes.

  Nenhuma baseline fora das `settings*` mudou.
- **Fica para depois:**
  - o leitor ativo da principal a mudar com as Definições abertas;
  - nomes de leitor duplicados;
  - o piscar da cor de destaque no arranque;
  - o `homeDir()` real, só testado com mock (a confirmar na build dev).
- **Correções do Bruno na build dev (2026-11-21):**
  - o título nativo fica escondido (`hidden_title: true`);
  - os semáforos passam a (20,18), seguindo a regra «Figma + 8» medida na janela principal;
  - verificado na janela real: botão de fechar em AX top 8, sem título.
  - depois, a pedido do Bruno: semáforos iguais aos da principal (16,28), verificados em AX `[15,18]` nas duas janelas; separadores pela ordem Kobo, Aparência, Exportação, Atualizações, com Kobo por omissão.

### Task 46: Ecrã 7 · Atualizações (separador V2, janela U3 e estados 2–7)
**Decisões** (ver DECISIONS):
- **Q-V (2026-11-18):** V2, o separador «Atualizações» com o Switch e a linha «Versão».
- **Q-U (2026-11-18):** U3, com o registo de todas as versões desde a instalada, e o fluxo com os estados 2–7 e os seus textos.
- **Implementação de 2026-11-18:** o `updater` (store, plugin, menu, `release-history.json`) já existe e não muda de comportamento. Esta task muda o desenho e o fio entre janelas.
- **Q1 (Bruno, 2026-11-21):** entre fases, a janela é a mesma e troca o conteúdo sem animação.
- **Q2 (Bruno, 2026-11-21):** a barra indeterminada é um segmento a deslizar, parado com Reduzir movimento.
- **Por omissão:**
  - o número de versões vai por extenso de dois a dez;
  - a procura pelas Definições traz a principal para a frente, mesmo minimizada.

**Figma** (só leitura, medido a 2026-11-21):
- **V2** `78:25710` / Escuro `78:26129`:
  - janela de 540 × 243, conteúdo de 152 (duas linhas de 51, sem cabeçalho de grupo);
  - «Procurar atualizações automaticamente», com a ajuda «Uma vez por dia, ao abrir o Khi.» e o Switch;
  - «Versão 1.3.0», com a ajuda «Procurada hoje às 17:10.» e o Botão secundário «Procurar agora».
- **U3** `78:20401` / `78:20646`, 480 × 400, `p-6 gap-2`:
  - título Title 3, «Khi 1.3.0 está disponível.»;
  - frase em Body;
  - caixa das notas com 232 px de altura fixa, fundo `muted`, com deslocamento;
  - em cada versão: «Khi X.Y.Z» em Body Semibold, a data por extenso em 12 e `muted-foreground`, os grupos «Novidades» e «Correções» em 11 Semibold e as listas nativas com recuo pendente;
  - rodapé: «Saltar esta versão» (Ligação) à esquerda; «Mais tarde» (Secundário) e «Instalar e reiniciar» (Principal) à direita.
- **Estados com 380 px** (o componente Janela, `ui/dialog`):
  - **2 · A procurar** `78:23921` / `78:23961`: título e barra indeterminada; Cancelar.
  - **3 · Khi está atualizado** `78:23969` / `78:24008`: OK.
  - **4 · A descarregar** `78:24014` / `78:24057`: barra determinada de 6 px (`muted` + `primary`, raio 3) e «4,3 MB de 6,9 MB» em 12; Cancelar.
  - **5 · Instalado, à espera** `78:24066` / `78:24105`: Reiniciar agora (Secundário) e OK (Principal).
  - **6 · Sem ligação** `78:24112` / `78:24153`: Cancelar e Tentar outra vez.
  - **7 · Falha ao instalar** `80:26508` / `80:26716`: igual ao 6, com o texto da instalação.

**Ficheiros:**
- `src/lib/components/SettingsPanel.svelte`: o conteúdo do separador sai para `settings/UpdatesPane.svelte`, com o seu teste;
- `src/lib/components/UpdateDialog.svelte`, reescrito sobre `ui/dialog` (ou `ui/alert-dialog`), e o seu teste;
- `ui/dialog`: uma largura de 480 para a U3, sem mudar os 380 por omissão nem o `UnknownKoboDialog`;
- `src/lib/stores/updater.svelte.ts`: só o necessário para o fio entre janelas;
- `src/routes/+page.svelte`, no listener de `check-for-updates`;
- `src/routes/definicoes/+page.svelte`;
- `src-tauri/capabilities/default.json` (+ `core:window:allow-unminimize`) e o teste da capability;
- `pt.json` e `en.json`;
- `tests/visual/scenarios.ts`, o README e as baselines `settings-updates*` e dos estados da atualização.

**Comportamento:**
1. **Separador Atualizações** (`UpdatesPane`):
   - um `FormGroup` sem cabeçalho e duas `FormRow`, como no Kobo;
   - o Switch grava logo, com `settings.commit(['uiPreferences.checkForUpdates'])`, e um erro mostra o `saveError`, como nos outros painéis;
   - «Procurar agora» emite `check-for-updates`;
   - a janela fica com ≈240 de altura.
2. **Fio entre janelas:**
   - **na principal:** o `check-for-updates` faz `unminimize`, `show` e `setFocus` antes de procurar;
   - **depois de cada procura**, a principal emite um evento (por exemplo, `updates-state`) com o estado e a data da última procura;
   - **nas Definições:**
     - «Procurada hoje às…» acompanha esse evento;
     - «Procurar agora» fica desativado enquanto a principal procura ou instala;
   - **dois cliques** em «Procurar agora» não lançam duas procuras.
3. **Janela de atualização:**
   - uma só janela do primeiro ao último estado (Q1):
     - abre e fecha com o Movimento 4;
     - entre fases troca o conteúdo sem animação;
     - na U3 passa a 480 px e volta a 380 nas outras fases;
   - nenhum botão recebe o foco ao abrir (Q-E);
   - Return carrega no botão por omissão de cada fase: Instalar e reiniciar, OK, OK, Tentar outra vez;
   - Esc e ⌘. fazem o mesmo que Cancelar ou Mais tarde, e em «Instalado» o mesmo que OK;
   - em `installing`, Esc não faz nada e Cancelar fica desativado;
   - um clique fora da janela não a fecha.
4. **Barras:**
   - **determinada:** 6 px, `muted` + `primary`, raio 3, `role="progressbar"` com `aria-valuenow`;
   - **indeterminada (Q2):**
     - um segmento de 1/3 a deslizar em ciclo;
     - com `prefers-reduced-motion`, parado ao meio;
     - sem `aria-valuenow`.
5. **Textos:**
   - comparar `pt.json` e `en.json` com o Figma, com ponto final nos títulos que são frases;
   - número de versões por extenso de dois a dez, em pt («duas», «três»…) e en («two», «three»…).

**Passos:**
- [x] **Passo 1:** testes que falham do `UpdatesPane` e do fio entre janelas.
- [x] **Passo 2:** testes que falham da janela de atualização (fases, larguras, teclado, foco, barras, número por extenso).
- [x] **Passo 3:** cenários visuais:
  - `settings-updates`, com a altura medida;
  - a U3 e os estados 2–7 sobre a Biblioteca;
  - tudo em Claro e Escuro, comparado com o Figma.
- [x] **Passo 4:** gate completo (Vitest, check, build, `test:visual`, `cargo test`, `cargo clippy --all-targets`).
- [x] **Passo 5:** review adversarial (Opus), mutações minhas e comparação com o Figma. Commit `feat(updates): redesign the updates pane and the update dialog`.

**Verificar no ecrã (Bruno), com a build dev:**
- com a principal minimizada, «Procurar agora» nas Definições traz a principal para a frente, com a janela de atualização;
- «A procurar…» passa a «Khi está atualizado.» na mesma janela, sem piscar;
- «Procurada hoje às…» nas Definições muda depois da procura;
- o segmento desliza, e para com Reduzir movimento;
- a ponta a ponta, com descarregar, instalar e reiniciar, fica para quando houver uma release real.

**Feito (2026-11-21).** Aprovada pelo Bruno («Aprovo a Task 46»). Implementada pelo Sonnet com TDD; revista pelo Opus (review adversarial independente); mutações minhas.
- **1.ª ronda:**
  - `settings/UpdatesPane.svelte` (V2, 240 px de altura);
  - `UpdateDialog` reescrito sobre `ui/dialog`:
    - uma só janela, com `w-120` na U3;
    - montado de `visible` até `onOpenChangeComplete`, para não deslocar os ids do Bits nas baselines da principal;
    - conteúdo congelado durante o fade;
  - `ui/progress` novo, com `@keyframes indeterminate-slide` e parado ao meio com `motion-reduce`;
  - `src/lib/version-count.ts`;
  - fio entre janelas: `updates-state` e `updates-state-request`, `snapshot`/`adopt`, e `unminimize`, `show` e `setFocus` na principal (+ `core:window:allow-unminimize`);
  - bug antigo corrigido: faltava a chave base `updates.available.body`;
  - no harness, `expectedConsoleErrors`.
- **Review:** 0 blockers, 3 majors e 10 minors.
  - **Majors corrigidos:**
    - **M1:** Return com as notas focadas não instalava. Agora `returnIsFree` aceita focáveis que não usam o Return;
    - **M2 e M3:** o fade congelado e o clique fora não tinham teste que os apanhasse. Ganharam testes que as mutações provam.
  - **Minors corrigidos:**
    - o pedido de estado só sai depois do `listen`;
    - os listeners novos têm a guarda `destroyed`;
    - a procura silenciosa do arranque conta como ocupada (`busy`);
    - o `$effect` de foco saiu, porque o FocusScope do Bits já faz esse trabalho;
    - o ⌘. passou a ser testado com a janela aberta;
    - `expectedConsoleErrors` conta as ocorrências exatas;
    - voltou um controlo do caminho `unreachable`;
    - a região das notas tem nome próprio («Notas da versão»).
  - **Ficam sem correção:**
    - m4: «Procurar agora» desativado em `restartPending`, o que é coerente, porque já há versão instalada;
    - m10: «hoje» depois da meia-noite, como já acontecia antes.
- **Comparação com o Figma (minha):**
  - nos estados 2 e 4 faltava o Espaço de 4 px entre o título e a barra. Ficou `mt-3`, e o conteúdo mede 146, 144 e 169, como no Figma;
  - a U3 com 480 × 400 e as notas com 232 px batem;
  - o V2 bate.
- **Mutações minhas:** 12, todas mortas:
  - largura da U3;
  - `mt-3` nas duas barras;
  - `motion-reduce`;
  - «duas»;
  - `unminimize`;
  - `busy` e `silentCheck` (três);
  - `checking` em `isUpdateBusy`;
  - `returnIsFree` (duas);
  - `disabled` do «Procurar agora».
- **Gate final:**
  - Vitest: 969 passam, 1 ignorado;
  - `npm run check`: 0/0;
  - build OK;
  - `test:visual`: 140 passam (128 + 12 controlos);
  - `cargo test`: 179 passam;
  - `clippy`: os 7 avisos de antes.

  Nenhuma baseline da principal mudou.
- **Dívida vista, sem tocar:** os outros listeners de `setupDeviceListeners` na principal não têm a guarda `destroyed`.

**Ecrã 7 aprovado a 2026-11-21** (Bruno: «Aprovo o ecrã 7»), pela build dev. A atualização de ponta a ponta (descarregar, instalar e reiniciar) só se verifica com uma release real.

### Task 47: Ecrã 8 · Exportação concluída e com erro (Q-Y, Y1)
**Decisões** (ver DECISIONS, «Ecrãs · 8 · Q-Y»):
- **Q-Y (Bruno, 2026-11-21):** Y1 · Botão e aviso. Fecha a D4.
- **Erro fora do cabeçalho (Bruno, 2026-11-21):** na Biblioteca, o erro de exportação vai para o cabeçalho, venha de onde vier (o botão do cabeçalho, a barra ou ⌘E). No Detalhe, vai para o aviso, com a mesma ação.
- **Ficheiro › «Mostrar última exportação no Finder» (Bruno, 2026-11-21):** só da sessão, desativado antes da primeira exportação.
- **Já decididas:** Cor 6 e as suas quatro condições, Movimento 3, «Sem novidades, sem cabeçalho» (2026-11-19), exportar limpa os «novos» (2026-11-19), códigos de erro do export (`ExportFailure`, 2026-11-18).

**Figma** (só leitura, medido a 2026-11-21):
- **Concluída, 0 a 2 s** `137:34169` / `137:35323`:
  - cabeçalho «Novos» com o botão Principal «✓ Exportado» (ícone `check` à esquerda);
  - aviso (componente 14) centrado a 24 do fundo, 297 × 32: `circle-check`, «4 livros exportados» e a ligação «Mostrar no Finder» no tom de ligação.
- **Depois dos 2 s:** sem cabeçalho (prevalece sobre a moldura `73:12743`, que ainda o mostra); a grelha sobe para 24 da Barra e as etiquetas saem; o aviso continua até aos 4 s.
- **Com erro** `137:34750` / `137:35904`:
  - cabeçalho Erro: `circle-alert` em `text-destructive`, «Não foi possível exportar.», detalhe «O Khi não consegue escrever em ~/Documents/Kobo. Escolhe outra pasta.» e o botão Principal «Escolher pasta…» (136 de largura);
  - as etiquetas «N novos» ficam.

**Ficheiros:**
- `src/routes/+page.svelte`: o estado do cabeçalho, o erro de exportação e o aviso com a ação;
- `src/lib/components/ui/library-header/library-header.svelte` e o seu teste: o Erro passa a aceitar título, detalhe e ação (rótulo, variante e `onclick`), sem mudar o erro de sincronização;
- `src/lib/components/BookDetailsView.svelte` (ou quem trata o export do Detalhe) e o seu teste;
- `src/lib/stores/library.svelte.ts`: a última exportação da sessão (os caminhos devolvidos pelo `exportLibraryBooks`);
- `src/lib/menu.ts` e o seu teste: o menu Ficheiro;
- `src/lib/errors.ts` e o seu teste: título, detalhe e ação por tipo de `ExportFailure`;
- `src-tauri/capabilities/default.json` só se o `opener:default` não chegar (a 2.5.3 já inclui `allow-reveal-item-in-dir`);
- `pt.json` e `en.json`;
- `tests/visual/scenarios.ts`, o mock (`plugin:opener|reveal_item_in_dir`, `pick_export_folder`) e as baselines novas.

**Comportamento:**
1. **Concluída (Y1):**
   - com o export bem-sucedido, o cabeçalho continua montado com o estado que tinha antes de exportar e o botão «✓ Exportado» durante 2 s. Só depois sai, com o fade de 150 ms (Movimento 3), e as etiquetas saem no mesmo fade. Hoje desmonta-se no mesmo instante, e o «✓ Exportado» nunca aparece (o teste `header_export_exports_books_with_news` espera isso e muda);
   - uma sincronização, a troca de leitor ou abrir um livro durante os 2 s acabam a espera, como já acontece com o `exported`;
   - o aviso «N livros exportados» leva a ação «Mostrar no Finder», que chama o `revealItemInDir` com os caminhos dessa exportação (os ficheiros ficam selecionados no Finder);
   - o aviso cumpre a Cor 6: pausa com o rato e o foco, `aria-live="polite"`, só fade com Reduzir movimento (o `ui/toast` já o faz; confirmar com teste).
2. **Com erro, na Biblioteca** (o botão do cabeçalho, a barra e ⌘E):
   - o cabeçalho passa a Erro, com «Não foi possível exportar.» e o detalhe por tipo:
     - `folderNotWritable`: «O Khi não consegue escrever em {pasta}. Escolhe outra pasta.», com `~` (`abbreviateHome`), e o botão Principal «Escolher pasta…»;
     - `diskFull` e os outros: o texto que o `errors.ts` já tem, e o botão Secundário «Tentar de novo», que repete a mesma exportação;
   - «Escolher pasta…» abre o `pickExportFolder`, grava a pasta no leitor ativo como faz a `ExportPane` (`null` quando é a pasta por omissão) e repete a mesma exportação. Cancelar o seletor deixa o erro;
   - o erro sai com a exportação seguinte bem-sucedida, a sincronização seguinte, a troca de leitor ou ao abrir um livro;
   - a sincronização tem prioridade: com `isImporting`, o cabeçalho mostra a sincronização; um erro de sincronização ganha a um de exportação;
   - o erro de exportação não toca nos «novos» nem no `lastSyncFailed`.
3. **Com erro, no Detalhe:** o aviso, com `circle-alert`, «Não foi possível exportar para {pasta}.» e a ação «Escolher pasta…» (ou «Tentar de novo»), que faz o mesmo que no cabeçalho.
4. **Menu Ficheiro**, entre Khi e Edição:
   - «Mostrar última exportação no Finder», sem atalho; desativado até à primeira exportação da sessão, e depois chama o `revealItemInDir` com os caminhos da última;
   - a troca de idioma refaz o menu, como os outros.
5. **Textos:** pt e en novos, comparados com o Figma, com ponto final nas frases.

**Passos:**
- [x] **Passo 1:** testes que falham: o cabeçalho fica 2 s com «✓ Exportado» e depois sai; a ação do aviso chama o `revealItemInDir`; o erro de cada tipo no cabeçalho e no Detalhe; «Escolher pasta…» grava e repete; prioridades com a sincronização; menu Ficheiro.
- [x] **Passo 2:** a implementação.
- [x] **Passo 3:** cenários visuais, em Claro e Escuro, comparados com o Figma: `export-done` (0 a 2 s), `export-done-after` (sem cabeçalho, com o aviso) e `export-error`.
- [x] **Passo 4:** gate completo (Vitest, check, build, `test:visual`, `cargo test`, `cargo clippy --all-targets`).
- [x] **Passo 5:** review adversarial (Opus), mutações minhas e comparação com o Figma. Commit `feat(export): screen 8, export feedback, error in the header and Show in Finder`.

**Verificar no ecrã (Bruno), com a build dev:**
- exportar os novos: «✓ Exportado» 2 s, o cabeçalho sai, e o aviso leva ao Finder com os ficheiros selecionados;
- Ficheiro › «Mostrar última exportação no Finder» depois de exportar, e desativado antes;
- uma pasta sem permissão de escrita (por exemplo, criada com `chmod a-w`): o erro no cabeçalho, e «Escolher pasta…» grava a pasta e exporta.

**Feito (2026-11-21).** Aprovada pelo Bruno («Aprovo a Task 47»). Implementada pelo Sonnet com TDD; revista pelo Opus (review adversarial independente); mutações minhas.
- **1.ª ronda:** cabeçalho retido durante a exportação e os 2 s (`heldHeader`, `heldNew`), erro de exportação no cabeçalho com ação (`exportErrorView`), «Escolher pasta…» pela função partilhada `src/lib/export-folder.ts` (a `ExportPane` passa a usá-la), `library.lastExport`, menu Ficheiro, aviso com ícone de erro.
- **Review adversarial: «rejeitar».** Corrigidos:
  - **A1 (blocker):** duplo clique ou clique em «✓ Exportado» dava um erro falso permanente. O botão fica inerte durante os 2 s, e uma exportação sem livros não faz nada;
  - **A2:** resultado de uma exportação a cair noutro leitor ou depois de uma sincronização. Contador de geração, `readerId` na tentativa, `recoverExport` desiste se o leitor mudou (também depois do seletor);
  - **A3:** «Tentar de novo» do aviso exportava durante uma sincronização. `handleExport` recusa com `isImporting`, e o aviso de erro fecha-se ao começar uma sincronização ou ao trocar de leitor (`dismiss(id)` novo no `ui/toast`);
  - minors A4 (foco para a ação do erro), A5 (anúncio pelo `sync-announcer` quando o cabeçalho não estava montado), A7 («Choose folder…»; no Detalhe, «Não foi possível exportar.»), A8 (órfãos apagados: `exportErrorMessage`, `errors.export.folderNotWritable`, `library.exportSelected`), A9 (largura máxima do aviso, texto truncado e ação inteira), A10 (menu refeito com o estado certo), A11 (aviso quando o Finder falha).
- **Decisões minhas, por omissão:**
  - com uma sincronização falhada, a falha de exportação vai para o aviso (A6);
  - detalhe «O disco está cheio.» no `diskFull` e nenhum nas falhas desconhecidas;
  - abrir um livro acaba o «✓ Exportado», mas não silencia uma exportação a correr: a falha aparece como aviso (desvio do Sonnet, aceite).
- **Fica como está:** o «✓» de «Exportado» é texto, não o ícone `check` do Figma (vem do ecrã 1 aprovado).
- **Mutações minhas:** 16; morrem 12 e a C9 depois de um teste novo (troca de leitor com o seletor aberto). Sobrevivem só as guardas em camadas contra o segundo clique (a da página, a do cabeçalho e a do «sem livros»): retiradas juntas, morrem.
- **Comparação com o Figma:** cabeçalho em y 76 com 28 de altura, aviso a 24 do fundo com 32; «Escolher pasta…» mede 134 em vez de 136 (desenho do texto).
- **Gate final:**
  - Vitest: 1026 passam, 1 ignorado;
  - `npm run check`: 0/0;
  - build OK;
  - `test:visual`: 149 passam (137 + 12 controlos), 9 baselines novas (`export-done`, `export-done-after`, `export-error`), nenhuma antiga mudou;
  - `cargo test`: 179 passam;
  - `clippy`: os 7 avisos de antes.

**Ecrã 8 aprovado a 2026-11-21** (Bruno: «Aprovo o ecrã 8»), pela build dev.

### Task 48: Ecrã 9 · Apagar livro (Detalhe 5, Q-A)
**Decisões** (ver DECISIONS, «Ecrãs · 9 · Apagar livro» e «Task 48 · decisões»):
- **Já decididas:** Detalhe 5 (A1): o caixote na barra só quando todos os destaques foram removidos do Kobo. Q-A: «Apagar» Secundário em `destructive-text`, sem botão por omissão, Esc e ⌘. cancelam. Q-E (B): à entrada, nenhum botão recebe o foco, que fica na janela, e o anel não aparece. (Corrigido a 2026-11-21: a primeira versão desta Task dizia «foco no Cancelar», que vinha da proposta 2 do componente 15 e que a Q-E substituiu.) Q-F: texto 13/16. Q-G: fundo a 15 %. Movimento 4 e Movimento 5.
- **Menu Livro (Bruno, 2026-11-21):** fica para a Fase 6. Agora o ⌘⌫ funciona pelo `keydown` da página, como o ⌘R e o ⌘E.
- **Por omissão (minhas, registadas):** ver «Comportamento», pontos 3 a 6.

**Figma** (só leitura, medido a 2026-11-21):
- **Barra** `74:16535` / `74:16671`: `Ecrã=Detalhe com Apagar`, com o caixote (`trash-2`, 32 × 32) antes de Exportar, no mesmo grupo. Tooltip Com atalho «Apagar livro… ⌘⌫» (134 × 24, a 46 do topo).
- **Confirmação** `74:16868` / `74:16918`: Janela modal Apagar livro (`58:6782`), 380 × 160, centrada (x 310, y 270), sobre o preto a 15 %. Textos: «Apagar este livro?», «Todos os destaques foram removidos do Kobo. O livro e os destaques saem da Biblioteca de vez.», Cancelar e Apagar.

**Ficheiros:**
- `src/routes/+page.svelte` e `page.svelte.test.ts`: o `canDelete`, o ⌘⌫, a janela e o apagar;
- `src/lib/components/DeleteBookDialog.svelte` (novo) e o seu teste, sobre o `ui/alert-dialog` (Task 23), com o padrão `busy` do `UnknownKoboDialog`;
- `src/lib/stores/library.svelte.ts` só se for preciso;
- `pt.json` e `en.json`: reutilizar `screens.bookDetails.deleteBookTitle`, `deleteBookBody`, `deleteBookConfirm`, `cancel` e `deleteBookError` (com ponto final). A chave `screens.bookDetails.deleteBook` já está órfã: mencionar e não apagar;
- `tests/visual/scenarios.ts`, o mock (`delete_book`) e as baselines novas.

**Comportamento:**
1. **Caixote:** `canDelete` é verdadeiro quando o livro aberto tem pelo menos 1 destaque e todos têm `removedAt`. Um livro sem destaques não mostra o caixote (o Rust só exige 0 vivos; a regra da interface é a do Figma).
2. **Abrir a janela:** pelo caixote ou por ⌘⌫ no Detalhe, só com `canDelete`. O ⌘⌫ não dispara num campo de texto, com outra janela modal aberta, com o atualizador ativo nem com a tecla a repetir.
3. **Inerte durante uma sincronização ou exportação:** o caixote fica desativado, com o tooltip que o Exportar já usa («Espera pelo fim da sincronização»), e o ⌘⌫ não faz nada.
4. **A janela:**
   - o foco inicial segue a Q-E (fica na janela, não num botão); Return não confirma; Esc e ⌘. cancelam;
   - enquanto apaga (`busy`), Cancelar, Esc, ⌘. e um segundo clique em Apagar não fazem nada;
   - com a janela aberta, ⌘E, ⌘R, ⌘1, ⌘2, ⌘[ e ⌘⌫ não chegam à página, e o Esc que cancela a janela não fecha também o Detalhe;
   - se começar uma sincronização (por exemplo, «Sincronizar ao ligar»), a janela fecha-se sem apagar.
5. **Confirmar:** volta a verificar no clique que não há `isImporting` nem `isExporting`, que o mesmo livro continua aberto e que continua tudo removido. Depois do `await`, desiste se o leitor ou o livro aberto mudaram (como o `stale()` do `recoverExport`).
6. **Depois de apagar:** fecha a janela e volta à Biblioteca. O livro sai da lista e da seleção, e o título da janela volta ao de antes. Não há aviso de sucesso: o livro desaparece da Biblioteca (`feedback.md`).
7. **Falha:** recarrega a Biblioteca do leitor (`openReader` com `keepSelection`). Se o livro já não existe, trata como apagado e volta à Biblioteca sem erro. Se continua lá, fica no Detalhe, a janela fecha-se e aparece o aviso com `icon: 'error'` e «Não foi possível apagar o livro.». Se o livro voltou a ter destaques no Kobo, o caixote desaparece sozinho.

**Passos:**
- [x] **Passo 1:** testes que falham: o caixote aparece e desaparece com a regra 1; ⌘⌫ abre a janela e não dispara num campo; foco na janela (Q-E); Return não apaga; Esc cancela sem fechar o Detalhe; o duplo clique apaga uma só vez; inerte durante uma sincronização ou exportação; a sincronização a meio fecha a janela; volta à Biblioteca e o livro sai; as três falhas; os atalhos da página bloqueados com a janela aberta.
- [x] **Passo 2:** a implementação.
- [x] **Passo 3:** cenários visuais em Claro e Escuro, comparados com o Figma: `detail-delete` (caixote com tooltip) e `detail-delete-confirm` (janela).
- [x] **Passo 4:** gate completo (Vitest, check, build, `test:visual`, `cargo test`, `cargo clippy --all-targets`).
- [x] **Passo 5:** review adversarial (Opus), mutações minhas e comparação com o Figma. Commit `feat(detail): screen 9, delete a book whose highlights left the Kobo`.

**Verificar no ecrã (Bruno), com a build dev:** um livro com todos os destaques removidos do Kobo (apagá-los no Kobo e sincronizar) mostra o caixote; ⌘⌫ abre a janela; Apagar volta à Biblioteca sem o livro.

**Feito (2026-11-21).** Aprovada pelo Bruno («Aprovo a Task 48»). Implementada pelo Sonnet com TDD, revista pelo Opus (review adversarial independente) e testada com mutações minhas.
- **1.ª ronda:** `DeleteBookDialog` (novo, sobre o `ui/alert-dialog`, com o padrão `busy`); na página, `canDelete`, ⌘⌫, `confirmDelete` com nova verificação no clique e `stale()` depois do `await`; `deleteDisabled`/`deleteDisabledReason` no caixote; no store, o `deleteBook` só tira o livro se o leitor for o mesmo. Antes da implementação falharam 20 testes da página e os 9 da janela.
- **Review adversarial: «aprovar com correções».** Corrigidos:
  - o foco inicial passa à Q-E (fica na janela). O erro estava na primeira versão desta Task;
  - **M1:** o teste da nova verificação no clique não a exercitava; reescrito com `isExporting`;
  - **M2:** uma janela do Kobo novo ou de uma atualização deixava de se empilhar sobre a de apagar, que agora se fecha sem apagar;
  - minors: comentário sobre o `AlertDialog.Action` (na 2.21.0 não fecha), `confirm().catch`, sem aviso quando o recarregar depois de uma falha é ultrapassado (`openReader` devolve se aplicou), foco no livro vizinho depois de apagar, `boundingBox` do tooltip no cenário.
- **Mutações minhas:** 12. Morrem 11; a guarda `deleteInFlight` da página só morre junto com o `busy` da janela (guarda em camadas, aceite). A ordem do vizinho e a tecla mantida sobreviviam e ganharam um teste cada.
- **Comparação com o Figma:** caixote 32 × 32 antes de Exportar; janela 380 × 160 em x 310, y 270, fundo a 15 %, «Apagar» em `destructive-text`, sem anel de foco. Duas diferenças anteriores a esta Task:
  - a capa pequena ainda não segue a Q-N (13/16 e espaço não separável), por isso «O / Retorno» parte em duas linhas;
  - o tooltip encosta à borda direita (o `collisionPadding`, ainda em aberto).
- **Gate final:**
  - Vitest: 1070 passam, 1 ignorado;
  - `npm run check`: 0/0;
  - build OK;
  - `test:visual`: 155 passam (143 + 12 controlos), 6 baselines novas (`detail-delete`, `detail-delete-confirm`), nenhuma antiga mudou;
  - `cargo test`: 179;
  - `clippy`: os 7 avisos de antes.

**Ecrã 9 aprovado a 2026-11-21** (Bruno: «Aprovo o ecrã 9»), pela build dev.

### Task 49: Capa · título na capa pequena e espaço não separável (Q-N)
**Origem:** a comparação do ecrã 9 com o Figma (2026-11-21) mostrou «O / Retorno» no Detalhe. A Q-N, fechada a 2026-11-18, nunca passou para o plano. Os ecrãs 3, 5 e 9 foram aprovados com a capa pequena a 15/20.

**Decisões** (ver DECISIONS, «Ecrãs · Q-N · Título na capa pequena» e «Espaço não separável nas capas»):
- **Q-N (Bruno, 2026-11-18): N1.** A capa pequena (96 × 144, no Detalhe) usa «Capa/Título pequeno», Literata Medium a 13/16. A capa grande continua com «Capa/Título», a 15/20.
- **Espaço não separável:** nos títulos de **todas** as Capas, grandes e pequenas, depois de uma palavra de 1 ou 2 letras, mas só se o par couber na linha. Se não couber, fica o espaço normal. As legendas do Cartão do livro e as Linhas da lista ficam com espaços normais.
- **Palavras longas:** uma palavra que não caiba sozinha parte com `hyphens: auto` e `lang="pt"`. No Figma o hífen de «Desassos-sego» é manual; no código é o do WebKit, a verificar no ecrã.

**Figma** (só leitura, medido a 2026-11-21):
- Capa (`63:3281`): margens de 12, intervalo de 4, título em 4 linhas no máximo com reticências, autor numa linha com reticências.
- Capa do Detalhe no ecrã 9 (`74:16868`): 96 × 144, título 13/16 («O Retorno» numa linha), autor 12/16.
- A capa grande do Cartão tem 171 × 256, com 147 de largura de texto. A pequena tem 72.

**Ficheiros:**
- `src/lib/components/ui/cover/cover.svelte` e o seu teste: uma prop `size?: 'md' | 'sm'` (`md` por omissão). O `sm` usa `text-cover-title-sm`, que já existe em `src/lib/styles/typography.css` e nunca foi usado. O título leva `lang="pt"` e `hyphens-auto`;
- um utilitário novo, por exemplo `src/lib/components/ui/cover/cover-title.ts`, com o seu teste: liga as palavras de 1 ou 2 letras à seguinte com U+00A0 quando o par cabe na largura do texto. Mede com o `canvas.measureText` e a fonte calculada do título. Sem medida possível (jsdom, fonte por carregar), mantém o espaço normal;
- `src/lib/components/BookDetailsView.svelte`: `size="sm"` na Capa;
- baselines visuais das capas sem imagem: grelha, Detalhe e ecrã 9, as que mudarem por causa do espaço não separável ou do 13/16.

**Comportamento:**
1. **Detalhe:** o título da capa sem imagem a 13/16. «O Retorno» e «A Sibila» ficam numa linha.
2. **Todas as capas sem imagem:** depois de «O», «A», «de», «da», «e»… vem um espaço não separável se o par couber na largura do texto (147 na grande, 72 na pequena); senão, o espaço fica normal. A palavra curta não fica sozinha no fim da linha.
3. **Palavras longas:** «Desassossego» e «Guarda-Chuvas» partem com hífen na capa pequena em vez de saírem da caixa. Se o WebKit do Tauri não hifenizar, a palavra parte sem hífen (`overflow-wrap: anywhere`) e nunca sai da capa.
4. **Sem mudanças:** o `aria-hidden` dos textos da capa, o título nas legendas e o texto nas linhas da lista.
5. **A medida volta a fazer-se** quando a fonte (Literata) acaba de carregar (`document.fonts.ready`) e quando a largura da capa muda.

**Passos:**
- [x] **Passo 1:** testes que falham: `size="sm"` dá `text-cover-title-sm`; o utilitário liga «O Retorno» com uma largura folgada e não liga quando o par não cabe; deixa espaços normais sem medida; palavras de 3 letras ficam como estão; títulos com vários pares («O Ano da Morte de Ricardo Reis»); o Detalhe passa `size="sm"`.
- [x] **Passo 2:** a implementação.
- [x] **Passo 3:** cenários visuais: os do Detalhe e da grelha que já existem, com as baselines regeneradas, e um cenário novo `cover-titles` com os quatro títulos de teste da Q-N («O Retorno», «Desassossego», «Guarda-Chuvas», «O Ano da Morte de Ricardo Reis») em capa grande e pequena, Claro e Escuro. Compara com a secção `78:19221` do Figma.
- [x] **Passo 4:** gate completo (Vitest, check, build, `test:visual`, `cargo test`, `cargo clippy --all-targets`). As baselines que mudarem são só as que têm capas sem imagem; justifica cada uma.
- [x] **Passo 5:** review adversarial (Opus), mutações minhas e comparação com o Figma. Commit `feat(cover): small cover title and non-breaking short words (Q-N)`.

**Verificar no ecrã (Bruno), com a build dev:** um livro sem capa com o título começado por «O» ou «A» no Detalhe (numa linha, se couber) e, se houver, um título com uma palavra longa (hífen ou corte limpo).

**Feito (2026-11-21).** Aprovada pelo Bruno («Aprovo a Task 49»). Implementada pelo Sonnet com TDD, revista pelo Opus (review adversarial independente) e testada com mutações minhas.
- **Código:** a Capa tem `size` (`md` e `sm`); o Detalhe usa `sm` (13/16). `cover-title.ts` liga as palavras curtas com U+00A0 quando o par cabe (`bindShortWords`) e decide o `hyphenate` (`coverTitle`). A medida é feita num canvas com a fonte calculada e repete-se com `ResizeObserver`, `fonts.ready`, `loadingdone` e a mudança de `size`.
- **Review adversarial: «rejeitar».** Corrigidos:
  - **B1:** o `hyphens-auto` em todo o título partia palavras que cabiam («Ensaio sobre a Ce-/gueira» na grelha). Agora só hifeniza quando uma palavra, sozinha, não cabe; caso contrário fica `hyphens: manual`, e o `wrap-anywhere` como rede;
  - **M1:** o recorder visual não gravava `hyphens`. Acrescentado num passo à parte, sem mudar nenhum PNG;
  - minors: o cenário passou a usar o Detalhe real em vez de trocar classes no DOM (a troca era desfeita pelo Svelte e gravava capas pequenas a 15 px, visto por mim no PNG); nova medida ao mudar `size`; espaços duplos e nas pontas; `loadingdone`; testes mais exigentes (`ctx.font`, desmontar, `rerender`).
- **Mutações minhas:** 14. Morrem 12; as outras 2 (palavra com dígito, `observe` da capa) ganharam um teste cada e passaram a morrer.
- **Baselines:** mudam as 94 com capas sem imagem (só os títulos com palavras curtas ligadas e, no Detalhe, o 13/16), mais a propriedade `hyphens` em todos os JSON. Novos: `cover-titles` (grelha com as capas grandes) e `cover-titles-small-*` (5 Detalhes), em 3 temas.
- **Capa pequena (PNG):** «O Retorno» numa linha; «Desassos-/sego» e «O Desas-/sossego» com hífen; «Guarda-/Chuvas» no hífen do título; «O Ano / da Morte / de Ricardo / Reis». O hífen é o do WebKit do Playwright; falta ver no Tauri.
- **Gate final:**
  - Vitest: 1100 passam, 1 ignorado;
  - `npm run check`: 0/0;
  - build OK;
  - `test:visual`: 173 passam (161 + 12 controlos);
  - `cargo test`: 179;
  - `clippy`: os 7 avisos de antes.

**Capas aprovadas a 2026-11-21** (Bruno: «Capas aprovadas»), pela build dev.

### Task 50: Ecrã 10 · Vários leitores (verificação e cenários)
**Decisões** (ver DECISIONS, «Ecrãs · 10 · Vários leitores» e «Q-M»):
- **Atalho para trocar de leitor (Bruno, 2026-11-21):** não há. A troca faz-se pelo Título-menu, que já abre pelo teclado. Na Fase 6, a barra de menus pode ter uma lista «Leitor», também sem atalho.
- **Já decididas:** o Título-menu serve de seletor (R4, componente 22). A Q-M é a M2, com o pop-up «Leitor» no painel Kobo. «Biblioteca de Bruno» fica com 19 caracteres. O Título-menu fica desativado durante a sincronização (Task 38). Com o Kobo de outro leitor ligado, o tooltip diz «O Kobo ligado é de {leitor}» (Task 39).

**O que já existe** (levantamento a 2026-11-21):
- `ui/title-menu`: com um leitor mostra «Biblioteca» em texto; com vários, um menu com a marca no leitor ativo, 4 px abaixo e alinhado ao início. O botão mostra «Biblioteca de {leitor}»;
- `settings/KoboPane.svelte`: a M2, com dois ou mais leitores;
- `UnknownKoboDialog`: o Kobo novo com leitores (ecrã 6, cenário `unknown-kobo`).
- Ainda não há nenhum cenário visual do menu aberto nem da Biblioteca de outro leitor com livros.

**Figma** (só leitura): menu aberto `74:17138` / `74:17195`; Biblioteca de Ana `74:17252` / `74:17479`, com 6 livros, «8 destaques novos em 2 livros», «desde 2 nov.» e «Exportar 2 livros»; Kobo novo com leitores `74:17706` / `74:17770`; cartão `74:18446`.

**Ficheiros:**
- `tests/visual/scenarios.ts`, `fixtures.ts` e `README.md`: os cenários novos;
- `src/routes/page.svelte.test.ts`: o teste do teclado;
- **qualquer código só se a comparação com o Figma mostrar uma diferença.** Nesse caso, reporta a diferença antes de a corrigir, e o orquestrador decide.

**Comportamento a provar:**
1. **Menu aberto** (`library-reader-menu`): com Bruno e Ana, o Título-menu «Biblioteca de Bruno ▾» abre a lista com Bruno marcado e Ana por baixo. A lista tem 200 de largura, fica 4 px abaixo do botão e alinha com o início dele.
2. **Biblioteca de Ana** (`library-other-reader`): depois de escolher Ana no menu, o título passa a «Biblioteca de Ana» e aparecem os livros, o cabeçalho de novidades e o Exportar de Ana, não os de Bruno.
3. **Teclado** (teste de página): Tab até ao Título-menu, Espaço ou ↓ abre o menu, ↓ vai até Ana, Return escolhe-a, e a Biblioteca passa a ser a de Ana. O foco volta ao Título-menu.

**Passos:**
- [x] **Passo 1:** o teste do teclado (ponto 3). Se passar à primeira, fica como teste de regressão; diz-o no relatório.
- [x] **Passo 2:** os cenários `library-reader-menu` e `library-other-reader`, em 3 temas, comparados com o Figma: posição e largura do menu, marca, título, cabeçalho e contagens.
- [x] **Passo 3:** gate completo.
- [x] **Passo 4:** review adversarial (Opus), só se mudar código; senão, revisão minha. Depois, comparação com o Figma e commit `test(readers): screen 10, reader menu and another reader's Library`.

**Verificar no ecrã (Bruno), com a build dev:** se tiveres dois leitores, abre o Título-menu, troca de leitor, e confirma que a Biblioteca, as novidades e o Exportar mudam de acordo.

**Feito (2026-11-21).** Aprovada pelo Bruno («Aprovo a Task 50»). Feita pelo Sonnet e revista por mim. Não houve review adversarial, porque a única mudança de código é uma classe.
- **Teste do teclado** `reader_menu_by_keyboard_opens_anas_library`: não passou à primeira por causa das asserções. A versão final espera que o foco entre no menu antes do ↓. A app não mudou, e o teste fica como regressão.
- **Cenários novos:** `library-reader-menu` e `library-other-reader`, em 3 temas. A fixture `booksAna` e a opção `newSinceByReader` do mock dão o «desde 2 nov.» da Ana. O cabeçalho dela bate com o Figma («8 destaques novos em 2 livros», «Exportar 2 livros»).
- **Diferença corrigida (decisão minha):** o menu media 200 × 58 em vez de 200 × 56, porque o `border` de 1 px somava ao `p-1`. O Figma e o comentário do `menuContent` dizem «1 px border inside». Passou a `inset-ring-(length:--stroke-border) inset-ring-border`. Os itens ficaram a +4 com 192 de largura, e a sombra continua. Vale para todos os menus e listas de Pop-up. Só mudaram as baselines do `library-reader-menu`, porque não há outro cenário com um menu aberto. A mutação que repõe o `border` faz falhar os testes do Menu e do Select.
- **Gate:**
  - Vitest: 1101 passam, 1 ignorado;
  - `npm run check`: 0/0;
  - build OK;
  - `test:visual`: 179 passam;
  - `cargo test`: 179;
  - `clippy`: os 7 avisos de antes.

**Ecrã 10 aprovado a 2026-11-21** (Bruno: «Aprovo o ecrã 10»), pela build dev. Ficam aprovados os 10 ecrãs da Fase 5.

## Fase 6 · Fecho da v2
- **Menus:** desenhados na ronda Q-Z (Z1 escolhida). Ver a Task 53.
  
- **Inglês:** os textos dos ecrãs do redesign.
  
- **Release:**
  
  - número da versão;
    
  - notas da v2 em `release-history.json`, em pt e en;
    
  - teste do updater de ponta a ponta;
    
  - verificação com o macOS em português;
    
  - os semáforos no macOS 13–15: o `trafficLightPosition` com `y` 28 foi acertado no Darwin 27, onde os semáforos têm 14 pt. Nas versões anteriores têm 12 pt, e o `origin.y` dos botões pode ser outro (review da Task 36b, M4);
    
  - teste do Tab do Bruno.
    
### Task 51: Fase 6 · Base técnica (strip, pasta de dados, BUSY e limpeza)
**Decisões** (ver DECISIONS, «Fase 6 · Pendentes antes do fecho», 2026-11-21, todas do Bruno):
- **Strip:** `[profile.release.build-override] strip = false` no `Cargo.toml`.
- **Pasta de dados:** segue o identificador da app, e não o `debug_assertions`.
- **BUSY:** a exportação espera pela sincronização em curso antes de marcar os livros.
- **Código morto:** apaga-se, confirmando antes que nada o usa.
- **Fora desta task:** o `collisionPadding` dos tooltips fica como está, e o push espera pelo fim da Fase 6.

**O que já existe** (levantamento a 2026-11-21):
- `src-tauri/Cargo.toml` ainda não tem nenhum `[profile.*]`. A release só compila com `CARGO_PROFILE_RELEASE_STRIP=false` (§4 do handover 1800: o strip do ld-27106 estraga os dylibs de proc-macro).
- `settings/mod.rs` ≈ 352: `data_dir_in(home)` escolhe «KoboHighlightsExporter Dev» com `cfg!(debug_assertions)`. Chamam-no `data_dir()` em `lib.rs:99` (setup), `settings/mod.rs:417` (`get_config_dir`) e `commands/library.rs:337`. O teste `debug_builds_use_their_own_data_folder` fica ≈ 706.
- O identificador é `com.bruno.khi` em `tauri.conf.json` e `com.bruno.khi.dev` em `tauri.dev.conf.json`. O `npm run dev:app` e a build dev do handover já passam o `tauri.dev.conf.json`.
- `library.svelte.ts` ≈ 434: o `exportIds` chama o `markBookOpened` sem esperar pelo `this.running`. O `openBook` (≈ 165) já espera (M1, handover 1055), porque o `mark_book_opened` tem `busy_timeout(ZERO)` contra a transação IMMEDIATE do `sync`.
- **Código morto:** `src/lib/components/LibraryView.svelte.backup`; `src/lib/utils/date.ts`, que ninguém importa (substituído por `short-date.ts`); a chave `screens.bookDetails.deleteBook` em `pt.json` e `en.json`, enquanto as `deleteBook*` irmãs estão em uso; e `/Users/bruno/Documents/khi-project/kobo-highlights-exporter/node_modules` em `vite.config.ts` → `server.fs.allow`.

**Comportamento a provar:**
1. **Pasta de dados:** um identificador acabado em `.dev` dá «KoboHighlightsExporter Dev», e qualquer outro dá «KoboHighlightsExporter», seja qual for o tipo de build. A função pura recebe o identificador. O identificador real vem da config do Tauri (`app.config().identifier`) no setup, antes de qualquer `data_dir()`. Se o `data_dir()` for chamado sem identificador conhecido, **dá erro e nunca cai na pasta real**.
2. **BUSY:** com uma sincronização em curso, o `exportIds` exporta logo, mas só chama o `markBookOpened` depois de a sincronização acabar, e limpa o «novo» como hoje. O snapshot continua a ser tirado antes da exportação, por isso um destaque que chegue com a sincronização continua novo. O teste falha sem a correção.
3. **Strip:** a release compila sem a variável de ambiente.
4. **Limpeza:** os 4 restos desaparecem; o Vitest, o `check`, a build e o visual continuam verdes.

**Passos:**
- [x] **Passo 1 (TDD):** os testes Rust da pasta de dados (o ponto 1, com `.dev`, sem `.dev` e sem identificador), substituindo o `debug_builds_use_their_own_data_folder`. Vermelho, implementação, verde.
- [x] **Passo 2 (TDD):** o teste Vitest do ponto 2 em `library.svelte.test.ts`, com o `markBookOpened` a rejeitar enquanto a sincronização falsa estiver aberta. Vermelho, implementação, verde.
- [x] **Passo 3:** o `build-override` no `Cargo.toml`. Prova com `npx tauri build --config src-tauri/tauri.dev.conf.json --config '{"bundle":{"createUpdaterArtifacts":false}}' --bundles app`, **sem** o `CARGO_PROFILE_RELEASE_STRIP`. Não se lança a `.app`; isso faço eu.
- [x] **Passo 4:** a limpeza. Antes de apagar, um `grep` em `src`, `tests` e `src-tauri` por cada resto.
- [x] **Passo 5:** gate completo.
- [x] **Passo 6:** review adversarial (Opus), porque muda a escolha da pasta de dados, que guarda a library real. Depois vêm as correções, as minhas mutações, a minha verificação da release «Khi Dev» (com `ls` à pasta Dev, sem tocar na real), e os commits `fix(release): keep proc-macros unstripped`, `fix(settings): data folder follows the app identifier`, `fix(export): wait for the running sync before marking books` e `chore: remove dead code`.

**Verificar no ecrã (Bruno), com a build dev:** nada de visível muda. Exporta durante a sincronização ao ligar o Kobo: os livros exportados deixam de aparecer como novos.

**Feito (2026-11-21).** Aprovada pelo Bruno («Aprovo a Task 51»). O Sonnet implementou com TDD, e eu revi.
- **Review adversarial (Opus): «aprovar com correções».** As 2 correções foram feitas:
  - **Major:** o `npm run tauri dev` documentado, sem a config dev, passava a abrir a pasta real. Agora, uma build de debug sem identificador `.dev` dá o erro `DebugBuildNeedsDevIdentifier`. O README e o BUILD passaram a dizer `npm run dev:app`.
  - **Minor:** a espera pela sincronização atrasava o «✓ Exportado». Agora o `exportIds` devolve os ficheiros e põe o `isExporting` a falso logo a seguir à exportação. As marcas correm depois (`marksSettled()` para os testes).
- **Pasta:** a função pura é `data_dir_for(home, identifier, debug)`. O identificador vem de `app.config().identifier` (um `OnceLock`, posto no setup antes do primeiro `data_dir()`). Sem identificador, dá `IdentifierUnknown`.
- **Mutações (7):** morreram 6. Sobreviveu a que retira o `set_app_identifier` do setup, porque não há teste que corra o setup. Nesse caso a app dá erro ao arrancar e nunca toca na pasta real (o `IdentifierUnknown` está testado).
- **Prova no runtime:** a release «Khi Dev» compilou sem o `CARGO_PROFILE_RELEASE_STRIP`. Lançada, abriu só a pasta Dev (`lsof`), e as datas de modificação da pasta real não mudaram.
- **Gate:**
  - Vitest: 1102 passam, 1 ignorado;
  - `npm run check`: 0/0;
  - build OK;
  - `test:visual`: 179 passam;
  - `cargo test`: 182;
  - `clippy`: os 7 avisos de antes.

### Task 52: Barra de deslocamento mais clara no tema claro
**Pedido (Bruno, 2026-11-21):** «A scrollbar do tema Light devia ser mais clara.» Captura da Biblioteca com a barra sempre visível (rato ou «Mostrar barras de deslocamento: sempre»): o polegar é cinzento-escuro, mais escuro do que as barras nativas do AppKit.

**O que já existe** (levantamento a 2026-11-21):
- O código não tem estilo nenhum para a barra (nem `scrollbar-*`, nem `::-webkit-scrollbar`). A que se vê é a do WKWebView.
- **Há 4 áreas com deslocamento:** `LibraryView.svelte:68`, `dropdown-menu-content`, `select-content` e as notas do `UpdateDialog`. Os tokens estão em `src/lib/styles/tokens.css` (`:root`, `.dark`, `prefers-contrast: more`).
- **O que a pesquisa encontrou:**
  - o `scrollbar-color` só existe a partir do Safari 26.2 ([WebKit](https://webkit.org/blog/17640/webkit-features-for-safari-26-2/)). O macOS do Bruno (27.2) já o tem; os macOS 13–15 não;
  - o `::-webkit-scrollbar` funciona no WKWebView em todas as versões. Foi a solução da app Tauri Handy para este mesmo caso ([PR #2048](https://github.com/cjpais/Handy/pull/2048));
  - o `color-scheme` não muda a cor;
  - o Tauri não tem nenhuma opção para isto no macOS ([tauri#6067](https://github.com/tauri-apps/tauri/issues/6067)).
  - **Por verificar:** as regras `::-webkit-scrollbar` podem tirar ao macOS as barras sobrepostas, que se escondem sozinhas.
- **Figma:** não há nenhuma barra desenhada. A referência é a barra nativa do AppKit em cada tema.

**Decisões:**
- **Tokens novos:** `--scrollbar-thumb` e `--scrollbar-thumb-hover` em `:root`, `.dark` e `prefers-contrast: more` (decisão minha). O tema claro fica perto do polegar nativo do AppKit. O escuro e o de contraste alto não podem perder contraste em relação a hoje.
- **Primeiro caminho:** o `scrollbar-color: var(--scrollbar-thumb) transparent` na raiz.
- **Caminho de recurso:** as regras `::-webkit-scrollbar`, só dentro de `@supports not (scrollbar-color: red transparent)`, para que o macOS 26.2 ou mais recente nunca as receba.
- **Se o recurso tirar o esconder automático no macOS 13–15:** decide o Bruno, depois de ver o resultado.

**Comportamento a provar:**
1. **Raiz:** no tema claro, o `scrollbar-color` resolve para o token claro; no escuro e em `--hc`, para os tokens deles. Prova-se com o teste de CSS (`app-css.test.ts` ou `tokens.test.ts`).
2. **Recurso:** as regras `::-webkit-scrollbar` existem e estão dentro do `@supports not (scrollbar-color …)`.
3. **Visual:** a suite inteira passa. Os PNG que mudarem são revistos um a um; o Playwright em headless pode nem desenhar a barra.

**Passos:**
- [x] **Passo 1 (TDD):** os testes dos pontos 1 e 2. Vermelho, implementação, verde.
- [x] **Passo 2:** tokens e CSS em `tokens.css` e no `app.css` ou `components.css`, onde estiverem as regras globais.
- [x] **Passo 3:** gate completo.
- [x] **Passo 4 (eu):** build dev; comparar com uma janela do Finder, com «Mostrar barras: sempre» e com «automaticamente», nos 3 temas. Review adversarial só se o CSS for além dos tokens e destas regras. Depois, o commit `fix(theme): lighter scroll bar in light theme`.

**Verificar no ecrã (Bruno), com a build dev:** com o rato ou «Mostrar barras: sempre», a barra da Biblioteca no tema claro tem a mesma claridade que a do Finder, e continua visível no escuro. Com o trackpad e «automaticamente», a barra continua a esconder-se.

**Feito (2026-11-21).** Aprovada pelo Bruno («Aprovo a Task 52»). O Sonnet implementou com TDD, e eu revi. Não houve review adversarial, porque só mudaram tokens e CSS.
- **Onde ficou:** os tokens estão no `app.css`, não no `tokens.css`, porque o `tokens.test.ts` prende o `tokens.css` ao `design/tokens.json`; é o mesmo precedente do `--selection-outline`, da Task 41. O `scrollbar-color` está na `:root`, e o recurso `::-webkit-scrollbar` está dentro do `@supports not`. O build mantém os dois.
- **Cores do polegar (normal / hover):**
  - claro: `#D1D1D1` / `#B8B8B8` (o Bruno pediu um pouco mais claro que `#C1C1C1`; 1,5:1);
  - escuro: `#4A4A4A` / `#5C5C5C` (o Bruno achou `#6B6B6B` claro demais; agora tem o mesmo peso do claro, 1,9:1);
  - contraste alto claro: `#8D8D91` / `#6E6E73`;
  - contraste alto escuro: `#A1A1A6` / `#C7C7CC`.
- **Visto no ecrã (macOS 27.2, com rato):** a barra da Biblioteca no tema claro passou de cinzento-escuro a cinzento-claro, perto da nativa.
  - **Ficam por ver:** o esconder automático com o trackpad e o recurso nos macOS 13–15. Não há onde os testar aqui.
- **Gate:**
  - Vitest: 1105 passam, 1 ignorado;
  - `npm run check`: 0/0;
  - build OK;
  - `test:visual`: 179, sem baselines novas, porque o headless não desenha a barra;
  - Rust não mudou.

### Task 53: Barra de menus (Q-Z, Z1)
**Decisões** (Bruno escolheu a Z1, 2026-11-21; DECISIONS «16 · Q-Z · Barra de menus»; Figma `142:36584`):
- **Menus, por esta ordem:** Khi · Ficheiro · Edição · Visualização · Livro · Janela.
- **Khi:** fica como está.
- **Ficheiro:**
  - Sincronizar com o Kobo ⌘R;
  - Exportar ⌘E. O texto segue o botão da barra: «Exportar 12 livros» ou «Exportar 1 livro» na Biblioteca, e «Exportar livro» dentro de um livro;
  - separador; Mostrar última exportação no Finder (já existe);
  - separador; Fechar janela ⌘W, que sai do menu Janela.
- **Edição:** em pt, «Editar» passa a «Edição», o nome do macOS em português. Os itens não mudam.
- **Visualização:**
  - Ver em grelha ⌘1 e Ver em lista ⌘2, com ✓ na vista atual;
  - separador; Ordenar por ›, com as quatro ordens da barra e ✓ na atual;
  - separador; a lista dos leitores («Biblioteca de {leitor}»), com ✓ no aberto. **Só aparece com dois ou mais leitores**, sem atalho (Bruno, 2026-11-21).
- **Livro:** Voltar à Biblioteca ⌘[ ; separador; Apagar livro… ⌘⌫.
- **Janela:** Minimizar ⌘M e Zoom.

**O que já existe** (levantamento a 2026-11-21):
- **`src/lib/menu.ts`:**
  - o `createApplicationMenu(t, activeReaderId, lastExport)` cria Khi, Ficheiro, Editar e Janela;
  - só é reconstruído quando muda a língua (`+page.svelte:244`, com 500 ms de atraso);
  - o estado do item da última exportação muda sem reconstruir, pelo `setRevealLastExportEnabled`. É o padrão a seguir para os outros estados.
- **`+page.svelte`:**
  - ≈ 755: o `handleBackKey` trata o ⌘[ e o Esc;
  - ≈ 769: o `handleShortcut` trata o ⌘R, ⌘E, ⌘1, ⌘2 e ⌘⌫, com as condições de hoje (campo de texto, `unknownDevice`, `deleting`, updater, `uiState`, `declinedKobo`, `detailBook`, `canSync`, `isImporting`).
- **Ações da página que o menu reutiliza:** `handleSync`, `handleBarExport`, `openDeleteDialog` (com o `canDelete` na linha 146), `handleViewModeChange`, `handleSortChange`, `handleSelectReader` e `handleCloseBookDetails`.
- **Estado:** `viewMode` e `sortBy` vêm de `settings.uiPreferences`; os leitores vêm de `library.readers` e `library.activeReaderId`.
- **Textos:** `app.menuFile`, `app.menuEdit`, `app.menuWindow` e `app.menuRevealLastExport`; os textos dos botões da barra estão em `ui.windowBar.*`, `ui.viewGroup.*` e `screens.library.sort.*`.

**O que a pesquisa encontrou** (2026-11-21):
- **Um item ativo com atalho apanha a tecla antes da página**, mesmo com o cursor num campo de texto ([muda#393](https://github.com/tauri-apps/muda/issues/393), [tauri#15909](https://github.com/tauri-apps/tauri/issues/15909)). O Tauri não diz se a ação veio do atalho ou de um clique.
- **Um item desativado deixa a tecla seguir** para a página (Apple, `NSMenuDelegate.menuHasKeyEquivalent`: um item desativado não conta).
- **Consequência:** o estado ativo de cada item tem de ser exatamente a condição em que o atalho funciona hoje. Para o ⌘⌫, isto inclui **a janela principal estar à frente**: as Definições têm campos de texto, e lá o ⌘⌫ apaga até ao início da linha.

**Comportamento a provar:**
1. **Estado dos itens:** uma função pura recebe o estado da página e devolve, para cada item, se está ativo, se tem ✓ e o seu texto. Reproduz as condições do `handleShortcut` e do `handleBackKey` de hoje. Os testes Vitest cobrem:
   - Biblioteca normal;
   - Detalhe;
   - Detalhe com `canDelete`;
   - sem Kobo, com e sem `declinedKobo`;
   - a sincronizar e a importar;
   - `unknownDevice`, `deleting` e updater ocupado;
   - um leitor e dois leitores;
   - a janela principal sem foco.
2. **Um só caminho:** as ações do menu chamam as mesmas funções que os botões da barra. Os atalhos ⌘R, ⌘E, ⌘1, ⌘2, ⌘⌫ e ⌘[ saem do `keydown` da página; o Esc fica. Um atalho nunca corre duas vezes.
3. **Apagar livro… ⌘⌫:** só fica ativo com `canDelete`, sem `deleteBusy`, sem janela modal e com a janela principal à frente. Fora de um livro, o menu Livro fica todo desativado.
4. **Marcas e textos:**
   - o ✓ segue a vista, a ordem e o leitor, mesmo quando mudam pela barra;
   - o texto do Exportar segue o contexto e o número de livros;
   - a lista dos leitores aparece e desaparece com o número de leitores, sem reiniciar a app.
5. **Textos:** pt «Edição»; os itens novos em pt e en. O inglês é revisto na task do inglês.

**Passos:**
- [x] **Passo 1 (TDD):** os testes da função pura do ponto 1. Vermelho, implementação, verde.
- [x] **Passo 2:** reestruturar o `menu.ts`:
  - os itens de vista, ordem e leitor são `CheckMenuItem`;
  - atualizam-se sem reconstruir (`setEnabled`, `setChecked`, `setText`);
  - a lista dos leitores reconstrói-se só quando os leitores mudam.
- [x] **Passo 3:** ligar no `+page.svelte`:
  - um `$effect` aplica a função pura ao menu;
  - o foco da janela vem do `onFocusChanged`;
  - tirar os atalhos do `keydown`, menos o Esc.
- [x] **Passo 4:** os textos em pt e en.
- [x] **Passo 5:** gate completo.
- [x] **Passo 6:** review adversarial (Opus), porque muda o caminho do teclado e o atalho de uma ação destrutiva.
- [x] **Passo 7 (eu):** correções, mutações e verificação na build dev:
  - cada atalho e cada item;
  - o ⌘⌫ no campo «Nome» das Definições, com um livro apagável aberto, apaga texto e não o livro;
  - o ⌘⌫ na Biblioteca não faz nada;
  - as marcas mudam ao usar a barra;
  - commit `feat(menu): menu bar from Q-Z (Z1)`.

**Verificar no ecrã (Bruno), com a build dev:**
- os menus são os do Figma, com «Edição»;
- ⌘R, ⌘E, ⌘1, ⌘2, ⌘[ e ⌘⌫ fazem o mesmo que antes;
- num livro com todos os destaques removidos, Livro › Apagar livro… abre a confirmação;
- com dois leitores, Visualização mostra-os e troca de Biblioteca.
- **Feito (2026-11-21), à espera do ecrã do Bruno:** `src/lib/menu-state.ts` (função pura, 16 testes) e `menu.ts` refeito. A review adversarial encontrou duas falhas, ambas corrigidas: uma tecla mantida repetia o ⌘E e o ⌘R (agora há um intervalo de 300 ms), e a reconstrução do menu depois de mudar de língua podia correr ao mesmo tempo que uma atualização e congelar os estados (agora corre em série, e cada ação confirma o estado antes de agir). 15 mutações dos guardas apanhadas (duas só depois de dois testes novos). Gate: vitest 1131 + 1 skipped, check 0/0, visual 179. Na build dev: o ⌘2 muda a vista pelo menu nativo.

## Visto à margem (não se apaga sem pedido)
- `src/lib/components/LibraryView.svelte.backup` e `date.ts` são código morto.
  
- O `vite.config.ts` tem um caminho antigo em `server.fs.allow` (`/Users/bruno/Documents/…`).
  
## Cobertura da spec
| Decisão | Onde |
| --- | --- |
| D1 (janela `Overlay`, Definições em janela própria, sem sidebar) | Fase 4 |
| D5 (estados prioritários, tema mantido) | Task 1 (tema), Fase 5 |
| D6 (movimento discreto, reduzido) | Task 2, Tasks 8, 14, 17, 18, 22 a 24, 27, 28 e 30 |
| D7 (tokens, 24 componentes) | Tasks 2 a 4, Tasks 5 a 30 |
| D8 (Svelte 5, shadcn-svelte, Tailwind v4) | Tasks 1 e 4 |
| Tema 3 e «Revisão · Contraste do que não é texto» | Task 2, Task 6 |
| Cor 2 (cor de destaque do sistema e amostras) | Tasks 20 e 21 |
| «Revisão · Foco, VoiceOver e Reduzir transparência» | Tasks 5, 8, 10 a 30 |
| «Âmbito da v2» (macOS 13.3, «novo») | Task 1, Fase 3 |
| Ordem de construção e paragem por ecrã | Fase 5 |
