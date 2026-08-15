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

  .glass-panel {
    background: rgba(18, 18, 20, 0.94) !important;
    backdrop-filter: blur(14px) !important;
    -webkit-backdrop-filter: blur(14px) !important;
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
  }

  .glass-card {
    background: rgba(27, 27, 30, 0.94) !important;
    backdrop-filter: blur(8px) !important;
    -webkit-backdrop-filter: blur(8px) !important;
    border: 1px solid rgba(255, 255, 255, 0.08) !important;
  }

  .shadow-card {
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.75) !important;
  }

  .shadow-glow-orange {
    box-shadow: 0 0 20px rgba(255, 85, 0, 0.35) !important;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: scale(0.98); }
    to { opacity: 1; transform: scale(1); }
  }

  .animate-fade-in {
    animation: fadeIn 0.15s ease-out forwards;
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
