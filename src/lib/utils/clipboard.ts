/**
 * Copia texto para o clipboard usando API moderna navigator.clipboard
 *
 * @param text - Texto a copiar
 * @returns Promise<boolean> - true se sucesso, false se erro
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Erro ao copiar para clipboard:', error);
    return false;
  }
}
