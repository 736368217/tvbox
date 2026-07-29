// ==UserScript==
// @name         Hanime for TVBox
// @namespace    tvbox.456
// @version      2026.07.29
// @description  Hanime GM spider for the current mirror
// @match        https://hanimeone.me/*
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
    const meta = (name) => document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.content || "";

    function parseVideos() {
        const seen = new Set();
        const list = [];
        document.querySelectorAll('a[href*="watch?v="]').forEach((link) => {
            const url = new URL(link.href, location.href);
            const id = url.searchParams.get("v");
            const titleNode = link.querySelector(".home-rows-videos-title, .title");
            const image = link.querySelector("img");
            if (!id || !titleNode || !image || seen.has(id)) return;
            seen.add(id);
            list.push({
                vod_id: id,
                vod_name: titleNode.textContent.trim(),
                vod_pic: image.src || image.getAttribute("data-src") || "",
                vod_remarks: text(link, ".duration, .home-rows-videos-duration")
            });
        });
        return list;
    }

    function pageCount() {
        const skip = text(document, ".skip-page-wrapper, .pager__total").match(/\/\s*(\d+)/);
        if (skip) return Number(skip[1]);
        const pages = [...document.querySelectorAll(".pagination a")]
            .map((a) => Number(a.textContent.trim())).filter(Number.isFinite);
        return pages.length ? Math.max(...pages) : 1;
    }

    const classes = [
        ["全部", "全部"], ["裏番", "裏番"], ["泡麵番", "泡面番"],
        ["Motion Anime", "Motion Anime"], ["3DCG", "3DCG"], ["2.5D", "2.5D"],
        ["2D動畫", "2D动画"], ["無碼18禁遊戲", "无码18禁游戏"], ["AI生成", "AI生成"],
        ["MMD", "MMD"], ["Cosplay", "Cosplay"]
    ].map(([type_id, type_name]) => ({type_id, type_name}));
    const sort = [{
        key: "sort", name: "排序", value: [
            {n: "最新上市", v: "&sort=最新上市"},
            {n: "最新上传", v: "&sort=最新上傳"},
            {n: "本日排行", v: "&sort=本日排行"},
            {n: "本周排行", v: "&sort=本週排行"},
            {n: "本月排行", v: "&sort=本月排行"},
            {n: "观看次数", v: "&sort=觀看次數"}
        ]
    }];

    const spider = {
        homeContent: function () {
            const filters = {};
            classes.forEach((item) => { filters[item.type_id] = sort; });
            return {class: classes, filters: filters, list: parseVideos()};
        },
        homeVideoContent: function () {
            return {list: parseVideos()};
        },
        categoryContent: function (_tid, pg) {
            return {list: parseVideos(), page: Number(pg) || 1, pagecount: pageCount(), limit: 40};
        },
        detailContent: function (ids) {
            const sources = [...document.querySelectorAll("#player source, video source")]
                .map((source) => ({
                    url: source.src,
                    quality: source.getAttribute("size") || source.getAttribute("label") || "高清"
                }))
                .filter((source) => source.url)
                .sort((a, b) => Number(b.quality) - Number(a.quality));
            const tags = (meta("twitter:description").split(" - ")[1] || "").trim();
            return {list: [{
                vod_id: ids[0],
                vod_name: meta("og:title") || document.title,
                vod_pic: meta("og:image") || document.querySelector("#player")?.poster || "",
                vod_remarks: tags,
                vod_content: meta("description") || meta("og:description"),
                vod_play_from: "Hanime",
                vod_play_url: sources.map((source) => `${source.quality}P$${source.url}`).join("#")
            }]};
        },
        searchContent: function (_key, _quick, pg) {
            return {list: parseVideos(), page: Number(pg) || 1, pagecount: pageCount()};
        },
        playerContent: function (_flag, id) {
            return {
                parse: 0,
                url: id,
                header: {
                    "User-Agent": navigator.userAgent,
                    "Referer": "https://hanimeone.me/"
                }
            };
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
