import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Component classes global replacements
  // Backgrounds and text
  content = content.replace(/bg-\[\#E4E3E0\]/g, 'bg-glass-bg');
  content = content.replace(/text-\[\#141414\]/g, 'text-glass-text');
  content = content.replace(/bg-white/g, 'bg-glass-panel');
  content = content.replace(/bg-\[\#141414\]/g, 'bg-white/10');
  
  // Borders
  content = content.replace(/border-2 border-\[\#141414\]/g, 'border border-glass-border');
  content = content.replace(/border border-\[\#141414\]/g, 'border border-glass-border');
  content = content.replace(/border-b-2 border-\[\#141414\]/g, 'border-b border-glass-border');
  
  // Shadows (remove brutalist shadows)
  content = content.replace(/shadow-\[.*?\]/g, 'shadow-lg');
  
  // Rounded corners (change from rounded-none to rounded-lg or xl)
  content = content.replace(/rounded-none/g, 'rounded-lg');
  
  // Text opacity
  content = content.replace(/text-\[\#141414\]\/[0-9]+/g, 'text-glass-muted');
  
  // Interactive elements
  content = content.replace(/hover:bg-\[\#E4E3E0\]/g, 'hover:bg-white/5');
  content = content.replace(/hover:text-\[\#141414\]/g, 'hover:text-white');
  content = content.replace(/active:translate-y-px/g, 'active:scale-95');
  
  // Specific tweaks
  content = content.replace(/bg-amber-500/g, 'bg-neon-emerald');
  content = content.replace(/text-amber-600/g, 'text-neon-emerald');
  content = content.replace(/bg-red-600/g, 'bg-neon-rose');
  
  // Fix CadViewer grid background
  content = content.replace(/bg-\[linear-gradient.*?\]/g, "bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)]");
  
  fs.writeFileSync(filePath, content);
}

const dir = path.join(__dirname, 'src/components');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  replaceInFile(path.join(dir, file));
}

console.log('UI refactor completed!');
