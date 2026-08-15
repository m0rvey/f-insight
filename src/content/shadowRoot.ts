import tailwindCss from '../styles/tailwind.css?inline';

const SHARED_CSS_TEXT = `
  *, ::before, ::after {
    box-sizing: border-box;
    border-width: 0;
    border-style: solid;
  }

  ${tailwindCss}

  .f-insight-container {
    font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #FFFFFF;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    contain: content;
  }
`;

// Shared CSSStyleSheet instance for zero-cost Shadow DOM style sharing
let sharedStyleSheet: CSSStyleSheet | null = null;

function getSharedStyleSheet(): CSSStyleSheet | null {
  if (typeof CSSStyleSheet !== 'undefined' && 'adoptedStyleSheets' in Document.prototype) {
    if (!sharedStyleSheet) {
      try {
        sharedStyleSheet = new CSSStyleSheet();
        sharedStyleSheet.replaceSync(SHARED_CSS_TEXT);
      } catch (err) {
        sharedStyleSheet = null;
      }
    }
    return sharedStyleSheet;
  }
  return null;
}

export function createShadowContainer(id: string): { host: HTMLElement; root: ShadowRoot; container: HTMLElement } {
  let host = document.getElementById(id);
  if (host && host.shadowRoot) {
    const existingContainer = host.shadowRoot.querySelector('.f-insight-container') as HTMLElement;
    if (existingContainer) {
      return { host, root: host.shadowRoot, container: existingContainer };
    }
  }

  if (host) {
    host.remove();
  }

  host = document.createElement('div');
  host.id = id;
  host.style.cssText = 'all: initial; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: block;';

  const root = host.attachShadow({ mode: 'open' });

  const sheet = getSharedStyleSheet();
  if (sheet) {
    root.adoptedStyleSheets = [sheet];
  } else {
    const styleEl = document.createElement('style');
    styleEl.textContent = SHARED_CSS_TEXT;
    root.appendChild(styleEl);
  }

  const container = document.createElement('div');
  container.className = 'f-insight-container';
  root.appendChild(container);

  return { host, root, container };
}
