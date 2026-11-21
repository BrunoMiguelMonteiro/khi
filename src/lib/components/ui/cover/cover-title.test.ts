import { describe, expect, it } from "vitest";
import { bindShortWords, coverTitle } from "./cover-title";

const NB = " ";
// A fake measure: 7 px per character, so the widths in the tests are easy to follow.
const seven = (text: string) => text.length * 7;

describe("bindShortWords", () => {
  it("binds_a_one_letter_word_to_the_next_when_the_pair_fits", () => {
    // «O Retorno» is 9 characters: 63 px, well inside 147.
    expect(bindShortWords("O Retorno", 147, seven)).toBe(`O${NB}Retorno`);
  });

  it("binds_two_letter_words_too", () => {
    expect(bindShortWords("Os Maias", 147, seven)).toBe(`Os${NB}Maias`);
    expect(bindShortWords("A Cidade de Lisboa", 147, seven)).toBe(
      `A${NB}Cidade de${NB}Lisboa`,
    );
  });

  it("keeps_the_normal_space_when_the_pair_does_not_fit", () => {
    // «O Retorno» needs 63 px; the width is 62.
    expect(bindShortWords("O Retorno", 62, seven)).toBe("O Retorno");
    // Exactly the width still fits.
    expect(bindShortWords("O Retorno", 63, seven)).toBe(`O${NB}Retorno`);
    // A word too long for the line alone can never bind.
    expect(bindShortWords("O Desassossego", 72, seven)).toBe("O Desassossego");
  });

  it("leaves_words_of_three_letters_or_more_alone", () => {
    expect(bindShortWords("Guarda-Chuvas", 147, seven)).toBe("Guarda-Chuvas");
    expect(bindShortWords("Sem ar", 147, seven)).toBe(`Sem ar`);
    expect(bindShortWords("Sem ar fresco", 147, seven)).toBe(`Sem ar${NB}fresco`);
  });

  it("counts_unicode_letters_so_accents_count", () => {
    expect(bindShortWords("É tarde", 147, seven)).toBe(`É${NB}tarde`);
    expect(bindShortWords("Às portas", 147, seven)).toBe(`Às${NB}portas`);
    expect(bindShortWords("Ça va", 147, seven)).toBe(`Ça${NB}va`);
  });

  it("does_not_bind_a_short_word_that_has_a_digit", () => {
    // «2A» has one letter and a digit: it is a number-like token, not a short word.
    expect(bindShortWords("Lei 2A Final", 147, seven)).toBe("Lei 2A Final");
    expect(bindShortWords("Lei A2 Final", 147, seven)).toBe("Lei A2 Final");
  });

  it("does_not_touch_numbers_or_lone_punctuation", () => {
    expect(bindShortWords("42 respostas", 147, seven)).toBe("42 respostas");
    expect(bindShortWords("Ano 1 dias", 147, seven)).toBe("Ano 1 dias");
    expect(bindShortWords("Dias — noites", 147, seven)).toBe("Dias — noites");
    expect(bindShortWords("Dias - noites", 147, seven)).toBe("Dias - noites");
  });

  it("decides_every_pair_by_its_own_width_in_a_title_with_several", () => {
    const title = "O Ano da Morte de Ricardo Reis";
    // 147 px = 21 characters: «O Ano», «da Morte», «de Ricardo» fit; «Ricardo Reis» is not a pair.
    expect(bindShortWords(title, 147, seven)).toBe(
      `O${NB}Ano da${NB}Morte de${NB}Ricardo Reis`,
    );
    // 63 px = 9 characters: «O Ano» (5) and «da Morte» (8) fit, «de Ricardo» (10) does not.
    expect(bindShortWords(title, 63, seven)).toBe(
      `O${NB}Ano da${NB}Morte de Ricardo Reis`,
    );
    // 28 px = 4 characters: nothing fits.
    expect(bindShortWords(title, 28, seven)).toBe(title);
  });

  it("grows_a_chain_of_short_words_only_while_the_whole_unit_fits", () => {
    // «de a Z» is 6 characters: 42 px.
    expect(bindShortWords("de a Z fim", 42, seven)).toBe(`de${NB}a${NB}Z fim`);
    // At 41 px the whole unit would overflow: the chain stops after «de a», and «Z fim» starts a new unit.
    expect(bindShortWords("de a Z fim", 41, seven)).toBe(`de${NB}a Z${NB}fim`);
    // At 27 px «de a» (28 px) does not fit either; «a Z» (21 px) does, but not «a Z fim».
    expect(bindShortWords("de a Z fim", 27, seven)).toBe(`de a${NB}Z fim`);
  });

  it("changes_nothing_without_a_measure_or_a_width", () => {
    expect(bindShortWords("O Retorno", 147, null)).toBe("O Retorno");
    expect(bindShortWords("O Retorno", 0, seven)).toBe("O Retorno");
    expect(bindShortWords("O Retorno", Number.NaN, seven)).toBe("O Retorno");
  });

  it("keeps_a_title_without_spaces_and_the_empty_title", () => {
    expect(bindShortWords("Desassossego", 72, seven)).toBe("Desassossego");
    expect(bindShortWords("", 72, seven)).toBe("");
    expect(bindShortWords("O", 72, seven)).toBe("O");
  });

  it("does_not_touch_spaces_that_are_already_non_breaking_or_repeated", () => {
    expect(bindShortWords(`O${NB}Retorno`, 147, seven)).toBe(`O${NB}Retorno`);
    expect(bindShortWords("O  Retorno", 147, seven)).toBe("O  Retorno");
  });
});

describe("bindShortWords · spaces at the ends and doubled", () => {
  it("keeps_original_spaces_and_still_binds_the_other_pairs", () => {
    expect(bindShortWords("O Retorno ", 147, seven)).toBe(`O${NB}Retorno `);
    expect(bindShortWords(" O Retorno", 147, seven)).toBe(` O${NB}Retorno`);
    expect(bindShortWords("A  Sibila", 147, seven)).toBe("A  Sibila");
    expect(bindShortWords("A  Sibila de O Retorno", 147, seven)).toBe(
      `A  Sibila de${NB}O${NB}Retorno`,
    );
  });
});

describe("coverTitle", () => {
  it("does_not_hyphenate_when_every_word_fits_alone", () => {
    const r = coverTitle("Ensaio sobre a Cegueira", 147, seven);
    expect(r.hyphenate).toBe(false);
    expect(r.text).toBe(`Ensaio sobre a${NB}Cegueira`);
    expect(coverTitle("Livro Sem Destaques", 147, seven).hyphenate).toBe(false);
  });

  it("hyphenates_only_when_a_word_alone_is_wider_than_the_width", () => {
    expect(coverTitle("Desassossego", 72, seven).hyphenate).toBe(true);
    expect(coverTitle("Desassossego", 84, seven).hyphenate).toBe(false);
    expect(coverTitle("O Desassossego", 72, seven)).toEqual({
      text: "O Desassossego",
      hyphenate: true,
    });
  });

  it("changes_nothing_without_a_measure_or_a_width", () => {
    expect(coverTitle("Desassossego", 72, null)).toEqual({
      text: "Desassossego",
      hyphenate: false,
    });
    expect(coverTitle("Desassossego", 0, seven).hyphenate).toBe(false);
  });
});
