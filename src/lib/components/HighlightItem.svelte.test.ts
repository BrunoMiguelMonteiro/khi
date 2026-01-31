import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import HighlightItem from './HighlightItem.svelte';
import type { Highlight } from '../types';

const mockHighlight: Highlight = {
  id: 'hl1',
  text: 'This is the original highlight text',
  chapterTitle: 'Chapter 1',
  chapterProgress: 0.25,
  dateCreated: '2025-01-24',
  isExcluded: false,
  isEditing: false,
};

const mockHighlightWithNote: Highlight = {
  ...mockHighlight,
  id: 'hl2',
  personalNote: 'This is my personal note',
};

const mockExcludedHighlight: Highlight = {
  ...mockHighlight,
  id: 'hl3',
  isExcluded: true,
};

const mockEditedHighlight: Highlight = {
  ...mockHighlight,
  id: 'hl4',
  editedText: 'This is the edited text',
};

describe('HighlightItem', () => {
  it('renders highlight text', () => {
    render(HighlightItem, { props: { highlight: mockHighlight } });
    expect(screen.getByText('This is the original highlight text')).toBeInTheDocument();
  });

  it('renders edited text when present', () => {
    render(HighlightItem, { props: { highlight: mockEditedHighlight } });
    expect(screen.getByText('This is the edited text')).toBeInTheDocument();
    expect(screen.queryByText('This is the original highlight text')).not.toBeInTheDocument();
  });

  it('shows edited badge when highlight has been edited', () => {
    render(HighlightItem, { props: { highlight: mockEditedHighlight } });
    expect(screen.getByText('(edited)')).toBeInTheDocument();
  });

  it('renders chapter title', () => {
    render(HighlightItem, { props: { highlight: mockHighlight } });
    expect(screen.getByText('Chapter 1')).toBeInTheDocument();
  });

  it('renders progress percentage', () => {
    render(HighlightItem, { props: { highlight: mockHighlight } });
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('renders date', () => {
    render(HighlightItem, { props: { highlight: mockHighlight } });
    // Date format may vary, check for year
    expect(screen.getByText(/2025/)).toBeInTheDocument();
  });

  it('renders personal note when present', () => {
    render(HighlightItem, { props: { highlight: mockHighlightWithNote } });
    expect(screen.getByText('Note:')).toBeInTheDocument();
    expect(screen.getByText('This is my personal note')).toBeInTheDocument();
  });

  it('applies excluded class when highlight is excluded', () => {
    render(HighlightItem, { props: { highlight: mockExcludedHighlight } });
    const item = screen.getByTestId('highlight-item');
    expect(item).toHaveClass('excluded');
  });

  it('shows strikethrough on text when excluded', () => {
    render(HighlightItem, { props: { highlight: mockExcludedHighlight } });
    const text = screen.getByText('This is the original highlight text');
    // In Svelte scoped styles, the style is applied via class, check computed style
    expect(text).toHaveClass('highlight-text');
    const item = screen.getByTestId('highlight-item');
    expect(item).toHaveClass('excluded');
  });

  it('calls onToggleExclude when exclude button clicked', async () => {
    const handleToggleExclude = vi.fn();
    render(HighlightItem, { 
      props: { 
        highlight: mockHighlight,
        onToggleExclude: handleToggleExclude
      } 
    });
    
    const excludeBtn = screen.getByTestId('highlight-exclude-btn');
    await fireEvent.click(excludeBtn);
    
    expect(handleToggleExclude).toHaveBeenCalledWith('hl1', true);
  });

  it('calls onToggleExclude with false when clicking exclude on already excluded highlight', async () => {
    const handleToggleExclude = vi.fn();
    render(HighlightItem, { 
      props: { 
        highlight: mockExcludedHighlight,
        onToggleExclude: handleToggleExclude
      } 
    });
    
    const excludeBtn = screen.getByTestId('highlight-exclude-btn');
    await fireEvent.click(excludeBtn);
    
    expect(handleToggleExclude).toHaveBeenCalledWith('hl3', false);
  });

  it('enters edit mode when edit button clicked', async () => {
    render(HighlightItem, { props: { highlight: mockHighlight } });
    
    const editBtn = screen.getByTestId('highlight-edit-btn');
    await fireEvent.click(editBtn);
    
    expect(screen.getByTestId('highlight-edit-textarea')).toBeInTheDocument();
  });

  it('disables edit button when highlight is excluded', () => {
    render(HighlightItem, { props: { highlight: mockExcludedHighlight } });
    
    const editBtn = screen.getByTestId('highlight-edit-btn');
    expect(editBtn).toBeDisabled();
  });

  it('calls onEdit when saving edit', async () => {
    const handleEdit = vi.fn();
    render(HighlightItem, { 
      props: { 
        highlight: mockHighlight,
        onEdit: handleEdit
      } 
    });
    
    // Enter edit mode
    const editBtn = screen.getByTestId('highlight-edit-btn');
    await fireEvent.click(editBtn);
    
    // Change text
    const textarea = screen.getByTestId('highlight-edit-textarea');
    await fireEvent.input(textarea, { target: { value: 'New edited text' } });
    
    // Save
    const saveBtn = screen.getByTestId('highlight-save-edit');
    await fireEvent.click(saveBtn);
    
    expect(handleEdit).toHaveBeenCalledWith('hl1', 'New edited text');
  });

  it('does not call onEdit when text is unchanged', async () => {
    const handleEdit = vi.fn();
    render(HighlightItem, { 
      props: { 
        highlight: mockHighlight,
        onEdit: handleEdit
      } 
    });
    
    // Enter edit mode
    const editBtn = screen.getByTestId('highlight-edit-btn');
    await fireEvent.click(editBtn);
    
    // Save without changing
    const saveBtn = screen.getByTestId('highlight-save-edit');
    await fireEvent.click(saveBtn);
    
    expect(handleEdit).not.toHaveBeenCalled();
  });

  it('cancels edit mode when cancel button clicked', async () => {
    render(HighlightItem, { props: { highlight: mockHighlight } });
    
    // Enter edit mode
    const editBtn = screen.getByTestId('highlight-edit-btn');
    await fireEvent.click(editBtn);
    
    // Cancel
    const cancelBtn = screen.getByTestId('highlight-cancel-edit');
    await fireEvent.click(cancelBtn);
    
    expect(screen.queryByTestId('highlight-edit-textarea')).not.toBeInTheDocument();
  });

  it('enters note mode when note button clicked', async () => {
    render(HighlightItem, { props: { highlight: mockHighlight } });
    
    const noteBtn = screen.getByTestId('highlight-note-btn');
    await fireEvent.click(noteBtn);
    
    expect(screen.getByTestId('highlight-note-textarea')).toBeInTheDocument();
  });

  it('calls onAddNote when saving note', async () => {
    const handleAddNote = vi.fn();
    render(HighlightItem, { 
      props: { 
        highlight: mockHighlight,
        onAddNote: handleAddNote
      } 
    });
    
    // Enter note mode
    const noteBtn = screen.getByTestId('highlight-note-btn');
    await fireEvent.click(noteBtn);
    
    // Type note
    const textarea = screen.getByTestId('highlight-note-textarea');
    await fireEvent.input(textarea, { target: { value: 'My new note' } });
    
    // Save
    const saveBtn = screen.getByTestId('highlight-save-note');
    await fireEvent.click(saveBtn);
    
    expect(handleAddNote).toHaveBeenCalledWith('hl1', 'My new note');
  });

  it('calls onAddNote with empty string when clearing note', async () => {
    const handleAddNote = vi.fn();
    render(HighlightItem, { 
      props: { 
        highlight: mockHighlightWithNote,
        onAddNote: handleAddNote
      } 
    });
    
    // Enter note mode
    const noteBtn = screen.getByTestId('highlight-note-btn');
    await fireEvent.click(noteBtn);
    
    // Clear note
    const textarea = screen.getByTestId('highlight-note-textarea');
    await fireEvent.input(textarea, { target: { value: '' } });
    
    // Save
    const saveBtn = screen.getByTestId('highlight-save-note');
    await fireEvent.click(saveBtn);
    
    expect(handleAddNote).toHaveBeenCalledWith('hl2', '');
  });

  it('cancels note mode when cancel button clicked', async () => {
    render(HighlightItem, { props: { highlight: mockHighlight } });
    
    // Enter note mode
    const noteBtn = screen.getByTestId('highlight-note-btn');
    await fireEvent.click(noteBtn);
    
    // Cancel
    const cancelBtn = screen.getByTestId('highlight-cancel-note');
    await fireEvent.click(cancelBtn);
    
    expect(screen.queryByTestId('highlight-note-textarea')).not.toBeInTheDocument();
  });

  it('saves edit on Ctrl+Enter', async () => {
    const handleEdit = vi.fn();
    render(HighlightItem, { 
      props: { 
        highlight: mockHighlight,
        onEdit: handleEdit
      } 
    });
    
    // Enter edit mode
    const editBtn = screen.getByTestId('highlight-edit-btn');
    await fireEvent.click(editBtn);
    
    // Change text and press Ctrl+Enter
    const textarea = screen.getByTestId('highlight-edit-textarea');
    await fireEvent.input(textarea, { target: { value: 'New text' } });
    await fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
    
    expect(handleEdit).toHaveBeenCalledWith('hl1', 'New text');
  });

  it('cancels edit on Escape key', async () => {
    render(HighlightItem, { props: { highlight: mockHighlight } });
    
    // Enter edit mode
    const editBtn = screen.getByTestId('highlight-edit-btn');
    await fireEvent.click(editBtn);
    
    // Press Escape
    const textarea = screen.getByTestId('highlight-edit-textarea');
    await fireEvent.keyDown(textarea, { key: 'Escape' });
    
    expect(screen.queryByTestId('highlight-edit-textarea')).not.toBeInTheDocument();
  });

  it('saves note on Ctrl+Enter', async () => {
    const handleAddNote = vi.fn();
    render(HighlightItem, { 
      props: { 
        highlight: mockHighlight,
        onAddNote: handleAddNote
      } 
    });
    
    // Enter note mode
    const noteBtn = screen.getByTestId('highlight-note-btn');
    await fireEvent.click(noteBtn);
    
    // Type note and press Ctrl+Enter
    const textarea = screen.getByTestId('highlight-note-textarea');
    await fireEvent.input(textarea, { target: { value: 'Note text' } });
    await fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
    
    expect(handleAddNote).toHaveBeenCalledWith('hl1', 'Note text');
  });

  it('cancels note on Escape key', async () => {
    render(HighlightItem, { props: { highlight: mockHighlight } });
    
    // Enter note mode
    const noteBtn = screen.getByTestId('highlight-note-btn');
    await fireEvent.click(noteBtn);
    
    // Press Escape
    const textarea = screen.getByTestId('highlight-note-textarea');
    await fireEvent.keyDown(textarea, { key: 'Escape' });
    
    expect(screen.queryByTestId('highlight-note-textarea')).not.toBeInTheDocument();
  });

  it('has correct data attributes', () => {
    render(HighlightItem, { props: { highlight: mockHighlight } });
    const item = screen.getByTestId('highlight-item');
    expect(item).toHaveAttribute('data-highlight-id', 'hl1');
  });

  it('note button shows active state when highlight has note', () => {
    render(HighlightItem, { props: { highlight: mockHighlightWithNote } });
    const noteBtn = screen.getByTestId('highlight-note-btn');
    expect(noteBtn).toHaveClass('active');
  });

  it('exclude button shows active state when highlight is excluded', () => {
    render(HighlightItem, { props: { highlight: mockExcludedHighlight } });
    const excludeBtn = screen.getByTestId('highlight-exclude-btn');
    expect(excludeBtn).toHaveClass('active');
  });
});
