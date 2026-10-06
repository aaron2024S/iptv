#!/usr/bin/env node
/**
 * 「海外频道」模块（extractors/overseas）与它的频道表 IPTV-overseas.m3u：
 *   - 频道表完整：33 台、台名不重复、只进约定的现有分组、地址都是 https 的固定 HLS；
 *   - 不和精选列表 IPTV.m3u 重复收台；
 *   - 台标：除了暂无出处的 Tennis Channel International，要么写了 tvg-logo，要么内置台标库按台名有图；
 *   - 模块：默认关闭（defaultEnabled: false）、排在注册表最后；先从仓库拉，拉不到用镜像自带的那份；频道排到组尾。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'

// 只用镜像自带的那份，测试不连 GitHub；模块在 import 时读这个变量
process.env.moverseasPlaylistUrl = ''

const { getModule, listModules, validateModule } = await import('../extractors/registry.js')
const { loadChannels, PLAYLIST_FILE } = await import('../extractors/overseas/index.js')
const { parsePlaylistContent } = await import('../utils/externalSources.js')
const { moveTrailingChannelsLast } = await import('../utils/channelMerger.js')

let passed = 0
const check = (name, fn) => { fn(); passed++; console.log(`  ✅ ${name}`) }
const checkAsync = async (name, fn) => { await fn(); passed++; console.log(`  ✅ ${name}`) }
const read = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')

const GROUPS = new Set(['体育', '娱乐时尚', '文旅', '国际', '韩国'])
const module = getModule('overseas')
const CHANNELS = parsePlaylistContent(read(`../${PLAYLIST_FILE}`))

console.log('海外频道模块测试')

check('模块定义合法，默认关闭，排在注册表最后', () => {
  assert.ok(module)
  assert.doesNotThrow(() => validateModule(module))
  assert.equal(module.defaultEnabled, false, '播放器直连海外 CDN，能不能看看播放设备的网络，交给用户打开')
  assert.equal(module.capabilities.resolve, false, '固定直链，不需要换签')
  assert.equal(module.defaultRefreshMinutes, 360, '和精选列表同周期从仓库拉')
  assert.equal(listModules().at(-1).id, 'overseas')
})

check('频道表：33 台、台名不重复、只进约定分组、地址都是 https HLS', () => {
  assert.equal(CHANNELS.length, 33)
  const names = CHANNELS.map(channel => channel.name)
  assert.equal(new Set(names).size, names.length, '台名重复')
  for (const channel of CHANNELS) {
    assert.ok(GROUPS.has(channel.group), `${channel.name} 的分组「${channel.group}」不在约定里`)
    const url = new URL(channel.url)
    assert.equal(url.protocol, 'https:', channel.name)
    assert.match(url.pathname, /\.m3u8$/, channel.name)
  }
})

check('不和精选列表重复收台（在大陆也顺的留在 IPTV.m3u）', () => {
  const featured = parsePlaylistContent(read('../IPTV.m3u'))
  const names = new Set(featured.map(channel => channel.name))
  const urls = new Set(featured.map(channel => channel.url))
  for (const channel of CHANNELS) {
    assert.ok(!names.has(channel.name), `${channel.name} 已在精选列表里`)
    assert.ok(!urls.has(channel.url), `${channel.name} 的地址已在精选列表里`)
  }
})

check('台标：写了 tvg-logo 或内置台标库按台名有图（Tennis Channel International 暂无）', () => {
  const pack = JSON.parse(read('../logo-pack/index.json')).logos
  const missing = CHANNELS.filter(channel => !channel.logo && !pack[channel.name]).map(channel => channel.name)
  assert.deepEqual(missing, ['Tennis Channel International'])
})

await checkAsync('fetch 按分组输出，频道排到组尾、不透传回看参数', async () => {
  const { groups, meta } = await module.fetch()
  assert.deepEqual(meta, { skipped: [], warnings: [] })
  assert.deepEqual(groups.map(group => [group.name, group.dataList.length]),
    [['体育', 13], ['娱乐时尚', 12], ['文旅', 5], ['国际', 2], ['韩国', 1]])
  for (const group of groups) {
    for (const channel of group.dataList) {
      assert.ok(channel.url && channel.name)
      assert.equal(channel.catchup, 'none')
      assert.equal(channel.trailing, true, '要排到所在分组最后')
    }
  }
  const bein = groups[0].dataList.find(channel => channel.name === 'beIN Sports Xtra')
  assert.match(bein.logo, /^https:\/\/image\.xumo\.com\//)
})

await checkAsync('先从仓库拉：拉到就用仓库的（推送即生效），拉不到用镜像自带的并提示', async () => {
  const remote = '#EXTM3U\n#EXTINF:-1 group-title="体育",Test Sports\nhttps://cdn.example/test/playlist.m3u8\n'
  const server = createServer((req, res) => {
    if (req.url === `/${PLAYLIST_FILE}`) { res.writeHead(200, { 'Content-Type': 'audio/x-mpegurl' }); res.end(remote) } else { res.writeHead(404); res.end() }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    const fromRepo = await loadChannels({ url: `${base}/${PLAYLIST_FILE}` })
    assert.equal(fromRepo.from, 'remote')
    assert.deepEqual(fromRepo.channels.map(channel => channel.name), ['Test Sports'])
    assert.deepEqual(fromRepo.warnings, [])

    const fallback = await loadChannels({ url: `${base}/missing.m3u` })
    assert.equal(fallback.from, 'bundled')
    assert.equal(fallback.channels.length, 33)
    assert.match(fallback.warnings[0], /拉不到，先用镜像自带的/)
  } finally {
    server.close()
  }
})

check('任何分组里海外频道都排到最后，跟在精选列表之后（不拆开 France 24 各语种）', () => {
  const input = [{ name: '国际', dataList: [
    { name: 'NEWS1', trailing: true },
    { name: 'France 24 Español', trailing: true },
    { name: 'CNA', source: 'external' },
    { name: 'France 24 Français', source: 'external' },
    { name: 'France 24 English', source: 'external' },
  ] }, { name: '央视频', dataList: [{ name: 'CCTV1综合' }] }]
  const before = JSON.stringify(input)
  const output = moveTrailingChannelsLast(input)
  assert.deepEqual(output[0].dataList.map(channel => channel.name),
    ['CNA', 'France 24 Français', 'France 24 English', 'NEWS1', 'France 24 Español'])
  assert.equal(output[1], input[1], '没有海外台的分组原样返回')
  assert.equal(JSON.stringify(input), before, '不改输入')
})

console.log(`\n全部通过：${passed} ✅`)
