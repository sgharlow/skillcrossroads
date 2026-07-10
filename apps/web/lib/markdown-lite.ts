/**
 * Minimal Markdown → HTML for the published data report. Covers exactly the constructs the
 * report generator emits (headings, bold/italic/code, fenced code, tables, blockquotes, lists,
 * links) — NOT a general-purpose renderer. Input is escaped first, so even though the report is
 * our own trusted artifact this stays safe by construction.
 */

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Inline spans on already-escaped text: `code`, **bold**, *italic*, [text](https://url). */
function inline(s: string): string {
  return s
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
}

function tableHtml(rows: string[]): string {
  const cells = (line: string): string[] =>
    line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
  const head = cells(rows[0] ?? "");
  const body = rows.slice(2); // row 1 is the |---| separator
  let html = "<table><thead><tr>";
  for (const h of head) html += `<th>${inline(h)}</th>`;
  html += "</tr></thead><tbody>";
  for (const r of body) {
    html += "<tr>";
    for (const c of cells(r)) html += `<td>${inline(c)}</td>`;
    html += "</tr>";
  }
  return html + "</tbody></table>";
}

/** Convert the report's Markdown to HTML. Escapes all input before applying structure. */
export function markdownToHtml(md: string): string {
  const lines = md.split(/\r?\n/).map(esc);
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] as string;

    if (line.startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] as string).startsWith("```")) buf.push(lines[i] as string), i++;
      i++; // closing fence
      out.push(`<pre><code>${buf.join("\n")}</code></pre>`);
      continue;
    }
    if (/^###\s/.test(line)) { out.push(`<h3>${inline(line.slice(4))}</h3>`); i++; continue; }
    if (/^##\s/.test(line)) { out.push(`<h2>${inline(line.slice(3))}</h2>`); i++; continue; }
    if (/^#\s/.test(line)) { out.push(`<h1>${inline(line.slice(2))}</h1>`); i++; continue; }
    if (/^\s*\|/.test(line)) {
      const rows: string[] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i] as string)) rows.push(lines[i] as string), i++;
      out.push(tableHtml(rows));
      continue;
    }
    if (/^&gt;\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^&gt;\s?/.test(lines[i] as string))
        buf.push((lines[i] as string).replace(/^&gt;\s?/, "")), i++;
      out.push(`<blockquote><p>${inline(buf.join(" "))}</p></blockquote>`);
      continue;
    }
    if (/^-\s/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^-\s/.test(lines[i] as string))
        buf.push(`<li>${inline((lines[i] as string).slice(2))}</li>`), i++;
      out.push(`<ul>${buf.join("")}</ul>`);
      continue;
    }
    if (/^---+\s*$/.test(line)) { out.push("<hr>"); i++; continue; }
    if (line.trim() === "") { i++; continue; }
    out.push(`<p>${inline(line)}</p>`);
    i++;
  }
  return out.join("\n");
}
