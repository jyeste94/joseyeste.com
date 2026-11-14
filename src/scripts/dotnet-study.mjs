/* No dependencies, fetches, storage or global content changes. */
const instances = new Map();
let nextDialogId = 0;

function setupNavigation(root, layout, signal) {
  const toc = root.querySelector('details#indice');
  const slot = layout.querySelector('[data-study-toc-slot]');
  const sidebar = slot?.closest('.study-sidebar');
  if (!toc || !slot || !sidebar) return;

  const originalOpen = toc.open;
  let mobileOpen = originalOpen;
  let desktop = false;
  let frame = 0;
  let activePart = null;
  const placeholder = document.createComment('Original study index position');
  toc.before(placeholder);

  const partIds = ['parte-i', 'parte-ii', 'parte-iii', 'parte-iv', 'parte-v'];
  const labels = [...toc.querySelectorAll('strong')]
    .filter((label) => /^Parte\s+[IVX]+\s*[—–-]/i.test(label.textContent.trim()));
  const parts = partIds.flatMap((id, index) => {
    const boundary = root.querySelector(`#${id}`);
    const label = labels[index];
    if (!boundary || !label) return [];
    const link = document.createElement('a');
    link.href = `#${id}`;
    label.before(link);
    link.append(label);
    const group = link.closest('p');
    group?.classList.add('study-toc-part');
    return [{ boundary, label, link, group }];
  });

  // Read all five boundaries, not intersection ratios of potentially huge parts.
  // This also handles reverse jumps and leaves the executive introduction inactive.
  function updateActivePart() {
    frame = 0;
    const offset = parts.length
      ? parseFloat(getComputedStyle(parts[0].boundary).scrollMarginBlockStart) || 0
      : 0;
    let nextPart = null;
    for (const part of parts) {
      if (part.boundary.getBoundingClientRect().top <= offset + 1) nextPart = part;
    }
    if (nextPart === activePart) return;
    activePart?.link.removeAttribute('aria-current');
    activePart?.group?.classList.remove('study-toc-active');
    nextPart?.link.setAttribute('aria-current', 'location');
    nextPart?.group?.classList.add('study-toc-active');
    activePart = nextPart;
    if (desktop && nextPart && !sidebar.contains(document.activeElement)) {
      const bounds = sidebar.getBoundingClientRect();
      const current = nextPart.link.getBoundingClientRect();
      if (current.top < bounds.top || current.bottom > bounds.bottom) {
        sidebar.scrollTop += current.top - bounds.top - 16;
      }
    }
  }

  function scheduleActivePart() {
    if (!frame) frame = requestAnimationFrame(updateActivePart);
  }

  const media = window.matchMedia('(min-width: 1024px)');
  function placeIndex() {
    if (media.matches !== desktop) {
      const focused = toc.contains(document.activeElement) ? document.activeElement : null;
      desktop = media.matches;
      if (desktop) {
        mobileOpen = toc.open;
        sidebar.hidden = false;
        slot.append(toc);
        toc.open = true;
        layout.dataset.studyToc = 'desktop';
      } else {
        placeholder.after(toc);
        toc.open = mobileOpen;
        sidebar.hidden = true;
        delete layout.dataset.studyToc;
      }
      if (focused) {
        const focusTarget = toc.open ? focused : toc.querySelector('summary');
        focusTarget?.focus({ preventScroll: true });
      }
    }
    scheduleActivePart();
  }

  media.addEventListener('change', placeIndex, { signal });
  window.addEventListener('scroll', scheduleActivePart, { passive: true, signal });
  window.addEventListener('resize', scheduleActivePart, { passive: true, signal });
  root.addEventListener('load', scheduleActivePart, { capture: true, signal });
  const resizeObserver = new ResizeObserver(scheduleActivePart);
  resizeObserver.observe(root);
  placeIndex();

  return () => {
    if (frame) cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    placeholder.replaceWith(toc);
    toc.open = originalOpen;
    sidebar.hidden = true;
    delete layout.dataset.studyToc;
    for (const { label, link, group } of parts) {
      link.replaceWith(label);
      group?.classList.remove('study-toc-part', 'study-toc-active');
      if (group?.getAttribute('class') === '') group.removeAttribute('class');
    }
  };
}

function setup(root) {
  const abort = new AbortController();
  const { signal } = abort;
  const changes = [];
  const layout = root.closest('.dotnet-study-layout') ?? root;
  const disposeNavigation = setupNavigation(root, layout, signal);
  if (disposeNavigation) changes.push(disposeNavigation);
  let dialog;
  let opener;
  let disposing = false;
  let enlargedImage;
  let originalLink;
  let title;
  let viewport;
  let zoom;
  let close;

  function makeDialog() {
    const id = `dotnet-study-image-${++nextDialogId}`;
    dialog = document.createElement('dialog');
    dialog.className = 'study-image-dialog';
    dialog.setAttribute('aria-labelledby', `${id}-title`);
    const header = document.createElement('header');
    title = document.createElement('strong');
    title.id = `${id}-title`;
    const controls = document.createElement('div');
    zoom = document.createElement('button');
    zoom.type = 'button';
    zoom.textContent = 'Tamaño real';
    zoom.setAttribute('aria-pressed', 'false');
    zoom.setAttribute('aria-controls', `${id}-viewport`);
    close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Cerrar imagen';
    close.autofocus = true;
    controls.append(zoom, ' ', close);
    header.append(title, controls);
    const figure = document.createElement('figure');
    viewport = document.createElement('div');
    viewport.id = `${id}-viewport`;
    viewport.className = 'study-image-viewport';
    viewport.tabIndex = 0;
    viewport.setAttribute('role', 'region');
    viewport.setAttribute('aria-label', 'Imagen ampliada: desplazamiento horizontal y vertical en tamaño real');
    enlargedImage = document.createElement('img');
    viewport.append(enlargedImage);
    const caption = document.createElement('figcaption');
    originalLink = document.createElement('a');
    originalLink.textContent = 'Abrir original PNG';
    caption.append('Esquema o evidencia del artículo, sin modificar. ', originalLink);
    figure.append(viewport, caption);
    dialog.append(header, figure);
    root.append(dialog);
    close.addEventListener('click', () => dialog.close(), { signal });
    zoom.addEventListener('click', () => {
      const natural = zoom.getAttribute('aria-pressed') !== 'true';
      zoom.setAttribute('aria-pressed', String(natural));
      zoom.textContent = natural ? 'Ajustar a la ventana' : 'Tamaño real';
      viewport.dataset.zoom = natural ? 'natural' : 'fit';
      viewport.scrollTo(0, 0);
    }, { signal });
    // Keep Tab at the dialog's endpoints; Escape retains native behavior.
    dialog.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;
      if (event.shiftKey && document.activeElement === zoom) {
        event.preventDefault();
        originalLink.focus();
      } else if (!event.shiftKey && document.activeElement === originalLink) {
        event.preventDefault();
        zoom.focus();
      }
    }, { signal });
    dialog.addEventListener('close', () => {
      if (!disposing && opener?.isConnected) opener.focus({ preventScroll: true });
      opener = undefined;
    }, { signal });
  }

  function findImage(link) {
    let target;
    try {
      target = new URL(link.href);
    } catch {
      return;
    }
    if (!['http:', 'https:', 'file:'].includes(target.protocol) || !/\.png$/i.test(target.pathname)) return;
    return [...root.querySelectorAll('img')].find((image) => {
      if (dialog?.contains(image)) return false;
      return image.src === target.href;
    });
  }

  root.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link || !root.contains(link) || dialog?.contains(link) || link.hasAttribute('download') || link.target) return;
    if (typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal) return;
    const image = findImage(link);
    if (!image) return;
    if (!dialog) makeDialog();
    title.textContent = image.alt || 'Imagen del artículo';
    enlargedImage.alt = image.alt || 'Imagen del artículo';
    enlargedImage.src = link.href;
    originalLink.href = link.href;
    viewport.dataset.zoom = 'fit';
    viewport.scrollTo(0, 0);
    zoom.textContent = 'Tamaño real';
    zoom.setAttribute('aria-pressed', 'false');
    opener = link;
    try {
      dialog.showModal();
    } catch {
      opener = undefined;
      return; // Keep the normal image link if the native enhancement cannot open.
    }
    event.preventDefault();
    close.focus();
  }, { signal });

  // Reveal the native TOC or evidence catalogue before fragment scrolling.
  function revealFragment(hash) {
    let id;
    try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target || !layout.contains(target)) return;
    for (let details = target.closest('details'); details; details = details.parentElement?.closest('details')) {
      details.open = true;
    }
    if (target.matches('.study-evidence-row')) target.focus({ preventScroll: true });
  }
  layout.addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
    if (link) revealFragment(link.hash);
  }, { signal });
  window.addEventListener('hashchange', () => revealFragment(location.hash), { signal });
  revealFragment(location.hash);

  // The build-time adapter is preferred; these wrappers also help plain renderers.
  root.querySelectorAll('table').forEach((table, index) => {
    if (table.closest('.study-table-scroll')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'study-table-scroll';
    wrapper.tabIndex = 0;
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', `Tabla ${index + 1}: desplazamiento horizontal si es necesario`);
    table.before(wrapper);
    wrapper.append(table);
    const hadClass = table.classList.contains('study-wrapped-table');
    table.classList.add('study-wrapped-table');
    changes.push(() => {
      wrapper.before(table);
      wrapper.remove();
      if (!hadClass) table.classList.remove('study-wrapped-table');
    });
  });
  root.querySelectorAll('pre').forEach((pre, index) => {
    const oldTabIndex = pre.getAttribute('tabindex');
    const oldLabel = pre.getAttribute('aria-label');
    if (oldTabIndex === null) pre.tabIndex = 0;
    if (oldLabel === null) pre.setAttribute('aria-label', `Código ${index + 1}: desplazamiento horizontal si es necesario`);
    changes.push(() => {
      if (oldTabIndex === null) pre.removeAttribute('tabindex');
      if (oldLabel === null) pre.removeAttribute('aria-label');
    });
  });

  return () => {
    disposing = true;
    abort.abort();
    if (dialog?.open) dialog.close();
    dialog?.remove();
    for (const undo of changes.reverse()) undo();
  };
}

function initStudies() {
  for (const [root, dispose] of instances) {
    if (!root.isConnected) {
      dispose();
      instances.delete(root);
    }
  }
  document.querySelectorAll('article.dotnet-study').forEach((root) => {
    if (!instances.has(root)) instances.set(root, setup(root));
  });
}

function destroyStudies() {
  for (const dispose of instances.values()) dispose();
  instances.clear();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initStudies, { once: true });
  else initStudies();
  document.addEventListener('astro:page-load', initStudies);
  document.addEventListener('astro:before-swap', destroyStudies);
}
