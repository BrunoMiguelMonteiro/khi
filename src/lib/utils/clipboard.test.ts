import { describe, it, expect, vi, beforeEach } from 'vitest';
import { copyToClipboard } from './clipboard';

describe('copyToClipboard', () => {
  // Mock da API moderna navigator.clipboard
  const mockWriteText = vi.fn();

  beforeEach(() => {
    // Reset mock antes de cada teste
    vi.clearAllMocks();

    // Mock do navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText
      }
    });
  });

  it('copia texto para clipboard usando navigator.clipboard.writeText', async () => {
    mockWriteText.mockResolvedValue(undefined);

    await copyToClipboard('Test text');

    expect(mockWriteText).toHaveBeenCalledWith('Test text');
    expect(mockWriteText).toHaveBeenCalledTimes(1);
  });

  it('retorna true quando a cópia é bem-sucedida', async () => {
    mockWriteText.mockResolvedValue(undefined);

    const result = await copyToClipboard('Success test');

    expect(result).toBe(true);
  });

  it('retorna false quando ocorre erro na cópia', async () => {
    mockWriteText.mockRejectedValue(new Error('Clipboard API error'));

    const result = await copyToClipboard('Error test');

    expect(result).toBe(false);
  });

  it('trata texto vazio sem crash', async () => {
    mockWriteText.mockResolvedValue(undefined);

    const result = await copyToClipboard('');

    expect(mockWriteText).toHaveBeenCalledWith('');
    expect(result).toBe(true);
  });

  it('preserva quebras de linha em texto multiline', async () => {
    mockWriteText.mockResolvedValue(undefined);
    const multilineText = 'Linha 1\nLinha 2\nLinha 3';

    await copyToClipboard(multilineText);

    expect(mockWriteText).toHaveBeenCalledWith('Linha 1\nLinha 2\nLinha 3');
  });

  it('trata caracteres especiais Unicode corretamente', async () => {
    mockWriteText.mockResolvedValue(undefined);
    const unicodeText = 'Olá 👋 世界 🌍 Привет';

    await copyToClipboard(unicodeText);

    expect(mockWriteText).toHaveBeenCalledWith('Olá 👋 世界 🌍 Привет');
  });
});
