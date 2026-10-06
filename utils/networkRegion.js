/**
 * 部署所在网络 × 模块网络档位：判定规则与当前状态。零依赖，config.js 也能 import。
 *
 * 为什么要有：所有官方源都是给大陆网络做的，部署在海外时有一批模块必然不通（取列表被拒、
 * 换签 403、清单连不上），开着只会每轮超时刷日志，播放列表里还挂着播不了的台——咪咕在
 * 海外 83 台只剩 1 台能播，它的「央视」「卫视」分组又排在最前，播放器默认选中的就是坏的。
 * 2026-10-06 的普查（仓库根目录 OVERSEAS.md）把 57 个模块按「在哪能用」分成三档，
 * 模块在自己的 index.js 里用 `network` 声明。
 *
 * 档位（模块声明）：
 *   any    不限：海外也能用（含按频道的版权拦截——那些台播放时会回官方原话，不另打标记）
 *   cn-hk  大陆和香港：香港放行，日本 / 新加坡 / 欧美拒绝
 *   cn     仅大陆：香港也拒
 *
 * 地区（探测结果，见 utils/networkProbe.js）：
 *   cn       能直连大陆专属端点（含大陆机器挂分流代理的情形）
 *   hk       大陆专属端点被拒，但大陆和香港放行的端点能通
 *   intl     两类端点都明确回了地域拒绝
 *   unknown  还没测过、或测不出（断网 / 全部超时）——按大陆处理，等于本功能上线前的行为
 *
 * 档位只决定模块的**默认**开关：用户在卡片上手动开过、关过的，一律照用户的来。
 */

export const NETWORK_TIERS = Object.freeze(['any', 'cn-hk', 'cn'])
export const NETWORK_REGIONS = Object.freeze(['cn', 'hk', 'intl', 'unknown'])

export const TIER_LABELS = Object.freeze({
  any: '不限',
  'cn-hk': '大陆和香港',
  cn: '仅大陆',
})

export const REGION_LABELS = Object.freeze({
  cn: '大陆',
  hk: '香港',
  intl: '海外（香港以外）',
  unknown: '未检测',
})

/** 某档位的模块在某地区能不能用。未知地区按大陆处理，不替用户关任何东西。 */
export function networkAllows(tier, region = state.region) {
  if (region === 'cn' || region === 'unknown' || !NETWORK_REGIONS.includes(region)) return true
  if (tier === 'any') return true
  if (tier === 'cn-hk') return region === 'hk'
  return false
}

const EMPTY = Object.freeze({ region: 'unknown', source: 'none', checkedAt: null, details: [] })
let state = EMPTY
const listeners = new Set()

export function getNetworkState() {
  return state
}

/**
 * 换掉当前状态。地区变了才通知监听者（config.js 要据此重算咪咕的默认开关）。
 * source：probe 本次探测 / cache 上次探测的落盘结果 / env 环境变量指定。
 */
export function setNetworkState(next) {
  const region = NETWORK_REGIONS.includes(next?.region) ? next.region : 'unknown'
  const prev = state.region
  state = Object.freeze({
    region,
    source: next?.source || 'probe',
    checkedAt: next?.checkedAt ?? null,
    details: Array.isArray(next?.details) ? next.details : [],
  })
  if (prev !== region) {
    for (const fn of listeners) {
      try { fn(region, prev) } catch {}
    }
  }
  return state
}

export function onNetworkRegionChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** 测试用：回到未检测状态（监听者保留——config.js 在 import 时就挂上了）。 */
export function resetNetworkState() {
  setNetworkState(EMPTY)
}
