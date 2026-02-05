<script lang="ts">
    import type { Book, Highlight } from "../types";
    import HighlightItem from "./HighlightItem.svelte";
    import { settings } from "../stores/settings.svelte";
    import { _ } from "$lib/i18n";
    import { getBookGradient } from "$lib/utils/gradients";
    import { FileDown } from "lucide-svelte";
    import { invoke } from "@tauri-apps/api/core";

    interface Props {
        book: Book;
        onClose?: () => void;
    }

    let { book, onClose }: Props = $props();

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
            // Export apenas este livro (não usa seleção)
            const filePaths = await invoke<string[]>("export_books", {
                books: [book],
                config: {
                    exportPath,
                    metadata: exportConfig.metadata,
                    dateFormat: exportConfig.dateFormat,
                },
            });

            console.log("[BookDetailsView] Export successful:", filePaths);
            // TODO: Mostrar notificação de sucesso
        } catch (error) {
            console.error("[BookDetailsView] Export failed:", error);
            // TODO: Mostrar notificação de erro
        }
    }
</script>

<div class="book-details-view" data-testid="book-details-view">
    <!-- Logo Header -->
    <header class="brand-header">
        <h1 class="brand">khi</h1>
    </header>

    <!-- Toolbar -->
    <div class="details-header">
        <button
            type="button"
            class="back-btn"
            onclick={onClose}
            data-testid="book-details-close"
        >
            <svg
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
            <span>{$_("screens.bookDetails.back")}</span>
        </button>

        <button
            type="button"
            class="export-btn"
            onclick={handleExport}
            data-testid="book-details-export"
        >
            <FileDown size={16} />
            <span>{$_("screens.bookDetails.exportMarkdown")}</span>
        </button>
    </div>

    <div class="book-info-section">
        <div class="book-cover">
            {#if book.coverPath}
                <img src={book.coverPath} alt="" class="cover-image" />
            {:else}
                <div
                    class="cover-placeholder bg-gradient-to-br {getBookGradient(
                        book.contentId,
                    )}"
                >
                    <span class="placeholder-text"
                        >{getInitials(book.title)}</span
                    >
                </div>
            {/if}
        </div>

        <div class="book-meta">
            <h1 class="book-title">{book.title}</h1>
            <p class="book-author">
                {book.author || $_("screens.bookDetails.unknownAuthor")}
            </p>
            <p class="book-highlight-count">
                {book.highlights.length} highlights
            </p>
        </div>
    </div>

    <div class="highlights-section">
        {#if book.highlights.length === 0}
            <div class="empty-state" data-testid="book-details-empty">
                <svg
                    class="empty-icon"
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
                <p>{$_("screens.bookDetails.noHighlights")}</p>
            </div>
        {:else}
            <div class="highlights-list" data-testid="highlights-list">
                {#each book.highlights as highlight (highlight.id)}
                    <HighlightItem {highlight} />
                {/each}
            </div>
        {/if}
    </div>
</div>

<style>
    .book-details-view {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow-y: auto;
        background: var(--surface-primary);
    }

    /* Brand Header */
    .brand-header {
        padding: var(--space-4) var(--space-6); /* 16px 24px */
        border-bottom: 1px solid var(--border-default);
        background-color: var(--surface-primary);
    }

    .brand {
        font-size: var(--text-2xl); /* 24px */
        font-weight: var(--font-bold); /* 700 */
        letter-spacing: -0.025em;
        color: var(--text-primary);
        margin: 0;
    }

    /* Toolbar Header */
    .details-header {
        position: sticky;
        top: 0;
        z-index: var(--z-sticky);
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--space-4) var(--space-6);
        background-color: var(--surface-secondary);
        border-bottom: 1px solid var(--border-default);
    }

    .back-btn,
    .export-btn {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-3);
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        color: var(--text-primary);
        background: transparent;
        border: 1px solid transparent;
        border-radius: var(--radius-md);
        cursor: pointer;
        transition: all var(--transition-fast);
    }

    .back-btn:hover,
    .export-btn:hover {
        background: var(--surface-hover);
        border-color: var(--border-default);
        color: var(--text-primary);
    }

    .back-btn:focus-visible,
    .export-btn:focus-visible {
        outline: none;
        box-shadow: var(--shadow-focus);
        border-color: var(--border-focus);
    }

    .back-btn svg {
        width: 16px;
        height: 16px;
    }

    /* Book Info Section */
    .book-info-section {
        display: flex;
        gap: var(--space-6);
        max-width: 896px; /* Spec: max-w-4xl */
        margin: 0 auto 48px; /* Spec: margin-bottom 48px, centered */
        padding: var(--space-8) var(--space-6); /* Spec: 32px vertical, 24px horizontal */
        background: transparent;
    }

    .book-cover {
        width: 128px; /* Spec: 128px */
        height: 192px; /* Spec: 192px */
        flex-shrink: 0;
        border-radius: var(--radius-lg);
        overflow: hidden;
        box-shadow: var(--shadow-md);
    }

    .cover-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .cover-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .placeholder-text {
        font-size: var(--text-3xl);
        font-weight: var(--font-bold);
        color: var(--text-inverse);
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    }

    .book-meta {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        width: 100vh;
    }

    .book-title {
        margin: 0 0 var(--space-2); /* 8px bottom margin */
        font-size: var(--text-3xl); /* Spec: 30px */
        font-weight: var(--font-semibold); /* Spec: 600 */
        color: var(--text-primary);
        line-height: var(--leading-tight);
    }

    .book-author {
        margin: 0 0 var(--space-4); /* 16px bottom margin */
        font-size: var(--text-lg); /* Spec: 18px */
        color: var(--text-secondary);
    }

    .book-highlight-count {
        margin: 0;
        font-size: var(--text-sm); /* Spec: 14px */
        color: var(--text-tertiary);
    }

    /* Highlights Section */
    .highlights-section {
        flex: 1;
        max-width: 896px; /* Spec: max-w-4xl */
        margin: 0 auto; /* Centered */
        padding: 0 var(--space-6); /* Spec: 0 24px */
    }

    /* Empty State */
    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--space-4);
        padding: var(--space-16);
        text-align: center;
        color: var(--text-tertiary);
    }

    .empty-icon {
        width: 48px;
        height: 48px;
        opacity: 0.5;
    }

    .empty-state p {
        margin: 0;
        font-size: var(--text-base);
    }

    /* Highlights List */
    .highlights-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-8); /* Spec: 32px gap between highlights */
    }

    .highlights-list:last-child {
        margin-bottom: var(--space-16);
    }

    /* Responsive */
    @media (max-width: 640px) {
        .book-info-section {
            flex-direction: column;
            align-items: center;
            text-align: center;
        }

        .book-cover {
            width: 96px;
            height: 144px;
        }
    }
</style>
