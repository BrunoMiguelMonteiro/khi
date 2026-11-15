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

## Por fazer com o Kobo real (manual)

- [ ] `npm run tauri dev` com o Kobo ligado: o diálogo «De quem é este Kobo?» aparece e a sincronização corre uma única vez.
- [ ] O log mostra `Read Kobo snapshot in N ms`. Meta: sincronização completa em menos de 2 s.
- [ ] Desligar o Kobo e reabrir a app: os mesmos Livros, com capas.
- [ ] Editar uma nota e apagar um highlight no Kobo, depois sincronizar: a nota é atualizada e o highlight fica marcado «Removido do Kobo».
- [ ] Exportar pela barra e pelo detalhe: ficheiros idênticos na pasta do Leitor.

## Nota sobre o `settings.json` real

O mtime de referência era `1794765935` (15 nov 2026, 18:05). Às 21:01 o ficheiro e um `settings.json.backup` foram gravados. Foi durante uma pausa, sem nenhum comando a correr. Não existe `library.sqlite`, por isso a v2 nunca correu, o que aponta para a app v1 instalada em `/Applications/Khi.app`. As suites seguintes não lhe tocaram. A nova referência proposta é `1794776502`.
