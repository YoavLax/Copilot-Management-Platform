import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import type { EditorCount } from '../../types';

const EDITOR_COLORS: Record<string, string> = {
  vscode:                  '#388bfd',
  jetbrains:               '#3fb950',
  visualstudio:            '#d2a8ff',
  vim:                     '#f0883e',
  neovim:                  '#56d364',
  xcode:                   '#79c0ff',
  eclipse:                 '#fbbf24',
  emacs:                   '#a78bfa',
  'copilot-pr-review':     '#e879f9',
  'copilot-cli':           '#67e8f9',
  'copilot-chat-platform': '#60a5fa',
  'copilot-developer':     '#fb923c',
  'unknown-chat':          '#9ca3af',
  'unknown-completions':   '#6b7280',
  'no-activity':           '#374151',
  unknown:                 '#4b5563',
};

const EDITOR_LABELS: Record<string, string> = {
  vscode:                  'VS Code',
  jetbrains:               'JetBrains',
  visualstudio:            'Visual Studio',
  vim:                     'Vim',
  neovim:                  'Neovim',
  xcode:                   'Xcode',
  eclipse:                 'Eclipse',
  emacs:                   'Emacs',
  'copilot-pr-review':     'PR Review',
  'copilot-cli':           'Copilot CLI',
  'copilot-chat-platform': 'GitHub.com Chat',
  'copilot-developer':     'Extensions / API',
  'unknown-chat':          'Unknown IDE (Chat)',
  'unknown-completions':   'Unknown IDE (Completions)',
  'no-activity':           'No Activity',
  unknown:                 'Unknown',
};

interface Props {
  data: EditorCount[];
}

export function EditorChart({ data }: Props) {
  const formatted = data.map((d) => ({
    name: EDITOR_LABELS[d.editor] ?? d.editor,
    seats: d.seats,
    color: EDITOR_COLORS[d.editor] ?? '#7d8590',
  }));

  const barHeight = 36;
  const chartHeight = formatted.length * barHeight;

  return (
    <div className="gh-card p-4">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={formatted} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
          <XAxis type="number" tick={{ fill: '#7d8590', fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fill: '#c9d1d9', fontSize: 12 }} tickLine={false} axisLine={false} width={150} interval={0} />
          <Tooltip
            contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6, fontSize: 12 }}
            labelStyle={{ color: '#e6edf3', fontWeight: 600 }}
            itemStyle={{ color: '#e6edf3' }}
            formatter={(v: number) => [v + ' seats', 'Seats']}
          />
          <Bar dataKey="seats" radius={[0, 4, 4, 0]}>
            {formatted.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
