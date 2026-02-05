<script lang="ts">
	let { checked = false, onChange, name = '', value = '' } = $props();

	function handleClick(event: MouseEvent) {
		event.stopPropagation();
		if (onChange) {
			onChange(value);
		}
	}
</script>

<button
	type="button"
	class="w-4 h-4 border-2 rounded-full bg-transparent border-neutral-400 hover:border-neutral-500 flex items-center justify-center cursor-pointer p-0 transition-all duration-150 ease-in-out shrink-0 dark:border-neutral-500 dark:hover:border-neutral-400"
	class:border-black={checked}
	class:dark:border-white={checked}
	onclick={handleClick}
	aria-checked={checked}
	role="radio"
	{name}
	data-value={value}
>
	{#if checked}
		<span class="w-2 h-2 rounded-full bg-black transition-transform duration-150 ease-in-out dark:bg-white"></span>
	{/if}
</button>
