<script lang="ts">
	import { Tabs as TabsPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		value = $bindable(),
		class: className,
		...restProps
	}: Omit<TabsPrimitive.RootProps, 'activationMode' | 'orientation'> = $props();

	// With no value supplied, the first enabled tab is chosen once the triggers exist, so there is
	// always a visible panel and a single Tab stop. Bits UI has no such default and its root does not
	// know its triggers, hence the look at its own (not a nested tabs') rendered triggers.
	$effect(() => {
		if (value || !ref) return;
		const root = ref;
		const first = [...root.querySelectorAll<HTMLElement>('[data-tabs-trigger]')].find(
			(t) => t.closest('[data-tabs-root]') === root && !t.hasAttribute('data-disabled')
		);
		if (first?.dataset.value) value = first.dataset.value;
	});
</script>

<!-- Automatic activation: the arrows choose, as in the macOS Settings toolbar. -->
<TabsPrimitive.Root
	bind:ref
	bind:value={() => value ?? '', (v) => (value = v)}
	data-slot="tabs"
	class={cn('flex flex-col', className)}
	{...restProps}
	activationMode="automatic"
	orientation="horizontal"
/>
