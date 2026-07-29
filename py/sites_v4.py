# -*- coding: utf-8 -*-
import html
import json
import re
from urllib.parse import quote, urlencode, urljoin

import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class Spider:
    UA = "Mozilla/5.0 (Linux; Android 13; TVBox) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
    AV_HOST = "https://123av.com"
    JABLE_HOST = "https://jable.tv"
    MISSAV_HOSTS = ("https://missav.ws", "https://missav.ai")
    HANIME_HOSTS = ("https://hanime1.best", "https://hanimeone.me", "https://hanime1.me")

    def init(self, extend=""):
        try:
            value = json.loads(extend)
            self.mode = value.get("mode", "123av") if isinstance(value, dict) else str(value)
        except Exception:
            self.mode = str(extend or "123av")
        self.hanime_host = self.HANIME_HOSTS[0]
        self.missav_host = self.MISSAV_HOSTS[0]
        self.session = requests.Session()

    def getName(self):
        return self.mode

    def getDependence(self):
        return []

    def destroy(self):
        self.session.close()

    def liveContent(self, url):
        return {"list": []}

    def localProxy(self, params):
        return [404, "text/plain", "", ""]

    def isVideoFormat(self, url):
        return False

    def manualVideoCheck(self):
        return False

    def getProxyUrl(self):
        return ""

    def _headers(self, referer=""):
        result = {
            "User-Agent": self.UA,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.7",
        }
        if referer:
            result["Referer"] = referer
        return result

    def _get(self, url, referer=""):
        try:
            response = self.session.get(
                url,
                headers=self._headers(referer),
                timeout=25,
                verify=False,
            )
            print(
                "[DEBUG-v9] GET status=%s len=%s watch=%s rows=%s cf=%s url=%s"
                % (
                    response.status_code,
                    len(response.text),
                    response.text.count("watch?v="),
                    response.text.count("home-rows-videos"),
                    "Just a moment" in response.text or "Attention Required" in response.text,
                    url,
                )
            )
            if "jable.tv" in url:
                try:
                    with open(
                        "/sdcard/Android/data/com.hlyt.gamehlythz.yscsp/files/jable-debug.html",
                        "w",
                        encoding="utf-8",
                    ) as debug_file:
                        debug_file.write(response.text)
                except Exception:
                    pass
            return response.text
        except Exception as error:
            print("[DEBUG-v9] GET error=%s url=%s" % (type(error).__name__, url))
            return ""

    def _get_missav(self, path, query=""):
        path = "/" + path.lstrip("/")
        hosts = (self.missav_host,) + tuple(host for host in self.MISSAV_HOSTS if host != self.missav_host)
        for host in hosts:
            url = host + path + query
            content = self._get(url, host + "/cn/")
            if content and "error code: 1015" not in content.lower() and "cf-error-details" not in content.lower():
                self.missav_host = host
                return content, url
        return "", self.missav_host + path + query

    @staticmethod
    def _unpack_packer(content):
        results = []
        pattern = re.compile(
            r"eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\('((?:\\.|[^'])*)',(\d+),(\d+),'((?:\\.|[^'])*)'\.split\('\|'\)",
            re.I,
        )
        for payload, radix, _count, words in pattern.findall(content or ""):
            radix = int(radix)
            table = words.replace(r"\'", "'").replace(r"\\", "\\").split("|")

            def replace(match):
                token = match.group(0).lower()
                try:
                    index = int(token, radix)
                except ValueError:
                    return match.group(0)
                return table[index] if index < len(table) and table[index] else match.group(0)

            unpacked = re.sub(r"\b[0-9a-z]+\b", replace, payload, flags=re.I)
            results.append(unpacked.replace(r"\/", "/").replace(r"\'", "'"))
        return "\n".join(results)

    @staticmethod
    def _clean(value):
        value = re.sub(r"<script[\s\S]*?</script>", "", value or "", flags=re.I)
        value = re.sub(r"<style[\s\S]*?</style>", "", value, flags=re.I)
        value = re.sub(r"<[^>]+>", " ", value)
        return re.sub(r"\s+", " ", html.unescape(value)).strip()

    @staticmethod
    def _attr(block, name):
        match = re.search(r"\b%s\s*=\s*['\"]([^'\"]+)" % re.escape(name), block, re.I)
        return html.unescape(match.group(1)) if match else ""

    @staticmethod
    def _page_count(content, current=1):
        matches = re.findall(r"pager__total[^>]*>\s*/\s*([\d,]+)|/\s*([\d,]+)\s*<", content, re.I)
        values = [int((a or b).replace(",", "")) for a, b in matches if a or b]
        if values:
            return max(values)
        pages = [int(x) for x in re.findall(r"[?&](?:page|from)=(\d+)", content)]
        return max(pages) if pages else current

    def _parse_av_cards(self, content, prefix="video:"):
        result = []
        seen = set()
        for block in re.split(r'<div\s+class="card"', content, flags=re.I)[1:]:
            match = re.search(r'href=["\']/en/v/([^"\'?#/]+)', block, re.I)
            if not match:
                continue
            slug = html.unescape(match.group(1))
            if slug in seen:
                continue
            seen.add(slug)
            title = re.search(r'class="card__link"[^>]*>([\s\S]*?)</a>', block, re.I)
            image = re.search(r'class="card__img"[^>]+src="([^"]+)"', block, re.I)
            duration = re.search(r'class="card__dur"[^>]*>([\s\S]*?)</span>', block, re.I)
            result.append({
                "vod_id": prefix + slug,
                "vod_name": self._clean(title.group(1)) if title else slug.upper(),
                "vod_pic": html.unescape(image.group(1)) if image else "",
                "vod_remarks": self._clean(duration.group(1)) if duration else "",
            })
        return result

    def _parse_av_folders(self, content, root):
        pattern = r'<a[^>]+href=["\']/en/%s/([^"\'?#/]+)["\'][^>]*>([\s\S]*?)</a>' % re.escape(root)
        result = []
        seen = set()
        for slug, body in re.findall(pattern, content, re.I):
            name = self._clean(body)
            if not name or slug in seen:
                continue
            seen.add(slug)
            result.append({
                "vod_id": "%s/%s" % (root, html.unescape(slug)),
                "vod_name": name,
                "vod_tag": "folder",
                "style": {"type": "rect", "ratio": 2.0},
            })
        return result

    @staticmethod
    def _filters():
        years = [{"n": "全部", "v": ""}] + [
            {"n": str(year), "v": str(year)} for year in range(2026, 1999, -1)
        ]
        return [
            {"key": "type", "name": "类型", "value": [
                {"n": "全部", "v": ""}, {"n": "有码", "v": "censored"},
                {"n": "无码", "v": "uncensored"}, {"n": "无码流出", "v": "uncensored-leaked"},
            ]},
            {"key": "year", "name": "年份", "value": years},
            {"key": "sort", "name": "排序", "value": [
                {"n": "发行日期", "v": "release_date"}, {"n": "最近更新", "v": "recent"},
                {"n": "热门", "v": "hot"}, {"n": "今日热门", "v": "today"},
                {"n": "本周热门", "v": "week"}, {"n": "本月热门", "v": "month"},
                {"n": "最多观看", "v": "views"}, {"n": "最多收藏", "v": "follows"},
            ]},
        ]

    def _av_classes(self):
        classes = [
            ("all", "全部影片"), ("new", "最新发布"), ("hot", "热门影片"),
            ("recent", "最近更新"), ("censored", "有码"),
            ("uncensored", "无码"), ("uncensored-leaked", "无码流出"),
            ("genres", "类型标签"), ("actresses", "女优"),
            ("makers", "厂商"), ("series", "系列"),
        ]
        result = [{"type_id": key, "type_name": name} for key, name in classes]
        filters = {key: self._filters() for key, _ in classes[:7]}
        return result, filters

    def _av_url(self, tid, pg, extend=None):
        extend = extend or {}
        params = {"page": str(pg)}
        for key in ("type", "year", "sort"):
            if extend.get(key):
                params[key] = extend[key]
        return "%s/en/%s?%s" % (self.AV_HOST, tid, urlencode(params))

    def _parse_jable(self, content):
        result = []
        seen = set()
        for block in re.split(r'class="video-img-box', content, flags=re.I)[1:]:
            match = re.search(r'href=["\'](?:https://jable\.tv)?/videos/([^"\'/?#]+)/?', block, re.I)
            if not match or match.group(1) in seen:
                continue
            slug = match.group(1)
            seen.add(slug)
            title = re.search(r'class="title"[^>]*>([\s\S]*?)</', block, re.I)
            image = re.search(r'(?:data-src|src)=["\']([^"\']+)', block, re.I)
            duration = re.search(r'class="absolute-bottom-right"[^>]*>([\s\S]*?)</', block, re.I)
            result.append({
                "vod_id": "jable-video:" + slug,
                "vod_name": self._clean(title.group(1)) if title else slug.upper(),
                "vod_pic": html.unescape(image.group(1)) if image else "",
                "vod_remarks": self._clean(duration.group(1)) if duration else "",
            })
        return result

    def _parse_missav(self, content):
        result = []
        seen = set()
        for block in re.split(r'class="thumbnail', content, flags=re.I)[1:]:
            match = re.search(r'href=["\'](?:https://missav\.[^/]+)?/(?:cn/)?([^"\'?#]+)', block, re.I)
            if not match:
                continue
            path = match.group(1).strip("/")
            if not path or path in seen or path.startswith(("search", "genres", "makers", "actresses")):
                continue
            seen.add(path)
            title = re.search(r'class="[^"]*text-secondary[^"]*"[^>]*>([\s\S]*?)</a>', block, re.I)
            image = re.search(r'(?:data-src|src)=["\']([^"\']+)', block, re.I)
            duration = re.search(r'class="[^"]*(?:right-1|left-1)[^"]*"[^>]*>([\s\S]*?)</', block, re.I)
            result.append({
                "vod_id": "missav-video:" + path,
                "vod_name": self._clean(title.group(1)) if title else path.upper(),
                "vod_pic": html.unescape(image.group(1)) if image else "",
                "vod_remarks": self._clean(duration.group(1)) if duration else "",
            })
        return result

    def _parse_missav_folders(self, content, roots):
        roots_pattern = "|".join(re.escape(root) for root in roots)
        pattern = re.compile(
            r'<a[^>]+href=["\'](?:https?://[^/"\']+)?((?:/[^/"\']+)?/cn/(%s)/([^"\'?#]+))["\'][^>]*class=["\'][^"\']*text-nord13[^"\']*["\'][^>]*>([\s\S]*?)</a>'
            % roots_pattern,
            re.I,
        )
        result = []
        seen = set()
        for request_path, root, slug, body in pattern.findall(content or ""):
            path = html.unescape(request_path)
            name = self._clean(body)
            if not name or path in seen or path.endswith("/actresses/ranking"):
                continue
            seen.add(path)
            result.append({
                "vod_id": "missav-folder:" + path,
                "vod_name": name,
                "vod_tag": "folder",
                "style": {"type": "rect", "ratio": 2.0},
            })
        return result

    @staticmethod
    def _missav_filters():
        return [
            {"key": "filters", "name": "过滤", "value": [
                {"n": "所有", "v": ""}, {"n": "单人作品", "v": "individual"},
                {"n": "多人作品", "v": "multiple"},
                {"n": "中文字幕", "v": "chinese-subtitle"},
            ]},
            {"key": "sort", "name": "排序", "value": [
                {"n": "发行日期", "v": "released_at"}, {"n": "最近更新", "v": "published_at"},
                {"n": "收藏数", "v": "saved"}, {"n": "今日浏览", "v": "today_views"},
                {"n": "本周浏览", "v": "weekly_views"}, {"n": "本月浏览", "v": "monthly_views"},
                {"n": "总浏览数", "v": "views"},
            ]},
        ]

    def _direct_classes(self):
        if self.mode == "jable":
            classes = [
                ("jable:latest-updates", "最近更新"), ("jable:hot", "热门影片"),
                ("jable:categories/chinese-subtitle", "中文字幕"),
                ("jable:new-release", "全新上市"), ("jable:categories", "主题与标签"),
            ]
        else:
            classes = [
                ("missav:new", "所有影片"), ("missav:madou", "麻豆传媒"),
                ("missav:chinese-subtitle", "中文字幕"),
                ("missav:uncensored-leak", "无码流出"),
                ("missav:actresses/ranking", "热门女优"),
                ("missav:makers", "发行商"), ("missav:genres", "类型"),
            ]
        result = [{"type_id": key, "type_name": name} for key, name in classes]
        if self.mode == "missav":
            folder_ids = {"missav:actresses/ranking", "missav:makers", "missav:genres"}
            filters = {item["type_id"]: self._missav_filters() for item in result if item["type_id"] not in folder_ids}
            return result, filters
        return result, {}

    def _select_hanime_host(self):
        for host in self.HANIME_HOSTS:
            content = self._get(host + "/search?sort=%s&page=1" % quote("最新上市"), host + "/")
            if self._parse_hanime(content):
                self.hanime_host = host
                return content
        return ""

    def _parse_hanime(self, content):
        result = []
        seen = set()
        patterns = (
            re.compile(
                r'class="video-item-container".*?href="[^"]*v=(\d+)".*?src="([^"]+)".*?class="duration">(.*?)<.*?class="title">(.*?)<',
                re.I | re.S,
            ),
            re.compile(
                r'href="[^"]*watch\?v=(\d+)".*?src="([^"]+)".*?class="home-rows-videos-title"[^>]*>(.*?)</div>',
                re.I | re.S,
            ),
        )
        for index, pattern in enumerate(patterns):
            for match in pattern.findall(content or ""):
                video_id, image = match[0], match[1]
                duration, title = (match[2], match[3]) if index == 0 else ("", match[2])
                if video_id in seen:
                    continue
                seen.add(video_id)
                result.append({
                    "vod_id": "hanime-video:" + video_id,
                    "vod_name": self._clean(title),
                    "vod_pic": html.unescape(image),
                    "vod_remarks": self._clean(duration),
                })
            if result:
                break
        return result

    def _hanime_classes(self):
        values = [
            ("latest_rank", "最新上市"), ("裏番", "裏番"), ("泡麵番", "泡面番"),
            ("Motion Anime", "Motion Anime"), ("3DCG", "3DCG"), ("2.5D", "2.5D"),
            ("2D動畫", "2D动画"),
            ("AI生成", "AI生成"), ("MMD", "MMD"), ("Cosplay", "Cosplay"),
            ("daily_rank", "本日排行"), ("weekly_rank", "本周排行"),
            ("monthly_rank", "本月排行"),
        ]
        classes = [{"type_id": key, "type_name": name} for key, name in values]
        sort_filter = [{"key": "sort", "name": "排序", "value": [
            {"n": "最新上市", "v": "最新上市"}, {"n": "最新上传", "v": "最新上傳"},
            {"n": "本日排行", "v": "本日排行"}, {"n": "本周排行", "v": "本週排行"},
            {"n": "本月排行", "v": "本月排行"}, {"n": "观看次数", "v": "觀看次數"},
        ]}]
        return classes, {key: sort_filter for key, _ in values}

    def homeContent(self, filter):
        if self.mode == "hanime":
            self._select_hanime_host()
            classes, filters = self._hanime_classes()
            return {"class": classes, "filters": filters}
        if self.mode == "123av":
            classes, filters = self._av_classes()
            return {"class": classes, "filters": filters}
        classes, filters = self._direct_classes()
        return {"class": classes, "filters": filters}

    def homeVideoContent(self):
        if self.mode == "hanime":
            return self.categoryContent("latest_rank", "1", False, {})
        if self.mode == "123av":
            return self.categoryContent("all", "1", False, {})
        tid = self.mode + (":latest-updates" if self.mode == "jable" else ":new")
        return self.categoryContent(tid, "1", False, {})

    def categoryContent(self, tid, pg, filter, extend):
        page = int(pg or 1)
        extend = extend or {}
        if self.mode == "hanime":
            rank = {
                "latest_rank": "最新上市", "daily_rank": "本日排行",
                "weekly_rank": "本週排行", "monthly_rank": "本月排行",
            }
            if tid in rank:
                url = "%s/search?sort=%s&page=%d" % (self.hanime_host, quote(rank[tid]), page)
            else:
                sort = extend.get("sort", "最新上市")
                url = "%s/search?genre=%s&sort=%s&page=%d" % (
                    self.hanime_host, quote(tid), quote(sort), page)
            content = self._get(url, self.hanime_host + "/")
            items = self._parse_hanime(content)
            return {"list": items, "page": page, "pagecount": self._page_count(content, page), "limit": 40}
        if self.mode == "123av":
            url = self._av_url(tid, page, extend)
            content = self._get(url, self.AV_HOST + "/en/")
            if tid in ("genres", "actresses", "makers", "series"):
                items = self._parse_av_folders(content, tid)
                return {"list": items, "page": 1, "pagecount": 1, "limit": len(items) or 1}
            items = self._parse_av_cards(content)
            return {"list": items, "page": page, "pagecount": self._page_count(content, page), "limit": 12}
        path = tid.split(":", 1)[1] if ":" in tid else tid
        if self.mode == "jable":
            url = "%s/%s/%s" % (self.JABLE_HOST, path.strip("/"), "" if page == 1 else str(page) + "/")
            if "?" not in url:
                url += "?from=%d" % page
            content = self._get(url, self.JABLE_HOST + "/")
            items = self._parse_jable(content)
        else:
            params = {"page": str(page)}
            for key in ("filters", "sort"):
                if extend.get(key):
                    params[key] = extend[key]
            query = "?" + urlencode(params)
            request_path = path if path.startswith("/") and "/cn/" in path else "/cn/%s" % path.strip("/")
            content, url = self._get_missav(request_path, query)
            if path in ("actresses/ranking", "makers", "genres"):
                roots = ("actresses",) if path == "actresses/ranking" else (path,)
                items = self._parse_missav_folders(content, roots)
                return {"list": items, "page": page, "pagecount": self._page_count(content, page), "limit": len(items) or 1}
            else:
                items = self._parse_missav(content)
        return {"list": items, "page": page, "pagecount": self._page_count(content, page), "limit": 24}

    def _media_variants(self, media_url, referer):
        if not media_url:
            return []
        content = self._get(media_url, referer)
        lines = [line.strip() for line in content.splitlines() if line.strip()]
        result = []
        for index, line in enumerate(lines):
            if not line.startswith("#EXT-X-STREAM-INF"):
                continue
            resolution = re.search(r"RESOLUTION=\d+x(\d+)", line, re.I)
            next_url = next((value for value in lines[index + 1:] if not value.startswith("#")), "")
            if next_url:
                quality = (resolution.group(1) + "P") if resolution else "高清"
                result.append((quality, urljoin(media_url, next_url)))
        if result:
            unique = []
            seen = set()
            for quality, url in sorted(result, key=lambda item: int(re.sub(r"\D", "", item[0]) or 0), reverse=True):
                if url not in seen:
                    seen.add(url)
                    unique.append((quality, url))
            return unique
        quality = re.search(r"(?:^|[^0-9])(2160|1440|1080|720|480)(?:p|[^0-9]|$)", media_url, re.I)
        return [((quality.group(1) + "P") if quality else "播放", media_url)]

    def _av_detail(self, slug, source_name):
        url = "%s/en/v/%s" % (self.AV_HOST, slug)
        content = self._get(url, self.AV_HOST + "/en/")
        title = re.search(r"<h1[^>]*>([\s\S]*?)</h1>", content, re.I)
        poster = re.search(r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"', content, re.I)
        media_url = ""
        media_referer = url
        normalized = re.sub(r"\\+/", "/", content)
        iframe = re.search(r'https://javplayer\.cc/e/([A-Za-z0-9_-]+)', normalized, re.I)
        if iframe:
            player_id = iframe.group(1)
            iframe_url = "https://javplayer.cc/e/%s" % player_id
            stream_text = self._get("https://javplayer.cc/stream?id=%s" % quote(player_id), iframe_url)
            try:
                stream_data = json.loads(stream_text)
                media_url = html.unescape(stream_data.get("media", {}).get("stream", ""))
            except Exception:
                media_url = ""
            media_referer = iframe_url
        variants = self._media_variants(media_url, media_referer)
        play_url = "#".join("%s$%s" % item for item in variants)
        if not play_url:
            play_url = "网页播放$" + url
        return {"list": [{
            "vod_id": slug,
            "vod_name": self._clean(title.group(1)) if title else slug.upper(),
            "vod_pic": html.unescape(poster.group(1)) if poster else "",
            "vod_play_from": source_name,
            "vod_play_url": play_url,
        }]}

    def _direct_detail(self, path):
        if self.mode == "jable":
            url = "%s/videos/%s/" % (self.JABLE_HOST, path.strip("/"))
            content = self._get(url, self.JABLE_HOST + "/")
            source = re.search(r'(?:hlsUrl\s*=\s*|"hlsUrl"\s*:\s*)["\']([^"\']+)', content, re.I)
            source_name = "Jable"
        else:
            content, url = self._get_missav("/cn/%s" % path.strip("/"))
            source = re.search(r'(?:hls\.url\s*=\s*|"hls"\s*:\s*)["\']([^"\']+)', content, re.I)
            if not source:
                source = re.search(r'https?://[^\s"\']+\.m3u8[^\s"\']*', content, re.I)
            if not source:
                unpacked = self._unpack_packer(content)
                source = re.search(r"source\s*=\s*['\"]([^'\"]+\.m3u8[^'\"]*)", unpacked, re.I)
            source_name = "MissAV"
        title = re.search(r'<meta[^>]+property="og:title"[^>]+content="([^"]+)"', content, re.I)
        poster = re.search(r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"', content, re.I)
        media_url = html.unescape(source.group(1) if source and source.lastindex else source.group(0) if source else "")
        variants = self._media_variants(media_url, url)
        if not variants:
            variants = [("网页播放", url)]
        return {"list": [{
            "vod_id": path,
            "vod_name": html.unescape(title.group(1)) if title else path.upper(),
            "vod_pic": html.unescape(poster.group(1)) if poster else "",
            "vod_play_from": source_name,
            "vod_play_url": "#".join("%s$%s" % item for item in variants),
        }]}

    def detailContent(self, ids):
        vod_id = ids[0]
        if vod_id.startswith("hanime-video:"):
            vid = vod_id.split(":", 1)[1]
            url = "%s/watch?v=%s" % (self.hanime_host, vid)
            content = self._get(url, self.hanime_host + "/")
            title = re.search(r'<meta[^>]+property="og:title"[^>]+content="([^"]+)"', content, re.I)
            poster = re.search(r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"', content, re.I)
            sources = []
            for tag in re.findall(r'<source[^>]+>', content, re.I):
                src = self._attr(tag, "src")
                quality = self._attr(tag, "size") or self._attr(tag, "label")
                if src:
                    quality = (quality + "P") if quality.isdigit() else (quality or "播放")
                    sources.append((quality, html.unescape(src)))
            sources.sort(key=lambda item: int(re.sub(r"\D", "", item[0]) or 0), reverse=True)
            return {"list": [{
                "vod_id": vid,
                "vod_name": html.unescape(title.group(1)) if title else vid,
                "vod_pic": html.unescape(poster.group(1)) if poster else "",
                "vod_play_from": "Hanime",
                "vod_play_url": "#".join("%s$%s" % item for item in sources),
            }]}
        if vod_id.startswith("jable-video:") or vod_id.startswith("missav-video:"):
            return self._direct_detail(vod_id.split(":", 1)[1])
        if self.mode == "123av":
            slug = vod_id.split(":", 1)[1] if ":" in vod_id else vod_id
            return self._av_detail(slug, "123AV")
        return {"list": []}

    def searchContent(self, key, quick, pg="1", extend=None):
        page = int(pg or 1)
        if self.mode == "hanime":
            url = "%s/search?query=%s&page=%d" % (self.hanime_host, quote(key), page)
            content = self._get(url, self.hanime_host + "/")
            items = self._parse_hanime(content)
        elif self.mode == "jable":
            url = "%s/search/%s/?from=%d" % (self.JABLE_HOST, quote(key, safe=""), page)
            content = self._get(url, self.JABLE_HOST + "/")
            items = self._parse_jable(content)
        elif self.mode == "missav":
            content, url = self._get_missav("/cn/search/%s" % quote(key, safe=""), "?page=%d" % page)
            items = self._parse_missav(content)
        else:
            url = "%s/en/search?keyword=%s&page=%d" % (self.AV_HOST, quote(key), page)
            content = self._get(url, self.AV_HOST + "/en/")
            items = self._parse_av_cards(content)
        return {"list": items, "page": page, "pagecount": self._page_count(content, page)}

    def playerContent(self, flag, vod_id, vipFlags):
        if vod_id.startswith("http") and not re.search(r"\.(?:m3u8|mp4)(?:[?#]|$)", vod_id, re.I):
            return {"parse": 1, "jx": 0, "url": vod_id}
        if flag == "123AV":
            referer = "https://javplayer.cc/"
        elif self.mode == "hanime":
            referer = self.hanime_host + "/"
        elif self.mode == "jable":
            referer = self.JABLE_HOST + "/"
        elif self.mode == "missav":
            referer = self.missav_host + "/cn/"
        else:
            referer = self.AV_HOST + "/en/"
        return {"parse": 0, "url": vod_id, "header": {"User-Agent": self.UA, "Referer": referer}}
