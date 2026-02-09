<script lang="ts">
    import type { Book, Highlight } from "../types";
    import HighlightItem from "./HighlightItem.svelte";
    import Button from "./Button.svelte";
    import { settings } from "../stores/settings.svelte";
    import { _ } from "$lib/i18n";
    import { getBookGradient } from "$lib/utils/gradients";
    import { FileDown } from "lucide-svelte";
    import { invoke, convertFileSrc } from "@tauri-apps/api/core";

    interface Props {
        book: Book;
        onClose?: () => void;
        onNotification?: (message: string, type: 'success' | 'error') => void;
    }

    let { book, onClose, onNotification }: Props = $props();

    function getInitials(title: string): string {
        return title
            .split(" ")
            .slice(0, 2)
            .map((word) => word.charAt(0).toUpperCase())
            .join("");
    }

    async function handleExport() {
        const exportConfig = settings.exportConfig;
        const exportPath = exportConfig.exportPath;

        try {
            const filePaths = await invoke<string[]>("export_books", {
                books: [book],
                config: {
                    exportPath,
                    metadata: exportConfig.metadata,
                    dateFormat: exportConfig.dateFormat,
                },
            });

            console.log("[BookDetailsView] Export successful:", filePaths);
            onNotification?.($_('notifications.exportSuccess'), 'success');
        } catch (error) {
            console.error("[BookDetailsView] Export failed:", error);
            const errorMessage = error instanceof Error ? error.message : 'Export failed';
            onNotification?.(`Export failed: ${errorMessage}`, 'error');
        }
    }
</script>

<div
    class="flex flex-col h-full bg-white dark:bg-neutral-900"
    data-testid="book-details-view"
>
    <!-- Toolbar -->
    <div
        class="sticky top-0 z-20 flex justify-between items-center px-6 py-3 bg-neutral-100 dark:bg-neutral-800 border-t border-b border-neutral-200 dark:border-neutral-700"
    >
        <Button
            variant="ghost"
            onclick={onClose}
            ariaLabel={$_("screens.bookDetails.back")}
        >
            {#snippet icon()}
                <svg
                    class="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                >
                    <path
                        d="M19 12H5"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                    <path
                        d="M12 19l-7-7 7-7"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                </svg>
            {/snippet}
            {$_("screens.bookDetails.back")}
        </Button>

        <div class="flex items-center gap-3">
            <Button variant="ghost" onclick={handleExport}>
                {#snippet icon()}
                    <FileDown size={16} />
                {/snippet}
                {$_("screens.bookDetails.exportMarkdown")}
            </Button>
        </div>
    </div>

    <!-- Content (Scrollable) -->
    <div class="flex-1 overflow-y-auto">
        <div
            class="flex gap-6 max-w-4xl mx-auto mb-12 px-6 py-8 bg-transparent max-sm:flex-col max-sm:items-center max-sm:text-center"
        >
            <div
                class="w-32 h-48 shrink-0 rounded-lg overflow-hidden shadow-md max-sm:w-24 max-sm:h-36"
            >
                {#if book.coverPath}
                    <img
                        src={convertFileSrc(book.coverPath)}
                        alt=""
                        class="w-full h-full object-cover"
                    />
                {:else}
                    <div
                        class="w-full h-full flex items-center justify-center bg-gradient-to-br {getBookGradient(
                            book.contentId,
                        )}"
                    >
                        <span
                            class="text-3xl font-bold text-white drop-shadow-md"
                            >{getInitials(book.title)}</span
                        >
                    </div>
                {/if}
            </div>

            <div class="flex-1 flex flex-col gap-2 min-w-0">
                <h1
                    class="m-0 mb-2 text-3xl font-semibold leading-tight text-neutral-900 dark:text-neutral-100"
                >
                    {book.title}
                </h1>
                <p
                    class="m-0 mb-4 text-lg text-neutral-600 dark:text-neutral-400"
                >
                    {book.author || $_("screens.bookDetails.unknownAuthor")}
                </p>
                <p class="m-0 text-sm text-neutral-500 dark:text-neutral-500">
                    {book.highlights.length} highlights
                </p>
            </div>
        </div>

        <div class="max-w-4xl mx-auto px-6">
            {#if book.highlights.length === 0}
                <div
                    class="flex flex-col items-center justify-center gap-4 py-16 text-center text-neutral-500 dark:text-neutral-400"
                    data-testid="book-details-empty"
                >
                    <svg
                        class="w-12 h-12 opacity-50"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                    >
                        <path
                            d="M7 7h10M7 12h10M7 17h10"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                        />
                    </svg>
                    <p class="m-0 text-base">
                        {$_("screens.bookDetails.noHighlights")}
                    </p>
                </div>
            {:else}
                <div
                    class="flex flex-col gap-8 pb-16"
                    data-testid="highlights-list"
                >
                    {#each book.highlights as highlight (highlight.id)}
                        <HighlightItem {highlight} />
                    {/each}
                </div>
            {/if}
        </div>
    </div>
</div>
