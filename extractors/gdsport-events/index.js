import { createProvider, GROUP_NAME, eventChannelName, HEADERS, validateSegmentUrl, verifySegment } from './api.js'
const claimsRef = ref => /^gdsport-event-[1-9]\d{0,9}$/.test(String(ref || ''))
let defaultProvider = createProvider(), providers = new WeakMap()
function providerFor(ctx) {
  if (typeof ctx.fetchImpl !== 'function') return defaultProvider
  if (!providers.has(ctx.fetchImpl)) providers.set(ctx.fetchImpl, createProvider(ctx))
  return providers.get(ctx.fetchImpl)
}

export default {
  id: 'gdsport-events', name: '广东体育赛事',
  description: '从广东体育官方 H5 获取公开赛事直播，统一归入广东分组；开播加入、结束移除。',
  capabilities: { cache: 'disk', resolve: true, epg: false, catchup: false },
  catalogVersion: 1, outputGroupName: GROUP_NAME, configSchema: [],
  defaultRefreshMinutes: 1, refreshConfigurable: false,
  refreshDescription: '自动同步在播赛事，结束后移除；播放时复核官方状态并获取当前 HLS。',
  async fetch(_config, ctx = {}) {
    const events = await providerFor(ctx).discover()
    return { groups: [{ name: GROUP_NAME, dataList: events.map(event => ({
      name: eventChannelName(event), deferredRef: `gdsport-event-${event.id}`, proxyHls: true, catchup: 'none',
      // 官方赛事直播间按台标规则留空，不使用比赛海报冒充电视频道台标。
      logo: '',
      opts: ['network-caching=3000'],
    })) }], meta: { skipped: [], warnings: [] } }
  },
  claimsRef,
  async resolve(ref, ctx = {}) {
    if (!claimsRef(ref)) return { url: '', desc: '未知的广东体育赛事引用' }
    try {
      const result = await providerFor(ctx).resolve(ref.slice('gdsport-event-'.length))
      return {
        url: result.url, desc: result.event.name,
        upstreamHeaders: url => {
          if (url !== result.url) validateSegmentUrl(url, result.url)
          return HEADERS
        },
        manifestText: result.text, manifestUrl: result.url,
        upstreamUrlTransform: url => validateSegmentUrl(url, result.url), segmentTransform: verifySegment,
      }
    } catch (error) { return { url: '', desc: error.message } }
  },
  clearResolveCache() { defaultProvider = createProvider(); providers = new WeakMap() },
}
