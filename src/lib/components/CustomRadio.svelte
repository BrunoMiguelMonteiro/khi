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
	class="custom-radio"
	class:checked
	onclick={handleClick}
	aria-checked={checked}
	role="radio"
	{name}
	data-value={value}
>
	{#if checked}
		<span class="inner-dot"></span>
	{/if}
</button>

<style>
	.custom-radio {
		width: 16px;
		height: 16px;
		border: 2px solid;
		border-radius: 50%;
		background-color: transparent;
		border-color: rgb(163 163 163);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		padding: 0;
		transition: all 150ms ease;
		flex-shrink: 0;
	}

	.custom-radio:hover {
		border-color: rgb(115 115 115);
	}

	.custom-radio.checked {
		border-color: black;
	}

	.inner-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background-color: black;
		transition: transform 150ms ease;
	}

	@media (prefers-color-scheme: dark) {
		.custom-radio {
			border-color: rgb(115 115 115);
		}

		.custom-radio:hover {
			border-color: rgb(163 163 163);
		}

		.custom-radio.checked {
			border-color: white;
		}

		.inner-dot {
			background-color: white;
		}
	}

	:global(.dark) .custom-radio {
		border-color: rgb(115 115 115);
	}

	:global(.dark) .custom-radio:hover {
		border-color: rgb(163 163 163);
	}

	:global(.dark) .custom-radio.checked {
		border-color: white;
	}

	:global(.dark) .inner-dot {
		background-color: white;
	}
</style>
