// Valida que los <script> inline de ava.html parsean sin syntax errors.
import { readFileSync } from 'node:fs';

const html = readFileSync('ava.html', 'utf8');
const blocks = html.match(/<script>([\s\S]*?)<\/script>/g) || [];
const inline = blocks.filter((x) => !/src=/.test(x));

let errs = 0;
inline.forEach((blk, i) => {
  const code = blk.replace(/^<script>/, '').replace(/<\/script>$/, '');
  try {
    new Function(code);
  } catch (e) {
    errs++;
    console.error(`Block ${i}: ${e.message}`);
  }
});

if (errs > 0) process.exit(1);
console.log(`inline scripts: ${inline.length} — no syntax errors`);
