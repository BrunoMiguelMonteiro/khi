import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import BookListItem from './BookListItem.svelte';
import type { Book } from '$lib/types';

describe('BookListItem', () => {
	const mockBook: Book = {
		contentId: 'test-book-1',
		title: 'Test Book Title',
		author: 'Test Author',
		highlights: [
			{
				id: '1',
				text: 'Test highlight 1',
				dateCreated: '2024-01-01'
			},
			{
				id: '2',
				text: 'Test highlight 2',
				dateCreated: '2024-01-02'
			}
		],
		isSelected: false
	};

	const mockGradient = 'from-blue-400 to-blue-600';

	it('renders book information correctly', () => {
		render(BookListItem, {
			props: {
				book: mockBook,
				gradient: mockGradient,
				isSelected: false,
				onToggleSelect: vi.fn(),
				onClick: vi.fn()
			}
		});

		expect(screen.getByText('Test Book Title')).toBeInTheDocument();
		expect(screen.getByText('Test Author')).toBeInTheDocument();
		expect(screen.getByText('2 highlights')).toBeInTheDocument();
	});

	it('displays correct highlight count for single highlight', () => {
		const singleHighlightBook = {
			...mockBook,
			highlights: [mockBook.highlights[0]]
		};

		render(BookListItem, {
			props: {
				book: singleHighlightBook,
				gradient: mockGradient,
				isSelected: false,
				onToggleSelect: vi.fn(),
				onClick: vi.fn()
			}
		});

		expect(screen.getByText('1 highlights')).toBeInTheDocument();
	});

	it('calls onToggleSelect when checkbox is clicked', async () => {
		const onToggleSelect = vi.fn();

		const { container } = render(BookListItem, {
			props: {
				book: mockBook,
				gradient: mockGradient,
				isSelected: false,
				onToggleSelect,
				onClick: vi.fn()
			}
		});

		// CustomCheckbox é um button com role="checkbox"
		const checkbox = container.querySelector('[role="checkbox"]');
		if (checkbox) {
			await fireEvent.click(checkbox);
		}

		expect(onToggleSelect).toHaveBeenCalledTimes(1);
	});

	it('calls onClick when item is clicked', async () => {
		const onClick = vi.fn();
		render(BookListItem, {
			props: {
				book: mockBook,
				gradient: mockGradient,
				isSelected: false,
				onToggleSelect: vi.fn(),
				onClick
			}
		});

		const listItem = screen.getByRole('button');
		await fireEvent.click(listItem);

		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it('calls onClick when title is clicked', async () => {
		const onClick = vi.fn();
		render(BookListItem, {
			props: {
				book: mockBook,
				gradient: mockGradient,
				isSelected: false,
				onToggleSelect: vi.fn(),
				onClick
			}
		});

		const title = screen.getByText(mockBook.title);
		await fireEvent.click(title);

		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it('calls onClick when highlight count is clicked', async () => {
		const onClick = vi.fn();
		render(BookListItem, {
			props: {
				book: mockBook,
				gradient: mockGradient,
				isSelected: false,
				onToggleSelect: vi.fn(),
				onClick
			}
		});

		const highlightCount = screen.getByText('2 highlights');
		await fireEvent.click(highlightCount);

		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it('clicking checkbox does not trigger onClick', async () => {
		const onClick = vi.fn();
		const onToggleSelect = vi.fn();
		const { container } = render(BookListItem, {
			props: {
				book: mockBook,
				gradient: mockGradient,
				isSelected: false,
				onToggleSelect,
				onClick
			}
		});

		const checkbox = container.querySelector('[role="checkbox"]');
		await fireEvent.click(checkbox!);

		expect(onToggleSelect).toHaveBeenCalledTimes(1);
		expect(onClick).not.toHaveBeenCalled();
	});

	it('calls onClick when Enter key is pressed', async () => {
		const onClick = vi.fn();
		render(BookListItem, {
			props: {
				book: mockBook,
				gradient: mockGradient,
				isSelected: false,
				onToggleSelect: vi.fn(),
				onClick
			}
		});

		const listItem = screen.getByRole('button');
		await fireEvent.keyDown(listItem, { key: 'Enter' });

		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it('calls onClick when Space key is pressed', async () => {
		const onClick = vi.fn();
		render(BookListItem, {
			props: {
				book: mockBook,
				gradient: mockGradient,
				isSelected: false,
				onToggleSelect: vi.fn(),
				onClick
			}
		});

		const listItem = screen.getByRole('button');
		await fireEvent.keyDown(listItem, { key: ' ' });

		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it('renders book cover image when coverPath is provided', () => {
		const bookWithCover = {
			...mockBook,
			coverPath: 'data:image/png;base64,test'
		};

		render(BookListItem, {
			props: {
				book: bookWithCover,
				gradient: mockGradient,
				isSelected: false,
				onToggleSelect: vi.fn(),
				onClick: vi.fn()
			}
		});

		const coverImage = screen.getByAltText(`Capa de ${bookWithCover.title}`);
		expect(coverImage).toBeInTheDocument();
		expect(coverImage).toHaveAttribute('src', bookWithCover.coverPath);
	});

	it('uses gradient background when no cover image is provided', () => {
		const { container } = render(BookListItem, {
			props: {
				book: mockBook,
				gradient: 'from-blue-400 to-blue-600',
				isSelected: false,
				onToggleSelect: vi.fn(),
				onClick: vi.fn()
			}
		});

		// O container da capa é o div a seguir à checkbox
		const cover = container.querySelector('.bg-gradient-to-br');
		expect(cover).toBeInTheDocument();
		expect(cover).toHaveClass('from-blue-400');
		expect(cover).toHaveClass('to-blue-600');
	});

	it('displays custom checkbox with correct checked state', () => {
		const { container } = render(BookListItem, {
			props: {
				book: mockBook,
				gradient: mockGradient,
				isSelected: true,
				onToggleSelect: vi.fn(),
				onClick: vi.fn()
			}
		});

		const checkbox = container.querySelector('[role="checkbox"]');
		expect(checkbox).toHaveAttribute('aria-checked', 'true');
	});
});
