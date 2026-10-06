#!/usr/bin/env node
/**
 * 部署网络探测与模块网络档位（OVERSEAS.md）：
 *   - 探测结果的判定（大陆 / 香港 / 海外 / 测不出）偏保守，接口改版不会把大陆误判成海外；
 *   - 模块默认开关跟随网络，用户手动开过、关过的不受影响；
 *   - 存量 extractors.json 里被写死的 enabled:true 迁移成「跟随默认」，false 原样保留；
 *   - 判定落盘、重启恢复，一次测不出不翻回「按大陆处理」；环境变量可强制指定；
 *   - 咪咕的开关（config.js 的 enableMigu）没设过时同样跟随网络。
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const tmp = mkdtempSync(join(tmpdir(), 'iptv-network-region-'))
// config.js 在 import 时读 system-config.json，别让它读到仓库根目录里作者真实的那份
process.env.mdataDir = tmp
delete process.env.mnetworkRegion
delete process.env.menableMigu

const { classifyNetwork, probeNetwork, NETWORK_PROBES } = await import('../utils/networkProbe.js')
const { networkAllows, setNetworkState, getNetworkState, resetNetworkState, NETWORK_TIERS } = await import('../utils/networkRegion.js')
const { ExtractorManager } = await import('../utils/extractorManager.js')
const { listModules, getModule, validateModule } = await import('../extractors/registry.js')

let passed = 0
const check = (name, fn) => { fn(); passed++; console.log(`  ✅ ${name}`) }
const checkAsync = async (name, fn) => { await fn(); passed++; console.log(`  ✅ ${name}`) }

const row = (id, tier, status) => ({ id, tier, status })
const cnIds = () => listModules().filter(m => m.network === 'cn').map(m => m.id)
const cnHkIds = () => listModules().filter(m => m.network === 'cn-hk').map(m => m.id)

let seq = 0
function newManager(config, cache) {
  const n = ++seq
  const manager = new ExtractorManager()
  manager.configPath = join(tmp, `extractors-${n}.json`)
  manager.cachePath = join(tmp, `extractor-cache-${n}.json`)
  manager.legacyConfigPath = join(tmp, `system-config-legacy-${n}.json`)
  if (config !== undefined) writeFileSync(manager.configPath, JSON.stringify(config))
  if (cache !== undefined) writeFileSync(manager.cachePath, JSON.stringify(cache))
  return manager.load()
}
const freshConfig = () => ({ modules: {}, masterSwitchRetired: true, enabledFollowsNetwork: true })

/** 按端点 id 回固定状态码的假 fetch；值是 'hang' 就挂到被 abort。 */
function fakeFetch(statusById, calls = []) {
  return (url, { signal } = {}) => {
    const probe = NETWORK_PROBES.find(p => p.url === url)
    calls.push(probe?.id)
    const status = statusById[probe?.id]
    if (status === 'hang') {
      return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))))
    }
    if (status === 'error') return Promise.reject(Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNRESET' } }))
    return Promise.resolve({ status, body: { cancel: async () => {} } })
  }
}

console.log('部署网络探测与模块网络档位测试')

// ---- 判定 ----

check('大陆：任一仅大陆端点有响应就是大陆，包括接口改版回 404 / 业务码 999', () => {
  assert.equal(classifyNetwork([row('a', 'cn', 200), row('b', 'cn', 403), row('c', 'cn-hk', 403)]), 'cn')
  assert.equal(classifyNetwork([row('a', 'cn', 404), row('b', 'cn', 0)]), 'cn', '404 说明连上了，不是地域拒绝')
  assert.equal(classifyNetwork([row('a', 'cn', 999), row('b', 'cn', 0)]), 'cn')
  assert.equal(classifyNetwork([row('a', 'cn', 302)]), 'cn', '宁夏在大陆回 302')
})

check('香港：仅大陆端点被拒、大陆和香港端点能通', () => {
  assert.equal(classifyNetwork([
    row('xinjiang', 'cn', 403), row('ningxia', 'cn', 0), row('anhui', 'cn', 403),
    row('jlntv', 'cn-hk', 200), row('wuxi', 'cn-hk', 0),
  ]), 'hk')
})

check('海外：至少两个端点明确回地域拒绝（403 / 451）', () => {
  assert.equal(classifyNetwork([
    row('xinjiang', 'cn', 403), row('ningxia', 'cn', 403), row('anhui', 'cn', 403),
    row('jlntv', 'cn-hk', 403), row('wuxi', 'cn-hk', 403),
  ]), 'intl')
  assert.equal(classifyNetwork([row('a', 'cn', 451), row('b', 'cn-hk', 403), row('c', 'cn', 0)]), 'intl')
})

check('测不出：全部连不上，或只有一个 403，都不下结论（按大陆处理）', () => {
  assert.equal(classifyNetwork([row('a', 'cn', 0), row('b', 'cn', 0), row('c', 'cn-hk', 0)]), 'unknown')
  assert.equal(classifyNetwork([row('a', 'cn', 403), row('b', 'cn', 0), row('c', 'cn-hk', 0)]), 'unknown')
  assert.equal(classifyNetwork([]), 'unknown')
})

check('档位 × 地区：未知按大陆处理，不替用户关任何模块', () => {
  for (const tier of NETWORK_TIERS) {
    assert.equal(networkAllows(tier, 'cn'), true)
    assert.equal(networkAllows(tier, 'unknown'), true)
  }
  assert.deepEqual(['any', 'cn-hk', 'cn'].map(t => networkAllows(t, 'hk')), [true, true, false])
  assert.deepEqual(['any', 'cn-hk', 'cn'].map(t => networkAllows(t, 'intl')), [true, false, false])
})

await checkAsync('探测：并发、只看状态码、单个端点挂住会按超时收尾，绝不抛异常', async () => {
  const calls = []
  const started = Date.now()
  const result = await probeNetwork({
    timeoutMs: 200,
    fetchImpl: fakeFetch({ xinjiang: 403, ningxia: 'hang', anhui: 403, jlntv: 403, wuxi: 'error' }, calls),
  })
  assert.ok(Date.now() - started < 1500, '挂住的端点按超时收尾')
  assert.equal(calls.length, NETWORK_PROBES.length)
  assert.equal(result.region, 'intl')
  const ningxia = result.details.find(d => d.id === 'ningxia')
  assert.equal(ningxia.status, 0)
  assert.equal(ningxia.error, '超时')
  assert.equal(result.details.find(d => d.id === 'wuxi').error, 'ECONNRESET')
  const broken = await probeNetwork({ fetchImpl: () => { throw new Error('同步炸了') } })
  assert.equal(broken.region, 'unknown')
})

// ---- 注册表 ----

check('每个注册模块都声明了合法的 network；非法取值被拒', () => {
  for (const module of listModules()) assert.ok(NETWORK_TIERS.includes(module.network), module.id)
  assert.throws(() => validateModule({ id: 'probe', name: 'probe', network: 'overseas', fetch: async () => ({ groups: [] }) }), /network 非法/)
  assert.ok(cnIds().includes('migu'), '咪咕在海外换签全被拒，是仅大陆')
  assert.ok(cnHkIds().length > 0)
  assert.equal(getModule('yangshipin').network, 'any', '央视频海外能播央视卫视，是海外部署的主力')
})

// ---- 默认开关 ----

check('大陆 / 未检测：所有普通模块默认开启（与本功能上线前一致）', () => {
  resetNetworkState()
  const manager = newManager(freshConfig())
  const regular = listModules().filter(m => typeof m.enabledGetter !== 'function')
  assert.deepEqual(regular.filter(m => !manager.isModuleEnabled(m)).map(m => m.id), [])
  setNetworkState({ region: 'cn' })
  assert.deepEqual(regular.filter(m => !manager.isModuleEnabled(m)).map(m => m.id), [])
})

check('海外：仅大陆、大陆和香港档默认关；香港：只关仅大陆档', () => {
  const manager = newManager(freshConfig())
  const regular = listModules().filter(m => typeof m.enabledGetter !== 'function')
  setNetworkState({ region: 'intl' })
  const offIntl = regular.filter(m => !manager.isModuleEnabled(m)).map(m => m.id).sort()
  assert.deepEqual(offIntl, regular.filter(m => m.network !== 'any').map(m => m.id).sort())
  setNetworkState({ region: 'hk' })
  const offHk = regular.filter(m => !manager.isModuleEnabled(m)).map(m => m.id).sort()
  assert.deepEqual(offHk, regular.filter(m => m.network === 'cn').map(m => m.id).sort())
  resetNetworkState()
})

check('手动开过、关过的不跟随网络；没点过的才跟随', () => {
  setNetworkState({ region: 'intl' })
  const manager = newManager(freshConfig())
  manager.setModuleEnabled('anhui', true)
  manager.setModuleEnabled('hntv', false)
  assert.equal(manager.isModuleEnabled(getModule('anhui')), true, '海外手动打开仅大陆模块要照开')
  assert.equal(manager.isModuleEnabled(getModule('hntv')), false, '手动关掉的不限档模块要照关')
  assert.equal(manager.isEnabledByDefault(getModule('anhui')), false)
  assert.equal(manager.isEnabledByDefault(getModule('xinjiang')), true)
  const state = manager.getState()
  const anhui = state.modules.find(m => m.id === 'anhui')
  assert.equal(anhui.networkReachable, false)
  assert.ok(state.network.unreachableOn.includes('anhui'), '手动开着但不通的要提示')
  assert.ok(state.network.autoOff.includes('xinjiang'))
  assert.ok(!state.network.autoOff.includes('anhui'))
  // 落盘只写点过的两个，其余仍不存 enabled
  const saved = JSON.parse(readFileSync(manager.configPath, 'utf8'))
  assert.equal(saved.modules.anhui.enabled, true)
  assert.equal(saved.modules.hntv.enabled, false)
  assert.equal('enabled' in (saved.modules.xinjiang || {}), false)
  resetNetworkState()
})

check('迁移：存量被写死的 enabled:true 改为跟随默认，false 原样保留；只迁一次', () => {
  const manager = newManager({
    modules: { anhui: { enabled: true, config: {} }, hntv: { enabled: false, config: {} }, migu: { config: {} } },
    masterSwitchRetired: true,
  })
  const saved = JSON.parse(readFileSync(manager.configPath, 'utf8'))
  assert.equal(saved.enabledFollowsNetwork, true)
  assert.equal('enabled' in saved.modules.anhui, false, 'true 和「没存」在本功能之前语义一样，去掉不丢信息')
  assert.equal(saved.modules.hntv.enabled, false, '用户明确关掉的不动')
  setNetworkState({ region: 'intl' })
  assert.equal(manager.isModuleEnabled(getModule('anhui')), false, '迁移后存量海外部署也会自动关掉必然失败的模块')
  resetNetworkState()

  // 已迁过：之后用户点出来的 true 是明确选择，不能再被抹掉
  const again = newManager({ modules: { anhui: { enabled: true, config: {} } }, masterSwitchRetired: true, enabledFollowsNetwork: true })
  setNetworkState({ region: 'intl' })
  assert.equal(again.isModuleEnabled(getModule('anhui')), true)
  resetNetworkState()
})

check('设置失败回滚时，没点过的模块回到「不存 enabled」而不是被写成 undefined 字段', () => {
  const manager = newManager(freshConfig())
  manager.corrupt = { message: '测试用' }
  assert.throws(() => manager.setModuleEnabled('wuxi', false), /已拒绝写入/)
  assert.equal('enabled' in manager.config.modules.wuxi, false)
  assert.equal(manager.isEnabledByDefault(getModule('wuxi')), true)
})

// ---- 探测落盘与恢复 ----

await checkAsync('探测结果落盘，重启后先用上次的判定；地区变了才算 changed', async () => {
  resetNetworkState()
  const manager = newManager(freshConfig())
  const first = await manager.detectNetwork({ fetchImpl: fakeFetch({ xinjiang: 403, ningxia: 403, anhui: 403, jlntv: 403, wuxi: 403 }) })
  assert.equal(first.changed, true)
  assert.equal(getNetworkState().region, 'intl')
  const cache = JSON.parse(readFileSync(manager.cachePath, 'utf8'))
  assert.equal(cache.network.region, 'intl')
  assert.equal(cache.network.details.length, NETWORK_PROBES.length)

  resetNetworkState()
  const restarted = newManager(freshConfig(), cache)
  assert.equal(getNetworkState().region, 'intl')
  assert.equal(getNetworkState().source, 'cache')
  const second = await restarted.detectNetwork({ fetchImpl: fakeFetch({ xinjiang: 403, ningxia: 403, anhui: 403, jlntv: 403, wuxi: 403 }) })
  assert.equal(second.changed, false)
  resetNetworkState()
})

await checkAsync('一次测不出（断网）不把已知地区翻回「按大陆处理」', async () => {
  resetNetworkState()
  const manager = newManager(freshConfig(), { modules: {}, network: { region: 'hk', checkedAt: 1, details: [] } })
  assert.equal(getNetworkState().region, 'hk')
  const result = await manager.detectNetwork({ fetchImpl: fakeFetch({ xinjiang: 'error', ningxia: 'error', anhui: 'error', jlntv: 'error', wuxi: 'error' }) })
  assert.equal(result.failed, true)
  assert.equal(result.changed, false)
  assert.equal(getNetworkState().region, 'hk')
  assert.ok(manager.networkSummary().lastFailedAt)
  resetNetworkState()
})

await checkAsync('环境变量 mnetworkRegion 强制指定地区，且不再探测', async () => {
  resetNetworkState()
  process.env.mnetworkRegion = 'HK'
  try {
    const manager = newManager(freshConfig())
    assert.equal(getNetworkState().region, 'hk')
    assert.equal(getNetworkState().source, 'env')
    const calls = []
    const result = await manager.detectNetwork({ fetchImpl: fakeFetch({}, calls) })
    assert.equal(calls.length, 0)
    assert.equal(result.changed, false)
  } finally {
    delete process.env.mnetworkRegion
    resetNetworkState()
  }
})

// ---- 咪咕（代理开关）----

await checkAsync('咪咕没设过开关时跟随网络：海外 / 香港默认关，回到大陆自动恢复', async () => {
  const config = await import('../config.js')
  const migu = getModule('migu')
  resetNetworkState()
  assert.equal(config.enableMiguSource, 'auto')
  assert.equal(migu.enabledGetter(), true)
  setNetworkState({ region: 'intl' })
  assert.equal(migu.enabledGetter(), false, '海外换签全被拒，默认关')
  assert.equal(migu.enabledIsDefault(), true)
  const manager = newManager(freshConfig())
  assert.ok(manager.networkSummary().autoOff.includes('migu'))
  setNetworkState({ region: 'hk' })
  assert.equal(migu.enabledGetter(), false)
  setNetworkState({ region: 'cn' })
  assert.equal(migu.enabledGetter(), true)

  // 后台点过（写进 system-config.json）就不再跟随网络
  writeFileSync(join(tmp, 'system-config.json'), JSON.stringify({ enableMigu: true }))
  config.reloadConfig()
  setNetworkState({ region: 'intl' })
  assert.equal(config.enableMiguSource, 'config')
  assert.equal(migu.enabledGetter(), true)
  assert.equal(migu.enabledIsDefault(), false)
  resetNetworkState()
})

console.log(`\n全部通过：${passed} ✅`)
