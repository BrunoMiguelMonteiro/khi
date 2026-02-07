<script lang="ts">
    import type { Highlight } from "../types";
    import { copyToClipboard } from "../utils/clipboard";
    import { t } from "$lib/i18n";
    import { Copy, Check } from "lucide-svelte";

    interface Props {
        highlight: Highlight;
    }

    let { highlight }: Props = $props();

    // Estado de feedback de cópia (Svelte 5 runes)
    let copyFeedback: 'idle' | 'success' | 'error' = $state('idle');
    let copyTimeoutId: number | undefined = $state(undefined);

    /**
     * Formata chapter titles técnicos (paths EPUB) em títulos legíveis
     * Exemplos:
     *   "OEBPS/Text/Section0001.html" → "Section 1"
     *   "file:///mnt/onboard/Book/xhtml/chapter01.xhtml#intro" → "Intro"
     *   "content/chapter-3.html" → "Chapter 3"
     */
    function formatChapterTitle(rawTitle: string | undefined): string {
        if (!rawTitle) return "";

        let cleaned = rawTitle;

        // Remove file:// protocol
        cleaned = cleaned.replace(/^file:\/\/\/mnt\/onboard\//, "");

        // Remove common EPUB internal paths
        cleaned = cleaned.replace(/.*\/(OEBPS|Text|xhtml|html|content)\//, "");

        // Remove file extensions
        cleaned = cleaned.replace(/\.(xhtml|html|htm|xml).*$/, "");

        // Extract hash anchor if present (e.g., Section0001.html#chapter_1 → chapter_1)
        const anchorMatch = cleaned.match(/#(.+)$/);
        if (anchorMatch) {
            cleaned = anchorMatch[1];
        }

        // Clean up common patterns
        cleaned = cleaned
            .replace(/Section\d+/gi, "") // Remove "Section001"
            .replace(/chapter[-_]?(\d+)/gi, "Chapter $1") // chapter-1 → Chapter 1
            .replace(/part[-_]?(\d+)/gi, "Part $1") // part_2 → Part 2
            .replace(/[-_]/g, " ") // Replace hyphens/underscores with spaces
            .replace(/\s+/g, " ") // Normalize whitespace
            .trim();

        // Capitalize first letter of each word
        cleaned = cleaned
            .split(" ")
            .map(
                (word) =>
                    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
            )
            .join(" ");

        return cleaned || "Unknown Location";
    }

    /**
     * Handler para cópia da citação para clipboard
     */
    async function handleCopyClick() {
        // Debouncing: prevenir múltiplos cliques
        if (copyFeedback !== 'idle') return;

        const success = await copyToClipboard(highlight.text);

        // Limpar timeout anterior se existir
        if (copyTimeoutId !== undefined) {
            clearTimeout(copyTimeoutId);
        }

        // Atualizar feedback
        copyFeedback = success ? 'success' : 'error';

        // Reset após 2 segundos
        copyTimeoutId = window.setTimeout(() => {
            copyFeedback = 'idle';
            copyTimeoutId = undefined;
        }, 2000);
    }
</script>

<div
    class="group flex flex-col gap-3 p-4 rounded-lg transition-colors duration-200 hover:bg-neutral-100/70 dark:hover:bg-neutral-800/40"
    data-testid="highlight-item"
    data-highlight-id={highlight.id}
>
    <blockquote
        class="relative m-0 py-1 pl-4 pr-10 border-l-4 border-neutral-300 dark:border-neutral-600 text-base leading-relaxed text-neutral-900 dark:text-neutral-100"
    >
        {highlight.text}

        <!-- Copy button - appears on hover -->
        <button
            type="button"
            class="absolute top-1 right-1 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50"
            onclick={handleCopyClick}
            aria-label={copyFeedback === 'idle' ? t('highlight.copy') :
                       copyFeedback === 'success' ? t('highlight.copied') :
                       t('highlight.copyError')}
            disabled={copyFeedback !== 'idle'}
        >
            {#if copyFeedback === 'success'}
                <Check class="w-4 h-4" />
            {:else}
                <Copy class="w-4 h-4" />
            {/if}
        </button>
    </blockquote>

    {#if highlight.chapterTitle}
        <p class="m-0 pl-4 text-xs text-neutral-500 dark:text-neutral-400">
            {formatChapterTitle(highlight.chapterTitle)}
        </p>
    {/if}
</div>
