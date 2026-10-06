/** 澳广视（TDM）自办六套电视：官网公开直播，播放时按官方路由接口取当前网络可用的 CDN。 */
import { buildChannels, claimsRef, clearResolveCache, resolveChannel } from './api.js'
import epg from './epg.js'

export default {
  id: 'tdm',
  name: '澳门',
  description: '澳广视（TDM）自办的六套电视：澳视澳门、澳视葡文、澳门体育、澳门资讯、澳门综艺、澳门-Macau。官网与视频只对大陆以外开放，部署在香港或海外时默认开启。',
  network: 'non-cn',  // 大陆连官网和视频 CDN 都超时；香港、台湾、日本、美国走海外 CDN（OVERSEAS.md）
  capabilities: { cache: 'disk', resolve: true, epg: true, catchup: false },
  catalogVersion: 1,
  outputGroupName: '澳门',
  defaultRefreshMinutes: 1440,
  refreshConfigurable: false,
  refreshDescription: '固定频道表；播放时向官方路由接口取当前网络可用的 CDN（缓存 5 分钟），视频由播放器直连官方 CDN。',
  configSchema: [],

  async fetch() {
    return {
      groups: [{ name: '澳门', dataList: buildChannels() }],
      meta: { skipped: [], warnings: [] },
    }
  },

  // 官网直播页自用的节目单接口（见 epg.js）；与取流链路互不依赖
  epg,
  claimsRef,
  resolve: resolveChannel,
  clearResolveCache,
}
