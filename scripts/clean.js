const fs = require('fs');
const path = require('path');

function rmrf(p) {
  if (!fs.existsSync(p)) return;
  try {
    fs.rmSync(p, { recursive: true, force: true });
    console.log('removed', p);
  } catch (e) {
    console.error('failed to remove', p, e.message);
  }
}

const root = path.resolve(__dirname, '..');
const targets = [
  path.join(root, 'dist'),
  path.join(root, '.expo'),
  path.join(root, '.expo-cache'),
  path.join(root, 'node_modules', '.cache'),
  path.join(root, 'temp'),
];

for (const t of targets) rmrf(t);
console.log('clean: done');
