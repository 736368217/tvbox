// ==UserScript==
// @name         123AV family for TVBox
// @namespace    tvbox.456
// @version      2026.07.29
// @description  123AV, MissAV mirror and Jable mirror GM spider
// @match        https://123av.com/*
// @grant        none
// ==/UserScript==
(function () {
    "use strict";

    const args = {name: "homeContent", values: [true]};
    if (typeof GmSpiderInject !== "undefined") {
        const injected = JSON.parse(GmSpiderInject.GetSpiderArgs());
        args.name = injected.shift();
        args.values = injected;
    }

    const text = (root, selector) => (root.querySelector(selector)?.textContent || "").trim();
    const absolute = (value) => value ? new URL(value, location.href).href : "";
    const slugFromHref = (href) => {
        try {
            const parts = new URL(href, location.href).pathname.split("/v/");
            return parts.length > 1 ? parts[1].split("/")[0] : "";
        } catch (_) {
            return "";
        }
    };

    function parseCards() {
        const seen = new Set();
        const list = [];
        document.querySelectorAll(".card").forEach((card) => {
            const link = card.querySelector(".card__link, .card__cover");
            const id = slugFromHref(link?.getAttribute("href"));
            if (!id || seen.has(id)) return;
            seen.add(id);
            const meta = [...card.querySelectorAll(".card__meta span")]
                .map((node) => node.textContent.trim()).filter(Boolean);
            list.push({
                vod_id: id,
                vod_name: text(card, ".card__title") || id.toUpperCase(),
                vod_pic: absolute(card.querySelector(".card__img")?.getAttribute("src")),
                vod_remarks: text(card, ".card__dur"),
                vod_year: meta.join(" · ")
            });
        });
        return list;
    }

    function pageCount() {
        const total = text(document, ".pager__total").match(/\d+/);
        if (total) return Number(total[0]);
        const pages = [...document.querySelectorAll(".pager a, .pagination a")]
            .map((a) => Number(a.textContent.trim())).filter(Number.isFinite);
        return pages.length ? Math.max(...pages) : 1;
    }

    const typeFilter = {
        key: "type", name: "类型", value: [
            {n: "全部", v: ""},
            {n: "有码", v: "&type=censored"},
            {n: "无码", v: "&type=uncensored"},
            {n: "无码流出", v: "&type=uncensored-leaked"},
            {n: "VR", v: "&type=vr"}
        ]
    };
    const yearFilter = {
        key: "year", name: "年份", value: [{n: "全部", v: ""}].concat(
            Array.from({length: 17}, (_, i) => String(2026 - i)).map((year) => ({
                n: year, v: "&year=" + year
            }))
        )
    };
    const actressFilter = {
        key: "actress", name: "女优", value: [
            {n: "全部", v: ""},
            {n: "单女优", v: "&actress=single"},
            {n: "多女优", v: "&actress=multi"}
        ]
    };
    const sortFilter = {
        key: "sort", name: "排序", value: [
            {n: "发行日期", v: "&sort=release_date"},
            {n: "最近添加", v: "&sort=recent"},
            {n: "热门", v: "&sort=hot"},
            {n: "今日观看", v: "&sort=today"},
            {n: "本周观看", v: "&sort=week"},
            {n: "本月观看", v: "&sort=month"},
            {n: "最多观看", v: "&sort=views"},
            {n: "最多收藏", v: "&sort=follows"},
            {n: "时长最长", v: "&sort=longest"}
        ]
    };
    const fullFilters = [typeFilter, yearFilter, actressFilter, sortFilter];

    function classesForPage() {
        const path = location.pathname;
        if (path.endsWith("/missav")) return [
            {type_id: "missav?sort=release_date", type_name: "最新发行"},
            {type_id: "missav?sort=recent", type_name: "最近更新"},
            {type_id: "missav?sort=hot", type_name: "热门影片"},
            {type_id: "missav?sort=today", type_name: "今日热门"},
            {type_id: "missav?sort=week", type_name: "本周热门"},
            {type_id: "missav?sort=month", type_name: "本月热门"},
            {type_id: "missav?sort=views", type_name: "最多观看"},
            {type_id: "missav?sort=follows", type_name: "最多收藏"},
            {type_id: "missav?type=censored", type_name: "有码"},
            {type_id: "missav?type=uncensored", type_name: "无码"},
            {type_id: "missav?type=uncensored-leaked", type_name: "无码流出"}
        ];
        if (path.endsWith("/jable")) return [
            {type_id: "jable?sort=recent", type_name: "最近更新"},
            {type_id: "jable?sort=release_date", type_name: "最新发行"},
            {type_id: "jable?sort=hot", type_name: "热门影片"},
            {type_id: "jable?sort=today", type_name: "今日热门"},
            {type_id: "jable?sort=week", type_name: "本周热门"},
            {type_id: "jable?sort=month", type_name: "本月热门"},
            {type_id: "jable?sort=views", type_name: "最多观看"},
            {type_id: "jable?sort=follows", type_name: "最多收藏"},
            {type_id: "jable?type=censored", type_name: "有码"},
            {type_id: "jable?type=uncensored", type_name: "无码"},
            {type_id: "jable?type=uncensored-leaked", type_name: "无码流出"}
        ];
        return [
            {type_id: "all?sort=release_date", type_name: "最新发行"},
            {type_id: "all?sort=recent", type_name: "最近更新"},
            {type_id: "all?sort=hot", type_name: "热门影片"},
            {type_id: "all?sort=today", type_name: "今日热门"},
            {type_id: "all?sort=week", type_name: "本周热门"},
            {type_id: "all?sort=month", type_name: "本月热门"},
            {type_id: "all?sort=views", type_name: "最多观看"},
            {type_id: "all?sort=follows", type_name: "最多收藏"},
            {type_id: "censored?sort=release_date", type_name: "有码"},
            {type_id: "uncensored?sort=release_date", type_name: "无码"},
            {type_id: "uncensored-leaked?sort=release_date", type_name: "无码流出"}
        ];
    }

    const spider = {
        homeContent: function () {
            const classes = classesForPage();
            const filters = {};
            classes.forEach((item) => { filters[item.type_id] = fullFilters; });
            return {class: classes, filters: filters, list: parseCards()};
        },
        homeVideoContent: function () {
            return {list: parseCards()};
        },
        categoryContent: function (_tid, pg) {
            return {list: parseCards(), page: Number(pg) || 1, pagecount: pageCount(), limit: 12};
        },
        detailContent: function (ids) {
            const id = ids[0];
            const iframe = document.querySelector('iframe[src*="javplayer"]');
            let poster = "";
            if (iframe?.src) {
                try { poster = new URL(iframe.src).searchParams.get("poster") || ""; } catch (_) {}
            }
            const title = text(document, "h1") || id.toUpperCase();
            const detailText = text(document, ".details, .watch__details, main");
            const labels = [...document.querySelectorAll('a[href*="/actresses/"], a[href*="/genres/"], a[href*="/makers/"]')]
                .map((a) => a.textContent.trim()).filter(Boolean);
            return {list: [{
                vod_id: id,
                vod_name: title,
                vod_pic: poster,
                vod_actor: [...new Set(labels)].join(" "),
                vod_content: detailText.slice(0, 1500),
                vod_play_from: "123AV",
                vod_play_data: [{
                    from: "123AV",
                    media: [{name: "播放", type: "webview", ext: {replace: {vod_id: id}}}]
                }]
            }]};
        },
        playerContent: function () {
            return {type: "match"};
        },
        searchContent: function (_key, _quick, pg) {
            return {list: parseCards(), page: Number(pg) || 1, pagecount: pageCount(), limit: 12};
        }
    };

    function run() {
        let result = {list: []};
        try {
            if (/Just a moment|Attention Required/i.test(document.title)) {
                result = {list: [], msg: "站点安全验证未通过，请稍后重试"};
            } else if (typeof spider[args.name] === "function") {
                result = spider[args.name](...args.values);
            }
        } catch (error) {
            result = {list: [], msg: String(error)};
        }
        if (typeof GmSpiderInject !== "undefined") {
            GmSpiderInject.SetSpiderResult(JSON.stringify(result));
        } else {
            console.log(JSON.stringify(result));
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", run, {once: true});
    } else {
        setTimeout(run, 0);
    }
})();
