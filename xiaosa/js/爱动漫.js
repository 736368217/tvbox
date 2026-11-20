const HOST = 'https://m3u8.girigirilove.com';

const TYPE_NAMES = {
  '2': '日番',
  '3': '美番',
  '20': '真人番剧',
  '21': '剧场版',
  '24': 'BD副音轨',
  '26': '其他'
};

const CLASSES = [
  { type_id: '2', type_name: '日番' },
  { type_id: '3', type_name: '美番' },
  { type_id: '21', type_name: '剧场版' },
  { type_id: '20', type_name: '真人番剧' },
  { type_id: '24', type_name: 'BD副音轨' },
  { type_id: '26', type_name: '其他' }
];

const GENRES = ['喜剧', '爱情', '恐怖', '动作', '科幻', '剧情', '战争', '奇幻', '冒险', '悬疑', '校园', '后宫', '热血', '运动', '职场', '百合', '乙女', '机甲', '日常', '魔法少女', '异世界', '爱抖露', '音乐', '萌'];
const AREAS = ['十月', '一月', '七月', '四月'];
const YEARS = ['1984', '1985', '1986', '1988', '1989', '2000至90年代', '2001', '2002', '2003', '2004', '2005', '2006', '2007', '2008', '2009', '2010', '2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'];
const LANGS = ['日语', '国语'];
const VERSIONS = ['TV番', '泡面番', 'OVA'];
const STATES = ['小说改', '漫画改', '游戏改', '原创'];

function values(list) {
  const out = [{ n: '全部', v: '' }];
  for (const item of list) out.push({ n: item, v: item });
  return out;
}

function filterGroups() {
  return [
    { key: 'class', name: '类型', value: values(GENRES) },
    { key: 'area', name: '季度', value: values(AREAS) },
    { key: 'year', name: '年份', value: values(YEARS) },
    { key: 'lang', name: '语言', value: values(LANGS) },
    { key: 'version', name: '版本', value: values(VERSIONS) },
    { key: 'state', name: '原作', value: values(STATES) },
    { key: 'by', name: '排序', value: [{ n: '最新', v: '' }, { n: '最热', v: 'hits' }, { n: '评分', v: 'score' }] }
  ];
}

function filterMap() {
  const one = filterGroups();
  const out = {};
  for (const c of CLASSES) out[c.type_id] = one;
  return out;
}

// 详情页 API 返回的 vod_pic 是相对路径 "upload/vod/..."，
// 图片实际存放在 jpg.girigirilove.com；挂在 API 域名 m3u8.girigirilove.com
// 下一律 404，会让所有客户端写进历史的封面都是坏地址。
// 列表 API 已经返回 https://jpg.girigirilove.com/... 的完整 URL，原样保留。
const IMG_HOST = 'https://jpg.girigirilove.com';

function pic(url) {
  url = String(url || '').trim();
  if (!url) return '';
  if (/^https?:\/\/jpg\.girigirilove\.com\//i.test(url)) return url;
  // 兼容站方以后把图片域名换成别的 CDN：非已知坏域名的完整 URL 原样保留。
  if (/^https?:/i.test(url)) {
    return url.replace(/^https?:\/\/(?:m3u8\.)?girigirilove\.com\//i, IMG_HOST + '/');
  }
  const path = url.replace(/^\/+/, '');
  // "upload/vod/..." 是站方图片路径；其余相对路径仍按旧逻辑回退到 API 域名，避免误伤。
  return /^(?:upload\/vod\/|vod\/)/i.test(path) ? IMG_HOST + '/' + path
        : HOST + '/' + path;
}


function rows(data, tid) {
  const list = (data && data.info && data.info.rows) ? data.info.rows : [];
  return list.map(item => ({
    vod_id: String(item.vod_id || ''),
    vod_name: item.vod_name || '',
    vod_pic: pic(item.vod_pic),
    vod_remarks: item.vod_remarks || '',
    vod_year: String(item.vod_year || ''),
    type_name: TYPE_NAMES[String(item.type_id || '')] || TYPE_NAMES[String(tid || '')] || ''
  }));
}

function pageResult(data, pg, size, tid) {
  const total = (data && data.info && data.info.total) ? Number(data.info.total) : 0;
  return {
    page: Number(pg) || 1,
    pagecount: Math.max(1, Math.ceil(total / size)),
    limit: size,
    total: total,
    list: rows(data, tid)
  };
}

function buildQuery(tid, pg, extend) {
  const size = 60;
  const parts = [
    'type_id=' + encodeURIComponent(tid),
    'offset=' + ((Math.max(1, Number(pg) || 1) - 1) * size),
    'limit=' + size
  ];
  const map = { class: 'vod_class', area: 'vod_area', year: 'vod_year', lang: 'vod_lang', version: 'vod_version', state: 'vod_state', by: 'orderby' };
  if (extend && typeof extend === 'object') {
    for (const key of Object.keys(map)) {
      const value = extend[key];
      if (value !== undefined && value !== null && String(value) !== '') {
        parts.push(map[key] + '=' + encodeURIComponent(String(value)));
      }
    }
  }
  return parts.join('&');
}

export default {
  init(ext) {
    this.host = HOST;
    this.ext = ext || '';
  },

  async home() {
    return { class: CLASSES, filters: filterMap() };
  },

  async homeVod() {
    const paths = [
      '/api.php/App2/bannerList',
      '/api.php/App2/weekList',
      '/api.php/Vod/get_list?type_id=2&offset=0&limit=12',
      '/api.php/Vod/get_list?type_id=21&offset=0&limit=12',
      '/api.php/App2/likeList'
    ];
    // 各分区独立容错，单个接口失败不清空整个首页。
    const data = await Promise.all(paths.map(async path => {
      try {
        return await net.json(this.host + path);
      } catch (error) {
        return null;
      }
    }));
    const infoList = value => value && Array.isArray(value.info) ? value.info : [];
    const videos = (items, tid) => rows({ info: { rows: (Array.isArray(items) ? items : [])
      .filter(item => item && /^[1-9]\d*$/.test(String(item.vod_id || '')))
      .map(item => Object.assign({}, item, {
        vod_remarks: item.vod_remarks || (typeof item.vod_time === 'string' ? item.vod_time : '')
      })) } }, tid);
    const week = infoList(data[1]);
    const calendar = [];
    for (const day of week) {
      if (day && Array.isArray(day.video)) calendar.push(...day.video);
    }
    const today = new Date().getDay() || 7;
    const schedule = week.find(day => day && Number(day.week) === today);
    const daily = videos(schedule && schedule.video, 2);
    const japan = videos(data[2] && data[2].info && data[2].info.rows, 2);
    const movies = videos(data[3] && data[3].info && data[3].info.rows, 21);
    const recommended = videos(infoList(data[4]));
    const catalog = japan.concat(movies, videos(calendar, 2), recommended);
    const featured = [];
    for (const banner of infoList(data[0])) {
      if (!banner) continue;
      const key = String(banner.video_key || '');
      const match = String(banner.link || '').match(/^\/(?:video|detail)\/([1-9]\d*)(?:[/?#]|$)/);
      const id = /^[1-9]\d*$/.test(key) ? key : (match ? match[1] : '');
      if (!id) continue; // 轮播 ID 不是番剧 ID，外部广告链接不能作为影片。
      const cover = String(banner.cover || '');
      const known = catalog.find(item => item.vod_id === id);
      featured.push(Object.assign({
        vod_id: id,
        vod_name: banner.title || '',
        // 横幅在 API 域名下，不能套用 upload/vod 封面的 CDN 替换。
        vod_pic: /^https?:\/\//i.test(cover) ? cover : (cover ? this.host + '/' + cover.replace(/^\/+/, '') : ''),
        vod_remarks: ''
      }, known || {}));
    }
    const list = [];
    const seen = new Set();
    // 与官网一致：精选、今日追番、日番、剧场版、为你推荐。
    for (const item of featured.concat(daily, japan, movies, recommended)) {
      if (!item.vod_name || seen.has(item.vod_id)) continue;
      seen.add(item.vod_id);
      list.push(item);
    }
    if (list.length) return { list };
    // 所有首页分区都不可用时，保留原日番列表作为最后回退。
    const fallback = await net.json(this.host + '/api.php/Vod/get_list?type_id=2&offset=0&limit=20');
    return { list: rows(fallback, 2) };
  },

  async category(tid, pg, filter, extend) {
    const size = 60;
    const url = this.host + '/api.php/Vod/get_list?' + buildQuery(tid, pg, extend);
    const data = await net.json(url);
    return pageResult(data, pg, size, tid);
  },

  async detail(id) {
    id = String(id || '').split('$')[0];
    const data = await net.json(this.host + '/api.php/Vod/get_detail?vod_id=' + encodeURIComponent(id));
    const d = (data && data.info) ? data.info : {};
    return {
      list: [{
        vod_id: String(d.vod_id || id),
        vod_name: d.vod_name || '',
        vod_pic: pic(d.vod_pic),
        type_name: TYPE_NAMES[String(d.type_id || '')] || '',
        vod_year: String(d.vod_year || ''),
        vod_area: d.vod_area || '',
        vod_lang: d.vod_lang || '',
        vod_actor: d.vod_actor || '',
        vod_director: d.vod_director || '',
        vod_content: d.vod_content || d.vod_blurb || '',
        vod_remarks: d.vod_remarks || '',
        vod_play_from: d.vod_play_from || '',
        vod_play_url: d.vod_play_url || ''
      }]
    };
  },

  async search(key, quick, pg) {
    const size = 30;
    const p = Math.max(1, Number(pg) || 1);
    const url = this.host + '/api.php/Vod/get_list?offset=' + ((p - 1) * size) + '&limit=' + size + '&vod_name=' + encodeURIComponent(key);
    const data = await net.json(url);
    return pageResult(data, p, size);
  },

  play(flag, id) {
    id = String(id || '');
    return { parse: 0, url: id };
  }
};
