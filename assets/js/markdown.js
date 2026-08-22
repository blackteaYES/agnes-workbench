'use strict';

// 安全 Markdown 渲染器：输入整体转义后再做语法转换，
// 输出只包含渲染器自身生成的标签，结构上不可能注入 HTML 或 SVG。
// 覆盖常用子集：标题、粗斜体、行内代码、代码块、列表、引用、表格、链接、分割线。
// Markdown 图片语法按链接显示，不直接加载远程图片。

const MARKDOWN_SLOT = '\u0000';

function markdownSafeLinkUrl(url) {
  const value = String(url || '').trim();
  return /^https?:\/\//i.test(value) ? value : '';
}

function markdownUnescape(value) {
  return String(value || '')
    .replaceAll('&#039;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&gt;', '>')
    .replaceAll('&lt;', '<')
    .replaceAll('&amp;', '&');
}

function markdownInline(text) {
  const slots = [];
  const keep = (html) => {
    slots.push(html);
    return `${MARKDOWN_SLOT}${slots.length - 1}${MARKDOWN_SLOT}`;
  };

  let out = String(text || '');
  out = out.replace(/(`+)([\s\S]*?)\1/g, (match, ticks, code) => keep(`<code class="md-code-inline">${code.replace(/^ | $/g, '')}</code>`));
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (match, alt, url) => {
    const safe = markdownSafeLinkUrl(url);
    if (!safe) return match;
    const label = alt || '图片';
    const raw = `![${markdownUnescape(alt)}](${markdownUnescape(safe)})`;
    return keep(`<span class="md-image"><button type="button" class="md-image-preview" data-md-image="${safe}" aria-label="预览图片 ${label}"><img class="md-image-media" src="${safe}" alt="${label}" loading="lazy" decoding="async"><span class="md-image-error" hidden><i data-lucide="image-off" aria-hidden="true"></i><span>图片无法显示</span></span></button><button type="button" class="md-image-copy" data-md-copy="${escapeHtml(raw)}"><i data-lucide="copy" aria-hidden="true"></i>复制 Markdown</button></span>`);
  });
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, url) => {
    const safe = markdownSafeLinkUrl(url);
    return safe ? keep(`<a href="${safe}" target="_blank" rel="noopener noreferrer">${label}</a>`) : match;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  out = out.replace(/(^|[^_\w])_([^_\n]+)_(?!\w)/g, '$1<em>$2</em>');
  out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  out = out.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (match, lead, url) => `${lead}${keep(`<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`)}`);

  const pattern = new RegExp(`${MARKDOWN_SLOT}(\\d+)${MARKDOWN_SLOT}`, 'g');
  return out.replace(pattern, (match, index) => slots[Number(index)] ?? match);
}

function markdownTableRows(line) {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return null;
  const body = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  return body.split('|').map((cell) => cell.trim());
}

function markdownTableAligns(cells) {
  return cells.map((cell) => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    return 'left';
  });
}

function renderMarkdownText(raw) {
  const lines = escapeHtml(String(raw || '')).split(/\r?\n/);
  const blocks = [];
  let paragraph = [];
  let list = null;
  let quote = [];
  let fence = null;
  let table = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(`<p>${markdownInline(paragraph.join('<br>'))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    const tag = list.ordered ? 'ol' : 'ul';
    blocks.push(`<${tag}>${list.items.map((item) => `<li>${markdownInline(item)}</li>`).join('')}</${tag}>`);
    list = null;
  };
  const flushQuote = () => {
    if (!quote.length) return;
    blocks.push(`<blockquote>${markdownInline(quote.join('<br>'))}</blockquote>`);
    quote = [];
  };
  const flushTable = () => {
    if (!table) return;
    const head = table.header.map((cell, index) => `<th style="text-align:${table.aligns[index] || 'left'}">${markdownInline(cell)}</th>`).join('');
    const body = table.rows.map((row) => `<tr>${row.map((cell, index) => `<td style="text-align:${table.aligns[index] || 'left'}">${markdownInline(cell)}</td>`).join('')}</tr>`).join('');
    blocks.push(`<div class="md-table-wrap"><table class="md-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`);
    table = null;
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
    flushTable();
  };

  lines.forEach((line) => {
    const fenceMatch = line.match(/^\s*(```|~~~)\s*([\w-]*)\s*$/);
    if (fence) {
      if (fenceMatch && fenceMatch[1] === fence.marker) {
        const lang = fence.lang.replace(/[^\w-]/g, '');
        if (lang === 'markdown' || lang === 'md') {
          // AI 常用 ```markdown 包裹整段回复表示排版内容，这类块按 Markdown 递归渲染
          blocks.push(renderMarkdownText(fence.lines.join('\n')));
        } else {
          blocks.push(`<pre class="md-code-block"${lang ? ` data-lang="${lang}"` : ''}><code>${fence.lines.join('\n')}</code></pre>`);
        }
        fence = null;
      } else {
        fence.lines.push(line);
      }
      return;
    }
    if (fenceMatch) {
      flushAll();
      fence = { marker: fenceMatch[1], lang: fenceMatch[2] || '', lines: [] };
      return;
    }

    if (!line.trim()) {
      flushAll();
      return;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushAll();
      const level = heading[1].length;
      blocks.push(`<h${level} class="md-heading">${markdownInline(heading[2].trim())}</h${level}>`);
      return;
    }

    if (/^\s*([-*_])\s*(?:\1\s*){2,}$/.test(line)) {
      flushAll();
      blocks.push('<hr class="md-hr">');
      return;
    }

    const quoted = line.match(/^\s*&gt;\s?(.*)$/);
    if (quoted) {
      flushParagraph();
      flushList();
      flushTable();
      quote.push(quoted[1]);
      return;
    }

    if (table && /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes('-')) {
      const cells = markdownTableRows(line);
      if (cells && cells.length) {
        table.aligns = markdownTableAligns(cells);
        return;
      }
    }
    const tableCells = markdownTableRows(line);
    if (tableCells && tableCells.length > 1) {
      if (table) {
        table.rows.push(tableCells);
      } else {
        flushParagraph();
        flushList();
        flushQuote();
        table = { header: tableCells, aligns: tableCells.map(() => 'left'), rows: [] };
      }
      return;
    }
    if (table) flushTable();

    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || ordered) {
      flushParagraph();
      flushQuote();
      const itemText = (bullet || ordered)[1];
      const orderedList = Boolean(ordered);
      if (!list || list.ordered !== orderedList) {
        flushList();
        list = { ordered: orderedList, items: [] };
      }
      list.items.push(itemText);
      return;
    }
    if (list && /^\s{2,}\S/.test(line)) {
      list.items[list.items.length - 1] += `<br>${line.trim()}`;
      return;
    }

    flushList();
    paragraph.push(line.trim());
  });

  if (fence) {
    const lang = fence.lang.replace(/[^\w-]/g, '');
    if (lang === 'markdown' || lang === 'md') blocks.push(renderMarkdownText(fence.lines.join('\n')));
    else blocks.push(`<pre class="md-code-block"><code>${fence.lines.join('\n')}</code></pre>`);
  }
  flushAll();
  return blocks.join('');
}
