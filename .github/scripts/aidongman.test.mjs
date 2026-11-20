import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const source = await readFile(new URL('../../xiaosa/js/爱动漫.js', import.meta.url), 'utf8');
const HOST = 'https://m3u8.girigirilove.com';
const paths = {
  banner: '/api.php/App2/bannerList',
  week: '/api.php/App2/weekList',
  japan: '/api.php/Vod/get_list?type_id=2&offset=0&limit=12',
  movies: '/api.php/Vod/get_list?type_id=21&offset=0&limit=12',
  recommended: '/api.php/App2/likeList',
  fallback: '/api.php/Vod/get_list?type_id=2&offset=0&limit=20'
};
const plain = value => JSON.parse(JSON.stringify(value));
const video = (id, extra = {}) => ({
  vod_id: id, vod_name: `番剧 ${id}`, vod_pic: `https://jpg.girigirilove.com/upload/vod/${id}.webp`, ...extra
});
function createSpider(handler, weekday = 5) {
  class Clock extends Date { getDay() { return weekday; } }
  const context = vm.createContext({ net: { json: handler }, Date: Clock });
  vm.runInContext(source.replace('export default {', 'globalThis.spider = {'), context);
  const spider = context.spider;
  spider.init('');
  return spider;
}
function fixtures() {
  return {
    [paths.banner]: { info: [
      { id: 91, title: '精选一', link: '/video/101', cover: `${HOST}/upload/banner/101.jpg` },
      { id: 92, title: '外链广告', link: 'https://example.invalid/promo' },
      { id: 93, title: '精选二', video_key: '102', cover: `${HOST}/upload/banner/102.jpg` },
      { id: 94, title: '无效影片', link: '/video/0' },
      { id: 95, title: '重复精选', link: '/video/101' }
    ] },
    [paths.week]: { info: [
      { week: 5, video: [video(101, { vod_time: '更新至03集' }), video(201)] },
      { week: 7, video: [video(701)] }
    ] },
    [paths.japan]: { info: { rows: [video(201), video(301), null, { vod_id: 0 }] } },
    [paths.movies]: { info: { rows: [video(401)] } },
    [paths.recommended]: { info: [video(401), video(501)] }
  };
}

test('homepage uses official selections and today schedule, excludes ads and deduplicates', async () => {
  const data = fixtures();
  const requests = [];
  const spider = createSpider(async url => {
    requests.push(url);
    assert.ok(url.startsWith(HOST));
    return data[url.slice(HOST.length)];
  });
  const { list } = plain(await spider.homeVod());
  assert.deepEqual(list.map(item => item.vod_id), ['101', '102', '201', '301', '401', '501']);
  assert.equal(list[0].vod_pic, 'https://jpg.girigirilove.com/upload/vod/101.webp');
  assert.equal(list[0].vod_remarks, '更新至03集');
  assert.equal(list[1].vod_pic, `${HOST}/upload/banner/102.jpg`);
  assert.equal(list.find(item => item.vod_id === '401').type_name, '剧场版');
  assert.equal(requests.length, 5);
});

test('Sunday selects calendar week 7', async () => {
  const data = fixtures();
  const spider = createSpider(async url => data[url.slice(HOST.length)], 0);
  const { list } = plain(await spider.homeVod());
  assert.deepEqual(list.slice(0, 3).map(item => item.vod_id), ['101', '102', '701']);
});

test('failed and malformed sections do not hide working movie and recommendation sections', async () => {
  const data = fixtures();
  data[paths.week] = { info: {} };
  const spider = createSpider(async url => {
    const key = url.slice(HOST.length);
    if (key === paths.banner || key === paths.japan) throw new Error('section unavailable');
    assert.notEqual(key, paths.fallback);
    return data[key];
  });
  assert.deepEqual(plain(await spider.homeVod()).list.map(item => item.vod_id), ['401', '501']);
});

test('empty homepage sections use the original list fallback and surface total network failure', async () => {
  const requests = [];
  const spider = createSpider(async url => {
    requests.push(url);
    if (url === HOST + paths.fallback) return { info: { rows: [video(901)] } };
    return { info: null };
  });
  assert.deepEqual(plain(await spider.homeVod()).list.map(item => item.vod_id), ['901']);
  assert.equal(requests.length, 6);
  const offline = createSpider(async () => { throw new Error('offline'); });
  await assert.rejects(offline.homeVod(), /offline/);
});

test('all seven filters and category pagination remain available', async () => {
  let requested;
  const spider = createSpider(async url => {
    requested = new URL(url);
    return { info: { total: 61, rows: [video(301)] } };
  });
  const home = plain(await spider.home());
  assert.equal(home.class.length, 6);
  for (const filters of Object.values(home.filters)) {
    assert.deepEqual(filters.map(filter => filter.key), ['class', 'area', 'year', 'lang', 'version', 'state', 'by']);
  }
  const result = plain(await spider.category('2', 2, true, {
    class: '喜剧', area: '十月', year: '2025', lang: '日语', version: 'TV番', state: '漫画改', by: 'hits'
  }));
  assert.deepEqual(Object.fromEntries(requested.searchParams), {
    type_id: '2', offset: '60', limit: '60', vod_class: '喜剧', vod_area: '十月',
    vod_year: '2025', vod_lang: '日语', vod_version: 'TV番', vod_state: '漫画改', orderby: 'hits'
  });
  assert.equal(result.page, 2);
  assert.equal(result.pagecount, 2);
});

test('detail keeps the corrected poster CDN and both direct playback lines', async () => {
  const media = 'https://media.example/episode.m3u8';
  const spider = createSpider(async () => ({ info: {
    ...video(101), vod_pic: 'upload/vod/101.webp',
    vod_play_from: 'cht$$$chs', vod_play_url: `01$${media}$$$01$${media}`
  } }));
  const { list } = plain(await spider.detail('101'));
  assert.equal(list[0].vod_pic, 'https://jpg.girigirilove.com/upload/vod/101.webp');
  assert.equal(list[0].vod_play_from, 'cht$$$chs');
  assert.deepEqual(plain(spider.play('cht', media)), { parse: 0, url: media });
});
