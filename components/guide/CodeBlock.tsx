"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

type CodeBlockProps = {
  code: string;
  filename?: string;
  language?: string;
};

export function CodeBlock({ code, filename, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be blocked (e.g. insecure context); fail quietly.
    }
  }

  return (
    <figure className="overflow-hidden rounded-xl border border-gray-800 bg-[#0D1117]">
      <figcaption className="flex items-center justify-between border-b border-gray-800 bg-gray-900/70 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="flex gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-gray-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-gray-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-gray-700" />
          </span>
          {filename && <span className="font-mono text-xs text-gray-400">{filename}</span>}
          {language && !filename && <span className="font-mono text-xs uppercase text-gray-500">{language}</span>}
        </div>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
          aria-label={copied ? "Copied" : "Copy code"}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-brand-400" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </button>
      </figcaption>
      <pre className="overflow-x-auto p-4 text-[0.8125rem] leading-relaxed sm:text-sm">
        <code className="font-mono text-gray-200">{code}</code>
      </pre>
    </figure>
  );
}
