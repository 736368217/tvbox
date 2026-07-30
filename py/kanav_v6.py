# -*- coding: utf-8 -*-
import base64
import html
import json
import re
from urllib.parse import quote, unquote, urljoin

import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class Spider:
    READER = 'https://r.jina.ai/'
    HOSTS = (
        'https://kanav.ad',
        'https://kanav.info',
        'https://v1.kanav.ink',
        'https://m1.kanav.fun',
    )
    UA = (
        'Mozilla/5.0 (Linux; Android 13; TVBox) AppleWebKit/537.36 '
        '(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    )
    CLASSES = (
        ('1', '中文字幕'),
        ('2', '日韩有码'),
        ('3', '日韩无码'),
        ('4', '国产AV'),
        ('22', '流出自拍'),
        ('30', '自拍泄密'),
        ('31', '探花约炮'),
        ('32', '主播录制'),
        ('20', '动漫番剧'),
        ('25', '里番'),
        ('26', '泡面番'),
        ('27', 'Motion Anime'),
        ('28', '3D动画'),
        ('29', '同人作品'),
    )

    def init(self, extend=''):
        self.session = requests.Session()
        self.session.verify = False
        self.host = self.HOSTS[0]

    def getName(self):
        return 'KanAV'

    def getDependence(self):
        return []

    def destroy(self):
        self.session.close()

    def isVideoFormat(self, url):
        return bool(re.search(r'\.(?:m3u8|mp4)(?:[?#]|$)', url or '', re.I))

    def manualVideoCheck(self):
        return False

    def liveContent(self, url):
        return {'list': []}

    def localProxy(self, params):
        return [404, 'text/plain', '', '']

    def _headers(self, referer=''):
        headers = {
            'User-Agent': self.UA,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.7',
        }
        if referer:
            headers['Referer'] = referer
        return headers

    def _fetch(self, url, referer=''):
        try:
            response = self.session.get(
                url, headers=self._headers(referer), timeout=12, verify=False)
            if response.status_code == 200:
                response.encoding = 'utf-8'
                return response.text
        except Exception:
            pass
        return ''

    def _fetch_page(self, url, marker):
        content = self._fetch(url, self.host + '/')
        if marker in content:
            return content
        try:
            response = self.session.get(
                self.READER + url,
                headers={'User-Agent': 'TVBox/1.0', 'X-Return-Format': 'html'},
                timeout=50,
            )
            if response.status_code == 200 and marker in response.text:
                return response.text
        except Exception:
            pass
        return content

    def _select_host(self):
        for candidate in self.HOSTS:
            url = candidate + '/index.php/vod/type/id/1/page/1.html'
            self.host = candidate
            content = self._fetch_page(url, 'video-item')
            if self._parse_cards(content):
                self.host = candidate
                return

    @staticmethod
    def _clean(value):
        value = re.sub(r'<[^>]+>', ' ', value or '')
        return re.sub(r'\s+', ' ', html.unescape(value)).strip()

    def _parse_cards(self, content):
        result = []
        seen = set()
        blocks = re.split(r'<div\s+class=["\']video-item["\']', content or '', flags=re.I)[1:]
        for block in blocks:
            link = re.search(
                r'href=["\']([^"\']*/index\.php/vod/(?:play|detail)/id/\d+[^"\']*)',
                block, re.I)
            if not link:
                continue
            path = html.unescape(link.group(1))
            if path.startswith('http'):
                path = re.sub(r'^https?://[^/]+', '', path)
            if path in seen:
                continue
            seen.add(path)
            image = re.search(r'<img[^>]+(?:data-original|data-src|src)=["\']([^"\']+)', block, re.I)
            title = re.search(r'<img[^>]+alt=["\']([^"\']+)', block, re.I)
            remark = re.search(r'class=["\']model-view["\'][^>]*>([^<]*)', block, re.I)
            result.append({
                'vod_id': 'kanav:' + path,
                'vod_name': self._clean(title.group(1)) if title else path,
                'vod_pic': html.unescape(image.group(1)) if image else '',
                'vod_remarks': self._clean(remark.group(1)) if remark else '',
            })
        return result

    @staticmethod
    def _page_count(content, current=1):
        pages = [int(value) for value in re.findall(r'/page/(\d+)\.html', content or '')]
        return max(pages) if pages else current

    @staticmethod
    def _player_data(content):
        match = re.search(r'var\s+player_[\w]+\s*=\s*(\{.*?\})\s*<', content or '', re.S)
        if not match:
            match = re.search(r'var\s+player_[\w]+\s*=\s*(\{.*?\})\s*;', content or '', re.S)
        if not match:
            return {}
        try:
            return json.loads(match.group(1))
        except Exception:
            return {}

    @staticmethod
    def _decode_media(value):
        if not value:
            return ''
        try:
            padded = value + '=' * (-len(value) % 4)
            value = base64.b64decode(padded).decode('utf-8')
        except Exception:
            pass
        return html.unescape(unquote(value.replace('\\/', '/')))

    def homeContent(self, filter):
        return {'class': [
            {'type_id': type_id, 'type_name': name}
            for type_id, name in self.CLASSES
        ]}

    def homeVideoContent(self):
        return self.categoryContent('1', '1', False, {})

    def categoryContent(self, tid, pg, filter, extend):
        page = int(pg or 1)
        url = '%s/index.php/vod/type/id/%s/page/%d.html' % (self.host, tid, page)
        content = self._fetch_page(url, 'video-item')
        items = self._parse_cards(content)
        return {
            'list': items,
            'page': page,
            'pagecount': self._page_count(content, page),
            'limit': len(items) or 24,
        }

    def detailContent(self, ids):
        path = str(ids[0]).split(':', 1)[-1]
        url = urljoin(self.host + '/', path)
        content = self._fetch_page(url, 'player_')
        data = self._player_data(content)
        vod_data = data.get('vod_data') or {}
        media = self._decode_media(data.get('url', ''))
        title = vod_data.get('vod_name', '')
        if not title:
            match = re.search(r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)', content, re.I)
            title = self._clean(match.group(1)) if match else path
        poster = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)', content, re.I)
        if not poster:
            poster = re.search(r'<img[^>]+class=["\'][^"\']*countext-img[^"\']*["\'][^>]+src=["\']([^"\']+)', content, re.I)
        play_url = ('播放$' + media) if media else ('网页播放$' + url)
        return {'list': [{
            'vod_id': ids[0],
            'vod_name': title,
            'vod_pic': html.unescape(poster.group(1)) if poster else '',
            'vod_actor': vod_data.get('vod_actor', ''),
            'vod_director': vod_data.get('vod_director', ''),
            'type_name': vod_data.get('vod_class', ''),
            'vod_play_from': 'KanAV',
            'vod_play_url': play_url,
        }]}

    def searchContent(self, key, quick, pg='1', extend=None):
        page = int(pg or 1)
        path = '/index.php/vod/search/by/time_add/page/%d/wd/%s.html' % (
            page, quote(key, safe=''))
        content = self._fetch_page(self.host + path, 'video-item')
        items = self._parse_cards(content)
        return {
            'list': items,
            'page': page,
            'pagecount': self._page_count(content, page),
            'limit': len(items) or 24,
        }

    def searchContentPage(self, key, quick, pg='1'):
        return self.searchContent(key, quick, pg)

    def playerContent(self, flag, vod_id, vipFlags=None):
        if not str(vod_id).startswith('http'):
            return {'parse': 1, 'jx': 0, 'url': vod_id}
        return {
            'parse': 0,
            'url': vod_id,
            'header': {
                'User-Agent': self.UA,
                'Referer': self.host + '/',
                'Origin': self.host,
            },
        }
