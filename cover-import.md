# Plano de Implementação: Importação de Capas de Livros

Este documento descreve o plano técnico para implementar a funcionalidade de importar capas de livros a partir do dispositivo Kobo ligado.

## Objetivo
Extrair as capas dos livros (ficheiros EPUB) diretamente do dispositivo Kobo durante o processo de importação de destaques e exibi-las na interface da aplicação.

## Arquitetura
A solução envolve três componentes principais:
1.  **Database (Rust):** Identificar o caminho do ficheiro do livro no dispositivo.
2.  **Command Logic (Rust):** Utilizar o `CoverExtractor` existente para extrair e criar cache das capas.
3.  **Frontend (Svelte):** Receber o caminho da capa e exibi-lo corretamente usando o protocolo de assets do Tauri.

## Passos de Implementação

### 1. Atualização do Modelo de Dados (`src-tauri/src/models/mod.rs`)
Adicionar um campo para armazenar o caminho do ficheiro no dispositivo. Este campo será usado internamente e não precisa de ser serializado para o frontend, a menos que útil para debugging, mas o foco é o `cover_path` (cache local).

*   Adicionar campo `file_path` à struct `Book`.
*   Anotar com `#[serde(skip)]` para não enviar para o frontend (opcional, mas mantém o payload limpo).
*   Atualizar o método `Book::new` para aceitar ou inicializar este campo.

### 2. Atualização da Extração da Base de Dados (`src-tauri/src/db/kobo.rs`)
A query SQL atual busca metadados do livro mas não o caminho do ficheiro.

*   Na tabela `Content`, o campo `ContentID` para livros (ContentType=6) geralmente contém o caminho interno (e.g., `file:///mnt/onboard/Author/Book.epub`) ou um UUID que mapeia para um ficheiro. Para livros *sideloaded*, o `ContentID` é frequentemente o caminho.
*   Atualizar a query SQL para selecionar a coluna que contém o caminho (verificar `ContentID` ou `ContentURL` se existir).
*   Normalizar o caminho: remover o prefixo `file:///mnt/onboard/` para obter o caminho relativo à raiz do dispositivo.
*   Preencher o novo campo `file_path` no objeto `Book`.

### 3. Integração do CoverExtractor (`src-tauri/src/commands/mod.rs`)
O comando `import_highlights` orquestra o processo.

*   Instanciar `CoverExtractor` apontando para a diretoria de cache da app (`app_handle.path().app_cache_dir()`).
*   Após obter a lista de livros via `db.extract_books_with_highlights()`:
    *   Iterar sobre cada `Book`.
    *   Se `file_path` existir:
        *   Construir o caminho absoluto do ficheiro EPUB no Mac: `device.path` + `book.file_path`.
        *   Verificar se o ficheiro existe.
        *   Chamar `extractor.extract_cover(&epub_path)`.
        *   Se a extração for bem-sucedida (retorna `Some(path)`), atualizar `book.cover_path` com o caminho absoluto do ficheiro de cache gerado.
*   Retornar a lista de livros atualizada para o frontend.

### 4. Frontend - Exibição da Capa (`src/lib/components/BookCard.svelte`)
O componente já possui lógica para exibir `coverPath`.

*   Garantir que o caminho do ficheiro local (e.g., `/Users/bruno/.../cache/capa.jpg`) seja acessível.
*   Utilizar a função `convertFileSrc` do `@tauri-apps/api/core` para converter o caminho do sistema de ficheiros num URL compatível com o WebView (`asset://...`).
*   **Nota:** Se o `book.coverPath` vier do backend como caminho absoluto, a conversão deve ser feita no frontend antes de passar ao `src` da tag `<img>`.

### 5. Configuração de Permissões (Tauri)
*   Verificar se o acesso à diretoria de cache e leitura de assets está permitido em `capabilities/default.json`.

## Plano de Trabalho

1.  **Criar Branch:** `feature/cover-import`
2.  **Backend:** Implementar alterações em `models/mod.rs` e `db/kobo.rs`.
3.  **Backend:** Implementar lógica de extração em `commands/mod.rs`.
4.  **Frontend:** Ajustar `BookCard.svelte` para usar `convertFileSrc`.
5.  **Testes:**
    *   Testar com Kobo simulado (mocks) se possível.
    *   Validar que as capas são geradas na pasta de cache.
    *   Validar exibição na UI.

## Metodologia: TDD (Test-Driven Development)
Todo o desenvolvimento deve ser guiado por testes. 
1. Escrever um teste que falha para a nova funcionalidade.
2. Implementar o código mínimo para passar o teste.
3. Refatorar.

## Estratégia de Testes

### 1. Backend (Rust)
*   **Unit Tests (`db/kobo.rs`):** Mock da base de dados com caminhos de ficheiro simulados para validar o parser SQL.
*   **Unit Tests (`covers/mod.rs`):** Já existem testes para extração e cache, mas devem ser expandidos para casos de erro.
*   **Integration Tests (`commands/mod.rs`):** Testar o comando `import_highlights` com um `AppHandle` mockado (se possível) ou via testes de integração de sistema.

### 2. Frontend (Vitest)
*   **Component Tests:** Validar que `BookCard` e outros chamam `convertFileSrc` quando o `coverPath` está presente.

## Resolução de Problemas (Imagens não carregam)

Se as imagens não aparecerem, verificar por esta ordem:
1.  **Logs do Tauri:** Consultar `tauri_debug.log` e a consola do inspetor (Cmd+Option+I na app).
2.  **CSP (Content Security Policy):** No Tauri v2, o protocolo `asset:` deve estar autorizado no `tauri.conf.json`.
3.  **Asset Scope:** Verificar se o scope de segurança permite ler da pasta de cache.
4.  **Caminhos Absolutos:** Confirmar se o Rust está a devolver caminhos absolutos válidos e se o `convertFileSrc` os está a transformar corretamente em URLs `asset://`.

---
