<script lang="ts">
    import type { Highlight } from "../types";
    import { copyToClipboard } from "../utils/clipboard";
    import { _ } from "$lib/i18n";
    import { Copy, Check } from "lucide-svelte";

    interface Props {
        highlight: Highlight;
    }

    let { highlight }: Props = $props();

    // Kobo stores "" for highlights without a note: empty or whitespace-only is no note.
    let note = $derived(highlight.annotation?.trim() ?? "");

    // Estado de feedback de cópia (Svelte 5 runes)
    let copyFeedback: "idle" | "success" | "error" = $state("idle");
    let copyTimeoutId: number | undefined = $state(undefined);

    /**
     * Formats chapter title for display.
     * Titles now come clean from the backend (via TOC ContentType 899).
     * This function only acts as a safety net to filter out any filenames
     * that might still slip through.
     */
    function formatChapterTitle(rawTitle: string | null | undefined): string {
        if (!rawTitle || !rawTitle.trim()) return "";

        // Safety net: if a filename still escapes the backend, don't show it
        if (/\.(xhtml|html|htm|xml)\b/.test(rawTitle) || rawTitle.includes('/')) {
            return "";
        }

        return rawTitle.trim();
    }

    /**
     * Handler para cópia da citação para clipboard
     */
    async function handleCopyClick() {
        // Debouncing: prevenir múltiplos cliques
        if (copyFeedback !== "idle") return;

        const success = await copyToClipboard(highlight.text);

        // Limpar timeout anterior se existir
        if (copyTimeoutId !== undefined) {
            clearTimeout(copyTimeoutId);
        }

        // Atualizar feedback
        copyFeedback = success ? "success" : "error";

        // Reset após 2 segundos
        copyTimeoutId = window.setTimeout(() => {
            copyFeedback = "idle";
            copyTimeoutId = undefined;
        }, 2000);
    }
</script>

<div
    class="group flex flex-col gap-3 p-4 -ml-4 -mt-4 rounded-lg transition-colors duration-200 hover:bg-neutral-100/70 dark:hover:bg-neutral-800/40"
    data-testid="highlight-item"
    data-highlight-id={highlight.id}
>
    <blockquote
        class="relative m-0 py-1 pl-4 pr-4 border-l-4 border-neutral-300 dark:border-neutral-600 text-base leading-relaxed text-neutral-900 dark:text-neutral-100 text-pretty"
    >
        {highlight.text}

        <!-- Copy button - appears on hover -->
        <button
            type="button"
            class="absolute top-0 right-0 p-1 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 focus-visible:opacity-100 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50"
            onclick={handleCopyClick}
            aria-label={copyFeedback === "idle"
                ? $_("highlight.copy")
                : copyFeedback === "success"
                  ? $_("highlight.copied")
                  : $_("highlight.copyError")}
            disabled={copyFeedback !== "idle"}
        >
            {#if copyFeedback === "success"}
                <Check class="w-4 h-4" />
            {:else}
                <Copy class="w-4 h-4" />
            {/if}
        </button>
    </blockquote>

    {#if note}
        <p
            class="m-0 pl-4 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 whitespace-pre-line text-pretty"
            data-testid="highlight-note"
        ><span class="font-medium text-neutral-500 dark:text-neutral-400">{$_("highlight.note")}:</span> {note}</p>
    {/if}

    {#if highlight.removedAt}
        <p
            class="m-0 pl-4 text-xs font-medium text-amber-700 dark:text-amber-400"
            data-testid="removed-mark"
        >
            {$_("highlight.removedFromKobo")}
        </p>
    {/if}

    {#if formatChapterTitle(highlight.chapterTitle)}
        <p class="m-0 pl-4 text-xs text-neutral-500 dark:text-neutral-400">
            {formatChapterTitle(highlight.chapterTitle)}
        </p>
    {/if}
</div>
