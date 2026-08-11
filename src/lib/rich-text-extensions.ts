import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Mathematics } from "@tiptap/extension-mathematics";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table/kit";
import type { AnyExtension, Editor } from "@tiptap/core";

/** Imagem com redimensionamento e opção de largura em %. */
export const ImageWithResize = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      widthStyle: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-width-style") ?? null,
        renderHTML: (attrs) =>
          attrs.widthStyle
            ? { "data-width-style": attrs.widthStyle, style: `max-width: ${attrs.widthStyle}` }
            : {},
      },
    };
  },
});

const IMAGE_HTML_ATTRIBUTES = { class: "max-w-full h-auto rounded-md" };

const IMAGE_RESIZE_OPTIONS: {
  enabled: boolean;
  directions: Array<"bottom-right" | "bottom-left" | "top-right" | "top-left">;
  minWidth: number;
  minHeight: number;
  alwaysPreserveAspectRatio: boolean;
} = {
  enabled: true,
  directions: ["bottom-right", "bottom-left", "top-right", "top-left"],
  minWidth: 80,
  minHeight: 60,
  alwaysPreserveAspectRatio: true,
};

const katexOptions = {
  throwOnError: false,
  strict: "ignore" as const,
};

/**
 * Remove delimitadores `$` / `$$` / `$$$` e espaços extras do LaTeX colado.
 */
export function normalizeLatexInput(raw: string): string {
  let s = (raw || "").trim();
  if (!s) return "";
  if (/^\$\$\$[\s\S]*\$\$\$$/.test(s)) {
    s = s.replace(/^\$\$\$/, "").replace(/\$\$\$$/, "").trim();
  } else if (/^\$\$[\s\S]*\$\$$/.test(s)) {
    s = s.replace(/^\$\$/, "").replace(/\$\$$/, "").trim();
  } else if (/^\$[^$]*\$$/.test(s)) {
    s = s.replace(/^\$/, "").replace(/\$$/, "").trim();
  }
  return s;
}

/** Detecta se o texto parece uma fórmula LaTeX (não só aritmética linear). */
export function looksLikeLatex(text: string): boolean {
  const s = normalizeLatexInput(text);
  if (!s) return false;
  if (/\\[a-zA-Z]+/.test(s)) return true;
  if (/[_^]/.test(s) && /[{}]/.test(s)) return true;
  if (/\$\$?/.test(text)) return true;
  return false;
}

export type RichTextMathClickHandler = (node: { attrs: { latex?: string } }, pos: number) => void;

/**
 * Extensões TipTap compartilhadas entre editor e viewer.
 * `editable` controla se cliques em fórmulas abrem edição.
 */
export function createRichTextExtensions(options?: {
  editable?: boolean;
  onMathClick?: RichTextMathClickHandler;
}): AnyExtension[] {
  const editable = options?.editable ?? false;
  const onMathClick = options?.onMathClick;

  return [
    StarterKit,
    Link.configure({
      openOnClick: false,
      HTMLAttributes: editable
        ? { class: "text-[var(--igh-primary)] underline" }
        : { target: "_blank", rel: "noopener noreferrer", class: "text-[var(--igh-primary)] underline" },
    }),
    ImageWithResize.configure({
      HTMLAttributes: IMAGE_HTML_ATTRIBUTES,
      // Node view de resize no viewer reaproveita o <img> ao trocar o HTML (slides).
      resize:
        editable && typeof document !== "undefined" ? IMAGE_RESIZE_OPTIONS : undefined,
    }),
    TableKit,
    Mathematics.configure({
      katexOptions,
      inlineOptions: editable && onMathClick
        ? {
            onClick: (node, pos) => onMathClick(node as { attrs: { latex?: string } }, pos),
          }
        : undefined,
      blockOptions: editable && onMathClick
        ? {
            onClick: (node, pos) => onMathClick(node as { attrs: { latex?: string } }, pos),
          }
        : undefined,
    }),
  ];
}

/** Conteúdo pode ser HTML (string) ou JSON TipTap/ProseMirror (string com type "doc"). */
export function parseRichTextContent(value: string): string | Record<string, unknown> {
  const s = (value || "").trim();
  if (!s) return "";
  if (s.startsWith("{") && s.endsWith("}")) {
    try {
      const parsed = JSON.parse(s) as { type?: string };
      if (parsed?.type === "doc") return parsed as Record<string, unknown>;
    } catch {
      // não é JSON válido, trata como HTML
    }
  }
  return s;
}

/**
 * Insere fórmula em bloco (melhor para frações). Retorna false se cancelado/vazio.
 */
export function insertBlockMathFromPrompt(editor: Editor, initialLatex = ""): boolean {
  const raw = window.prompt(
    "Cole ou digite a fórmula em LaTeX.\nExemplo de fração: \\frac{1+2}{2-2}\n\nDica: também funciona digitar $$\\frac{a}{b}$$ no texto.",
    initialLatex || "\\frac{a}{b}",
  );
  if (raw == null) return false;
  const latex = normalizeLatexInput(raw);
  if (!latex) return false;
  return editor.chain().focus().insertBlockMath({ latex }).run();
}

export function updateMathFromPrompt(
  editor: Editor,
  kind: "inline" | "block",
  pos: number,
  currentLatex: string,
): void {
  const raw = window.prompt("Editar fórmula (LaTeX):", currentLatex);
  if (raw == null) return;
  const latex = normalizeLatexInput(raw);
  if (!latex) return;
  if (kind === "block") {
    editor.chain().setNodeSelection(pos).updateBlockMath({ latex }).focus().run();
  } else {
    editor.chain().setNodeSelection(pos).updateInlineMath({ latex }).focus().run();
  }
}
