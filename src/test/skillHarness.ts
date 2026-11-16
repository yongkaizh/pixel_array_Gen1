// Executes the generated SKILL subset against an in-memory Cadence database.
// This checks emitted control flow and geometry; it does not emulate Virtuoso APIs in full.
type Node = { kind: string; value?: any; args?: Node[] };
class Parser {
  tokens: string[];
  i = 0;
  constructor(source: string) {
    this.tokens = source.match(/"(?:\\.|[^"\\])*"|;[^\n]*|~>|&&|\|\||==|!=|[A-Za-z_][\w]*\(|[A-Za-z_][\w]*|(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?|[^\s]/gi)!.filter(t => !t.startsWith(';'));
  }
  sequence(end?: string) {
    const nodes: Node[] = [];
    while (this.i < this.tokens.length && this.tokens[this.i] !== end) nodes.push(this.expression());
    if (end) this.i++;
    return nodes;
  }
  expression(min = 0): Node {
    const token = this.tokens[this.i++];
    let node: Node;
    if (token === '(' || token === '{') node = { kind: 'group', args: this.sequence(token === '(' ? ')' : '}') };
    else if (token === '-' || token === '+') node = { kind: 'unary', value: token, args: [this.expression(8)] };
    else if (token?.startsWith('"')) node = { kind: 'literal', value: JSON.parse(token) };
    else if (/^\d|^\.\d/.test(token)) node = { kind: 'literal', value: Number(token) };
    else if (token.endsWith('(')) node = { kind: 'call', value: token.slice(0, -1), args: this.sequence(')') };
    else node = { kind: 'name', value: token };
    const precedence: Record<string, number> = { '=': 1, '||': 2, '&&': 3, '==': 4, '!=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '~>': 9 };
    while (this.i < this.tokens.length) {
      const op = this.tokens[this.i];
      const p = precedence[op] ?? 0;
      if (!p || p < min) break;
      this.i++;
      const rhs = op === '~>' ? { kind: 'literal', value: this.tokens[this.i++] } : this.expression(op === '=' ? p : p + 1);
      node = { kind: 'binary', value: op, args: [node, rhs] };
    }
    return node;
  }
}

export type Box = [[number, number], [number, number]];
export function transformPoint(pt: number[], transform: any[]): number[] {
  const [[x, y], orient] = transform;
  const [u, v] = pt;
  const rotated: Record<string, number[]> = { R0: [u, v], R90: [-v, u], R180: [-u, -v], R270: [v, -u], MX: [u, -v], MY: [-u, v], MXR90: [v, u], MYR90: [-v, -u] };
  return [rotated[orient][0] + x, rotated[orient][1] + y];
}
export function transformBox(box: Box, transform: any[]): Box {
  const pts = [box[0], box[1], [box[0][0], box[1][1]], [box[1][0], box[0][1]]].map(pt => transformPoint(pt, transform));
  return [[Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1]))], [Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))]];
}

export function runSkill(code: string, masters: Record<string, { bBox: Box; shapes?: any[] }>) {
  const cv: any = { instances: [], mosaics: [], shapes: [] };
  const globals: Record<string, any> = { nil: null, t: true };
  const procedures = new Map<string, { params: Node[]; body: Node[] }>();
  const truth = (v: any) => v !== null && v !== false && v !== undefined && !(Array.isArray(v) && !v.length);
  const list = (...args: any[]) => args;
  const builtins: Record<string, (...args: any[]) => any> = {
    list, car: a => a?.[0] ?? null, cadr: a => a?.[1] ?? null, nth: (n, a) => a[n],
    caar: a => a[0][0], cadar: a => a[0][1], caadr: a => a[1][0], cadadr: a => a[1][1],
    cons: (a, b) => [a, ...(b ?? [])], min: Math.min, max: Math.max,
    listp: Array.isArray, member: (a, b) => b.includes(a),
    printf: () => null, ddGetObj: () => true, dbSave: () => true, dbClose: () => true,
    error: (message: string) => { throw new Error(message); },
    dbOpenCellViewByType: (lib, cell, _view, _type, mode) => mode === 'r' ? masters[`${lib}/${cell}`] : cv,
    dbCreateSimpleMosaic: (_cv, master, name, xy, orient, rows, columns, yp, xp) => {
      const inst = { name, xy, orient, rows, columns, master, libName: Object.keys(masters).find(k => masters[k] === master)!.split('/')[0], cellName: Object.keys(masters).find(k => masters[k] === master)!.split('/')[1] };
      cv.mosaics.push(inst);
      return inst;
    },
    dbDeleteObject: obj => { for (const key of ['mosaics', 'instances', 'shapes']) cv[key] = cv[key].filter((x: any) => x !== obj); },
    dbTransformPoint: transformPoint, dbTransformBBox: transformBox,
    dbShapeQuery: master => master.shapes ?? [],
    dbGetHierPathTransform: path => Array.isArray(path) ? path[0].transform : [[0, 0], 'R0', 1],
    dbCreateRect: (_cv, lpp, bBox) => { const shape = { lpp, bBox }; cv.shapes.push(shape); return shape; },
    dbReplaceProp: (obj, name, _type, value) => obj[name] = value,
  };
  function evaluate(node: Node, env: Record<string, any>): any {
    const args = node.args ?? [];
    const run = (n: Node) => evaluate(n, env);
    const sequence = (nodes: Node[]) => { let value: any; for (const n of nodes) value = run(n); return value; };
    if (node.kind === 'literal') return node.value;
    if (node.kind === 'name') return env[node.value] ?? null;
    if (node.kind === 'group') return sequence(args);
    if (node.kind === 'unary') return node.value === '-' ? -run(args[0]) : +run(args[0]);
    if (node.kind === 'binary') {
      const [lhs, rhs] = args;
      if (node.value === '=') {
        const value = run(rhs);
        if (lhs.kind === 'name') env[lhs.value] = value;
        else if (lhs.kind === 'binary' && lhs.value === '~>') run(lhs.args![0])[run(lhs.args![1])] = value;
        else throw new Error('Unsupported assignment');
        return value;
      }
      const a = run(lhs);
      if (node.value === '&&') return truth(a) && truth(run(rhs));
      if (node.value === '||') return truth(a) || truth(run(rhs));
      const b = run(rhs);
      switch (node.value) {
        case '~>': return a?.[b] ?? null;
        case '+': return a + b; case '-': return a - b; case '*': return a * b; case '/': return a / b;
        case '==': return a === b; case '!=': return a !== b;
      }
    }
    if (node.kind === 'call') {
      const name = node.value;
      if (name === 'procedure') { procedures.set(args[0].value, { params: args[0].args!, body: args.slice(1) }); return null; }
      if (name === 'let') {
        const local = Object.assign(Object.create(env), {});
        for (const variable of args[0].args!) local[variable.value] = null;
        let value: any;
        for (const body of args.slice(1)) value = evaluate(body, local);
        return value;
      }
      if (name === 'foreach') {
        let value: any;
        for (const item of run(args[1]) ?? []) { env[args[0].value] = item; value = sequence(args.slice(2)); }
        return value;
      }
      if (name === 'when' || name === 'unless') return truth(run(args[0])) === (name === 'when') ? sequence(args.slice(1)) : null;
      if (name === 'if') {
        const otherwise = args.findIndex(n => n.kind === 'name' && n.value === 'else');
        return truth(run(args[0])) ? sequence(args.slice(2, otherwise < 0 ? undefined : otherwise)) : otherwise < 0 ? null : sequence(args.slice(otherwise + 1));
      }
      if (name === 'unwindProtect') { try { return run(args[0]); } finally { sequence(args.slice(1)); } }
      if (builtins[name]) return builtins[name](...args.map(run));
      const proc = procedures.get(name);
      if (!proc) throw new Error(`Unknown SKILL function ${name}`);
      const local = Object.create(globals);
      proc.params.forEach((p, i) => local[p.value] = run(args[i]));
      let value: any;
      for (const body of proc.body) value = evaluate(body, local);
      return value;
    }
    throw new Error(`Unsupported AST ${node.kind}`);
  }
  for (const node of new Parser(code).sequence()) evaluate(node, globals);
  return cv;
}
