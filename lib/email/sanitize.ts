import "server-only";
import sanitizeHtml from "sanitize-html";

const allowedTags = [
  "a", "b", "blockquote", "br", "code", "div", "em", "h1", "h2", "h3", "hr",
  "i", "li", "ol", "p", "pre", "span", "strong", "u", "ul",
];

export function sanitizeNewsletterHtml(value: string): string {
  return sanitizeHtml(value, {
    allowedTags,
    allowedAttributes: {
      a: ["href", "target", "rel"],
    },
    allowedSchemes: ["https", "http", "mailto"],
    allowProtocolRelative: false,
    transformTags: {
      a: (_tagName, attributes) => ({
        tagName: "a",
        attribs: {
          ...attributes,
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
    },
  }).trim();
}
