// ==UserScript==
// @name         Jable
// @namespace    gmspider
// @version      2026.07.29
// @description  Jable GMSpider
// @author       Luomo
// @match        https://jable.tv/*
// @require      https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.slim.min.js
// @grant        unsafeWindow
// ==/UserScript==
console.log(JSON.stringify(GM_info));
(function () {
    const GMSpiderArgs = {};
    if (typeof GmSpiderInject !== 'undefined') {
        let args = JSON.parse(GmSpiderInject.GetSpiderArgs());
        GMSpiderArgs.fName = args.shift();
        GMSpiderArgs.fArgs = args;
    } else {
        GMSpiderArgs.fName = "homeContent";
        GMSpiderArgs.fArgs = [true];
    }
    Object.freeze(GMSpiderArgs);
    const GmSpider = (function () {
        function listVideos(result) {
            result.pagecount = parseInt($(".pagination .page-item:last").text());
            $("[id^='list_videos_'] .row:first .video-img-box").each(function (i) {
                const subTitle = $(this).find(".sub-title").text().split('\n');
                const remarks = [
                    "👁️" + subTitle[1].trim(),
                    "❤️" + subTitle[2].trim()
                ];
                const url = new URL($(this).find(".img-box a").attr("href"));
                result.list.push({
                    vod_id: url.pathname.split('/').at(2).toUpperCase(),
                    vod_name: $(this).find(".title").text(),
                    vod_pic: $(this).find(".img-box img").data("src"),
                    vod_remarks: remarks.join(" "),
                    vod_year: $(this).find(".absolute-bottom-right").text().trim()
                })
            });
            return result;
        }

        return {
            homeContent: function (filter) {
                let result = {
                    class: [
                        {type_id: "latest-updates", type_name: "最近更新"},
                        {type_id: "hot", type_name: "热门影片"},
                        {type_id: "categories/chinese-subtitle", type_name: "中文字幕"},
                        {type_id: "new-release", type_name: "全新上市"},
                        {type_id: "categories", type_name: "主题&标签"},
                    ],
                    filters: {
                        hot: [{
                            key: "sort_by",
                            name: "时间",
                            value: [
                                {
                                    n: "所有时间",
                                    v: "&sort_by=video_viewed"
                                },
                                {
                                    n: "本月热门",
                                    v: "&sort_by=video_viewed_month"
                                },
                                {
                                    n: "本周热门",
                                    v: "&sort_by=video_viewed_week"
                                },
                                {
                                    n: "今日热门",
                                    v: "&sort_by=video_viewed_today"
                                }
                            ]
                        }],
                        "categories/chinese-subtitle": [{
                            key: "sort_by",
                            name: "时间",
                            value: [
                                {
                                    n: "近期最佳",
                                    v: "&sort_by=post_date_and_popularity"
                                },
                                {
                                    n: "最近更新",
                                    v: "&sort_by=post_date"
                                },
                                {
                                    n: "最多观看",
                                    v: "&sort_by=video_viewed"
                                },
                                {
                                    n: "最高收藏",
                                    v: "&sort_by=most_favourited"
                                }
                            ]
                        }],
                        categories: [{
                            key: "sort_by",
                            name: "时间",
                            value: [
                                {
                                    n: "近期最佳",
                                    v: "&sort_by=post_date_and_popularity"
                                },
                                {
                                    n: "最近更新",
                                    v: "&sort_by=post_date"
                                },
                                {
                                    n: "最多观看",
                                    v: "&sort_by=video_viewed"
                                },
                                {
                                    n: "最高收藏",
                                    v: "&sort_by=most_favourited"
                                }
                            ]
                        }]
                    },
                    list: []
                };
                let itemList = [];
                $(".video-img-box").has(".detail").has("img").each(function () {
                    const url = new URL($(this).find(".img-box a").attr("href"));
                    if (url.hostname === "jable.tv") {
                        itemList.push({
                            vod_id: url.pathname.split('/').at(2).toUpperCase(),
                            vod_name: $(this).find(".title").text(),
                            vod_pic: $(this).find("img").data("src"),
                            vod_year: $(this).find(".absolute-bottom-right").text().trim()
                        })
                    }
                });
                result.list = itemList.filter((item, index) => {
                    return itemList.findIndex(i => i.vod_id === item.vod_id) === index
                });
                return result;
            },
            categoryContent: function (tid, pg, filter, extend) {
                let result = {
                    list: [],
                    pagecount: 1
                };
                if (tid === "categories") {
                    $("#list_categories_video_categories_list .video-img-box").each(function () {
                        const url = new URL($(this).find("a").attr("href")).pathname.split('/');
                        result.list.push({
                            vod_id: url[1] + "/" + url[2],
                            vod_name: $(this).find("h4").text(),
                            vod_pic: $(this).find("img").attr("src"),
                            vod_remarks: $(this).find(".absolute-center span").text(),
                            vod_tag: "folder",
                            style: {
                                "type": "rect",
                                "ratio": 1
                            }
                        })
                    });
                    const tags = [];
                    $(".app-nav .title-box:gt(0)").each(function () {
                        const remark = $(this).text();
                        $(this).next(".row").find(".tag").each(function () {
                            const url = new URL($(this).attr("href")).pathname.split('/');
                            result.list.push({
                                vod_id: url[1] + "/" + url[2],
                                vod_name: $(this).text(),
                                vod_remarks: remark,
                                vod_tag: "folder",
                            })
                        });
                    });
                    result.pagecount = 1;
                } else {
                    listVideos(result);
                }
                return result;
            },
            detailContent: function (ids) {
                let vodActor = [], categories = [], tags = [];
                $(".video-info .info-header .models .model").each(function () {
                    const url = new URL($(this).attr("href")).pathname.split('/');
                    const id = url[1] + "/" + url[2];
                    const name = $(this).find(".rounded-circle").data("original-title");
                    vodActor.push(`[a=cr:{"id":"${id}","name":"${name}"}/]${name}[/a]`);
                });
                $(".video-info .tags .cat").each(function () {
                    const url = new URL($(this).attr("href")).pathname.split('/');
                    const id = url[1] + "/" + url[2];
                    const name = $(this).text();
                    categories.push(`[a=cr:{"id":"${id}","name":"${name}"}/]#${name}[/a]`);
                });
                $(".video-info .tags a:not(.cat)").each(function () {
                    const url = new URL($(this).attr("href")).pathname.split('/');
                    const id = url[1] + "/" + url[2];
                    const name = $(this).text();
                    tags.push(`[a=cr:{"id":"${id}","name":"${name}"}/]#${name}[/a]`);
                });
                const vod = {
                    vod_id: ids[0],
                    vod_name: ids[0].toUpperCase(),
                    vod_pic: $("#player").attr("poster"),
                    vod_year: "更新於 " + $(".video-info .info-header .mr-3:first").text() + " " + $(".video-info .info-header .inactive-color").text(),
                    vod_remarks: tags.join(" "),
                    vod_actor: vodActor.join(" ") + " " + categories.join(" "),
                    vod_content: $(".video-info h4").text(),
                    vod_play_from: $(".video-info .info-header .header-right h6").children().remove().end().text().trim(),
                    vod_play_url: "1080P$" + unsafeWindow.hlsUrl,
                };
                return {list: [vod]};
            },
            searchContent: function (key, quick, pg) {
                const result = {
                    list: [],
                    pagecount: 1
                };
                listVideos(result);
                return result;
            }
        };
    })();
    $(document).ready(function () {
        const startedAt = Date.now();

        function isChallengePage() {
            const title = $("title").text().toLowerCase();
            return title.includes("just a moment")
                || title.includes("attention required")
                || $("#cf-wrapper, #challenge-running, .cf-turnstile").length > 0;
        }

        function isTargetPageReady() {
            switch (GMSpiderArgs.fName) {
                case "homeContent":
                    return $("[id^='list_videos_'], .video-img-box").length > 0;
                case "categoryContent":
                    if (GMSpiderArgs.fArgs[0] === "categories") {
                        return $("#list_categories_video_categories_list, .app-nav").length > 0;
                    }
                    return $("[id^='list_videos_']").length > 0;
                case "detailContent":
                    return $(".video-info, #player").length > 0;
                case "searchContent":
                    return $("[id^='list_videos_']").length > 0;
                default:
                    return document.readyState === "complete";
            }
        }

        function returnResult() {
            const result = GmSpider[GMSpiderArgs.fName](...GMSpiderArgs.fArgs);
            console.log(result);
            if (typeof GmSpiderInject !== 'undefined') {
                GmSpiderInject.SetSpiderResult(JSON.stringify(result));
            }
        }

        function waitForPage() {
            if (!isChallengePage() && isTargetPageReady()) {
                returnResult();
                return;
            }
            if (Date.now() - startedAt >= 50000) {
                returnResult();
                return;
            }
            setTimeout(waitForPage, 750);
        }

        waitForPage();
    });
})();
