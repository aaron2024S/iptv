/**
 * 「海外频道」的频道表：33 个海外免费直播频道。全部是固定 HLS 地址，不带时效参数、不要求请求头，
 * 播放器直连各平台 CDN。
 *
 * 来源：独立的亚洲直播实验台（asian-live-lab）筛选并验证过的分发源——Samsung TV Plus、Plex、
 * Rakuten TV、LG Channels、Xumo 等免费流媒体（FAST）平台，以及 France 24、Arirang 官方。
 * 2026-09-25 它们从精选列表 IPTV.m3u 拿掉：大陆连得上但常卡顿，海外播放流畅（作者实测）；
 * 在大陆也顺的那 16 台（Red Bull TV、NHL FAST 等）留在精选列表。
 * 2026-10-06 复测：美国机房主清单 → 子清单 → 分片 33/33 都通；Globalping 大陆家宽探针也都连得上。
 * 问题在流畅度而不是能不能连，所以模块档位是「大陆以外」（OVERSEAS.md）。
 *
 * 台标：这些台的官方图多数要先拿 Cookie，或只对本区 IP 开放，9 月已逐张手工收进内置台标库
 * logo-pack（index.json 每条写了出处），这里留空，按台名匹配内置台标。beIN Sports Xtra 库里没有，
 * 用实验台记录的 Xumo 频道卡；Tennis Channel International 暂无台标（实验台记的是第三方图床，不用）。
 *
 * 地址：主清单把最低档排在最前的，AVPlayer 等播放器会从最低档起播、先糊一阵（实验台网页播放器
 * 是锁最高档，所以那边看着清楚）。最高档地址固定不变的 14 台直接写最高档（10-06），
 * 和精选列表的 NHL FAST、WildEarth 同一做法；代价是没了自动降档。其余仍是主清单：最高档地址
 * 带会话参数会变（FUEL TV、MTRSPT1、Terra Mater WILD、Wipeout Xtra、MovieSphere），
 * 或带会话 ID 样的串怕过期（FIFA+、Qello Concerts），或本来就是高档在前 / 单档。
 *
 * 改频道、地址或台标要把 index.js 的 catalogVersion 加 1。
 */
export const CHANNELS = [
  // 体育
  { name: 'Sky Racing 1', group: '体育', url: 'https://636ffd31f0e12.streamlock.net/RacingStream1/RacingStream1/playlist.m3u8' },  // 澳大利亚赛马直播频道，720p
  { name: 'Sky Racing 2', group: '体育', url: 'https://636ffd31f0e12.streamlock.net/RacingStream2/RacingStream2/playlist.m3u8' },  // 澳大利亚赛马直播频道，720p
  { name: 'World of Freesports', group: '体育', url: 'https://mainstreammedia-worldoffreesportsintl-rakuten.amagi.tv/1080p-en/index.m3u8' },  // 英语户外与极限运动频道，最高 1080p
  { name: 'FUEL TV', group: '体育', url: 'https://amg01074-fueltv-fueltvemeaen-rakuten-b6j62.amagi.tv/hls/amagi_hls_data_rakutenAA-fueltvemeaen/CDN/master.m3u8' },  // 英语极限运动国际频道，最高 1080p
  { name: 'FloRacing', group: '体育', url: 'https://amg02278-amg02278c1-flosports-worldwide-7592.playouts.now.amagi.tv/1080p-cc/index.m3u8' },  // 英语赛车赛事与专题频道，最高 1080p
  { name: 'SportsGrid', group: '体育', url: 'https://sportsgrid-tribal.amagi.tv/playlist1080p.m3u8' },  // 英语体育新闻与数据分析频道，最高 1080p
  { name: 'ACCDN', group: '体育', url: 'https://raycom-accdn-firetv.amagi.tv/1080p-cc/index.m3u8' },  // ACC 大学体育赛事与专题频道，最高 1080p
  { name: 'Pac-12 Insider', group: '体育', url: 'https://pac12-firetv.amagi.tv/1080p-en-cc/index.m3u8' },  // Pac-12 大学体育赛事与专题频道，最高 1080p
  { name: 'Trace Sport Stars', group: '体育', url: 'https://lightning-tracesport-samsungau.amagi.tv/playlist1080p.m3u8' },  // Samsung TV Plus 澳大利亚区体育明星纪实频道，最高 1080p
  { name: 'beIN Sports Xtra', group: '体育', url: 'https://bein-xtra-bein.amagi.tv/playlistR1080p.m3u8', logo: 'https://image.xumo.com/v1/channels/channel/99991387/168x168.png?type=color_onBlack' },  // beIN 官方免费英语体育频道，最高 1080p
  { name: 'FIFA+', group: '体育', url: 'https://d2w9q46ikgrcwx.cloudfront.net/v1/master/3722c60a815c199d9c0ef36c5b73da68a62b09d1/cc-of5cbk3sav3w5/v1/sysdata_s_p_a_fifa_7/samsungheadend_us/latest/main/hls/playlist.m3u8' },  // FIFA 官方免费 FAST 频道，精选赛事、回放及专题节目，最高 720p
  { name: 'Tennis Channel International', group: '体育', url: 'https://cdn-uw2-prod.tsv2.amagi.tv/linear/amg01444-tennischannelth-tennischnlintl-lggb/playlist.m3u8' },  // Tennis Channel 官方国际版 FAST 频道，LG Channels 英国区讯源
  { name: 'MTRSPT1', group: '体育', url: 'https://amg02873-kravemedia-mtrspt1-samsungau-2anp4.amagi.tv/playlist/amg02873-kravemedia-mtrspt1-samsungau/playlist.m3u8' },  // Krave Media 官方 24/7 赛车频道，Samsung TV Plus 澳大利亚区讯源，最高 1080p
  // 娱乐时尚
  { name: 'FashionTV Paris L\'Original', group: '娱乐时尚', url: 'https://ftv1.b-cdn.net/bfdbb576-83f7-11f0-9f89-0200170e3e04_1000028043_HLS/manifest.m3u8' },  // FashionTV 官网直播频道，最高 1080p
  { name: 'Global Fashion Channel', group: '娱乐时尚', url: 'https://pubgfc.teleosmedia.com/linear/globalfashionchannel/globalfashionchannel/playlist.m3u8' },  // 频道官网嵌入的英语时尚与生活方式直播，最高 1080p
  { name: 'Qello Concerts', group: '娱乐时尚', url: 'https://lotus.stingray.com/manifest/qello-qello001-montreal/samsungtvplus/master.m3u8' },  // Stingray 为 Samsung TV Plus 提供的演唱会频道，最高 1080p
  { name: 'Totalmusic Concerts', group: '娱乐时尚', url: 'https://cdn.40mediagroup.com/live/c7eds/Totalmusic_Concerts/SA_LIVE_hls_enc/master.m3u8' },  // 40media 官方演唱会频道，1080p
  { name: 'Wipeout Xtra', group: '娱乐时尚', url: 'https://amg00627-banijaygroup-wipeoutxtraau-samsungau-ashbl.amagi.tv/playlist/amg00627-banijaygroup-wipeoutxtraau-samsungau/playlist.m3u8' },  // 英语闯关真人秀 FAST 频道，最高 1080p
  { name: 'Graham Norton', group: '娱乐时尚', url: 'https://amg00654-itv-amg00654c35-rakuten-gb-7598.playouts.now.amagi.tv/playlist1080_p.m3u8' },  // 英语脱口秀精选 FAST 频道，最高 1080p
  { name: 'Mystery TV', group: '娱乐时尚', url: 'https://aenetworks-mysterytv-rakuten.amagi.tv/1080p-vtt/index.m3u8' },  // 英语悬疑与罪案 FAST 频道，最高 1080p
  { name: 'Estrella TV', group: '娱乐时尚', url: 'https://estrellatv-oando.amagi.tv/playlistR1080p.m3u8' },  // 西班牙语综合娱乐频道，最高 1080p
  { name: 'MovieSphere', group: '娱乐时尚', url: 'https://amg00353-lionsgatefilmsi-moviesphereaus-samsungau-7qzhf.amagi.tv/playlist/amg00353-lionsgatefilmsi-moviesphereaus-samsungau/playlist.m3u8' },  // Lionsgate 英语电影 FAST 频道，最高 1080p
  { name: 'Rai Italia', group: '娱乐时尚', url: 'https://d3k8wzt41aflvx.cloudfront.net/RAIHD/Live.m3u8' },  // 意大利语综合国际频道，最高 1080p
  { name: 'Rai World Premium', group: '娱乐时尚', url: 'https://d3k8wzt41aflvx.cloudfront.net/RAIP/Live.m3u8' },  // 意大利语影视娱乐频道，最高 1080p
  { name: 'Mediaset Italia', group: '娱乐时尚', url: 'https://d3k8wzt41aflvx.cloudfront.net/Mediaset_AU/Live.m3u8' },  // 意大利语综合娱乐国际频道，最高 1080p
  // 文旅
  { name: 'History Hit', group: '文旅', url: 'https://lds-timeline-rakuten.amagi.tv/1080p-cc/index.m3u8' },  // 英语历史纪录片 FAST 频道，最高 1080p
  { name: 'Terra Mater WILD', group: '文旅', url: 'https://amg01775-amg01775c1-amgplt0343.playout.now3.amagi.tv/playlist/amg01775-amg01775c1-amgplt0343/playlist.m3u8' },  // 英语自然与野生动物纪录片频道，最高 1080p
  { name: 'Court TV', group: '文旅', url: 'https://cdn-uw2-prod.tsv2.amagi.tv/linear/amg01438-ewscrippscompan-courttv-tablo/playlist.m3u8' },  // 英语法庭纪实与案件报道频道，最高 1080p
  { name: 'Documentary+', group: '文旅', url: 'https://ef79b15c8c7c46c7a9de9d33001dbd07.mediatailor.us-west-2.amazonaws.com/v1/master/ba62fe743df0fe93366eba3a257d792884136c7f/LINEAR-859-DOCUMENTARYPLUS-DOCUMENTARYPLUS/mt/documentaryplus/859/hls/master/playlist.m3u8' },  // 英语综合纪录片 FAST 频道，最高 1080p
  { name: 'InTravel', group: '文旅', url: 'https://amg00861-amg00861c10-rakuten-uk-3152.playouts.now.amagi.tv/1080p/index.m3u8' },  // 英语国际旅行与生活方式频道，最高 1080p
  // 国际
  { name: 'NEWS1', group: '国际', url: 'https://server1.streamssl.com/stream/news1_mid.m3u8' },  // 泰国新闻频道，官方自适应直播最高约 2 Mbps
  { name: 'France 24 Español', group: '国际', url: 'https://live.france24.com/hls/live/2037220-b/F24_ES_HI_HLS/master_5000.m3u8' },  // 西班牙语国际新闻高码率直播
  // 韩国
  { name: 'Arirang', group: '韩国', url: 'https://amdlive-ch01-g-ctnd-com.akamaized.net/arirang_1gch/smil:arirang_1gch.smil/chunklist_b2256000_sleng.m3u8' },  // 官方自适应 360p / 540p / 720p
]
