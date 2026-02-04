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
	class="custom-checkbox"
	class:checked
	onclick={handleClick}
	aria-checked={checked}
	role="checkbox"
>
	{#if checked}
		<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
			<polyline points="20 6 9 17 4 12"></polyline>
		</svg>
	{/if}
</button>

<style>
	.custom-checkbox {
		width: 20px;
		height: 20px;
		border: 2px solid;
		border-radius: 0.375rem;
		background-color: white;
		border-color: rgb(212 212 212);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		padding: 0;
		transition: all 150ms ease;
	}

	.custom-checkbox:hover {
		border-color: rgb(163 163 163);
	}

	.custom-checkbox.checked {
		background-color: black;
		border-color: black;
	}

	.custom-checkbox.checked svg {
		color: white;
	}

	@media (prefers-color-scheme: dark) {
		.custom-checkbox {
			background-color: rgb(23 23 23);
			border-color: rgb(82 82 82);
		}

		.custom-checkbox:hover {
			border-color: rgb(115 115 115);
		}

		.custom-checkbox.checked {
			background-color: white;
			border-color: white;
		}

		.custom-checkbox.checked svg {
			color: black;
		}
	}

	:global(.dark) .custom-checkbox {
		background-color: rgb(23 23 23);
		border-color: rgb(82 82 82);
	}

	:global(.dark) .custom-checkbox:hover {
		border-color: rgb(115 115 115);
	}

	:global(.dark) .custom-checkbox.checked {
		background-color: white;
		border-color: white;
	}

	:global(.dark) .custom-checkbox.checked svg {
		color: black;
	}
</style>
