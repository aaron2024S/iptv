/**
 * 海外频道：在大陆常卡顿或连不上、海外播放流畅的免费直播频道，默认关闭，用户自己打开。
 *
 * 频道表是仓库根目录的 IPTV-overseas.m3u（格式同精选列表 IPTV.m3u，维护规则写在文件头）：运行时从仓库拉，
 * GitHub 镜像回退与精选列表同一套，改文件推送即生效、不用发版；远程都拉不到时读镜像里自带的那份。
 * 分工：大陆也播得顺的放 IPTV.m3u，只在海外顺的放这里（OVERSEAS.md）。
 */
import { readFileSync } from 'node:fs'

export const PLAYLIST_FILE = 'IPTV-overseas.m3u'
// 设成空（moverseasPlaylistUrl=）就只用镜像自带的那份，便于本地调试与测试
export const PLAYLIST_URL = process.env.moverseasPlaylistUrl !== undefined
  ? process.env.moverseasPlaylistUrl
  : `https://raw.githubusercontent.com/akiralereal/iptv/refs/heads/main/${PLAYLIST_FILE}`
const BUNDLED_PATH = new URL(`../../${PLAYLIST_FILE}`, import.meta.url)

// externalSources 在 import 时会读写数据目录里的订阅配置，只在真要抓的时候再加载
const playlistTools = () => import('../../utils/externalSources.js')

/** 读频道表：先仓库（含镜像回退），拉不到用镜像自带的。返回 { channels, from, warnings }。 */
export async function loadChannels({ url = PLAYLIST_URL } = {}) {
  const { fetchAndParseM3u, parsePlaylistContent } = await playlistTools()
  const warnings = []
  if (url) {
    try {
      return { channels: await fetchAndParseM3u(url), from: 'remote', warnings }
    } catch (error) {
      warnings.push(`仓库里的 ${PLAYLIST_FILE} 拉不到，先用镜像自带的：${error.message}`)
    }
  }
  return { channels: parsePlaylistContent(readFileSync(BUNDLED_PATH, 'utf8')), from: 'bundled', warnings }
}

export default {
  id: 'overseas',
  name: '海外频道',
  category: 'overseas',
  description: '海外免费直播频道（体育、娱乐时尚、文旅、国际、韩国），并入现有分组。在大陆常卡顿或连不上，默认关闭；播放器直连各平台 CDN，能不能看取决于播放设备的网络。',
  // 播放器直连海外 CDN：能不能看取决于看的人的网络，服务端判断不了，交给用户自己打开
  defaultEnabled: false,
  capabilities: { cache: 'disk', resolve: false, epg: false, catchup: false },
  defaultRefreshMinutes: 360,
  refreshConfigurable: false,
  refreshDescription: '每 6 小时从仓库拉一次 IPTV-overseas.m3u（与精选列表同周期），改了推送即生效；地址由播放器直连各平台 CDN。',
  configSchema: [],

  async fetch() {
    const { channels, warnings } = await loadChannels()
    const groups = new Map()
    for (const { name, group, url, logo, opts } of channels) {
      if (!groups.has(group)) groups.set(group, { name: group, dataList: [] })
      groups.get(group).dataList.push({
        name,
        url,
        ...(logo ? { logo } : {}),
        ...(opts ? { opts } : {}),
        catchup: 'none',
        // 排到所在分组最后，跟在各台官方频道与精选列表之后（见 channelMerger）
        trailing: true,
      })
    }
    return { groups: [...groups.values()], meta: { skipped: [], warnings } }
  },
}
