export const MODEL_COLORS: Record<string, string> = {
  'claude-4.6-sonnet':  '#a78bfa',
  'claude-sonnet-4.6':  '#a78bfa',
  'claude-4.5-sonnet':  '#c4b5fd',
  'claude-sonnet-4.5':  '#c4b5fd',
  'claude-4.5-haiku':   '#ddd6fe',
  'claude-haiku-4.5':   '#ddd6fe',
  'claude-opus-4.5':    '#7c3aed',
  'claude-opus-4.6':    '#6d28d9',
  'gpt-4o':             '#34d399',
  'gpt-4.1':            '#6ee7b7',
  'gpt-5.2':            '#10b981',
  'gpt-5.4':            '#059669',
  'gpt-5.5':            '#047857',
  'gpt-5.2-codex':      '#34d399',
  'gpt-5.3-codex':      '#6ee7b7',
  'gpt-5.4-mini':       '#a7f3d0',
  'gpt-5-mini':         '#bbf7d0',
  'gemini-2.5-pro':     '#60a5fa',
  'gemini-3.0-flash':   '#93c5fd',
  'gemini-3.1-pro':     '#3b82f6',
  'grok-code-fast-1':   '#fbbf24',
  'DeepSeek-V3.2':      '#f87171',
  'raptor-mini':        '#fb923c',
  'auto':               '#94a3b8',
  'others':             '#64748b',
  'unknown':            '#475569',
};

export function modelColor(model: string): string {
  return MODEL_COLORS[model] ?? '#94a3b8';
}

export function isOpusModel(model: string): boolean {
  return model.toLowerCase().includes('opus');
}
