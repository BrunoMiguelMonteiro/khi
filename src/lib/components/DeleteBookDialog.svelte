<!--
  DeleteBookDialog: «Apagar este livro?» (Ecrã 9, Figma 74:16868), on the AlertDialog (Task 23). «Apagar» is a
  Secundário in destructive-text with no default button, so Return confirms nothing (Q-A); the focus stays on the
  window, no button (Q-E). While the book is being deleted (`busy`) Cancelar, Esc, ⌘. and a second «Apagar» answer nothing.
-->
<script lang="ts">
	import { _ } from '$lib/i18n';
	import * as AlertDialog from './ui/alert-dialog';

	interface Props {
		/** A promise keeps the window busy until it answers. */
		onConfirm: () => void | Promise<void>;
		/** Esc, ⌘., Cancelar. */
		onCancel: () => void;
	}

	let { onConfirm, onCancel }: Props = $props();

	let busy = $state(false);

	async function confirm() {
		if (busy) return;
		busy = true;
		try {
			await onConfirm();
		} finally {
			busy = false;
		}
	}

	/** Bits UI's Action closes nothing: the page unmounts the window once the book is gone. A held key must not repeat. */
	function confirmKey(event: KeyboardEvent) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		if (!event.repeat) void confirm().catch((error) => console.error('Failed to delete the book:', error));
	}
</script>

<!-- Always open: the page unmounts it, and a refusal (busy) must leave it standing -->
<AlertDialog.Root bind:open={() => true, (isOpen) => !isOpen && !busy && onCancel()}>
	<AlertDialog.Content data-testid="delete-book-dialog">
		<AlertDialog.Title>{$_('screens.bookDetails.deleteBookTitle')}</AlertDialog.Title>
		<AlertDialog.Description>{$_('screens.bookDetails.deleteBookBody')}</AlertDialog.Description>
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={busy}>{$_('screens.bookDetails.cancel')}</AlertDialog.Cancel>
			<AlertDialog.Action variant="destructive" onclick={() => void confirm().catch((error) => console.error('Failed to delete the book:', error))} onkeydown={confirmKey}>
				{$_('screens.bookDetails.deleteBookConfirm')}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
