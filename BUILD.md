# Guia de Build - Khi

Este documento descreve o processo completo de build da aplicação para distribuição.

## Pré-requisitos

### Sistema
- macOS 11.0+ (para build macOS)
- ~2GB de espaço em disco
- Conexão à internet

### Ferramentas

#### 1. Node.js 18+
```bash
# Verificar versão
node --version

# Instalar via Homebrew (se necessário)
brew install node
```

#### 2. Rust 1.70+
```bash
# Instalar Rust via rustup
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Reiniciar terminal ou executar
source $HOME/.cargo/env

# Verificar versão
rustc --version
cargo --version
```

#### 3. Tauri CLI
```bash
# Instalar Tauri CLI globalmente
cargo install tauri-cli

# Ou usar via npx (recomendado)
npx @tauri-apps/cli
```

#### 4. Dependências macOS
```bash
# Instalar Xcode Command Line Tools
xcode-select --install
```

## Processo de Build

### 1. Preparação

```bash
# Clonar o repositório
git clone <repository-url>
cd khi

# Instalar dependências do Node
npm install
```

### 2. Desenvolvimento

```bash
# Modo de desenvolvimento com hot-reload
npm run tauri dev
```

### 3. Testes

```bash
# Testes do frontend
npm test

# Testes do backend
cd src-tauri && cargo test

# Testes com cobertura
npm test -- --coverage
```

### 4. Build de Produção

```bash
# Build completo (frontend + backend + bundle)
npm run tauri build
```

Este comando:
1. Compila o frontend (Vite) para `build/`
2. Compila o backend Rust em release mode
3. Gera o bundle da aplicação em `src-tauri/target/release/bundle/`

### 5. Localização dos Artefactos

Após o build, os artefactos encontram-se em:

```
src-tauri/target/release/bundle/
├── macos/
│   ├── Khi.app          # Aplicação
│   └── Khi_0.1.0_x64.dmg  # DMG para distribuição
└── (outros targets se configurados)
```

## Configuração de Build

### tauri.conf.json

Principais configurações para distribuição:

```json
{
  "productName": "Khi",
  "version": "0.1.0",
  "identifier": "com.bruno.khi",
  "build": {
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../build"
  },
  "bundle": {
    "active": true,
    "targets": ["dmg", "app"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns"
    ],
    "category": "Productivity",
    "shortDescription": "Export Kobo highlights to Markdown",
    "longDescription": "A macOS app to extract highlights from Kobo eReaders and export them to Markdown files."
  }
}
```

### Cargo.toml

Configurações do backend:

```toml
[package]
name = "khi"
version = "0.1.0"
edition = "2021"

[dependencies]
tauri = { version = "2" }
# ... outras dependências
```

## Assinatura de Código (Opcional mas Recomendado)

### Sem Assinatura
- A aplicação funciona normalmente
- Gatekeeper do macOS mostra aviso na primeira execução
- Utilizador precisa autorizar em Preferências do Sistema > Segurança

### Com Assinatura (Apple Developer ID)

1. **Obter certificado Apple Developer**
   - Junta-te ao Apple Developer Program ($99/ano)
   - Gera um certificado "Developer ID Application"

2. **Configurar assinatura**
   ```bash
   # Verificar identidades disponíveis
   security find-identity -v -p codesigning
   
   # Configurar no Tauri (tauri.conf.json)
   {
     "bundle": {
       "macOS": {
         "signingIdentity": "Developer ID Application: Your Name (TEAM_ID)"
       }
     }
   }
   ```

3. **Notarização (recomendado)**
   - A notarização permite que a aplicação passe pelo Gatekeeper sem avisos
   - Requer conta Apple Developer e configuração adicional
   - Documentação: https://tauri.app/distribute/sign/macos/

## Solução de Problemas

### Erro: "cargo not found"
```bash
# Verificar se Rust está instalado
rustc --version

# Se não, instalar
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### Erro: "xcrun: error: invalid active developer path"
```bash
# Instalar Xcode Command Line Tools
xcode-select --install

# Ou redefinir o path
sudo xcode-select --reset
```

### Erro de build do frontend
```bash
# Limpar cache
rm -rf node_modules
rm -rf build
npm install
npm run build
```

### Erro de build do Rust
```bash
# Limpar build anterior
cd src-tauri
cargo clean
cargo build --release
```

## Checklist Pré-Release

- [ ] Todos os testes passam (`npm test`, `cargo test`)
- [ ] Build de produção completo sem erros
- [ ] Aplicação abre corretamente
- [ ] Funcionalidades principais testadas:
  - [ ] Deteção de dispositivo Kobo
  - [ ] Importação de highlights
  - [ ] Edição de highlights
  - [ ] Exportação Markdown
  - [ ] Configurações
- [ ] README.md atualizado
- [ ] CHANGELOG.md atualizado (se aplicável)
- [ ] Versão atualizada em:
  - [ ] `package.json`
  - [ ] `src-tauri/Cargo.toml`
  - [ ] `src-tauri/tauri.conf.json`

## Distribuição

### GitHub Releases

1. Criar uma tag git:
   ```bash
   git tag -a v0.1.0 -m "Release version 0.1.0"
   git push origin v0.1.0
   ```

2. Fazer upload do DMG para GitHub Releases

3. Incluir no release:
   - DMG da aplicação
   - Notas de release (CHANGELOG)
   - Instruções de instalação

### Instalação pelo Utilizador

1. Descarregar o ficheiro `.dmg`
2. Abrir o DMG
3. Arrastar a aplicação para a pasta Aplicações
4. Na primeira execução:
   - Clicar com botão direito > Abrir (se não assinada)
   - Ou autorizar em Preferências do Sistema > Segurança

## Notas

- O bundle gerado é específico para a arquitetura do sistema de build
- Para suportar Apple Silicon (M1/M2) e Intel, é necessário build universal ou separado
- A assinatura de código não é obrigatória mas melhora a experiência do utilizador
- A notarização é recomendada para distribuição pública
