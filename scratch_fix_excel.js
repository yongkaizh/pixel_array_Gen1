import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'src/components/ExcelManager.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// Fix big white area and strange excel sheet colors
content = content.replace(/bg-\[\#F7F6F2\]/g, 'bg-glass-panel');
content = content.replace(/bg-\[\#F0F0F0\]/g, 'bg-glass-bg');
content = content.replace(/bg-\[\#FAFAFA\]/g, 'bg-glass-bg');
content = content.replace(/border-\[\#141414\]/g, 'border-glass-border');
content = content.replace(/border-\[\#E4E3E0\]/g, 'border-glass-border');
content = content.replace(/text-\[\#888\]/g, 'text-glass-muted');
content = content.replace(/bg-amber-50/g, 'bg-amber-500/10 text-amber-200');
content = content.replace(/bg-white\/10\/10/g, 'bg-white/10');

// Fix specific text colors in the table that are hard to read
content = content.replace(/text-amber-950/g, 'text-amber-400');
content = content.replace(/text-amber-800/g, 'text-amber-300');
content = content.replace(/text-rose-900/g, 'text-rose-200');
content = content.replace(/text-rose-800/g, 'text-rose-400');

fs.writeFileSync(filePath, content);
console.log('Fixed ExcelManager dark mode styling!');
