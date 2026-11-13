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
