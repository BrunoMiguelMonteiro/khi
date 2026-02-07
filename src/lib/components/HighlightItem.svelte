<script lang="ts">
    import type { Highlight } from "../types";
    import { copyToClipboard } from "../utils/clipboard";
    import { t } from "$lib/i18n";
    import Button from "./Button.svelte";
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
    class="flex flex-col gap-3"
    data-testid="highlight-item"
    data-highlight-id={highlight.id}
>
    <blockquote
        class="m-0 py-1 px-4 border-l-4 border-neutral-300 dark:border-neutral-600 text-base leading-relaxed text-neutral-900 dark:text-neutral-100"
    >
        {highlight.text}
    </blockquote>

    <div class="flex items-center justify-between pl-4">
        {#if highlight.chapterTitle}
            <p class="m-0 text-xs text-neutral-500 dark:text-neutral-400">
                {formatChapterTitle(highlight.chapterTitle)}
            </p>
        {:else}
            <div></div>
        {/if}

        <Button
            variant="ghost"
            size="sm"
            onclick={handleCopyClick}
            ariaLabel={copyFeedback === 'idle' ? t('highlight.copy') :
                       copyFeedback === 'success' ? t('highlight.copied') :
                       t('highlight.copyError')}
            disabled={copyFeedback !== 'idle'}
        >
            {#snippet icon()}
                {#if copyFeedback === 'success'}
                    <Check class="w-4 h-4" />
                {:else}
                    <Copy class="w-4 h-4" />
                {/if}
            {/snippet}
            {#if copyFeedback === 'success'}
                {t('highlight.copied')}
            {:else if copyFeedback === 'error'}
                {t('highlight.copyError')}
            {:else}
                {t('highlight.copy')}
            {/if}
        </Button>
    </div>
</div>
