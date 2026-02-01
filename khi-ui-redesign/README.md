# Khi - UI Redesign Specification

Este package contém a especificação completa do redesign do UI do Khi, uma aplicação Kobo Highlight Import em Tauri+Svelte.

---

## 🎯 Contexto

O projeto Tauri+Svelte **já existe e está funcional**. Este package documenta o **novo design visual** a ser implementado no projeto existente.

Este é um **design handoff** completo com especificações visuais, protótipo funcional em React como referência, e todos os assets necessários.

---

## 📦 Conteúdo do Package

```
khi-ui-redesign/
├── README.md                   # Este ficheiro
├── UI-SPEC.md                  # ⭐ Especificação visual completa
├── ASSETS.md                   # SVGs e ícones necessários
│
├── svgs/
│   ├── kobo-icon-solid.svg
│   ├── kobo-icon-disabled.svg
│   └── kobo-icon-dashed.svg
│
└── react-reference/
    ├── App.tsx
    ├── BooksLibrary.tsx
    ├── SettingsModal.tsx
    ├── BookHighlights.tsx
    ├── NoKoboScreen.tsx
    ├── ImportingScreen.tsx
    └── KoboIcon.tsx
```

---

## 📖 Como Usar Este Package

### 1. **Começa por UI-SPEC.md** (Fonte da Verdade)

Este documento contém **TUDO**:
- ✅ Design system completo (cores, typography, spacing, iconography)
- ✅ Especificações das 4 telas principais
- ✅ Layout e dimensões exatas
- ✅ Comportamentos e interações
- ✅ Estados hover/active/disabled
- ✅ Responsive breakpoints
- ✅ Animações e transições
- ✅ Temas Light/Dark com especificações completas

**Princípio:** Se algo não está no UI-SPEC.md, consulta o protótipo React.

### 2. **Consulta /react-reference/** (Protótipo Visual)

Componentes React totalmente funcionais para:
- 👁️ **Ver o comportamento exato** dos componentes
- 🔍 **Entender lógica complexa** (sorting, selections, themes)
- 🎨 **Classes Tailwind utilizadas** (copia/adapta)
- 🧩 **Estrutura de componentes** e data flow

**Nota:** React é **referência visual/comportamental**. Traduz para Svelte mantendo mesma lógica.

### 3. **Usa os SVGs de /svgs/**

Ícone customizado do e-reader Kobo em 3 variantes:
- `kobo-icon-solid.svg` → Tela "Importing" (com pulse animation)
- `kobo-icon-disabled.svg` → Tela "No Kobo Connected"
- `kobo-icon-dashed.svg` → Opcional (variante tracejada)

**ASSETS.md** tem exemplos de como usar em Svelte.

---

## 🎨 Principais Mudanças no Redesign

### Design System
- **Grayscale foundation** - Minimal e clean, sem cores vibrantes
- **Branding "khi"** - Texto preto (light) / branco (dark), bold, tight tracking
- **Book covers** - Gradientes coloridos simples (não imagens de capas reais)
- **Temas** - Light/Dark/System com toggle no Settings modal
- **Typography** - System fonts (sem custom fonts)

### 🖥️ Tela: Books Library
- **Sorting dropdown** no toolbar (5 opções: Title A-Z, Title Z-A, Author A-Z, Most Highlights, Least Highlights)
- **Book covers 30% menores**:
  - Grid view: 3→4→5→6 colunas (responsive)
  - List view: 32×48px (antes 48×64px)
- **Custom checkboxes** (não nativos do browser)
- Toolbar reorganizado: Actions (esquerda) + Sort/View/Settings (direita)

### ⚙️ Tela: Settings Modal
- **2 tabs:** Export + Appearance
- **Export tab:**
  - Export Folder com **botão Browse** (não input editável)
  - Metadata to Include com **custom checkboxes**
  - Date Format com **custom radios**
- **Appearance tab:**
  - Theme toggle (System/Light/Dark) com ícones
  - Library View Mode (Grid/List)
- **Removido:** "Default Sort" (agora é contextual no toolbar)

### 📱 Outras Telas
- **No Kobo Connected** - Ícone disabled + texto centered
- **Importing** - Ícone com pulse animation (scale 1.0→1.05)
- **Book Highlights** - Layout de highlights com border-left colorida

---

## 🔄 Estrutura de Dados

### Book Object
```typescript
interface Book {
  id: string;
  title: string;
  author: string;
  gradient: string; // e.g. "from-blue-400 to-blue-600"
  highlightCount: number;
  highlights: Highlight[];
}
```

### Highlight Object
```typescript
interface Highlight {
  id: string;
  text: string;
  page: number;
}
```

**Mock data completo** está em `/react-reference/App.tsx` (linhas 15-71).

---

## 🎭 Temas (Light/Dark)

Todas as especificações no UI-SPEC.md incluem valores para **ambos os temas**:

**Exemplo:**
- Container background: `white (light) / neutral-950 (dark)`
- Border: `neutral-200 (light) / neutral-800 (dark)`
- Active button: `Black background (light) / White background (dark)`

**CSS Variables approach** (recomendado):
```css
:root {
  --bg-primary: white;
  --text-primary: #111827;
}

.dark {
  --bg-primary: #0A0A0A;
  --text-primary: #F5F5F5;
}
```

---

## 📦 Dependencies Necessárias

### Ícones
```bash
npm install lucide-svelte
```

**Ícones usados:**
- `Download` - Export actions
- `Settings` - Settings button
- `Grid3x3` / `List` - View mode toggle
- `X` - Clear selection / Close modal
- `ArrowLeft` - Back navigation
- `FileDown` - Export to Markdown
- `ArrowUpDown` - Sort dropdown
- `ChevronDown` - Dropdown indicator
- `FolderOpen` - Browse folder
- `Monitor` / `Sun` / `Moon` - Theme toggle
- `Check` - Custom checkbox (checked state)

### Tailwind CSS
O design usa **Tailwind CSS** extensivamente. Mantém as mesmas classes do protótipo React.

---

## 🚫 O Que NÃO Está Incluído

Este package é **apenas UI/UX**. Não inclui:

❌ Lógica Tauri (device detection, file system)  
❌ Configuração build/deploy  
❌ Database/parsing do Kobo  
❌ Package.json do projeto Svelte  
❌ Testes  

**Razão:** O projeto Tauri+Svelte já tem isso implementado. Foca apenas no redesign visual.

---

## 💡 Workflow de Implementação Sugerido

### Fase 1: Setup
1. ✅ Ler UI-SPEC.md completo
2. ✅ Instalar `lucide-svelte`
3. ✅ Copiar SVGs para `/src/lib/assets/`
4. ✅ Configurar temas (CSS variables ou Tailwind dark mode)

### Fase 2: Componentes Base
1. ✅ Criar `KoboIcon.svelte` (exemplo no ASSETS.md)
2. ✅ Implementar NoKoboScreen
3. ✅ Implementar ImportingScreen (com pulse animation)

### Fase 3: Biblioteca Principal
1. ✅ Refactor BooksLibrary layout (toolbar + grid/list)
2. ✅ Implementar sorting dropdown
3. ✅ Reduzir tamanho das capas (30%)
4. ✅ Custom checkboxes para seleção

### Fase 4: Settings Modal
1. ✅ Estrutura com 2 tabs
2. ✅ Export tab (Browse button, custom checkboxes/radios)
3. ✅ Appearance tab (theme toggle, view mode)
4. ✅ Remover lógica de "default sort"

### Fase 5: Polish
1. ✅ Book Highlights page
2. ✅ Responsive breakpoints
3. ✅ Animações e transições
4. ✅ Testing light/dark theme em todas as telas

---

## 🎯 Checklist de Implementação

### Design System
- [ ] Cores grayscale implementadas (light/dark)
- [ ] Typography system fonts configurado
- [ ] Spacing scale (4px, 8px, 12px, 16px, 24px, 32px, 48px)
- [ ] Gradientes de book covers (10 variações)

### Telas
- [ ] No Kobo Connected (ícone disabled centered)
- [ ] Importing Screen (pulse animation)
- [ ] Books Library (grid + list views)
- [ ] Book Highlights (layout com quotes)
- [ ] Settings Modal (2 tabs)

### Interações
- [ ] Sorting dropdown (5 opções)
- [ ] View mode toggle (grid/list)
- [ ] Book selection (custom checkboxes)
- [ ] Theme switching (Light/Dark/System)
- [ ] Navigation (Back button, click book cover)

### Componentes Custom
- [ ] Kobo Icon (3 variantes)
- [ ] Custom Checkbox (não nativo)
- [ ] Custom Radio (não nativo)
- [ ] Sorting Dropdown (com indicator dot)

### Responsive
- [ ] Mobile (< 640px) - 2 colunas grid
- [ ] Tablet (640px-1024px) - 3 colunas
- [ ] Desktop (> 1024px) - 4-6 colunas

---

## 📸 Preview do Protótipo React

Para ver o design final funcionando:

```bash
# Na pasta do protótipo React
npm install
npm run dev
```

Abre no browser e testa:
- ✅ Todas as 4 telas
- ✅ Theme toggle (Light/Dark)
- ✅ Sorting dropdown
- ✅ Grid/List views
- ✅ Settings modal (todas as opções)
- ✅ Responsive behavior

---

## 🆘 FAQ

### "Devo copiar o código React diretamente?"
❌ **Não.** React é **referência visual**. Traduz para Svelte mantendo:
- Mesma lógica de estado
- Mesmas classes Tailwind
- Mesmo comportamento

### "O UI-SPEC.md contradiz o código React?"
**UI-SPEC.md é a fonte da verdade.** Se houver discrepância, segue o UI-SPEC.md.

### "Preciso implementar todas as 4 telas?"
Sim, as 4 telas são essenciais:
1. No Kobo Connected (estado inicial)
2. Importing (loading state)
3. Books Library (tela principal)
4. Book Highlights (detalhe de livro)

### "Os custom checkboxes/radios são obrigatórios?"
✅ **Sim.** Os inputs nativos do browser têm styling inconsistente (fundo preto em alguns browsers). Custom components garantem design consistente.

### "Posso mudar cores/spacing?"
O design foi especificado com detalhe. Se precisas fazer ajustes, consulta primeiro o UI-SPEC.md para manter coerência.

---

## 📞 Suporte

Para questões de implementação:
1. **Visual/UX** → UI-SPEC.md
2. **Comportamento** → Consulta `/react-reference/`
3. **Assets** → ASSETS.md
4. **Ambiguidades** → O protótipo React é a referência visual final

---

## ✨ Resultado Final

Uma aplicação Kobo Highlight Import com:
- ✅ Design minimal e clean
- ✅ Temas Light/Dark perfeitos
- ✅ Capas de livros coloridas (gradientes)
- ✅ Sorting e filtering intuitivos
- ✅ Settings completo e organizado
- ✅ Responsive em todos os breakpoints
- ✅ Animações suaves e profissionais

**Boa implementação!** 🚀
