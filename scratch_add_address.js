import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. types.ts
const typesPath = path.join(__dirname, 'src/types.ts');
let typesContent = fs.readFileSync(typesPath, 'utf-8');
if (!typesContent.includes('address?: string;')) {
  typesContent = typesContent.replace(
    'rightStr?: string;',
    'rightStr?: string;\n  address?: string;'
  );
  fs.writeFileSync(typesPath, typesContent);
}

// 2. utils.ts
const utilsPath = path.join(__dirname, 'src/utils.ts');
let utilsContent = fs.readFileSync(utilsPath, 'utf-8');
// Parse address
if (!utilsContent.includes('const addressTxt = colsCount > rc + 5 ? grid[r][rc + 5] : \'\';')) {
  utilsContent = utilsContent.replace(
    'const rightTxt = colsCount > rc + 4 ? grid[r][rc + 4] : \'\';',
    'const rightTxt = colsCount > rc + 4 ? grid[r][rc + 4] : \'\';\n    const addressTxt = colsCount > rc + 5 ? grid[r][rc + 5] : \'\';'
  );
  utilsContent = utilsContent.replace(
    'rightStr: rightTxt',
    'rightStr: rightTxt,\n      address: addressTxt'
  );
  // Export address
  utilsContent = utilsContent.replace(
    /const rowCells = \[\s*row\.rows,\s*row\.name \? `\$\{row\.name\} \(\$\{row\.purpose\}\)` : `\$\{row\.purpose\} \(\$\{row\.purpose\}\)`,\s*isRov \? 'ROV' : '',\s*leftStr,\s*rightStr,\s*'',\s*''\s*\];/g,
    'const rowCells = [\n      row.rows,\n      row.name ? `${row.name} (${row.purpose})` : `${row.purpose} (${row.purpose})`,\n      isRov ? \'ROV\' : \'\',\n      leftStr,\n      rightStr,\n      row.address || \'\',\n      \'\'\n    ];'
  );
  // Update col header in export
  utilsContent = utilsContent.replace(
    "'Notes', ''",
    "'Notes / Address', ''"
  );
  utilsContent = utilsContent.replace(
    "'', ''\n    ]",
    "'(e.g. (24, 114))', ''\n    ]"
  );
  // Update default config to have a sample address
  utilsContent = utilsContent.replace(
    "{ purpose: 'c1', rows: 1300, name: 'Active_Core_v2' }",
    "{ purpose: 'c1', rows: 1300, name: 'Active_Core_v2', address: '(Core Array Start)' }"
  );
  fs.writeFileSync(utilsPath, utilsContent);
}

// 3. ParamsForm.tsx
const paramsPath = path.join(__dirname, 'src/components/ParamsForm.tsx');
let paramsContent = fs.readFileSync(paramsPath, 'utf-8');
if (!paramsContent.includes('Address/Note')) {
  paramsContent = paramsContent.replace(
    'value={row.rightStr || \'\'}',
    'value={row.rightStr || \'\'}'
  );
  
  // Add the address input next to the purpose or padding. Let's add it to the top row next to Rows Count
  const addressHtml = `
                    <div className="flex-1 min-w-[120px]">
                      <label className="block text-[10px] font-mono uppercase text-slate-500 mb-1">Address/Note</label>
                      <input
                        type="text"
                        value={row.address || ''}
                        onChange={(e) => updateRowConfig(idx, 'address', e.target.value)}
                        className="w-full bg-white/60 border border-slate-300 rounded px-2 py-1 text-sm text-slate-800 font-mono placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        placeholder="e.g. (24, 114)"
                      />
                    </div>`;
  paramsContent = paramsContent.replace(
    /<div className="flex-1 min-w-\[80px\]">\s*<label className="block text-\[10px\] font-mono uppercase text-slate-500 mb-1">Rows<\/label>/,
    addressHtml + '\n                    <div className="flex-1 min-w-[80px]">\n                      <label className="block text-[10px] font-mono uppercase text-slate-500 mb-1">Rows</label>'
  );
  fs.writeFileSync(paramsPath, paramsContent);
}

// 4. CadViewer.tsx
const cadPath = path.join(__dirname, 'src/components/CadViewer.tsx');
let cadContent = fs.readFileSync(cadPath, 'utf-8');
if (!cadContent.includes('b.address')) {
  const addressBadgeHtml = `
                    {b.address && (
                      <div className="mt-2.5 pt-2 border-t border-glass-border">
                        <span className="bg-indigo-600/10 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-md text-xs font-mono font-bold flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
                          Address: {b.address}
                        </span>
                      </div>
                    )}`;
  cadContent = cadContent.replace(
    /<\/div>\s*<\/div>\s*\)\}\s*<\/div>\s*<\/div>\s*\);\s*\}\s*$/m,
    addressBadgeHtml + '\n                  </div>\n                </div>\n              )}\n            </div>\n          </div>\n  );\n}'
  );
  fs.writeFileSync(cadPath, cadContent);
}

console.log('Address feature successfully wired across the stack!');
