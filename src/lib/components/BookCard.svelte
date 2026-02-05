<script lang="ts">
    import type { Book } from "../types";
    import { _ } from "$lib/i18n";

    interface Props {
        book: Book;
        gradient?: string;
        isSelected?: boolean;
        isHovered?: boolean;
        onClick?: (event: MouseEvent) => void;
        onToggleSelection?: () => void;
        onMouseEnter?: () => void;
        onMouseLeave?: () => void;
    }

    let {
        book,
        gradient = "from-blue-400 to-blue-600",
        isSelected = false,
        isHovered = false,
        onClick,
        onToggleSelection,
        onMouseEnter,
        onMouseLeave,
    }: Props = $props();

    function formatHighlightCount(count: number): string {
        if (count === 0) return $_("book.noHighlights");
        return $_("book.highlightsCount", { count });
    }

    function getInitials(title: string): string {
        return title
            .split(" ")
            .slice(0, 2)
            .map((word) => word.charAt(0).toUpperCase())
            .join("");
    }
</script>

<div
    class="relative flex flex-col items-stretch border-2 border-transparent text-left w-full transition-all duration-200 group {isHovered ? '-translate-y-0.5' : ''}"
    class:translate-y-0={!isHovered}
    onmouseenter={onMouseEnter}
    onmouseleave={onMouseLeave}
    data-testid="book-card"
    role="group"
    aria-label={book.title}
>
    <button
        type="button"
        class="absolute top-2 left-2 w-6 h-6 bg-transparent border-none cursor-pointer z-10 flex items-center justify-center p-0 focus:outline-none"
        onclick={(e) => {
            e.stopPropagation();
            onToggleSelection?.();
        }}
        aria-label={isSelected ? "Deselect" : "Select"}
    >
        <div 
            class="w-5 h-5 text-neutral-100 transition-all duration-200 {isSelected || isHovered ? 'opacity-100' : 'opacity-0'} group-hover:opacity-100" 
            aria-hidden="true"
        >
            <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="2"
                />
                {#if isSelected}
                    <circle cx="12" cy="12" r="6" fill="currentColor" />
                {/if}
            </svg>
        </div>
    </button>

    <button type="button" class="flex flex-col items-start gap-0 p-0 w-full h-full bg-none border-none cursor-pointer text-left font-inherit text-inherit m-0 focus:outline-none" onclick={onClick}>
        <div class="relative w-full pb-[150%] rounded-lg overflow-hidden shadow-sm">
            {#if book.coverPath}
                <img
                    src={book.coverPath}
                    alt=""
                    class="absolute inset-0 w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                    loading="lazy"
                />
            {:else}
                <div class="absolute inset-0 w-full h-full flex items-center justify-center bg-gradient-to-br {gradient}">
                    <span class="text-xl font-bold text-white drop-shadow-md"
                        >{getInitials(book.title)}</span
                    >
                </div>
            {/if}
        </div>

        <div class="flex-1 min-w-0 flex flex-col gap-1 px-3 py-3 mt-3 max-sm:px-2">
            <h3 class="m-0 text-sm font-semibold leading-snug text-neutral-900 dark:text-neutral-100 line-clamp-2 normal-case overflow-hidden" title={book.title}>{book.title}</h3>
            <p class="m-0 text-xs text-neutral-600 dark:text-neutral-400 overflow-hidden text-overflow-ellipsis whitespace-nowrap">
                {book.author || $_("screens.bookDetails.unknownAuthor")}
            </p>

            <div class="mt-1">
                <span class="text-xs text-neutral-500 dark:text-neutral-500">
                    {formatHighlightCount(book.highlights.length)}
                </span>
            </div>
        </div>
    </button>
</div>
