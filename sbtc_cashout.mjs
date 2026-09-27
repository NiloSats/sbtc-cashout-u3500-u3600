// Bounty muk2q8eb456c1faac489: retiradas sBTC u3500..u3600, por dos vías (read-only y eventos).
import { uintCV, cvToHex, hexToCV, cvToJSON } from '@stacks/transactions'
import fs from 'fs'
const C = 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4', N = 'sbtc-registry', OUT = '../sbtc_cashout/'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function getJ(url, opt, tries = 6) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, opt)
    if (r.status === 429) { await sleep(3000 * (i + 1)); continue }
    if (!r.ok) throw new Error(url + ' HTTP ' + r.status)
    return r.json()
  }
  throw new Error('429 persistente ' + url)
}
async function ro(fn, id) {
  const j = await getJ(`https://api.hiro.so/v2/contracts/call-read/${C}/${N}/${fn}`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sender: C, arguments: [cvToHex(uintCV(id))] }) })
  if (!j.okay) throw new Error(fn + ' ' + id + ' ' + j.cause)
  return cvToJSON(hexToCV(j.result))
}
const ids = []; for (let i = 3500; i <= 3600; i++) ids.push(i)
const readonly = {}
for (const id of ids) { readonly[id] = { req: await ro('get-withdrawal-request', id), sweep: await ro('get-completed-withdrawal-sweep-data', id) }; await sleep(150) }
fs.writeFileSync(OUT + 'readonly.json', JSON.stringify(readonly, null, 1))
// eventos: paginar hasta ver creates por debajo de u3500
const ev = []; let off = 0, minCreate = Infinity
while (true) {
  const j = await getJ(`https://api.hiro.so/extended/v1/contract/${C}.${N}/events?limit=50&offset=${off}`)
  if (!j.results.length) break
  for (const e of j.results) {
    const repr = e.contract_log?.value?.repr || ''
    const topic = (repr.match(/\(topic "([^"]+)"\)/) || [])[1]
    if (!/withdrawal/.test(topic || '')) continue
    const rid = +((repr.match(/\(request-id u(\d+)\)/) || [])[1])
    ev.push({ topic, rid, tx: e.tx_id, repr, hex: e.contract_log.value.hex })
    if (topic === 'withdrawal-create') minCreate = Math.min(minCreate, rid)
  }
  off += 50
  if (minCreate < 3490) break
  await sleep(200)
}
fs.writeFileSync(OUT + 'events.json', JSON.stringify(ev.filter((e) => e.rid >= 3500 && e.rid <= 3600), null, 1))
console.log('readonly', Object.keys(readonly).length, 'eventos en ventana', ev.filter((e) => e.rid >= 3500 && e.rid <= 3600).length, 'paginas', off / 50)
