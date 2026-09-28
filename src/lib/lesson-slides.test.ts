import { describe, expect, it } from "vitest";
import { h1TitleFromHtml, slideTitleIndex, splitContentByH1 } from "@/lib/lesson-slides";

describe("slide title index", () => {
  it("reads the H1 text and ignores markup inside it", () => {
    expect(h1TitleFromHtml('<h1 class="title"><strong>Abertura &amp; metas</strong></h1><p>x</p>')).toBe(
      "Abertura & metas",
    );
    expect(h1TitleFromHtml("<p>sem título</p>")).toBeNull();
  });

  it("lists only titled slides and keeps the real page index", () => {
    const html = "<p>intro</p><h1>Primeiro</h1><p>a</p><h1>Segundo bloco</h1><p>b</p>";
    const pages = splitContentByH1(html);
    expect(slideTitleIndex(pages)).toEqual([
      { pageIndex: 1, title: "Primeiro" },
      { pageIndex: 2, title: "Segundo bloco" },
    ]);
  });
});
