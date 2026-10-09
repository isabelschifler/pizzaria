
 const L = (() => {
 // 1. O TRADUTOR (TOKENIZER E PARSER)
  // Transforma o texto digitado (ex: "A -> B") em uma árvore que o PC entende
  // =========================================================================

  const tok = (s) => {
    const t = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      const m = [['<->', 'iff'], ['<=>', 'iff'], ['->', 'imp'], ['=>', 'imp'], ['↔', 'iff'], ['→', 'imp']].find(([x]) => s.startsWith(x, i));
      if (m) { t.push({ k: m[1] }); i += m[0].length; continue; }
      if ('¬~!'.includes(c)) { t.push({ k: 'not' }); i++; continue; }
      if ('∧&'.includes(c)) { t.push({ k: 'and' }); i++; continue; }
      if ('∨|'.includes(c)) { t.push({ k: 'or' }); i++; continue; }
      if (c === '(' || c === ')') { t.push({ k: c }); i++; continue; }
      if (/[A-Za-z_]/.test(c)) {
        let j = i;
        while (j < s.length && /\w/.test(s[j])) j++;
        t.push({ k: 'var', n: s.slice(i, j) });
        i = j;
        continue;
      }
      throw Error('Símbolo inesperado "' + c + '"');
    }
    return t;
  };

  const parse = (s) => {
    const t = tok(s);
    let p = 0;
    const k = () => p < t.length ? t[p].k : 'fim';

    const bicondicional = () => { let x = implica(); while (k() === 'iff') { p++; x = { t: 'iff', a: x, b: implica() }; } return x; };
    const implica = () => { const x = ou(); if (k() === 'imp') { p++; return { t: 'imp', a: x, b: implica() }; } return x; };
    const ou = () => { let x = e(); while (k() === 'or') { p++; x = { t: 'or', a: x, b: e() }; } return x; };
    const e = () => { let x = nega(); while (k() === 'and') { p++; x = { t: 'and', a: x, b: nega() }; } return x; };
    const nega = () => {
      if (k() === 'not') { p++; return { t: 'not', a: nega() }; }
      if (k() === 'var') return { t: 'var', n: t[p++].n };
      if (k() === '(') {
        p++;
        const x = bicondicional();
        if (k() !== ')') throw Error('Faltou ")"');
        p++;
        return x;
      }
      throw Error('Esperava variável ou "("');
    };

    if (!t.length) throw Error('Fórmula vazia');
    const x = bicondicional();
    if (p < t.length) throw Error('Sobrou texto no fim da fórmula');
    return x;
  };

  const P = { iff: 1, imp: 2, or: 3, and: 4, not: 5, var: 6 };
  const S = { iff: '↔', imp: '→', or: '∨', and: '∧' };

  const str = (f) => {
    if (f.t === 'var') return f.n;
    if (f.t === 'not') return '¬' + (P[f.a.t] < 5 ? '(' + str(f.a) + ')' : str(f.a));
    const p = P[f.t], pa = P[f.a.t], pb = P[f.b.t], l = str(f.a), r = str(f.b);
    return ((pa < p || (pa === p && f.t === 'imp')) ? '(' + l + ')' : l) + ' ' + S[f.t] + ' ' + ((pb < p || (pb === p && f.t === 'iff')) ? '(' + r + ')' : r);
  };

  const pref = (f) => f.t === 'var' ? f.n : f.t === 'not' ? '¬ ' + pref(f.a) : S[f.t] + ' ' + pref(f.a) + ' ' + pref(f.b);

  // =========================================================================
  // 2. TESTADOR (FORÇA BRUTA E TABELA VERDADE)
  // =========================================================================

  const ev = (f, v) => {
    switch (f.t) {
      case 'var': return !!v[f.n];
      case 'not': return !ev(f.a, v);
      case 'and': return ev(f.a, v) && ev(f.b, v);
      case 'or': return ev(f.a, v) || ev(f.b, v);
      case 'imp': return !ev(f.a, v) || ev(f.b, v);
      case 'iff': return ev(f.a, v) === ev(f.b, v);
    }
  };

  const vars = (f) => {
    const s = new Set();
    (function r(g) {
      if (g.t === 'var') s.add(g.n);
      else { r(g.a); if (g.b) r(g.b); }
    })(f);
    return [...s].sort();
  };

  const linha = (vs, i) => Object.fromEntries(vs.map((x, k) => [x, ((i >> (vs.length - 1 - k)) & 1) === 0]));

  const tabela = (f) => {
    const vs = vars(f), n = 2 ** vs.length;
    if (vs.length > 20) throw Error('Variáveis demais para a tabela-verdade');
    let m = 0, prim = null;
    const rows = [];
    for (let i = 0; i < n; i++) {
      const v = linha(vs, i), r = ev(f, v);
      if (r) { m++; prim = prim || v; }
      if (rows.length < 128) rows.push([v, r]);
    }
    return { vs, n, m, prim, rows, cls: m === n ? 'válida (tautologia)' : m === 0 ? 'insatisfatível (contradição)' : 'satisfatível (contingente)' };
  };

  const forca = (f) => {
    const vs = vars(f);
    for (let i = 0; i < 2 ** vs.length; i++) {
      const v = linha(vs, i);
      if (ev(f, v)) return { sat: true, i: i + 1 };
    }
    return { sat: false, i: 2 ** vs.length };
  };

  // =========================================================================
  // 3. ORGANIZADOR FNC (FORMA NORMAL CONJUNTIVA)
  // Simplifica as fórmulas para o algoritmo inteligente poder trabalhar
  // =========================================================================

  const neg = (l) => l[0] === '-' ? l.slice(1) : '-' + l;
  const vd = (neg2) => neg2[0] === '-' ? neg2.slice(1) : neg2;
  const dd = (c) => [...new Map(c.map(x => [x.join(','), x])).values()];
  const norm = (c) => {
    const s = [...new Set(c)];
    return s.some(l => s.includes(neg(l))) ? null : s.sort();
  };

  const nnf = (f, n = false) => {
    switch (f.t) {
      case 'var': return n ? { t: 'not', a: f } : f;
      case 'not': return nnf(f.a, !n);
      case 'and':
      case 'or': return { t: n ? (f.t === 'and' ? 'or' : 'and') : f.t, a: nnf(f.a, n), b: nnf(f.b, n) };
      case 'imp': return nnf({ t: 'or', a: { t: 'not', a: f.a }, b: f.b }, n);
      case 'iff': return nnf({ t: 'and', a: { t: 'imp', a: f.a, b: f.b }, b: { t: 'imp', a: f.b, b: f.a } }, n);
    }
  };

  const dist = (f) => {
    if (f.t === 'var') return [[f.n]];
    if (f.t === 'not') return [['-' + f.a.n]];
    const A = dist(f.a), B = dist(f.b);
    if (f.t === 'and') return dd([...A, ...B]);
    if (A.length * B.length > 2000) throw Error('Explosão da FNC: mais de 2000 cláusulas (use Tseitin)');
    const r = [];
    for (const x of A) {
      for (const y of B) {
        const c = norm([...x, ...y]);
        if (c) r.push(c);
      }
    }
    return dd(r);
  };

  const cnf = (f) => {
    const n = nnf(f);
    return { nnf: n, cl: dist(n) };
  };

  const fmtL = (l) => l[0] === '-' ? '¬' + l.slice(1) : l;
  const fmtC = (c) => c.length ? '(' + c.map(fmtL).join(' ∨ ') + ')' : '□';
  const sats = (c, v) => c.some(l => l[0] === '-' ? !v[l.slice(1)] : !!v[l]);

  // =========================================================================
  // 4. O DETETIVE (DPLL)
  // Tenta resolver o problema usando deduções lógicas
  // =========================================================================

  const dpll = (cl) => {
    const tr = [], st = { d: 0, p: 0, c: 0, l: 0 };
    const simp = (cs, l) => cs.filter(c => !c.includes(l)).map(c => c.filter(x => x !== neg(l)));
    
    const rec = (cs, a, n) => {
      for (;;) {
        if (cs.some(c => !c.length)) {
          st.c++;
          tr.push(['conflito', 'Conflito: surgiu a cláusula vazia □', n]);
          return null;
        }
        if (!cs.length) {
          tr.push(['sat', 'Todas as cláusulas satisfeitas: modelo encontrado', n]);
          return a;
        }
        const u = cs.find(c => c.length === 1);
        if (u) {
          const l = u[0];
          a = { ...a, [vd(l)]: l[0] !== '-' };
          st.p++;
          tr.push(['unit', 'Propagação unitária: ' + vd(l) + ' = ' + (l[0] === '-' ? 'F' : 'V'), n]);
          cs = simp(cs, l);
          continue;
        }
        const ls = new Set(cs.flat()), pu = [...ls].find(l => !ls.has(neg(l)));
        if (pu) {
          a = { ...a, [vd(pu)]: pu[0] !== '-' };
          st.l++;
          tr.push(['puro', 'Literal puro: ' + vd(pu) + ' = ' + (pu[0] === '-' ? 'F' : 'V') + ' (' + fmtL(pu) + ' só aparece com esse sinal)', n]);
          cs = cs.filter(c => !c.includes(pu));
          continue;
        }
        break;
      }
      const x = vd(cs[0][0]);
      for (const v of [true, false]) {
        st.d++;
        tr.push(['dec', 'Decisão: ' + x + ' = ' + (v ? 'V' : 'F'), n]);
        const r = rec(simp(cs, v ? x : '-' + x), { ...a, [x]: v }, n + 1);
        if (r) return r;
        tr.push(['back', 'Retrocesso: ' + x + ' = ' + (v ? 'V' : 'F') + ' leva a conflito', n]);
      }
      return null;
    };
    const m = rec(cl.map(c => [...c]), {}, 0);
    return { sat: !!m, m, tr, st };
  };

  const dimacs = (cl) => {
    const vs = [...new Set(cl.flat().map(vd))].sort(), id = new Map(vs.map((x, i) => [x, i + 1]));
    return ['c ' + vs.map(x => x + '=' + id.get(x)).join(' '), 'p cnf ' + vs.length + ' ' + cl.length, ...cl.map(c => c.map(l => l[0] === '-' ? -id.get(l.slice(1)) : id.get(l)).join(' ') + ' 0')].join('\n');
  };

  const tam = (f) => f.t === 'var' ? 1 : 1 + tam(f.a) + (f.b ? tam(f.b) : 0);
  const alt = (f) => f.t === 'var' ? 1 : 1 + Math.max(alt(f.a), f.b ? alt(f.b) : 0);
  const chave = (f) => f.t === 'var' ? f.n : f.t + '(' + chave(f.a) + (f.b ? ',' + chave(f.b) : '') + ')';
  
  const dag = (f) => {
    const s = new Set();
    (function r(g) {
      s.add(chave(g));
      if (g.t !== 'var') {
        r(g.a);
        if (g.b) r(g.b);
      }
    })(f);
    return s.size;
  };

  const sem = (f) => {
    if (f.t === 'var') return f;
    if (f.t === 'not') return { t: 'not', a: sem(f.a) };
    const a = sem(f.a), b = sem(f.b);
    if (f.t === 'imp') return { t: 'or', a: { t: 'not', a }, b };
    if (f.t === 'iff') return { t: 'and', a: { t: 'or', a: { t: 'not', a }, b }, b: { t: 'or', a: { t: 'not', a: b }, b: a } };
    return { t: f.t, a, b };
  };

  const tse = (f) => {
    let n = 0;
    const cl = [], N = neg;
    const g = (x) => {
      if (x.t === 'var') return x.n;
      const id = 'τ' + (++n), a = g(x.a), b = x.b ? g(x.b) : null;
      if (x.t === 'not') cl.push([N(id), N(a)], [id, a]);
      else if (x.t === 'and') cl.push([N(id), a], [N(id), b], [id, N(a), N(b)]);
      else if (x.t === 'or') cl.push([N(id), a, b], [id, N(a)], [id, N(b)]);
      else if (x.t === 'imp') cl.push([N(id), N(a), b], [id, a], [id, N(b)]);
      else cl.push([N(id), N(a), b], [N(id), a, N(b)], [id, a, b], [id, N(a), N(b)]);
      return id;
    };
    cl.push([g(f)]);
    return { cl, aux: n };
  };

  return { parse, str, pref, ev, vars, linha, tabela, forca, cnf, dpll, dimacs, fmtC, sats, tam, alt, dag, sem, tse };
})();

const f = L.parse('(A -> B) & A');
console.log(L.str(f));
console.log(L.pref(f));
console.log('modelos:', L.tabela(f).m);
console.log(L.cnf(f).cl.map(L.fmtC).join(' ∧ '));
console.log('DPLL:', L.dpll(L.cnf(f).cl).sat ? 'SAT' : 'INSAT');
console.log(L.dimacs(L.cnf(f).cl));