/**
 * 探测部署所在网络：大陆 / 香港 / 海外。结果决定各模块按 `network` 档位的默认开关
 * （规则见 utils/networkRegion.js，依据见仓库根目录 OVERSEAS.md）。
 *
 * 做法：并发 GET 几个「只放行大陆」和「放行大陆和香港」的官方端点，只看 HTTP 状态码。
 * 这些端点都是 2026-10-06 普查时用 Globalping 多地探针核实过的：
 *   - 仅大陆：新疆、宁夏、安徽——香港（阿里云 / LeaseWeb / 家宽）和日本、新加坡、美国一律 403；
 *   - 大陆和香港：吉林、无锡——香港 200，日本、新加坡、美国 403。
 *
 * 判定刻意保守：
 *   - 回 403 / 451 才算「被地域拒绝」；回别的任何状态（200、302、404、业务层的 999…）
 *     都算「能连上」——官方接口改版、路径失效时大陆部署也不会被误判成海外；
 *   - 只有明确收到两个以上地域拒绝才判海外。连接失败、超时不算证据（可能只是断网、DNS 坏了），
 *     全部测不出时返回 unknown，按大陆处理，不替用户关任何东西。
 *
 * 本文件只发请求、不读写任何状态；落盘与生效由 extractorManager 负责。
 */
import { proxyAwareFetch } from './systemProxy.js'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

export const NETWORK_PROBES = Object.freeze([
  { id: 'xinjiang', tier: 'cn', url: 'https://slstapi.xjtvs.com.cn/api/Func/Timestamp?json=true' },
  { id: 'ningxia', tier: 'cn', url: 'https://hls.nxhhy.cn/live/nxws1M.m3u8' },
  { id: 'anhui', tier: 'cn', url: 'https://console.ahsx.ahtv.cn/api/appapi/api/config-other-encrypt?client=android&tenantid=7' },
  { id: 'jlntv', tier: 'cn-hk', url: 'https://clientapi.jlntv.cn/broadcast/list?page=1&size=1&type=1' },
  { id: 'wuxi', tier: 'cn-hk', url: 'https://bb-share.wifiwx.com/wxbb/share/live/?channel_id=4' },
])

const DENIED = new Set([403, 451])
const reachable = r => r.status > 0 && !DENIED.has(r.status)
const denied = r => DENIED.has(r.status)

/** 由各端点结果得出地区。纯函数，测试直接喂结果。 */
export function classifyNetwork(results) {
  const cn = results.filter(r => r.tier === 'cn')
  const cnHk = results.filter(r => r.tier === 'cn-hk')
  if (cn.some(reachable)) return 'cn'
  if (cnHk.some(reachable)) return 'hk'
  if (results.filter(denied).length >= 2) return 'intl'
  return 'unknown'
}

async function probeOne(probe, fetchImpl, timeoutMs) {
  const t0 = Date.now()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    // 不跟随跳转：宁夏在大陆回 302，跟过去就多一跳、还可能落到别的主机
    const response = await fetchImpl(probe.url, {
      redirect: 'manual',
      headers: { 'User-Agent': UA },
      signal: ctrl.signal,
    })
    // 只要状态码；无锡那页一百多 KB，不读正文
    response.body?.cancel?.().catch(() => {})
    return { id: probe.id, tier: probe.tier, status: response.status, ms: Date.now() - t0 }
  } catch (error) {
    const reason = ctrl.signal.aborted ? '超时' : (error?.cause?.code || error?.message || String(error))
    return { id: probe.id, tier: probe.tier, status: 0, error: reason, ms: Date.now() - t0 }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 跑一轮探测。绝不抛异常：任何意外都折成 unknown。
 * @returns {{ region, checkedAt, details: [{ id, tier, status, error?, ms }] }}
 */
export async function probeNetwork({ fetchImpl = proxyAwareFetch, timeoutMs = 8000, probes = NETWORK_PROBES } = {}) {
  try {
    const details = await Promise.all(probes.map(probe => probeOne(probe, fetchImpl, timeoutMs)))
    return { region: classifyNetwork(details), checkedAt: Date.now(), details }
  } catch (error) {
    return { region: 'unknown', checkedAt: Date.now(), details: [], error: error?.message || String(error) }
  }
}
