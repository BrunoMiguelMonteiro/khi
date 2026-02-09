<script lang="ts">
	import { fade } from 'svelte/transition';

	interface Props {
		message: string | null;
		type: 'success' | 'error';
	}

	let { message, type }: Props = $props();
</script>

{#if message}
	<div
		class="flex items-center gap-1.5 {type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}"
		role="status"
		aria-live="polite"
		transition:fade={{ duration: 200 }}
	>
		<svg
			class="w-3.5 h-3.5 shrink-0"
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
		>
			{#if type === 'success'}
				<path
					d="M20 6L9 17l-5-5"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			{:else}
				<path
					d="M18 6L6 18M6 6l12 12"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			{/if}
		</svg>
		<span class="text-xs font-medium">{message}</span>
	</div>
{/if}
