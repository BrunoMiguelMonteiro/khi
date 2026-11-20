import '@testing-library/jest-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/svelte';
import { tick } from 'svelte';
import BookDetailsView from './BookDetailsView.fixture.svelte';
import type { Book } from '../types';
import { makeBook } from '../test-fixtures';
import { library } from '../stores/library.svelte';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => Promise.resolve(null)),
  convertFileSrc: vi.fn((src: string) => src)
}));

const hl = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  text: `Text ${id}`,
  dateCreated: '2025-01-24T12:00:00Z',
  chapterTitle: 'Chapter 1',
  ...extra
});
const REMOVED = '2026-11-01T10:00:00Z';

/** Opens the book in the store, as the page does, so `viewingNewIds` holds the marks. */
async function open(book: Book) {
  library.setBooks([book]);
  await library.openBook(book.id);
  return book;
}

const slot = (name: string) => [...document.querySelectorAll<HTMLElement>(`[data-slot="${name}"]`)];
const texts = () => slot('highlight-text').map((el) => el.textContent);
const radio = (name: string) => screen.getByRole('radio', { name });
const counts = () => screen.getByTestId('book-details-counts').textContent;

beforeEach(() => {
  library.activeReaderId = null;
  library.closeBook();
  library.clearBooks();
});

describe('BookDetailsView · header', () => {
  it('shows the cover, title, author and a Callout of counts', async () => {
    const book = await open(
      makeBook({
        id: 1,
        title: 'A Sibila',
        author: 'Agustina',
        coverPath: '/c.jpg',
        highlights: [hl('a', { isNew: true }), hl('b', { isNew: true }), hl('c', { removedAt: REMOVED }), hl('d')]
      })
    );
    const { container } = render(BookDetailsView, { props: { book } });
    expect(screen.getByRole('heading', { level: 1, name: 'A Sibila' })).toBeInTheDocument();
    expect(screen.getByText('Agustina')).toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute('src', '/c.jpg');
    const cover = container.querySelector('[data-slot="cover"]')!;
    expect(cover.classList).toContain('w-24');
    expect(counts()).toBe('4 highlights · 2 new · 1 removed from Kobo');
  });

  it('leaves out «new» and «removed» when there are none, and says «1» in the singular', async () => {
    const book = await open(makeBook({ id: 1, title: 'T', author: 'A', highlights: [hl('a')] }));
    render(BookDetailsView, { props: { book } });
    expect(counts()).toBe('1 highlight');
  });

  it('shows «Unknown author» and the cover placeholder with the title', async () => {
    const book = await open(makeBook({ id: 1, title: 'Minimal Book', author: '', highlights: [hl('a')] }));
    const { container } = render(BookDetailsView, { props: { book } });
    expect(screen.getByText('Unknown author')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-slot="cover"]')).toHaveTextContent('Minimal Book');
  });

  it('has no toolbar of its own, no «show removed» box and no delete window', async () => {
    const book = await open(makeBook({ id: 1, title: 'T', author: 'A', highlights: [hl('a'), hl('b', { removedAt: REMOVED })] }));
    render(BookDetailsView, { props: { book } });
    expect(screen.queryByTestId('show-removed')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /back|export|delete/i })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('a book without highlights shows «0 highlights», no filter and no list', async () => {
    const book = await open(makeBook({ id: 1, title: 'Empty', author: 'A', highlights: [] }));
    render(BookDetailsView, { props: { book } });
    expect(counts()).toBe('0 highlights');
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.queryByTestId('highlights-list')).toBeNull();
  });
});

describe('BookDetailsView · filter', () => {
  const mixed = () =>
    makeBook({
      id: 1,
      title: 'T',
      author: 'A',
      highlights: [
        hl('plain'),
        hl('new', { isNew: true }),
        hl('noted', { annotation: 'Uma nota' }),
        hl('gone', { removedAt: REMOVED, isNew: true, annotation: 'Antiga' })
      ]
    });

  it('counts: removed are in «All», a new and removed one is not in «New»', async () => {
    const book = await open(mixed());
    render(BookDetailsView, { props: { book } });
    expect(radio('All, 4')).toBeChecked();
    expect(radio('New, 1')).toBeInTheDocument();
    expect(radio('With notes, 2')).toBeInTheDocument();
    expect(counts()).toBe('4 highlights · 1 new · 1 removed from Kobo');
    expect(texts()).toEqual(['Text plain', 'Text new', 'Text noted', 'Text gone']);
  });

  it('«New» lists only the new that are not removed; «With notes» keeps the removed one', async () => {
    const book = await open(mixed());
    render(BookDetailsView, { props: { book } });
    await fireEvent.click(radio('New, 1'));
    expect(texts()).toEqual(['Text new']);
    await fireEvent.click(radio('With notes, 2'));
    expect(texts()).toEqual(['Text noted', 'Text gone']);
  });

  it('a segment with 0 is disabled and the filter never sits on it', async () => {
    const book = await open(makeBook({ id: 1, title: 'T', author: 'A', highlights: [hl('a'), hl('b', { removedAt: REMOVED, isNew: true })] }));
    render(BookDetailsView, { props: { book } });
    expect(radio('New, 0')).toHaveAttribute('aria-disabled', 'true');
    expect(radio('With notes, 0')).toHaveAttribute('aria-disabled', 'true');
    await fireEvent.click(radio('New, 0'));
    expect(radio('All, 2')).toBeChecked();
    expect(texts()).toHaveLength(2);
  });

  it('a filter whose count drops to 0 falls back to «All» for good', async () => {
    const withNotes = (note: string | null) =>
      makeBook({ id: 1, title: 'T', author: 'A', highlights: [hl('a'), hl('b', { annotation: note })] });
    const book = await open(withNotes('Uma nota'));
    const view = render(BookDetailsView, { props: { book } });
    await fireEvent.click(radio('With notes, 1'));
    expect(texts()).toEqual(['Text b']);
    await view.rerender({ book: withNotes(null) });
    expect(radio('All, 2')).toBeChecked();
    expect(texts()).toEqual(['Text a', 'Text b']);
    // The note comes back: the view stays on «All»
    await view.rerender({ book: withNotes('Outra nota') });
    expect(radio('All, 2')).toBeChecked();
    expect(texts()).toEqual(['Text a', 'Text b']);
  });

  it('changing the filter takes the list back to the top', async () => {
    const book = await open(mixed());
    render(BookDetailsView, { props: { book } });
    const scroller = screen.getByTestId('book-details-view');
    scroller.scrollTop = 120;
    Object.defineProperty(scroller, 'scrollTop', { value: 120, writable: true, configurable: true });
    await fireEvent.click(radio('New, 1'));
    expect(scroller.scrollTop).toBe(0);
  });

  it('removed highlights show in place, with the removed mark and no «New» badge', async () => {
    const book = await open(mixed());
    render(BookDetailsView, { props: { book } });
    const gone = slot('highlight').find((el) => el.textContent?.includes('Text gone'))!;
    expect(gone).toHaveAttribute('data-state', 'removido');
    expect(within(gone).getByText('Removed from Kobo')).toBeInTheDocument();
    expect(gone.querySelector('[data-slot="badge"]')).toBeNull();
  });
});

describe('BookDetailsView · new marks', () => {
  it('marks come from viewingNewIds, never from isNew', async () => {
    const book = makeBook({ id: 1, title: 'T', author: 'A', highlights: [hl('a', { isNew: true }), hl('b')] });
    await open(book);
    // The store has cleared isNew on the opened book; a stale flag on a prop must not show a mark
    const stale = makeBook({ id: 1, title: 'T', author: 'A', highlights: [hl('a'), hl('b', { isNew: true })] });
    render(BookDetailsView, { props: { book: stale } });
    const badges = (id: string) => slot('highlight').find((el) => el.textContent?.includes(`Text ${id}`))!.querySelector('[data-slot="badge"]');
    expect(badges('a')).not.toBeNull();
    expect(badges('b')).toBeNull();
  });

  it('highlights that arrive while the book is open enter without a mark and keep the others', async () => {
    const book = await open(makeBook({ id: 1, title: 'T', author: 'A', highlights: [hl('a', { isNew: true }), hl('b')] }));
    const view = render(BookDetailsView, { props: { book } });
    const synced = makeBook({
      id: 1,
      title: 'T',
      author: 'A',
      highlights: [hl('a'), hl('b'), hl('c', { isNew: true, syncedSeq: 9 })]
    });
    await view.rerender({ book: synced });
    expect(texts()).toEqual(['Text a', 'Text b', 'Text c']);
    expect(slot('badge')).toHaveLength(1);
    expect(slot('highlight')[0].querySelector('[data-slot="badge"]')).not.toBeNull();
    expect(counts()).toBe('3 highlights · 1 new');
    expect(radio('New, 1')).toBeInTheDocument();
  });
});

describe('BookDetailsView · scroll compensation', () => {
  let scrollTop = 0;
  const ids = (n: number) => Array.from({ length: n }, (_, i) => `h${i}`);
  const bookOf = (list: string[]) => makeBook({ id: 1, title: 'T', author: 'A', highlights: list.map((id) => hl(id)) });

  /** jsdom has no layout: a column of 100 px highlights from y 300, in a 400 px viewport at y 0. */
  function fakeLayout(scroller: HTMLElement) {
    Object.defineProperty(scroller, 'scrollTop', { get: () => scrollTop, set: (v: number) => (scrollTop = v), configurable: true });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      let top = 0;
      let height = 400;
      if (this.dataset.slot === 'highlight') {
        top = 300 + [...scroller.querySelectorAll('[data-slot="highlight"]')].indexOf(this) * 100 - scrollTop;
        height = 100;
      }
      return { top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON() {} };
    });
  }

  beforeEach(() => (scrollTop = 0));
  afterEach(() => vi.restoreAllMocks());

  async function start(list: string[], top: number) {
    const book = await open(bookOf(list));
    const view = render(BookDetailsView, { props: { book } });
    fakeLayout(screen.getByTestId('book-details-view'));
    scrollTop = top;
    return view;
  }

  it('raises scrollTop by the height of highlights that enter above the visible text', async () => {
    const view = await start(ids(10), 500);
    // Two enter before h2, the first one on screen (h0 and h1 are above the viewport)
    await view.rerender({ book: bookOf(['h0', 'h1', 'x1', 'x2', ...ids(10).slice(2)]) });
    await tick();
    expect(scrollTop).toBe(700);
  });

  it('leaves scrollTop alone when they enter below the visible text', async () => {
    const view = await start(ids(10), 500);
    await view.rerender({ book: bookOf([...ids(10), 'x1', 'x2']) });
    await tick();
    expect(scrollTop).toBe(500);
  });

  it('leaves the top of the book alone: new highlights there are seen', async () => {
    const view = await start(ids(10), 0);
    await view.rerender({ book: bookOf(['x1', ...ids(10)]) });
    await tick();
    expect(scrollTop).toBe(0);
  });

  const newBookOf = (list: string[], removed: string[] = []) =>
    makeBook({
      id: 1,
      title: 'T',
      author: 'A',
      highlights: list.map((id) => hl(id, { isNew: true, ...(removed.includes(id) ? { removedAt: REMOVED } : {}) }))
    });

  it('leaves scrollTop alone when what enters above does not match the filter', async () => {
    const book = await open(newBookOf(ids(10)));
    const view = render(BookDetailsView, { props: { book } });
    await fireEvent.click(radio('New, 10'));
    fakeLayout(screen.getByTestId('book-details-view'));
    scrollTop = 500;
    // Two synced highlights come in before h2, but they are not marked: «New» does not show them
    const synced = makeBook({
      id: 1,
      title: 'T',
      author: 'A',
      highlights: ['h0', 'h1', 'x1', 'x2', ...ids(10).slice(2)].map((id) => hl(id, { isNew: id.startsWith('h') }))
    });
    await view.rerender({ book: synced });
    await tick();
    expect(texts()).toEqual(ids(10).map((id) => `Text ${id}`));
    expect(scrollTop).toBe(500);
  });

  it('falls back to the next visible highlight when the anchor leaves the list', async () => {
    const book = await open(newBookOf(ids(10)));
    const view = render(BookDetailsView, { props: { book } });
    await fireEvent.click(radio('New, 10'));
    fakeLayout(screen.getByTestId('book-details-view'));
    scrollTop = 500;
    // h2 is the first on screen; it is removed, so «New» drops it and h3 moves up by 100
    await view.rerender({ book: newBookOf(ids(10), ['h2']) });
    await tick();
    expect(texts()).not.toContain('Text h2');
    expect(scrollTop).toBe(400);
  });
});
