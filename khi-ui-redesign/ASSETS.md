# Khi UI Assets

Este documento lista todos os assets necessários para a implementação Svelte do Khi.

---

## Ícones Kobo E-reader

O ícone customizado do e-reader Kobo existe em 3 variantes:

### 1. `kobo-icon-solid.svg`
**Uso:** Tela "Importing" (animação pulsante)  
**Cor:** Preto (light mode) / Branco (dark mode)  
**Tamanho:** 140×180px (viewBox)

### 2. `kobo-icon-dashed.svg`
**Uso:** Opcional - pode ser usado para estados intermediários  
**Cor:** Igual ao solid  
**Características:** Todas as linhas com `stroke-dasharray="4 4"`

### 3. `kobo-icon-disabled.svg`
**Uso:** Tela "No Kobo Connected"  
**Cor:** Cinza (neutral-300 light / neutral-700 dark)  
**Características:** `opacity="0.5"` aplicado

---

## Como usar em Svelte

### Opção 1: Componente Svelte (Recomendado)

```svelte
<!-- KoboIcon.svelte -->
<script lang="ts">
  export let dashed: boolean = false;
  export let disabled: boolean = false;
  export let size: number = 140;
  
  $: strokeDasharray = dashed ? "4 4" : undefined;
  $: opacity = disabled ? 0.5 : 1;
</script>

<svg
  width={size}
  height={size * 1.286} 
  viewBox="0 0 140 180"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  style="opacity: {opacity}"
  class:text-neutral-300={disabled}
  class:dark:text-neutral-700={disabled}
  class:text-neutral-900={!disabled}
  class:dark:text-neutral-100={!disabled}
>
  <!-- Device outline -->
  <rect 
    x="15" y="20" width="110" height="140" rx="8" 
    stroke="currentColor" stroke-width="2.5" 
    stroke-dasharray={strokeDasharray}
    fill="none"
  />
  
  <!-- Full-screen display -->
  <rect 
    x="22" y="27" width="96" height="126" rx="3" 
    stroke="currentColor" stroke-width="1.5" 
    stroke-dasharray={strokeDasharray}
    fill="none"
  />
  
  <!-- Book page text lines -->
  <line x1="35" y1="45" x2="78" y2="45" stroke="currentColor" stroke-width="1.5" stroke-dasharray={strokeDasharray}/>
  <line x1="35" y1="59" x2="103" y2="59" stroke="currentColor" stroke-width="1.5" stroke-dasharray={strokeDasharray}/>
  <line x1="35" y1="73" x2="98" y2="73" stroke="currentColor" stroke-width="1.5" stroke-dasharray={strokeDasharray}/>
  <line x1="35" y1="87" x2="105" y2="87" stroke="currentColor" stroke-width="1.5" stroke-dasharray={strokeDasharray}/>
  <line x1="35" y1="101" x2="93" y2="101" stroke="currentColor" stroke-width="1.5" stroke-dasharray={strokeDasharray}/>
  <line x1="35" y1="115" x2="103" y2="115" stroke="currentColor" stroke-width="1.5" stroke-dasharray={strokeDasharray}/>
  <line x1="35" y1="129" x2="88" y2="129" stroke="currentColor" stroke-width="1.5" stroke-dasharray={strokeDasharray}/>
</svg>
```

**Uso:**
```svelte
<!-- No Kobo Screen -->
<KoboIcon disabled={true} size={128} />

<!-- Importing Screen -->
<KoboIcon size={128} />
```

---

### Opção 2: Importar SVG diretamente

```svelte
<script>
  import KoboIconSolid from './assets/kobo-icon-solid.svg';
  import KoboIconDisabled from './assets/kobo-icon-disabled.svg';
</script>

<!-- No Kobo Screen -->
<img src={KoboIconDisabled} alt="Kobo e-reader" class="w-32 h-40 text-neutral-300 dark:text-neutral-700" />

<!-- Importing Screen -->
<img src={KoboIconSolid} alt="Kobo e-reader" class="w-32 h-40 animate-pulse" />
```

---

### Opção 3: Inline SVG com @html (Mais controle)

```svelte
<script>
  const koboIconSVG = `<svg>...</svg>`;
</script>

<div class="text-neutral-300 dark:text-neutral-700">
  {@html koboIconSVG}
</div>
```

---

## Outros Assets

### Lucide Icons

Todos os outros ícones usam a biblioteca **Lucide**:

```bash
npm install lucide-svelte
```

**Ícones necessários:**
- `BookX` - No Kobo connected
- `Download` - Export actions
- `Settings` - Settings button
- `Grid3x3` - Grid view toggle
- `List` - List view toggle
- `X` - Close/clear actions
- `ArrowLeft` - Back navigation
- `FileDown` - Export to Markdown

**Exemplo de uso:**
```svelte
<script>
  import { Download, Settings, Grid3x3 } from 'lucide-svelte';
</script>

<Download size={16} />
<Settings size={16} />
```

---

## Book Cover Gradients

Não são assets físicos, mas classes Tailwind CSS:

```javascript
const gradients = [
  'from-blue-400 to-blue-600',
  'from-green-400 to-green-600',
  'from-purple-400 to-purple-600',
  'from-red-400 to-red-600',
  'from-orange-400 to-orange-600',
  'from-teal-400 to-teal-600',
  'from-pink-400 to-pink-600',
  'from-indigo-400 to-indigo-600',
  'from-yellow-400 to-yellow-600',
  'from-cyan-400 to-cyan-600',
];
```

**Uso:**
```svelte
<div class="w-32 h-48 rounded-lg bg-gradient-to-br {book.gradient}"></div>
```

---

## Animações CSS

### Pulse Animation (Importing Screen)

```css
@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

.importing-icon {
  animation: pulse 2s ease-in-out infinite;
}
```

**Ou usar Tailwind:**
```svelte
<KoboIcon class="animate-pulse" />
```

---

## Checklist de Assets

- [x] `kobo-icon-solid.svg` - Ícone sólido
- [x] `kobo-icon-dashed.svg` - Ícone tracejado (opcional)
- [x] `kobo-icon-disabled.svg` - Ícone desabilitado
- [ ] `lucide-svelte` instalado (npm)
- [ ] Componente `KoboIcon.svelte` criado
- [ ] Gradients configurados
- [ ] Animação pulse implementada

---

## Estrutura de Pastas Sugerida

```
src/
├── lib/
│   ├── components/
│   │   ├── KoboIcon.svelte
│   │   ├── NoKoboScreen.svelte
│   │   ├── ImportingScreen.svelte
│   │   ├── BooksLibrary.svelte
│   │   └── BookHighlights.svelte
│   └── assets/
│       ├── kobo-icon-solid.svg
│       ├── kobo-icon-dashed.svg
│       └── kobo-icon-disabled.svg
└── routes/
    └── +page.svelte
```

---

## Notas de Implementação

### currentColor

Os SVGs usam `stroke="currentColor"` para herdar a cor do texto CSS. Em Svelte:

```svelte
<div class="text-black dark:text-white">
  <KoboIcon /> <!-- Será preto/branco conforme o tema -->
</div>
```

### Responsive Sizing

O ícone usa aspect ratio 140:180 (aproximadamente 7:9 ou 0.777).

```svelte
<!-- Tamanho fixo -->
<KoboIcon size={128} /> <!-- 128×164px -->

<!-- Responsive -->
<div class="w-32 aspect-[7/9]">
  <KoboIcon />
</div>
```

---

## Download dos Assets

Os 3 SVGs estão disponíveis na raiz deste projeto:
- `/kobo-icon-solid.svg`
- `/kobo-icon-dashed.svg`
- `/kobo-icon-disabled.svg`

**Para exportar:**
1. Copia o conteúdo dos ficheiros
2. Salva-os no teu projeto Tauri/Svelte em `src/lib/assets/`
3. Ou cria o componente Svelte diretamente (recomendado)
