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

- [ ] 
  
  **Passo 1:** exportar os estilos de texto do Figma (tamanho, entrelinha, peso, família e estilo) para `design/text-styles.json`.
  
- [ ] 
  
  **Passo 2: testes que falham** (`typography.test.ts`):
  
  - `every_text_style_has_a_utility`: cada estilo do JSON tem um `@utility text-<nome>` com o mesmo `font-size`, `line-height` e `font-weight`;
    
  - `reading_uses_literata_with_optical_sizing`: `text-reading` usa `font-family: "Literata Variable"` (ou `"Literata"`, conforme o pacote) e `font-optical-sizing: auto`;
    
  - `interface_uses_system_font`: o `@theme` define `--font-sans` a começar por `-apple-system`.
    
  
- [ ] 
  
  **Passo 3:** implementar `typography.css`. Confirmar no pacote o eixo `opsz`; se faltar, registar no DECISIONS que o tamanho ótico cai e avisar o Bruno.
  
- [ ] 
  
  **Passo 4:** os testes passam e passam os quatro comandos.
  
- [ ] 
  
  **Passo 5:** commit `feat(ui): system font, embedded Literata and Figma text styles`.
  
### Task 4: base do shadcn-svelte e `cn()`
**Ficheiros:**

- criar `components.json`, `src/lib/utils.ts` e `src/lib/utils.test.ts`;
  
- dependências: bits-ui 2.21.0, tailwind-merge 3.7.0, clsx 2.1.1, tailwind-variants 4.0.2 e tw-animate-css 1.4.0.
  

**Interfaces que produz:**

- [ ] 
  
  `cn(...inputs: ClassValue[]): string`, em `$lib/utils`;
  
- [ ] 
  
  aliases do shadcn-svelte: `components` → `$lib/components`, `ui` → `$lib/components/ui`, `utils` → `$lib/utils`;
  
- [ ] 
  
  o `@import "tw-animate-css"` em `app.css`.
  
- [ ] 
  
  **Passo 1: testes que falham** (`utils.test.ts`):
  
  - `later_padding_wins`: `cn('px-2', 'px-4') === 'px-4'`;
    
  - `text_style_and_color_coexist` (Review Focus 3): `cn('text-body', 'text-foreground')` contém as duas classes;
    
  - `later_text_style_wins`: `cn('text-body', 'text-callout') === 'text-callout'`.
    
  
- [ ] 
  
  **Passo 2:** `npx shadcn-svelte@1.8.1 init`. O `init` escreve no `app.css` variáveis próprias em `oklch`. Apagam-se todas, porque as do Khi vêm de `tokens.css`, e o diff do `app.css` não pode deixar nenhuma.
  
- [ ] 
  
  **Passo 3:** `cn()` com `extendTailwindMerge`: os estilos de texto da Task 3 entram no grupo `font-size`.
  
- [ ] 
  
  **Passo 4:** os testes passam e passam os quatro comandos.
  
- [ ] 
  
  **Passo 5:** commit `build(ui): shadcn-svelte base and cn() aware of Khi text styles`.
  
**Paragem:** o Bruno aprova a Fase 1, e as tasks da Fase 2 são escritas aqui.

* * *
## Fase 2 · Componentes da D7 (tasks a escrever)
- **Ordem:** a do inventário, um nível de cada vez, em `src/lib/components/ui/<nome>/`.
  
  - **0:** Ícone, que embrulha o `lucide-svelte` a 16 e 12, com traço de 1,333.
    
  - **1:** Etiqueta (Badge), Botão, Botão de toolbar, Caixa (Checkbox), Campo de texto (Input), Pop-up (Select) e Tooltip.
    
  - **2:** Grupo de vista (Toggle Group), Segmentado, Menu (DropdownMenu), Linha e Grupo de formulário com Switch, Separador das Definições, Amostra de cor, Aviso (svelte-sonner) e Janela modal (AlertDialog).
    
  - **3:** Capa, Miniatura, Cartão do livro, Linha da lista e Cabeçalho de coluna, Destaque e Cabeçalho da Biblioteca.
    
  - **4:** Título-menu e Barra da janela.
    
- **Cada componente é uma task**, com:
  
  - testes de variantes e estados (papel ARIA, desativado, foco);
    
  - as respostas às perguntas do Figma (Q-A a Q-K, nas secções «Componentes (D7) · N»);
    
  - comparação com os nós do Figma em Claro e Escuro, na app, quando o componente entra no seu primeiro ecrã (Fase 5; D3).
    
- **Investigação antes da Amostra de cor:** como o WKWebView lê a cor de destaque do sistema. Hipóteses: o CSS `AccentColor`, ou o Rust com `NSColor.controlAccentColor` e a notificação de mudança. O DECISIONS diz «não confirmado».
  
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
| D6 (movimento discreto, reduzido) | Task 2, Fase 2 |
| D7 (tokens, 24 componentes) | Tasks 2 a 5, Fase 2 |
| D8 (Svelte 5, shadcn-svelte, Tailwind v4) | Tasks 1 e 4 |
| «Âmbito da v2» (macOS 13.3, «novo») | Task 1, Fase 3 |
| Ordem de construção e paragem por ecrã | Fase 5 |
