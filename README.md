# Khi

Aplicação macOS nativa para extrair highlights (destaques) do Kobo Libra II e exportar para ficheiros Markdown.

## Funcionalidades

- **Deteção Automática**: Deteta automaticamente quando o Kobo é conectado via USB
- **Pré-visualização**: Visualiza todos os livros e highlights antes de exportar
- **Edição Inline**: Edita highlights e adiciona notas pessoais antes de exportar
- **Exportação Markdown**: Gera ficheiros Markdown limpos e bem estruturados
- **Configurações Personalizáveis**: Escolhe metadados a incluir e formato de data
- **Design Moderno**: Interface nativa macOS com modo escuro

## Stack Tecnológico

- **Frontend**: Tauri 2.x + Svelte 5 + TypeScript
- **Backend**: Rust
- **Base de Dados**: SQLite (leitura do Kobo)
- **Testing**: Vitest (frontend) + Rust test framework (backend)

## Requisitos de Sistema

- macOS 11.0 (Big Sur) ou superior
- Kobo Libra II (ou outro eReader Kobo compatível)
- Cabo USB para ligar o Kobo ao Mac

## Instalação

### Download

1. Descarrega a última versão da aplicação na secção [Releases](../../releases)
2. Abre o ficheiro `.dmg` descarregado
3. Arrasta a aplicação "Khi" para a pasta Aplicações

### Primeira Execução

Como a aplicação não é assinada pela Apple (ainda), podes ver um aviso de segurança na primeira execução:

1. Clica com o botão direito na aplicação e seleciona "Abrir"
2. Na janela de segurança, clica em "Abrir"
3. Alternativamente, vai a `Preferências do Sistema > Segurança e Privacidade` e clica em "Abrir Mesmo Assim"

## Utilização

### 1. Conectar o Kobo

1. Liga o teu Kobo ao Mac via cabo USB
2. A aplicação deteta automaticamente o dispositivo
3. Clica em "Importar" para carregar os highlights

### 2. Selecionar Livros

- Usa Ctrl/Cmd+click para selecionar múltiplos livros
- Usa Shift+click para selecionar intervalos
- Clica em "Selecionar Todos" para exportar toda a biblioteca

### 3. Editar Highlights (Opcional)

- Clica num livro para ver os seus highlights
- Edita o texto de qualquer highlight
- Adiciona notas pessoais
- Exclui highlights que não queres exportar

### 4. Exportar

1. Escolhe a pasta de destino
2. Configura as opções de exportação (metadados, formato de data)
3. Clica em "Exportar Selecionados"
4. Os ficheiros Markdown são gerados na pasta escolhida

## Estrutura dos Ficheiros Exportados

Cada livro é exportado como um ficheiro Markdown separado:

```markdown
# Título do Livro

**Autor**: Nome do Autor  
**ISBN**: 978-1234567890  
**Data de Exportação**: 29/01/2026

---

## Capítulo 1

> "Este é o texto do highlight..."

**Nota pessoal**: A minha reflexão sobre este trecho.

---

## Capítulo 2

> "Outro highlight..."
```

## Desenvolvimento

### Pré-requisitos

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) 1.70+
- [Tauri CLI](https://tauri.app/start/prerequisites/)

### Setup do Projeto

```bash
# Clonar o repositório
git clone <repository-url>
cd khi

# Instalar dependências do frontend
npm install

# Executar em modo de desenvolvimento
npm run tauri dev
```

### Executar Testes

```bash
# Testes do frontend (Vitest)
npm test

# Testes do backend (Rust)
cd src-tauri && cargo test

# Testes com cobertura
npm test -- --coverage
```

### Build para Produção

```bash
# Build completo (frontend + backend)
npm run tauri build

# O bundle da aplicação fica em:
# src-tauri/target/release/bundle/
```

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Svelte 5)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ LibraryView  │  │ BookDetails  │  │ SettingsPanel    │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   BookCard   │  │ HighlightItem│  │   AppLayout      │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ IPC (Tauri)
┌─────────────────────────────────────────────────────────────┐
│                      Backend (Rust)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Device     │  │    KoboDB    │  │   CoverExtractor │   │
│  │  Detection   │  │   (SQLite)   │  │   (EPUB parser)  │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Export     │  │   Settings   │  │     Models       │   │
│  │  (Markdown)  │  │   Manager    │  │                  │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Testes

O projeto segue a metodologia **Test-Driven Development (TDD)**:

| Módulo | Testes | Cobertura |
|--------|--------|-----------|
| Frontend (TypeScript/Svelte) | 177+ | >90% |
| Backend (Rust) | 52+ | 100% |
| **Total** | **229+** | **>90%** |

## Contribuições

Contribuições são bem-vindas! Por favor:

1. Faz fork do projeto
2. Cria uma branch para a tua feature (`git checkout -b feature/nova-feature`)
3. Commit das alterações (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abre um Pull Request

## Licença

MIT License - ver [LICENSE](LICENSE) para detalhes.

## Agradecimentos

- [Tauri](https://tauri.app/) - Framework para aplicações desktop
- [Svelte](https://svelte.dev/) - Framework reativo para UI
- [Rust](https://www.rust-lang.org/) - Linguagem de programação segura e performante

---

**Nota**: Esta aplicação não é afiliada com Rakuten Kobo. É um projeto independente criado para facilitar a exportação de highlights pessoais.
