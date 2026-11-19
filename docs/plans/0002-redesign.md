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
  
- **D4. Pendente de design** criado pela D1: o ecrã 8 tem de ser revisto no Figma antes da Fase 5, com 3 opções, um cartão e a recomendação primeiro.
  
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

**Paragem:** o Bruno aprova a Fase 2. A comparação visual de cada componente fica para o seu primeiro ecrã (Fase 5).

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

## Fase 3 · Backend do «novo» e da sincronização (tasks a escrever)
- **Migração v2,** acrescentada ao fim de `MIGRATIONS` (a v1 não se edita):
  
  - `ALTER TABLE highlights ADD COLUMN synced_at TEXT`;
    
  - `ALTER TABLE books ADD COLUMN opened_at TEXT`.
    
- **Sincronização:** um destaque inserido recebe `synced_at`, exceto na primeira sincronização do leitor (D1). Os destaques que já existiam ficam com `NULL`.
  
- **Sincronização com o Detalhe aberto** (teste a escrever na Fase 3 ou 5): o `syncFinished` recarrega `library.books`.
  
  - As marcas «Novo» do livro aberto não podem desaparecer a meio da leitura.
    
  - Os destaques que chegam enquanto o livro está aberto ficam novos para a abertura seguinte.
    
- **Interfaces:**
  
  - `LibraryHighlight.isNew: boolean`, verdadeiro quando `synced_at` não é nulo e é posterior a `opened_at` (ou `opened_at` é nulo);
    
  - o command `markBookOpened(readerId: u32, bookId: u32)`;
    
  - `lastSyncAt: string | null` do Kobo ligado, para o «sincronizado às 10:42» do ecrã 5;
    
  - `newSince: string | null` por leitor, para o «desde 9 nov.».
    
- **Testes de integração** em `src-tauri/tests/library_new.rs`, e os bindings regenerados.
  
## Fase 4 · Janela (tasks a escrever)
- **Barra** `Overlay`**:**
  
  - `titleBarStyle: "Overlay"`, `hiddenTitle: true` e `trafficLightPosition`, tirada da Barra da janela (`#23`);
    
  - `data-tauri-drag-region` na barra;
    
  - `core:window:allow-start-dragging` nas capabilities.
    
- **Definições numa janela própria (D1):**
  
  - abre com ⌘, (o menu já emite `open-settings`);
    
  - rota `/definicoes`, janela `settings` nas capabilities;
    
  - as definições passam entre janelas por evento;
    
  - o `revertUnsavedLanguage` continua a funcionar ao fechar;
    
  - o `Modal` atual sai.
    
## Fase 5 · Ecrãs, por moldura (tasks a escrever)
Cada ecrã fica feito em Claro e Escuro, comparado com o Figma, com captura. O Bruno aprova antes do seguinte («Ecrãs · Ordem de construção»).

| Ordem | Ecrã | Figma (Claro / Escuro) | O que muda no comportamento |
|---|---|---|---|
| 1 | Biblioteca, grelha | `71:8040` / `71:8273` | Etiquetas «N novos» e cabeçalho, a partir da Fase 3 |
| 2 | A sincronizar | `71:8575` / `71:8590` | O `ImportingState` sai e a Biblioteca fica à vista (D5, R17). Exportar fica desativado, com o tooltip «Espera pelo fim da sincronização» |
| 3 | Kobo desligado, sem novidades | `71:9162` / `71:9177` | Sincronizar desativado, com o tooltip «Liga o Kobo para sincronizar» |
| 4 | Lista | `71:9740` / `71:9755` | A mesma ordem da grelha |
| 5 | Detalhe | `71:10560` / `71:10965` | Filtro Todos · Novos · Com notas, e `markBookOpened` (D2) |
| 6 | Primeiro arranque e Kobo novo | `72:11425` / `72:11443`, `72:11461` / `72:11500` | Texto novo do Kobo novo em pt e en |
| 7 | Definições | secção `73:12021` e Q-M (`74:18560`) | Pop-up de leitor com dois ou mais leitores, e 4 textos novos |
| 8 | Exportação | por rever no Figma (D4) | O erro segue `folderNotWritable`, não «a pasta já não existe» |
| 9 | Apagar livro | `74:16535` / `74:16671`, `74:16868` / `74:16918` | ⌘⌫ e a janela modal Q-A |
| 10 | Vários leitores | `74:17138` / `74:17195` e seguintes | Título-menu como seletor (R4) |

O diálogo de atualização (Q-U, Q-V) passa aos componentes novos junto com o ecrã 7.
## Fase 6 · Fecho da v2 (tasks a escrever)
- **Menus:** «Mostrar última exportação no Finder» no menu Ficheiro e o menu Livro. A barra de menus **continua por desenhar**.
  
- **Inglês:** os textos dos ecrãs do redesign.
  
- **Release:**
  
  - número da versão;
    
  - notas da v2 em `release-history.json`, em pt e en;
    
  - teste do updater de ponta a ponta;
    
  - verificação com o macOS em português;
    
  - teste do Tab do Bruno.
    
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
