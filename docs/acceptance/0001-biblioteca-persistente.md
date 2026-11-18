# Aceitação: Biblioteca persistente (spec 0001)

Estado na branch `v2`, depois da Task 15 e da revisão final.

## Critérios cobertos por testes automáticos

| # | Critério da spec | Teste |
|---|---|---|
| 1 | Sincronizar, desligar e reabrir mostra os mesmos Livros com capas | `library_readable_without_kobo`, `cover_survives_cache_clear` |
| 2 | Uma nota editada no Kobo atualiza depois de sincronizar | `kobo_wins_on_text_note_chapter_progress` |
| 3 | Um highlight apagado no Kobo aparece marcado | `missing_highlight_is_marked_removed_with_date`, «removed highlight shows mark» |
| 4 | Sincronizar um segundo Kobo não marca nada do primeiro | `other_kobo_highlights_are_untouched` |
| 5 | Outro caminho para o mesmo livro junta-se ao Livro existente | `same_book_by_other_path_joins_existing` |
| 6 | Dois Leitores ficam separados | `two_readers_same_book_are_separate` |
| 7 | «Sincronizar ao ligar» desligado sobrevive a reabrir a app | `test_sync_on_connect_disabled_survives_save` |
| 8 | Os dois botões de export produzem ficheiros idênticos | `same_ids_same_config_same_bytes`, «toolbar and details export call the same command with the same ids» |
| 9 | Testes verdes sem tocar no `settings.json` real | `cargo test --tests`, `npx vitest run`, `npm run check` |

Também cobertos na revisão final:
- Apagar um Livro e voltar a sublinhá-lo no Kobo faz o Livro reaparecer: `deleted_book_comes_back_when_highlighted_again`.
- Arrancar com o Kobo ligado sincroniza só uma vez: «a second connect while syncing reuses the running sync», «the same kobo reported again after its sync does not sync twice».

## Teste com o Kobo real (15 nov 2026, `npm run tauri dev`)

Kobo Libra 2, 11 livros e 115 highlights no primeiro contacto.

- [x] **Primeiro ligar.** Pedia o diálogo «De quem é este Kobo?». Depois do teste, o primeiro Kobo passou a criar o Leitor sem perguntar quando ainda não existe nenhum (spec R1/R7 atualizada, `497ebfd`).
- [x] **Tempo.** A primeira sincronização demorou 555 ms (leitura do Kobo 546 ms, junção 3 ms). As seguintes demoraram entre 21 e 853 ms. Meta de menos de 2 s cumprida.
- [x] **Uma sincronização por ligação.** Ligar o Kobo com a app aberta dá uma única sincronização. As duplicadas no log vieram de recargas do Vite durante o desenvolvimento.
- [x] **Persistência.** Com o Kobo desligado e a app reaberta, os 11 livros e as capas continuam lá. O cabeçalho mostra «Kobo disconnected» e o «Sync» fica desativado.
- [x] **Highlight novo noutro livro.** `added: 1`, e o 12.º livro entrou com capa.
- [x] **Highlight apagado.** `removed: 1`, marcado «Removed from Kobo».
- [x] **Nota editada.** `updated: 1`, e a nota nova está guardada na Biblioteca.
- [x] **Export pela barra e pelo detalhe.** Os ficheiros são idênticos byte a byte (`sha256 1cd6c3cc…`), em `Kobo Highlights/KOBOeReader/`.

### Encontrado no teste (fora desta branch)

- As notas não aparecem no Khi, nem no detalhe nem no Markdown. O exportador nunca as escreveu, já na v1. Resolvido no PR #8 (merge `d1ed1c0`): as notas aparecem no detalhe e vão para o Markdown numa linha `**Nota:**`.
- Os livros comprados na loja Kobo (caminho com UUID, `.kobo/kepub`) ficam sem capa, já na v1. O Kobo guarda miniaturas em `.kobo-images/`. Resolvido em `379c3b9` (ver «Capas dos livros da loja»).
- A v1 instalada (`/Applications/Khi.app`) abriu sozinha ao lado da build dev. As duas têm o identificador `com.bruno.khi` e partilham o `settings.json`.
- As Definições mostram dois campos de pasta de export, o do Leitor e o Path global, o que confunde. Resolvido em `4956448`: com um Leitor ativo, há um só campo, o da pasta do Leitor.

## Capas dos livros da loja (15 nov 2026, `npm run dev:app`)

Commits `379c3b9` (capas a partir de `.kobo-images`) e `c8cc6c1` (teste com um `ImageId` diferente do `ContentID`). Teste na Khi Dev, com uma cópia da Biblioteca real (1 Leitor, 12 livros, 116 highlights, 11 capas).

- [x] **«Lean UX» com capa.** Ao ligar o Kobo, a sincronização demorou 697 ms, sem nada novo (`added: 0`, 12 livros) e sem duplicados. A capa `covers/1.jpg` é um JPEG de 1120×1680, igual byte a byte a `.kobo-images/85/194/c6c0e484-… - N3_FULL.parsed`.
- [x] **A chave é o `ImageId`.** O `ImageId` do «Lean UX» (`c6c0e484-…`) é diferente do seu `ContentID` (`cee6647c-…`). Uma procura pelo `ContentID` daria a pasta `116/124`, que não existe. O teste `cover_comes_from_kobo_images_without_an_epub` usa este `ImageId` e falha se o código procurar pelo `volume_id`.
- [x] **Ordem de procura.** Primeiro a capa do EPUB; depois `.kobo-images/{d1}/{d2}/` em `N3_FULL`, `N3_LIBRARY_FULL` e `N3_LIBRARY_GRID`; por fim `.kobo/images/` (firmware antigo). Testes `kobo_image_*` e `qhash_matches_calibre`.

## Nota sobre o `settings.json` real

O mtime de referência era `1794765935` (15 nov 2026, 18:05). Às 21:01 o ficheiro e um `settings.json.backup` foram gravados. Foi durante uma pausa, sem nenhum comando a correr. Não existe `library.sqlite`, por isso a v2 nunca correu, o que aponta para a app v1 instalada em `/Applications/Khi.app`. As suites seguintes não lhe tocaram. A nova referência proposta é `1794776502`.
