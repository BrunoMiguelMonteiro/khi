<script lang="ts">
	let { checked = false, onChange } = $props();

	function handleClick(event: MouseEvent) {
		event.stopPropagation();
		if (onChange) {
			onChange(!checked);
		}
	}
</script>

<button
	type="button"
	class="w-5 h-5 border-2 rounded-md flex items-center justify-center cursor-pointer p-0 transition-all duration-150 ease-in-out bg-white border-neutral-300 hover:border-neutral-400 dark:bg-neutral-900 dark:border-neutral-700 dark:hover:border-neutral-500"
	class:bg-black={checked}
	class:border-black={checked}
	class:dark:bg-white={checked}
	class:dark:border-white={checked}
	onclick={handleClick}
	aria-checked={checked}
	role="checkbox"
>
	{#if checked}
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="3"
			stroke-linecap="round"
			stroke-linejoin="round"
			class="text-white dark:text-black"
		>
			<polyline points="20 6 9 17 4 12"></polyline>
		</svg>
	{/if}
</button>
