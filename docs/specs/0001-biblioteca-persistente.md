# Spec 0001: Biblioteca persistente
- **Estado:** aprovada
  
- **Data:** 2026-11-15
  
- **Origem:** candidato 1 da revisão de arquitetura e o grilling que se lhe seguiu
  
- **Glossário:** [GLOSSARY.md](../../GLOSSARY.md). Os termos em **negrito** vêm de lá.
  
- **Decisões de fundo:** [ADR-0001](../adr/0001-biblioteca-por-leitor.md), [ADR-0002](../adr/0002-highlights-removidos-ficam-na-biblioteca.md)
  
## Objetivo
A **Biblioteca** de cada **Leitor** passa a viver em disco, gerida pelo Rust. O Khi mostra-a e exporta a partir dela sem nenhum **Kobo** ligado. Ligar um Kobo faz uma **Sincronização**: acrescenta, atualiza e marca, e nunca substitui tudo.

Hoje os livros só existem num array em memória no frontend (`library.svelte.ts`) e desaparecem quando o Kobo é desligado ou a app fecha.
## Comportamento
### Leitores e Kobos
1. **Kobo desconhecido.** Na primeira vez que um Kobo é ligado, o Khi pergunta de quem é: um **Leitor** existente ou um novo. O nome de um Leitor novo vem, por defeito, do nome do device. O Khi guarda a associação e nunca volta a perguntar por esse Kobo. Exceção: se ainda não existe nenhum Leitor, o Khi não pergunta. Cria um Leitor com o nome do device, associa-lhe o Kobo e segue, porque só há uma resposta possível. O nome muda-se depois nas Definições.
  
2. **Identificador do Kobo.** O Kobo identifica-se pelo número de série, que é o primeiro campo de `.kobo/version`. Hoje o Khi guarda o conteúdo inteiro do ficheiro, e isso deve ser corrigido.
  
3. **Mudar o nome do Leitor.** Dá para mudar o nome a um Leitor, mas não para o apagar.
  
4. **Seletor de Leitor.** Só aparece quando existe mais de um Leitor.
  
5. **Biblioteca mostrada ao abrir.** O Khi mostra a Biblioteca do último Leitor usado. Se estiver um Kobo associado ligado, mostra a do Leitor desse Kobo.
  
### Sincronização
6. **Quando corre.** A Sincronização corre quando um Kobo associado é ligado e «Sincronizar ao ligar» está ativo (vem ativo por defeito). Também corre a pedido, num botão. A regra «só uma vez por sessão» desaparece.
  
7. **Kobo desconhecido.** Com um Kobo desconhecido, a Sincronização só corre depois de o Leitor ser escolhido, ou depois de criado o primeiro Leitor (R1).
  
8. **Highlights.** Para cada **Highlight** lido do Kobo, com texto não vazio:
  
  - **Novo** (`BookmarkID` que não existe na Biblioteca do Leitor): é inserido, com o Kobo de origem registado.
    
  - **Já existente:** texto, **Nota**, capítulo e progresso são atualizados com a versão do Kobo, que ganha sempre.
    
  - **Marcado como removido e de volta ao Kobo:** a marca é limpa.
    
9. **Highlights que desapareceram.** Um Highlight da Biblioteca cujo Kobo de origem é o Kobo que está a sincronizar, e que já não aparece nele, passa a **Highlight removido do Kobo** com a data da remoção. Um Highlight vindo de outro Kobo nunca é tocado.
  
10. **Identidade do Livro.** Cada Highlight pertence a um **Livro** da Biblioteca do Leitor. O Livro é encontrado por esta ordem:
  
  1. o caminho do livro no Kobo (`VolumeID`), já visto antes para este Leitor;
    
  2. o ISBN, se existir;
    
  3. o título e o autor normalizados (minúsculas, sem acentos, sem pontuação, espaços colapsados).
    
  
  Se nada corresponder, é criado um Livro novo. O caminho fica registado como mais uma origem do Livro.
  
11. **Metadados do Livro.** Título, autor, ISBN, editora, idioma, descrição e data da última leitura vêm do Kobo e são atualizados em cada Sincronização.
  
12. **Capas.** Na Sincronização, a capa do Livro é copiada para a pasta de dados do Khi se ainda não existir lá. Fica lá enquanto o Livro estiver na Biblioteca, e limpar a cache não a apaga.
  
13. **Livro sem highlights no Kobo.** Um Livro cujos highlights desapareceram todos do Kobo continua na Biblioteca.
  
14. **Atomicidade.** Uma Sincronização é atómica: ou fica toda gravada, ou nada muda. Desligar o Kobo a meio deixa a Biblioteca como estava.
  
15. **BD do Kobo só em leitura.** A base de dados do Kobo é aberta só em leitura. O Khi nunca escreve no Kobo.
  
16. **Progresso.** A Sincronização corre fora da thread principal e emite progresso: livros processados de N.
  
### Biblioteca sem Kobo
17. **Biblioteca sempre visível.** A Biblioteca do Leitor ativo é sempre visível. Desligar o Kobo só muda um indicador de estado.
  
18. **Highlights removidos na interface.** Aparecem com uma marca visual. Um filtro mostra ou esconde-os, e por defeito estão visíveis.
  
19. **Apagar um Livro.** Só se pode apagar um Livro em que todos os highlights estejam removidos do Kobo, e com confirmação. Os outros Livros não têm esta ação.
  
### Exportação
20. **Uma só entrada.** A **Exportação** recebe ids de Livros e lê da Biblioteca. Deixa de receber os livros inteiros vindos do frontend.
  
21. **Pasta por Leitor.** Cada Leitor tem uma pasta de export própria, por defeito `<pasta de export atual>/<nome do Leitor>`, e pode ser mudada nas Definições. As restantes opções (metadados, formato de data) são globais.
  
22. **Uma só configuração.** Os dois botões de export (barra da Biblioteca e detalhe do Livro) usam a mesma configuração gravada. Isto corrige o export com config fixa em `library.svelte.ts:116-132`.
  
### Definições
23. **Opção que finalmente grava.** `autoImportOnConnect` passa a `syncOnConnect` e existe dos dois lados, TS e Rust. Hoje o Rust descarta-a em cada gravação.
  
24. **Último import.** O registo do último import deixa de existir. Cada Kobo guarda a data da sua última Sincronização.
  
## Armazenamento
- **Onde:** uma SQLite própria em `~/Library/Application Support/KoboHighlightsExporter/library.sqlite`, ao lado do `settings.json` atual. As capas ficam em `covers/` nessa mesma pasta.
  
- **Entidades:** Leitor, Kobo (com o Leitor e a última Sincronização), Livro (por Leitor), origem do Livro (caminhos no Kobo), Highlight (com o Kobo de origem, a data de modificação no Kobo e a data de remoção).
  
- **Migrações de esquema:** o esquema tem uma versão e migrações numeradas desde o primeiro dia.
  
- **Dados da v1:** não há biblioteca em disco para migrar. As Definições atuais mantêm-se.
  

O esquema concreto (colunas, índices) decide-se no primeiro ticket. Esta spec fixa só as entidades e as regras.
## Interface entre o frontend e o Rust
O módulo **Biblioteca** em Rust é o único dono destes dados. Todas as operações que o frontend pode pedir passam por ele: listar Leitores, mudar o nome a um Leitor, associar um Kobo a um Leitor, ler a Biblioteca de um Leitor, sincronizar, apagar um Livro e exportar Livros por id. No sentido inverso, o Rust emite eventos: Kobo ligado (conhecido ou desconhecido), Kobo desligado, progresso da Sincronização e Sincronização terminada.

Os nomes e assinaturas finais saem do candidato 2 (tipos e bindings gerados). Ver a pergunta P1.
## Testes
- **Onde vivem os testes Rust.** Os testes de integração do módulo Biblioteca ficam em `src-tauri/tests/`, com uma SQLite temporária e uma BD de Kobo de fixture gerada no próprio teste.
  
- **Sem dados pessoais.** O `KoboReader.sqlite` da pasta de trabalho é pessoal e não entra no repositório.
  
- **Testes de comportamento.** Cada regra numerada de 6 a 15 e de 19 a 22 tem pelo menos um teste através da interface do módulo, não das funções internas.
  
- **Teste de** `addBooks` **substituído.** O teste atual «should add books without duplicates» em `library.svelte.test.ts` fixa o comportamento antigo e é substituído.
  
## Critérios de aceitação
- [ ] 
  
  Sincronizar, desligar o Kobo e reabrir a app mostra os mesmos Livros e Highlights, com capas.
  
- [ ] 
  
  Editar uma nota no Kobo e voltar a sincronizar atualiza a Nota no Khi.
  
- [ ] 
  
  Apagar um highlight no Kobo e voltar a sincronizar mostra-o marcado como removido.
  
- [ ] 
  
  Sincronizar um segundo Kobo do mesmo Leitor não marca nenhum highlight do primeiro.
  
- [ ] 
  
  O mesmo livro carregado por um caminho diferente junta-se ao Livro existente.
  
- [ ] 
  
  Dois Leitores com o mesmo livro têm Livros e pastas de export separados.
  
- [ ] 
  
  «Sincronizar ao ligar» desligado sobrevive a fechar e reabrir a app.
  
- [ ] 
  
  Exportar a partir da barra e do detalhe produz ficheiros idênticos com as mesmas Definições.
  
- [ ] 
  
  O `cargo test` e o `npm test` passam, e nenhum teste escreve no `settings.json` real.
  
## Fora de âmbito
- Dog-ears.
  
- Estado «já exportado» dos highlights.
  
- Apagar Leitores.
  
- Edição de highlights ou notas no Khi.
  
- Migrar o frontend para React. Esta spec só liga o Svelte atual à nova interface, o suficiente para os critérios acima.
  
## Decisões da revisão
- **P1 - Ordem com o candidato 2.** Os tipos e bindings TS são gerados a partir do Rust (candidato 2) antes desta spec, para a interface nova já nascer tipada.
  
- **P2 - Branch.** A implementação faz-se numa branch `v2` isolada, a partir de `main`.
