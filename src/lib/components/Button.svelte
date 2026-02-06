<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		type?: 'button' | 'submit' | 'reset';
		variant?: 'primary' | 'secondary' | 'ghost' | 'icon' | 'danger';
		size?: 'sm' | 'md' | 'lg';
		disabled?: boolean;
		loading?: boolean;
		class?: string;
		onclick?: (event: MouseEvent) => void;
		children?: Snippet;
		icon?: Snippet;
		ariaLabel?: string;
	}

	let {
		type = 'button',
		variant = 'primary',
		size = 'md',
		disabled = false,
		loading = false,
		class: className = '',
		onclick,
		children,
		icon,
		ariaLabel
	}: Props = $props();

	const baseStyles = 'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50 disabled:cursor-not-allowed';

	const variants = {
		primary: 'bg-neutral-900 text-white border border-neutral-900 hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:border-white dark:hover:bg-neutral-100',
		secondary: 'bg-neutral-100 text-neutral-900 border border-neutral-200 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-700',
		ghost: 'bg-transparent text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-100',
		icon: 'p-2 bg-transparent text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-100',
		danger: 'bg-red-600 text-white border border-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800'
	};

	const sizes = {
		sm: 'px-3 py-1.5 text-xs',
		md: 'px-4 py-2 text-sm',
		lg: 'px-6 py-3 text-base'
	};

	const buttonClasses = $derived(() => {
		let classes = [baseStyles];
		if (variant !== 'icon') classes.push(sizes[size]);
		classes.push(variants[variant]);
		if (className) classes.push(className);
		return classes.join(' ');
	});
</script>

<button
	{type}
	class={buttonClasses()}
	{disabled}
	{onclick}
	aria-label={ariaLabel}
>
	{#if loading}
		<svg class="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
			<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
		</svg>
		<span>Loading...</span>
	{:else}
		{#if icon}
			{@render icon()}
		{/if}
		{#if children}
			{@render children()}
		{/if}
	{/if}
</button>
