// Gera ModeloNexo.java (conceitual + lógico) para o Construtor do brModelo.
// Uso: node gerar.js <V1__esquema_inicial.sql> <layout.js>
const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(process.argv[2], 'utf8');
const layout = require(path.resolve(process.argv[3]));

// ---------------------------------------------------------------- SQL -> tabelas
function tabelasDoSql(texto) {
  const res = [];
  const re = /CREATE TABLE (\w+) \(([\s\S]*?)\n\);/g;
  let m;
  while ((m = re.exec(texto))) {
    const nome = m[1];
    const corpo = m[2].split('\n').map(l => l.replace(/--.*$/, '').trim()).filter(Boolean);
    const campos = [];
    let pkComposta = [];
    let atual = null;
    for (const linha of corpo) {
      const pkc = linha.match(/^PRIMARY KEY \(([^)]+)\)/);
      if (pkc) { pkComposta = pkc[1].split(',').map(s => s.trim()); continue; }
      if (/^CHECK \(/.test(linha)) continue;
      const col = linha.match(/^(\w+)\s+(SMALLINT|BIGINT|INTEGER|VARCHAR\(\d+\)|CHAR\(\d+\)|NUMERIC\(\d+,\d+\)|TEXT|DATE|TIMESTAMPTZ|BOOLEAN|JSONB)(?=\s|,|$)(.*)$/);
      if (col) {
        atual = {
          nome: col[1], tipo: col[2], pk: /PRIMARY KEY/.test(col[3]),
          uk: /\bUNIQUE\b/.test(col[3]), nn: /NOT NULL|PRIMARY KEY/.test(col[3]),
          ref: (col[3].match(/REFERENCES (\w+) \((\w+)\)/) || []).slice(1)
        };
        campos.push(atual);
      }
    }
    pkComposta.forEach(n => { const c = campos.find(x => x.nome === n); if (c) c.pk = true; });
    res.push({ nome, campos });
  }
  return res;
}
const tabelas = tabelasDoSql(sql);

// ---------------------------------------------------------------- Java
const q = s => JSON.stringify(s);
const linhas = [];
linhas.push('public class ModeloNexo extends Construtor {');
linhas.push('  public static void main(String[] a) throws Exception { new ModeloNexo().rode(a[0]); }');

linhas.push('  protected void conceitual() {');
for (const e of layout.entidades) {
  linhas.push(`    ent(${q(e.nome)}, ${e.x}, ${e.y}, ${e.extra || 0}${e.attrs.map(a => ', ' + q(a)).join('')});`);
}
for (const r of layout.relacionamentos) {
  linhas.push(`    rel(${q(r.nome)}, ${r.x}, ${r.y}${(r.attrs || []).map(a => ', ' + q(a)).join('')});`);
  for (const l of r.ligs) {
    linhas.push(`    lig(${q(l[0])}, '${l[1]}', ${l[2]}, ${q(r.nome)}, '${l[3]}', ${q(l[4])});`);
  }
}
linhas.push('  }');

linhas.push('  protected void logico() {');
// tabelas na mesma posição da entidade (ou do relacionamento N:N) no conceitual
const pos = {};
const mapa = { fornecedor_marca: 'trabalha_com', item_compra: 'inclui', item_pedido: 'contem' };
const todos = {};
layout.entidades.forEach(e => todos[e.nome.toLowerCase()] = e);
layout.relacionamentos.forEach(r => todos[r.nome] = r);
for (const t of tabelas) {
  const ref = todos[mapa[t.nome] || t.nome];
  if (!ref) throw new Error('sem posição no conceitual para ' + t.nome);
  const ajusteManual = (layout.ajusteTabelas || {})[t.nome] || [0, 0];
  pos[t.nome] = [Math.round(ref.x * layout.escalaLogico[0]) + ajusteManual[0], Math.round(ref.y * layout.escalaLogico[1]) + 40 + ajusteManual[1]];
}
const largura = t => Math.max(170, ...t.campos.map(c => Math.round((c.nome.length + c.tipo.length + 2) * 6.6) + 44));
// confere sobreposição (altura estimada: cabeçalho + campos + linha de restrições)
const ret = tabelas.map(t => ({ n: t.nome, x: pos[t.nome][0], y: pos[t.nome][1], w: largura(t), h: 22 * (t.campos.length + 3) }));
for (const a of ret) for (const b of ret) {
  if (a.n < b.n && a.x < b.x + b.w + 30 && b.x < a.x + a.w + 30 && a.y < b.y + b.h + 30 && b.y < a.y + a.h + 30) console.log('SOBREPOE', a.n, b.n);
}
for (const t of tabelas) {
  const p = pos[t.nome];
  if (!p) throw new Error('sem posição para a tabela ' + t.nome);
  linhas.push(`    tab(${q(t.nome)}, ${p[0]}, ${p[1]});`);
  for (const c of t.campos) {
    linhas.push(`    campo(${q(t.nome)}, ${q(c.nome)}, ${q(c.tipo)}, ${c.pk}, ${c.uk});`);
  }
  linhas.push(`    ajuste(${q(t.nome)}, ${largura(t)});`);
}
for (const t of tabelas) {
  for (const c of t.campos) {
    if (!c.ref.length) continue;
    const pkComposta = t.campos.filter(x => x.pk).length > 1;
    linhas.push(`    fk(${q(c.ref[0])}, ${q(c.ref[1])}, ${q(t.nome)}, ${q(c.nome)}, ${c.nn}, ${c.uk || (c.pk && !pkComposta)});`);
  }
}
linhas.push('  }');
linhas.push('}');
fs.writeFileSync(path.join(path.dirname(path.resolve(process.argv[3])), 'ModeloNexo.java'), linhas.join('\n'));
console.log('tabelas:', tabelas.length, 'campos:', tabelas.reduce((s, t) => s + t.campos.length, 0),
  'fks:', tabelas.reduce((s, t) => s + t.campos.filter(c => c.ref.length).length, 0));
