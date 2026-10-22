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

function pic(url) {
  url = String(url || '');
  if (!url) return '';
  return /^https?:/i.test(url) ? url : HOST + (url[0] === '/' ? url : '/' + url);
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
    const data = await net.json(this.host + '/api.php/Vod/get_list?type_id=2&offset=0&limit=20');
    return { list: rows(data, 2) };
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
