import fs from 'fs'
const ev = JSON.parse(fs.readFileSync('events.json')), ro = JSON.parse(fs.readFileSync('readonly.json'))
const f = (repr, k) => { const i = repr.indexOf('(' + k + ' '); if (i < 0) return undefined; const v = repr.slice(i + k.length + 2, repr.indexOf(')', i)); return v.startsWith('u') ? v.slice(1) : v }
const by = {}
for (const e of ev) { by[e.rid] ??= {}; by[e.rid][e.topic] = e }
const rows = [], dis = []
for (let id = 3500; id <= 3600; id++) {
  const r = ro[id].req.value?.value, sw = ro[id].sweep.value?.value
  const st = r?.status?.value == null ? 'none' : String(r.status.value.value)
  const c = by[id]?.['withdrawal-create'], a = by[id]?.['withdrawal-accept'], j = by[id]?.['withdrawal-reject']
  const evSt = a ? 'accept' : j ? 'reject' : 'pending'
  const roSt = st === 'true' ? 'accept' : st === 'false' ? 'reject' : 'pending'
  if (evSt !== roSt || (!!sw) !== (evSt === 'accept')) dis.push({ id, evSt, roSt, sweep: !!sw })
  const row = { id, st: evSt, amount: +f(c.repr, 'amount'), maxFee: +f(c.repr, 'max-fee'), createH: +f(c.repr, 'block-height'), roH: +r['block-height'].value }
  if (a) Object.assign(row, { fee: +f(a.repr, 'fee'), accH: +f(a.repr, 'burn-height'), txid: f(a.repr, 'bitcoin-txid'), sweepTx: f(a.repr, 'sweep-txid'), swH: +sw['sweep-burn-height'].value, swTx: sw['sweep-txid'].value, out: +f(a.repr, 'output-index') })
  rows.push(row)
}
const acc = rows.filter((r) => r.st === 'accept')
const lat = acc.map((r) => r.accH - r.createH).sort((x, y) => x - y)
const med = (a) => a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2
console.log('creadas', rows.length, 'aceptadas', acc.length, 'rechazadas', rows.filter((r) => r.st === 'reject').map((r) => r.id), 'pendientes', rows.filter((r) => r.st === 'pending').map((r) => r.id))
console.log('desacuerdos entre vias', JSON.stringify(dis))
console.log('createH evento == readonly', rows.every((r) => r.createH === r.roH))
console.log('latencia accept.burn-height - create.block-height (bloques BTC): mediana', med(lat), 'min', lat[0], 'max', lat.at(-1))
const lat2 = acc.map((r) => r.swH - r.createH).sort((x, y) => x - y)
console.log('latencia sweep-burn-height - create (bloques BTC): mediana', med(lat2), 'min', lat2[0], 'max', lat2.at(-1))
console.log('accH == swH en', acc.filter((r) => r.accH === r.swH).length, 'de', acc.length, '| accH - swH:', [...new Set(acc.map((r) => r.accH - r.swH))].join(','))
console.log('bitcoin-txid == sweep-txid (evento):', acc.filter((r) => r.txid === r.sweepTx).length, '| == readonly sweep-txid:', acc.filter((r) => r.txid === r.swTx).length)
const eq = acc.filter((r) => r.fee === r.maxFee).length
const gaps = acc.map((r) => ({ id: r.id, gap: r.maxFee - r.fee, fee: r.fee, max: r.maxFee }))
gaps.sort((x, y) => y.gap - x.gap)
console.log('fee == max-fee:', eq, 'de', acc.length, '| fee > max-fee:', acc.filter((r) => r.fee > r.maxFee).length, '| mayor holgura', JSON.stringify(gaps[0]), '| menor', JSON.stringify(gaps.at(-1)))
const tx = {}; for (const r of acc) (tx[r.txid] ??= []).push(r.id)
const multi = Object.entries(tx).filter(([, v]) => v.length > 1)
console.log('barridos BTC distintos', Object.keys(tx).length, '| con varias retiradas', multi.length, 'max por barrido', Math.max(...Object.values(tx).map((v) => v.length)))
for (const r of rows.filter((r) => r.st !== 'accept')) console.log('no completada', JSON.stringify(r))
fs.writeFileSync('rows.json', JSON.stringify(rows, null, 1))
