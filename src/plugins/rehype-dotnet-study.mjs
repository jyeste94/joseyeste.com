import { readFileSync } from 'node:fs';

const metadata = JSON.parse(readFileSync(new URL('../data/dotnet-study-images.json', import.meta.url), 'utf8'));
const images = new Map(metadata.images.map((image) => [image.src, image]));
const evidence = new Map(metadata.evidenceReferences.map((reference) => [decodeURI(reference.sourceHref), reference]));
const title = '.NET 10 vs .NET 11: análisis de rendimiento y cambios internos';
const text = (node) => node.value ?? (node.children ?? []).map(text).join('');

// Astro runs rehype before its raw-HTML pass. Shiki already supplies tabindex=0
// to code blocks; tables and Markdown images are HAST elements at this stage.
export default function rehypeDotnetStudy() {
  return (tree, file) => {
    if (file.data.astro?.frontmatter?.title !== title) return;
    // Derive both responsive TOCs from the canonical Markdown index at build time.
    const parts = [];
    let collectingIndex = false;
    let chapterCount = 0;
    for (const node of tree.children) {
      if (node.type === 'raw' && /<details\s+id="indice">/.test(node.value)) {
        collectingIndex = true;
        continue;
      }
      if (!collectingIndex) continue;
      if (node.type === 'raw' && /<\/details>/.test(node.value)) break;
      if (node.type !== 'element') continue;
      const label = node.tagName === 'p'
        ? node.children.find((child) => child.tagName === 'strong' && /^Parte\s+[IVX]+\s+—/.test(text(child)))
        : null;
      if (label) {
        const id = `parte-${text(label).match(/^Parte\s+([IVX]+)/)[1].toLowerCase()}`;
        parts.push({ id, label: text(label), start: chapterCount + 1, chapters: [] });
        node.properties ??= {};
        node.properties.className = ['study-toc-part'];
        node.children = node.children.map((child) => child === label
          ? { type: 'element', tagName: 'a', properties: { href: `#${id}` }, children: [label] }
          : child);
      }
      if (node.tagName === 'ol' && parts.length) {
        for (const item of node.children.filter((child) => child.tagName === 'li')) {
          const link = item.children.find((child) => child.tagName === 'a');
          if (!link?.properties?.href?.startsWith('#')) file.fail('Invalid study chapter link.');
          parts.at(-1).chapters.push({ href: link.properties.href, label: text(link) });
          chapterCount++;
        }
      }
    }
    if (parts.map((part) => part.id).join(',') !== 'parte-i,parte-ii,parte-iii,parte-iv,parte-v' || chapterCount !== 24) {
      file.fail('The study index must contain five parts and 24 chapters.');
    }
    file.data.astro.frontmatter.studyToc = parts;
    let section = title;
    let tableIndex = 0;
    function visit(parent) {
      if (!parent.children) return;
      for (let index = 0; index < parent.children.length; index++) {
        const node = parent.children[index];
        if (node.type !== 'element') continue;
        node.properties ??= {};
        if (/^h[23]$/.test(node.tagName)) section = text(node);
        if (node.tagName === 'a' && typeof node.properties.href === 'string') {
          const href = node.properties.href;
          if (href && !/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(href)) {
            const reference = evidence.get(decodeURI(href));
            if (!reference?.url) file.fail(`Unmapped public study evidence reference: ${href}`);
            node.properties.href = reference.url;
          }
        }
        if (node.tagName === 'img' && typeof node.properties.src === 'string') {
          const image = images.get(node.properties.src);
          if (!image) file.fail(`Study image is missing provenance and dimensions: ${node.properties.src}`);
          node.properties.width = image.width;
          node.properties.height = image.height;
          node.properties.loading = 'lazy';
          node.properties.decoding = 'async';
        }
        visit(node);
        if (node.tagName === 'table') {
          node.properties.className ??= [];
          node.properties.className.push('study-wrapped-table');
          parent.children[index] = {
            type: 'element', tagName: 'div',
            properties: {
              className: ['study-table-scroll'], tabIndex: 0, role: 'region',
              ariaLabel: `Tabla ${++tableIndex}. ${section}. Desplazamiento horizontal si es necesario`,
            },
            children: [node],
          };
        }
      }
    }
    visit(tree);
  };
}
