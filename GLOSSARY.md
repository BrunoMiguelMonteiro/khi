# Khi

O Khi guarda os highlights que o utilizador fez num Kobo e exporta-os para Markdown, mesmo quando o Kobo não está ligado.

## Language

**Leitor** (Reader):
A pessoa a quem pertencem os highlights. Cada Leitor tem uma Biblioteca e pode ter vários Kobos ao longo do tempo.
_Avoid_: utilizador, conta, perfil

**Biblioteca** (Library):
A coleção de livros e highlights de um Leitor que o Khi guarda, independente de o Kobo estar ligado. Nunca perde um highlight por ele ter desaparecido do Kobo, e não se mistura com a de outro Leitor.
_Avoid_: lista de livros, cache

**Kobo**:
Um e-reader concreto, identificado pelo seu número de série, associado a um único Leitor.
_Avoid_: device, dispositivo, e-reader (quando se fala de um aparelho concreto)

**Livro**:
Uma obra na Biblioteca de um Leitor. Cópias ou edições diferentes da mesma obra, mesmo vindas de Kobos diferentes, contam como o mesmo Livro.
_Avoid_: ficheiro, ebook, volume

**Highlight**:
Um excerto marcado num livro do Kobo, com a nota que o utilizador lhe tenha juntado.
_Avoid_: bookmark, marcação, sublinhado

**Nota**:
O texto que o utilizador escreveu no Kobo junto a um highlight. Só se escreve e edita no Kobo.
_Avoid_: anotação, annotation, comentário

**Sincronização** (Sync):
Ler os highlights de um Kobo e fundi-los na Biblioteca do seu Leitor. Acrescenta os novos, atualiza os alterados e marca os que desapareceram.
_Avoid_: importação, import, leitura

**Exportação** (Export):
Escrever highlights da Biblioteca em ficheiros Markdown.
_Avoid_: sincronização (é sempre Biblioteca → Markdown, nunca o contrário)

**Highlight removido do Kobo** (Removed from Kobo):
Um highlight que continua na Biblioteca mas que já não existe no Kobo de onde veio. Sincronizar outro Kobo do mesmo Leitor nunca o torna removido.
_Avoid_: apagado, órfão
