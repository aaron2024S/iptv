/** 海外免费直播频道：在大陆连得上但常卡顿，部署在香港或海外时默认开启（频道表见 channels.js）。 */
import { CHANNELS } from './channels.js'

export default {
  id: 'overseas',
  name: '海外频道',
  description: `${CHANNELS.length} 个海外免费直播频道（体育、娱乐时尚、文旅、国际、韩国），并入现有分组。在大陆连得上但常卡顿，部署在香港或海外时默认开启。`,
  network: 'non-cn',
  capabilities: { cache: 'disk', resolve: false, epg: false, catchup: false },
  catalogVersion: 1,
  defaultRefreshMinutes: 1440,
  refreshConfigurable: false,
  refreshDescription: '固定频道表；地址不带时效参数，由播放器直连各平台 CDN。',
  configSchema: [],

  async fetch() {
    const groups = new Map()
    for (const { group, name, url, logo } of CHANNELS) {
      if (!groups.has(group)) groups.set(group, { name: group, dataList: [] })
      // trailing：排到所在分组最后，跟在各台官方频道与精选列表之后（见 channelMerger）
      groups.get(group).dataList.push({ name, url, ...(logo ? { logo } : {}), catchup: 'none', trailing: true })
    }
    return { groups: [...groups.values()], meta: { skipped: [], warnings: [] } }
  },
}
