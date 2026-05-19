import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import type { FeatureCount } from '../../types';

const FEATURE_COLORS: Record<string, string> = {
  'IDE Completions':    '#388bfd',
  'IDE Chat':           '#3fb950',
  'PR Review':          '#d2a8ff',
  'Copilot CLI':        '#f0883e',
  'GitHub.com Chat':    '#79c0ff',
  'Extensions / API':   '#56d364',
  'Other':              '#7d8590',
  'Unknown':            '#484f58',
};

interface Props {
  data: FeatureCount[];
}

export function FeatureChart({ data }: Props) {
  const formatted = data.map((d) => ({
    name: d.feature,
    seats: d.seats,
    color: FEATURE_COLORS[d.feature] ?? '#7d8590',
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
            formatter={(v: number) => [v.toLocaleString() + ' users', 'Users']}
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
