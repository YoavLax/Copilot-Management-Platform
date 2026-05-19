const summary = await fetch('http://localhost:3001/api/copilot/model-usage/summary').then(r => r.json());
console.log('Total interactions:', summary.totalInteractions);
console.log('Unique users:', summary.uniqueUsers, '| Models:', summary.uniqueModels);
console.log('Date range:', summary.dateFrom, '->', summary.dateTo);
console.log('\nTop 10 models:');
summary.topModels.slice(0, 10).forEach(m =>
  console.log('  ' + m.model.padEnd(25) + 'interactions=' + String(m.interactions).padStart(6) + '  users=' + String(m.users).padStart(4))
);
