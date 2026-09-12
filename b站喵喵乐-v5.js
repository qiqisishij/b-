(function () {
  'use strict';

  var ROOT = (function () {
    try {
      if (window.parent && window.parent.document && window.parent.document.body) return window.parent;
    } catch (e) {}
    return window;
  })();
  var DOC = ROOT.document;
  if (ROOT.__mmle5) return;
  ROOT.__mmle5 = true;

  var IDS = { css: 'mmle5-css', orb: 'mmle5-orb', shell: 'mmle5-shell', dim: 'mmle5-dim', pip: 'mmle5-pip', full: 'mmle5-full' };
  var SK = 'mmle_cfg_v3';

  function readCfg() {
    var base = {
      queue: [],
      cursor: -1,
      epCursor: -1,
      loopMode: 'order',
      orbVisible: true,
      pipKeep: true,
      pipVisible: true,
      orbImg: '',
      orbSpin: false,
      orbPulse: true,
      orbGlow: true,
      orbAngle: 0,
      shelves: [],
      favorites: [],
      history: [],
      speed: 1,
      tab: 'parse',
      source: 'bilibili'
    };
    try {
      if (typeof getVariables === 'function') {
        var v = getVariables({ type: 'script' }) || {};
        if (v[SK]) Object.assign(base, v[SK]);
      }
    } catch (e) {}
    try {
      var raw = ROOT.localStorage.getItem(SK);
      if (raw) Object.assign(base, JSON.parse(raw));
    } catch (e) {}
    if (typeof base.orbVisible !== 'boolean') base.orbVisible = true;
    if (!Array.isArray(base.shelves)) base.shelves = [];
    return base;
  }

  function writeCfg() {
    var payload = {
      queue: cfg.queue,
      cursor: cfg.cursor,
      epCursor: cfg.epCursor,
      loopMode: cfg.loopMode,
      orbVisible: cfg.orbVisible,
      pipKeep: cfg.pipKeep,
      pipVisible: cfg.pipVisible,
      orbImg: cfg.orbImg,
      orbSpin: cfg.orbSpin,
      orbPulse: cfg.orbPulse,
      orbGlow: cfg.orbGlow,
      orbAngle: cfg.orbAngle,
      shelves: cfg.shelves,
      favorites: cfg.favorites,
      history: cfg.history,
      speed: cfg.speed,
      tab: cfg.tab,
      source: cfg.source
    };
    try {
      if (typeof insertOrAssignVariables === 'function') {
        insertOrAssignVariables({ [SK]: payload }, { type: 'script' });
      }
    } catch (e) {}
    try { ROOT.localStorage.setItem(SK, JSON.stringify(payload)); } catch (e) {}
  }

  var cfg = readCfg();
  var parseCache = { last: null, busy: false };
  var profileKey = 'mmle5_profile';
  var playUrl = '';
  var fitTimer = 0;

  function tip(msg, kind) {
    try {
      var t = ROOT.toastr || (typeof toastr !== 'undefined' ? toastr : null);
      if (t) (t[kind || 'info'] || t.info)(msg);
    } catch (e) {}
  }

  function userFace() {
    if (cfg.orbImg) return cfg.orbImg;
    var sels = ['#user_avatar img', '#avatar_img', '.user_avatar img', '#user-avatar img', '#top-user-avatar img', 'img[title="User Avatar"]'];
    for (var i = 0; i < sels.length; i++) {
      try {
        var el = DOC.querySelector(sels[i]);
        if (el) {
          var src = el.currentSrc || el.src || el.getAttribute('src');
          if (src) return src;
        }
      } catch (e) {}
    }
    try {
      var ctx = ROOT.SillyTavern && ROOT.SillyTavern.getContext && ROOT.SillyTavern.getContext();
      if (ctx && ctx.powerUserSettings && ctx.powerUserSettings.avatar) {
        return ROOT.location.origin + '/thumbnail?type=avatar&file=' + encodeURIComponent(ctx.powerUserSettings.avatar);
      }
    } catch (e) {}
    return '';
  }

  function decodeLink(text) {
    var s = String(text || '').trim();
    if (/^(https?:\/\/)?(v\.qq\.com|m\.v\.qq\.com|v\.mgtv\.com|www\.mgtv\.com)/i.test(s)) return { kind:'external', href:/^https?:\/\//i.test(s)?s:'https://'+s, label:s, title:s };
    if (!s) return null;
    var urlMatch = s.match(/https?:\/\/[^\s\]）)】>]+/i);
    if (urlMatch) s = urlMatch[0].replace(/[.,;，。；]+$/, '');
    var m;

    m = s.match(/b23\.tv\/ep(\d+)/i);
    if (m) return { kind: 'ogv', episodeId: m[1], label: 'EP' + m[1] };
    m = s.match(/b23\.tv\/ss(\d+)/i);
    if (m) return { kind: 'season', seasonId: m[1], label: 'SS' + m[1] };

    if (/^https?:\/\/b23\.tv\//i.test(s)) {
      return { kind: 'short', href: s, label: 'B站短链' };
    }

    m = s.match(/BV[\w]+/i);
    if (m) return { kind: 'vod', bvid: m[0], label: m[0] };
    m = s.match(/(?:av|aid[=/])(\d+)/i);
    if (m) return { kind: 'vod', aid: m[1], label: 'av' + m[1] };

    m = s.match(/\/bangumi\/media\/md(\d+)/i) || s.match(/\bmd(\d{5,})\b/i);
    if (m) return { kind: 'media', mediaId: m[1], label: 'md' + m[1] };

    m = s.match(/\/bangumi\/play\/ep(\d+)/i) || s.match(/[?&#]episode[_]?id=(\d+)/i) || s.match(/\/ep(\d+)\b/i);
    if (m) return { kind: 'ogv', episodeId: m[1], label: 'EP' + m[1] };

    m = s.match(/\/bangumi\/play\/ss(\d+)/i) || s.match(/[?&#]season[_]?id=(\d+)/i) || s.match(/\/ss(\d+)\b/i);
    if (m) return { kind: 'season', seasonId: m[1], label: 'SS' + m[1] };

    m = s.match(/space\.bilibili\.com\/(\d+)/i);
    if (m) return { kind: 'creator', mid: m[1], label: 'UP' + m[1] };
    if (/^\d{3,}$/.test(s)) return { kind: 'creator', mid: s, label: 'UP' + s };

    m = s.match(/bilibili\.com\/video\/(BV[\w]+)/i);
    if (m) return { kind: 'vod', bvid: m[1], label: m[1] };

    if (/bilibili\.com\/.*(lists|favlist|medialist)/i.test(s)) {
      return { kind: 'pack', href: s, label: '合集链接' };
    }
    return null;
  }

  function embedOf(item) {
    var dm = cfg.danmaku ? '1' : '0';
    if (item.bvid) {
      return 'https://player.bilibili.com/player.html?bvid=' + encodeURIComponent(item.bvid) +
        '&page=1&high_quality=1&danmaku=' + dm + '&as_wide=1';
    }
    if (item.aid) {
      return 'https://player.bilibili.com/player.html?aid=' + encodeURIComponent(item.aid) +
        '&page=1&high_quality=1&danmaku=' + dm + '&as_wide=1';
    }
    if (item.episodeId) {
      return 'https://player.bilibili.com/player.html?episodeId=' + encodeURIComponent(item.episodeId) +
        '&high_quality=1&danmaku=' + dm;
    }
    if (item.seasonId) {
      return 'https://player.bilibili.com/player.html?seasonId=' + encodeURIComponent(item.seasonId) +
        '&high_quality=1&danmaku=' + dm;
    }
    return '';
  }

  function keyOf(item) {
    return item.bvid || item.aid || item.episodeId || item.seasonId || item.mediaId || item.href || item.id || '';
  }

  function seriesKey(s) {
    return String(s.mediaId || '') + '|' + String(s.seasonId || '') + '|' + String(s.title || '');
  }

  // 拉全集列表 → 文件夹结构
  async function fetchSeriesByMedia(mediaId) {
    var endpoints = [
      'https://api.bilibili.com/pgc/view/web/media?media_id=' + mediaId,
      'https://api.bilibili.com/pgc/view/web/season?media_id=' + mediaId
    ];
    for (var i = 0; i < endpoints.length; i++) {
      try {
        var res = await fetch(endpoints[i], { credentials: 'omit' });
        if (!res.ok) continue;
        var json = await res.json();
        var d = json.result || json.data || {};
        var title = d.title || (d.media && d.media.title) || ('剧集 ' + mediaId);
        var seasonId = (d.media && d.media.season_id) || d.season_id || (d.season && d.season.season_id);
        var epList = d.episodes || (d.main_section && d.main_section.episodes) || [];
        if ((!epList || !epList.length) && seasonId) {
          var more = await fetchSeriesBySeason(seasonId);
          if (more) {
            more.mediaId = String(mediaId);
            if (!more.title) more.title = title;
            return more;
          }
        }
        var episodes = (epList || []).map(function (ep, idx) {
          return {
            episodeId: String(ep.id || ep.ep_id || ''),
            label: ep.long_title ? ('第' + (ep.title || (idx + 1)) + '集 ' + ep.long_title) : ('第' + (ep.title || (idx + 1)) + '集'),
            bvid: ep.bvid || ''
          };
        }).filter(function (e) { return e.episodeId || e.bvid; });
        if (episodes.length) {
          return {
            kind: 'series',
            title: title,
            mediaId: String(mediaId),
            seasonId: seasonId ? String(seasonId) : '',
            episodes: episodes,
            open: false
          };
        }
      } catch (e) {}
    }
    return null;
  }

  async function fetchSeriesBySeason(seasonId) {
    try {
      var res = await fetch('https://api.bilibili.com/pgc/view/web/season?season_id=' + seasonId, { credentials: 'omit' });
      if (!res.ok) return null;
      var json = await res.json();
      var d = json.result || json.data || {};
      var title = d.title || d.season_title || ('季 ' + seasonId);
      var epList = d.episodes || (d.main_section && d.main_section.episodes) || [];
      var episodes = (epList || []).map(function (ep, idx) {
        return {
          episodeId: String(ep.id || ep.ep_id || ''),
          label: ep.long_title ? ('第' + (ep.title || (idx + 1)) + '集 ' + ep.long_title) : ('第' + (ep.title || (idx + 1)) + '集'),
          bvid: ep.bvid || ''
        };
      }).filter(function (e) { return e.episodeId || e.bvid; });
      if (!episodes.length) return null;
      return {
        kind: 'series',
        title: title,
        mediaId: '',
        seasonId: String(seasonId),
        episodes: episodes,
        open: false
      };
    } catch (e) {
      return null;
    }
  }

  function injectCss() {
    if (DOC.getElementById(IDS.css)) return;
    var el = DOC.createElement('style');
    el.id = IDS.css;
    el.textContent = [
      '#' + IDS.dim + '{position:fixed;inset:0;z-index:2147483000;background:rgba(15,10,12,.48);display:none}',
      '#' + IDS.dim + '.on{display:block}',
      '#' + IDS.orb + '{display:none;position:fixed;right:12px;bottom:96px;width:54px;height:54px;border-radius:50%;z-index:2147483001;display:none;align-items:center;justify-content:center;overflow:hidden;background:linear-gradient(145deg,#ff7aa8,#fb7299);border:2px solid #fff;box-shadow:0 6px 18px rgba(251,114,153,.5);touch-action:none;cursor:grab;user-select:none;pointer-events:auto}',
      '#' + IDS.orb + '.on{display:flex!important}',
      '#' + IDS.orb + '.glow{box-shadow:0 0 0 3px rgba(255,170,200,.4),0 8px 22px rgba(251,114,153,.55)}',
      '#' + IDS.orb + '.pulse{animation:mm5p 1.8s ease-in-out infinite}',
      '#' + IDS.orb + '.spin img,#' + IDS.orb + '.spin .fb{animation:mm5s 6s linear infinite}',
      '#' + IDS.orb + ' img{width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;pointer-events:none}',
      '#' + IDS.orb + ' .fb{color:#fff;font-size:12px;font-weight:700}',
      '@keyframes mm5p{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}',
      '@keyframes mm5s{from{transform:rotate(0)}to{transform:rotate(360deg)}}',
      '#' + IDS.shell + '{position:fixed;z-index:2147483003;display:none;flex-direction:column;overflow:hidden;background:#fff5f8;border-radius:18px;border:1px solid #ffd0e0;box-sizing:border-box;box-shadow:0 20px 50px rgba(80,20,40,.28);font-family:system-ui,-apple-system,sans-serif;color:#2a1a22}',
      '#' + IDS.shell + '.on{display:flex}',
      '#' + IDS.pip + '{position:fixed;right:12px;bottom:170px;width:min(48vw,300px);height:min(27vw,168px);z-index:2147483002;display:none;background:#111;border-radius:12px;overflow:hidden;border:1px solid #ffb0c8;box-shadow:0 10px 28px rgba(0,0,0,.35);touch-action:none}',
      '#' + IDS.pip + '.on{display:block}',
      '#' + IDS.pip + ' iframe{width:100%;height:100%;border:0}',
      '#' + IDS.pip + ' .ops{position:absolute;top:4px;right:4px;display:flex;gap:4px;z-index:2}',
      '#' + IDS.pip + ' .ops button{border:0;border-radius:7px;background:rgba(0,0,0,.55);color:#fff;width:28px;height:22px;font-size:12px}',
      '#' + IDS.full + '{position:fixed;inset:0;z-index:2147483004;background:#000;display:none;align-items:center;justify-content:center;overflow:hidden}',
      '#' + IDS.full + '.on{display:flex}',
      '#' + IDS.full + ' .mm-full-video{width:100%;height:100%;border:0;background:#000}',
      '#' + IDS.full + ' .mm-full-close{position:absolute;top:calc(env(safe-area-inset-top) + 10px);right:12px;z-index:3;border:0;border-radius:9px;background:rgba(0,0,0,.55);color:#fff;width:38px;height:32px;font-size:18px}',
      '#' + IDS.full + ' .mm-full-tip{position:absolute;bottom:calc(env(safe-area-inset-bottom) + 12px);left:50%;transform:translateX(-50%);z-index:3;color:#fff;background:rgba(0,0,0,.5);padding:7px 10px;border-radius:10px;font-size:11px;opacity:.8;pointer-events:none}',

      '.m3-hd{height:46px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;background:linear-gradient(90deg,#fb7299,#ff8fb3);color:#fff;flex-shrink:0}',
      '.m3-hd strong{font-size:15px}',
      '.m3-hd button{border:0;background:transparent;color:#fff;font-size:16px;padding:4px 7px}',
      '.m3-pane{flex:1;min-height:0;display:none;flex-direction:column;overflow:hidden}',
      '.m3-pane.show{display:flex}',
      '.m3-stage{height:32%;min-height:128px;background:#0d0d0d;position:relative;flex-shrink:0}',
      '.m3-stage iframe{width:100%;height:100%;border:0}',
      '.m3-hold{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#bbb;font-size:12px;text-align:center;padding:12px;line-height:1.5}',
      '.m3-form{padding:8px;background:#fff;border-bottom:1px solid #ffe0ea;display:flex;flex-wrap:wrap;gap:6px;flex-shrink:0}',
      '.m3-form input[type=text]{flex:1 1 100%;height:34px;border:1px solid #ffc2d4;border-radius:10px;padding:0 10px;font-size:13px;background:#fffafc;outline:0}',
      '.m3-form .line{display:flex;gap:6px;width:100%;flex-wrap:wrap}',
      '.m3-chip{height:30px;border:1px solid #ffc2d4;border-radius:9px;background:#fff;color:#8a4a62;font-size:12px;flex:1}',
      '.m3-chip.on{background:#fb7299;border-color:#fb7299;color:#fff}',
      '.m3-btn{height:34px;border:0;border-radius:10px;padding:0 10px;font-size:12px;color:#fff;background:#fb7299;flex-shrink:0}',
      '.m3-btn.sky{background:#5bb8ff}',
      '.m3-btn.mute{background:#f0e4ea;color:#5a3a48}',
      '.m3-btn.sm{height:28px;font-size:11px;padding:0 8px}',
      '.m3-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:8px}',
      '.m3-row{display:flex;align-items:center;gap:6px;padding:10px;margin-bottom:6px;background:#fff;border-radius:12px;border:1px solid #ffe3ee}',
      '.m3-row.now{border-color:#fb7299;background:#fff0f5}',
      '.m3-row .body{flex:1;min-width:0}',
      '.m3-row .body b{display:block;font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.m3-row .body small{color:#9a7080;font-size:11px}',
      '.m3-row .x,.m3-row .fav{border:0;background:transparent;color:#c08095;font-size:15px;padding:0 4px}',
      '.m3-row .fav.on{color:#fb7299}',
      '.m3-folder{margin-bottom:6px;border-radius:12px;border:1px solid #ffc2d4;background:#fff;overflow:hidden}',
      '.m3-folder>.top{display:flex;align-items:center;gap:6px;padding:10px;background:#ffe9f1}',
      '.m3-folder>.top .body{flex:1;min-width:0}',
      '.m3-folder>.top b{font-size:13px}',
      '.m3-folder>.top small{color:#9a7080;font-size:11px}',
      '.m3-folder>.eps{display:none;padding:4px 6px 8px;background:#fffafc}',
      '.m3-folder.open>.eps{display:block}',
      '.m3-folder.open>.top{border-bottom:1px solid #ffd0e0}',
      '.m3-ep{display:flex;align-items:center;gap:6px;padding:8px;margin-top:4px;border-radius:10px;background:#fff;border:1px solid #f5e0e8}',
      '.m3-ep.now{border-color:#fb7299;background:#fff0f5}',
      '.m3-ep .body{flex:1;min-width:0;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.m3-foot{display:flex;gap:6px;padding:8px;background:#fff;border-top:1px solid #ffe0ea;flex-shrink:0;flex-wrap:wrap}',
      '.m3-foot .m3-btn{flex:1;min-width:64px}',
      '.m3-tabs{display:flex;background:#fff;border-top:1px solid #ffe0ea;flex-shrink:0;padding-bottom:env(safe-area-inset-bottom)}',
      '.m3-tabs button{flex:1;border:0;background:none;padding:8px 0;font-size:11px;color:#a07084}',
      '.m3-tabs button.on{color:#fb7299;font-weight:700}',
      '.m3-tabs button i{display:block;font-style:normal;font-size:15px;margin-bottom:1px}',
      '.m3-ban{padding:12px;background:linear-gradient(135deg,#fb7299,#ffb0c9);color:#fff;flex-shrink:0}',
      '.m3-ban h3{margin:0 0 4px;font-size:15px}',
      '.m3-ban p{margin:0;font-size:12px;opacity:.95;line-height:1.45}',
      '.m3-block{margin:8px;padding:12px;background:#fff;border-radius:12px;border:1px solid #ffe3ee}',
      '.m3-block h4{margin:0 0 6px;font-size:13px}',
      '.m3-block p{margin:0;font-size:12px;color:#8a6070;line-height:1.5}',
      '.m3-sw{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:8px;padding:12px;background:#fff;border-radius:12px;border:1px solid #ffe3ee}',
      '.m3-sw label{font-size:13px}',
      '.m3-sw em{display:block;font-style:normal;font-size:11px;color:#9a7080;margin-top:2px}',
      '.m3-kn{width:44px;height:26px;border-radius:13px;background:#e0c8d2;position:relative;flex-shrink:0}',
      '.m3-kn.on{background:#fb7299}',
      '.m3-kn u{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:left .15s;text-decoration:none}',
      '.m3-kn.on u{left:21px}',
      '.m3-void{padding:22px 12px;text-align:center;color:#b08a98;font-size:12px;line-height:1.6}',
      '.m3-source{position:relative;flex:0 0 auto}',
      '.m3-source-btn{height:34px;border:1px solid #ffc2d4;border-radius:10px;background:#fff;color:#8a4a62;padding:0 10px}',
      '.m3-source-menu{display:none;position:absolute;left:0;top:38px;z-index:20;background:#fff;border:1px solid #ffd0e0;border-radius:10px;padding:5px;box-shadow:0 8px 20px rgba(0,0,0,.15);min-width:92px}',
      '.m3-source-menu.on{display:block}',
      '.m3-source-menu button{display:block;width:100%;border:0;background:#fff;padding:8px;text-align:left;border-radius:7px}',
      '#' + IDS.pip + ' .pip-title{position:absolute;left:8px;bottom:24px;right:8px;color:#fff;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 2px #000}',
      '#' + IDS.pip + ' .pip-bar{position:absolute;left:8px;right:8px;bottom:4px;z-index:3}',
      '#' + IDS.pip + ' .pip-bar input{width:100%}',
      '.m3-file{display:none}'
    ].join('');
    DOC.head.appendChild(el);
  }

  function viewport() {
    return {
      w: Math.max(280, ROOT.innerWidth || DOC.documentElement.clientWidth || 360),
      h: Math.max(400, ROOT.innerHeight || DOC.documentElement.clientHeight || 640)
    };
  }

  function layoutShell() {
    var shell = DOC.getElementById(IDS.shell);
    if (!shell) return;
    var vp = viewport();
    var mx = vp.w < 480 ? 10 : Math.max(16, Math.round(vp.w * 0.04));
    var my = vp.h < 700 ? 12 : Math.max(16, Math.round(vp.h * 0.05));
    var width = vp.w <= 600 ? vp.w - mx * 2 : Math.min(420, Math.round(vp.w * 0.4));
    var height = vp.w <= 600 ? Math.min(Math.round(vp.h * 0.88), vp.h - my * 2) : Math.min(640, Math.round(vp.h * 0.8));
    width = Math.max(280, width);
    height = Math.max(360, height);
    shell.style.left = Math.round((vp.w - width) / 2) + 'px';
    shell.style.top = Math.round((vp.h - height) / 2) + 'px';
    shell.style.width = width + 'px';
    shell.style.height = height + 'px';
  }

  function paintOrb() {
    var orb = DOC.getElementById(IDS.orb);
    if (!orb) return;
    orb.classList.toggle('on', !!cfg.orbVisible);
    orb.classList.toggle('glow', !!cfg.orbGlow);
    orb.classList.toggle('pulse', !!cfg.orbPulse);
    orb.classList.toggle('spin', !!cfg.orbSpin);
    orb.style.transform = cfg.orbAngle ? ('rotate(' + cfg.orbAngle + 'deg)') : '';
    var face = userFace();
    orb.innerHTML = '';
    if (face) {
      var img = DOC.createElement('img');
      img.alt = '';
      img.src = face;
      img.onerror = function () { orb.innerHTML = '<span class="fb">喵</span>'; };
      orb.appendChild(img);
    } else {
      orb.innerHTML = '<span class="fb">喵</span>';
    }
  }

  function mount() {
    if (DOC.getElementById(IDS.shell)) return;
    var dim = DOC.createElement('div');
    dim.id = IDS.dim; dim.onclick = function(){ fold(false); }; DOC.body.appendChild(dim);

    var pip = DOC.createElement('div');
    pip.id = IDS.pip;
    pip.innerHTML = '<div class="ops"><button data-p="prev">‹</button><button data-p="next">›</button><button data-p="dan">弹幕</button><button data-p="max">□</button><button data-p="off">×</button></div><div class="pip-title" id="m5-pip-title"></div><div class="pip-bar"><input id="m5-pip-seek" type="range" min="0" max="100" value="0"></div>';
    DOC.body.appendChild(pip);
    pip.querySelector('[data-p="max"]').onclick=function(){ openShell(); };
    pip.querySelector('[data-p="off"]').onclick=function(){ closePip(true); };
    pip.querySelector('[data-p="prev"]').onclick=function(){ step(-1); };
    pip.querySelector('[data-p="next"]').onclick=function(){ step(1); };
    pip.querySelector('[data-p="dan"]').onclick=function(){ tip('弹幕请使用播放器内置开关'); };
    var ps=pip.querySelector('#m5-pip-seek'); ps.onchange=function(){var pct=Number(ps.value)||0; sendSeekPercent(pct);};
    dragify(pip);

    var full = DOC.createElement('div'); full.id=IDS.full;
    full.innerHTML='<button type="button" class="mm-full-close">×</button><div class="mm-full-tip">左右滑动：尝试快退 / 快进</div>';
    DOC.body.appendChild(full); full.querySelector('.mm-full-close').onclick=closeFullscreen;

    var shell=DOC.createElement('div'); shell.id=IDS.shell;
    shell.innerHTML=[
      '<div class="m3-hd"><strong id="m3-title">解析</strong><div><button type="button" data-h="full">⛶</button><button type="button" data-h="pip">⤵</button><button type="button" data-h="close">×</button></div></div>',
      '<div class="m3-pane show" data-pane="parse"><div class="m3-form"><div class="m3-source"><button class="m3-source-btn" id="m5-source-btn">△ B站</button><div class="m3-source-menu" id="m5-source-menu"><button data-src="bilibili">B站</button><button data-src="tencent">腾讯</button><button data-src="mango">芒果</button><button data-src="web">全网</button></div></div><input type="text" id="m3-in" placeholder="粘贴链接；全网模式输入剧名/电影名" enterkeyhint="done"><div class="line"><button class="m3-btn sky" id="m3-add">解析并加入</button><button class="m3-btn" id="m3-go">解析并播放</button><button class="m3-btn mute" id="m3-clear">清空</button></div></div><div class="m3-ban" id="m5-parse-tip"><h3>解析</h3><p>先解析，结果会进入播放列表；播放统一在“播放”页。</p></div><div class="m3-scroll" id="m5-results"></div></div>',
      '<div class="m3-pane" data-pane="fav"><div class="m3-ban"><h3>收藏</h3><p>只保存本机收藏，不连接任何账号。</p></div><div class="m3-scroll" id="m3-shelf"></div><div class="m3-void" id="m3-shelf-void">还没有收藏</div></div>',
      '<div class="m3-pane" data-pane="watch"><div class="m3-stage"><div class="m3-hold" id="m3-hold">先在解析页加入视频。</div><iframe id="m3-main" allowfullscreen allow="fullscreen; autoplay; encrypted-media" style="display:none"></iframe></div><div class="m3-scroll" id="m3-q"></div><div class="m3-foot"><button class="m3-btn mute" data-nav="-1">上一集</button><button class="m3-btn" data-nav="0">播放</button><button class="m3-btn mute" data-nav="1">下一集</button></div><div class="m3-form"><div class="line"><button class="m3-chip" data-loop="order">顺序</button><button class="m3-chip" data-loop="shuffle">随机</button><button class="m3-chip" data-loop="single">单曲循环</button></div></div></div>',
      '<div class="m3-pane" data-pane="tune"><div class="m3-ban"><h3>设置</h3><p>只保留本地播放器设置；弹幕由播放器自身控制。</p></div><div class="m3-sw"><div><label>关闭播放器后小窗续播</label><em>关闭主窗口时保留同一个播放器节点</em></div><div class="m3-kn" data-cfg="pipKeep"><u></u></div></div><div class="m3-sw"><div><label>默认播放速度</label><em id="m5-speed-label"></em></div><select id="m5-speed" style="width:100px;height:30px"><option>0.5</option><option>0.75</option><option>1</option><option>1.25</option><option>1.5</option><option>2</option></select></div><div class="m3-block"><h4>关于第三方来源</h4><p>腾讯、芒果以及全网结果是否允许内嵌由对方页面决定；脚本不会伪造会员权限，也不会内置盗版播放站。</p></div></div>',
      '<div class="m3-pane" data-pane="mine"><div class="m3-ban"><h3>我的</h3><p>这是喵喵乐自己的本地资料，不是B站账号。</p></div><div class="m3-block"><h4>本地资料</h4><div class="line"><input id="m5-name" type="text" placeholder="昵称" style="flex:1;height:32px;border:1px solid #ddd;border-radius:8px;padding:0 8px"><input id="m5-sign" type="text" placeholder="签名" style="flex:1;height:32px;border:1px solid #ddd;border-radius:8px;padding:0 8px"></div><div class="line" style="margin-top:8px"><input id="m5-avatar" type="text" placeholder="头像URL" style="flex:1;height:32px;border:1px solid #ddd;border-radius:8px;padding:0 8px"><button class="m3-btn" id="m5-save-profile">保存</button></div></div><div class="m3-block"><h4>本地统计</h4><p id="m5-stats"></p></div><div class="m3-foot"><button class="m3-btn mute" id="m5-clear-history">清空播放历史</button><button class="m3-btn mute" id="m5-reset">重置本地数据</button></div></div>',
      '<div class="m3-tabs"><button data-tab="parse" class="on"><i>⌕</i>解析</button><button data-tab="fav"><i>☆</i>收藏</button><button data-tab="watch"><i>▶</i>播放</button><button data-tab="tune"><i>⚙</i>设置</button><button data-tab="mine"><i>♙</i>我的</button></div>'
    ].join('');
    DOC.body.appendChild(shell);
    shell.querySelector('[data-h="close"]').onclick=function(){ fold(false); };
    shell.querySelector('[data-h="full"]').onclick=openFullscreen;
    shell.querySelector('[data-h="pip"]').onclick=function(){ fold(false); };
    shell.querySelectorAll('.m3-tabs button').forEach(function(btn){btn.onclick=function(){showPane(btn.dataset.tab);};});
    DOC.getElementById('m3-add').onclick=function(){ intake(false); };
    DOC.getElementById('m3-go').onclick=function(){ intake(true); };
    DOC.getElementById('m3-clear').onclick=function(){ cfg.queue=[];cfg.cursor=-1;cfg.epCursor=-1;halt();drawQueue();writeCfg();tip('播放列表已清空'); };
    DOC.getElementById('m3-in').addEventListener('keydown',function(e){if(e.key==='Enter') intake(true);});
    shell.querySelectorAll('[data-nav]').forEach(function(btn){btn.onclick=function(){var d=Number(btn.dataset.nav);if(d===0)reloadPlay();else step(d);};});
    shell.querySelectorAll('[data-loop]').forEach(function(btn){btn.onclick=function(){cfg.loopMode=btn.dataset.loop;markLoop();writeCfg();tip('播放模式：'+btn.textContent);};});
    shell.querySelectorAll('.m3-kn').forEach(function(kn){var key=kn.dataset.cfg;kn.classList.toggle('on',!!cfg[key]);kn.onclick=function(){cfg[key]=!cfg[key];kn.classList.toggle('on',!!cfg[key]);writeCfg();};});
    var sp=DOC.getElementById('m5-speed'); sp.value=String(cfg.speed||1); sp.onchange=function(){cfg.speed=Number(sp.value)||1;writeCfg();tip('已记录速度 '+cfg.speed+'×；实际速度由播放器支持情况决定');};
    var srcBtn=DOC.getElementById('m5-source-btn'), menu=DOC.getElementById('m5-source-menu'); srcBtn.textContent='△ '+sourceName(cfg.source);
    srcBtn.onclick=function(){menu.classList.toggle('on');};
    menu.querySelectorAll('button').forEach(function(b){b.onclick=function(){cfg.source=b.dataset.src;srcBtn.textContent='△ '+sourceName(cfg.source);menu.classList.remove('on');writeCfg();updateParsePlaceholder();};});
    var prof=readProfile(); DOC.getElementById('m5-name').value=prof.name||'';DOC.getElementById('m5-sign').value=prof.sign||'';DOC.getElementById('m5-avatar').value=prof.avatar||'';
    DOC.getElementById('m5-save-profile').onclick=function(){saveProfile();};
    DOC.getElementById('m5-clear-history').onclick=function(){cfg.history=[];writeCfg();drawMine();tip('历史已清空');};
    DOC.getElementById('m5-reset').onclick=function(){if(confirm('确定清空本地收藏、历史、队列和设置？')){ROOT.localStorage.removeItem('mmle5_profile');cfg=readCfg();cfg.queue=[];cfg.history=[];cfg.shelves=[];writeCfg();drawQueue();drawShelf();drawMine();tip('已重置');}};
    drawQueue();drawShelf();drawMine();drawParseResults();updateParsePlaceholder();
    bindSwipeSeek();bindPlayerEvents();
    showPane(cfg.tab||'parse');
  }

  function showPane(name) {
    var allowed={parse:1,fav:1,watch:1,tune:1,mine:1}; if(!allowed[name]) name='parse';
    cfg.tab=name; writeCfg(); var shell=DOC.getElementById(IDS.shell); if(!shell)return;
    shell.querySelectorAll('.m3-pane').forEach(function(p){p.classList.toggle('show',p.dataset.pane===name);});
    shell.querySelectorAll('.m3-tabs button').forEach(function(b){b.classList.toggle('on',b.dataset.tab===name);});
    var map={parse:'解析',fav:'收藏',watch:'播放',tune:'设置',mine:'我的'}; var t=DOC.getElementById('m3-title');if(t)t.textContent=map[name];
    if(name==='fav')drawShelf(); if(name==='mine')drawMine(); if(name==='parse')drawParseResults();
  }
  function sourceName(x){return ({bilibili:'B站',tencent:'腾讯',mango:'芒果',web:'全网'})[x]||'B站';}
  function updateParsePlaceholder(){var i=DOC.getElementById('m3-in');if(!i)return;i.placeholder=cfg.source==='web'?'输入剧名 / 电影名 / 动画名进行全网检索':'粘贴链接：合集 / md / ss / ep / BV / b23.tv';}
  function readProfile(){try{return JSON.parse(ROOT.localStorage.getItem(profileKey)||'{}')||{};}catch(e){return {};}}
  function saveProfile(){var p={name:(DOC.getElementById('m5-name').value||'').trim(),sign:(DOC.getElementById('m5-sign').value||'').trim(),avatar:(DOC.getElementById('m5-avatar').value||'').trim()};try{ROOT.localStorage.setItem(profileKey,JSON.stringify(p));}catch(e){}drawMine();tip('本地资料已保存');}
  function drawMine(){var p=readProfile(),st=DOC.getElementById('m5-stats');if(st)st.textContent='播放历史 '+cfg.history.length+' 条 · 收藏 '+cfg.shelves.length+' 项 · 播放列表 '+cfg.queue.length+' 项';}
  function drawParseResults(){var box=DOC.getElementById('m5-results');if(!box)return;box.innerHTML='';var r=parseCache.last;if(!r){box.innerHTML='<div class="m3-void">解析结果会显示在这里。</div>';return;}var frag=DOC.createDocumentFragment();
    if(r.kind==='web'){var b=document.createElement('div');b.className='m3-block';b.innerHTML='<h4>全网搜索：'+esc(r.title)+'</h4><p>脚本不抓取或聚合未授权盗版源。下面提供合法平台搜索入口。</p>';[['B站','https://search.bilibili.com/all?keyword='+encodeURIComponent(r.title)],['腾讯视频','https://v.qq.com/x/search/?q='+encodeURIComponent(r.title)],['芒果TV','https://so.mgtv.com/so?k='+encodeURIComponent(r.title)]].forEach(function(x){var q=document.createElement('button');q.className='m3-btn mute sm';q.textContent=x[0];q.onclick=function(){ROOT.open(x[1],'_blank');};b.appendChild(q);});frag.appendChild(b);box.appendChild(frag);return;}
    var title=r.title||r.label||'解析结果';var row=document.createElement('div');row.className='m3-row';var body=document.createElement('div');body.className='body';var bb=document.createElement('b');bb.textContent=title;var sm=document.createElement('small');sm.textContent=r.episodes?'共 '+r.episodes.length+' 集':'单视频';body.appendChild(bb);body.appendChild(sm);var btn=document.createElement('button');btn.className='m3-btn sm';btn.textContent='去播放';btn.onclick=function(){showPane('watch');if(r.episodes)jumpItem(cfg.queue.findIndex(function(x){return seriesKey(x)===seriesKey(r);}),0);else jumpItem(cfg.queue.length-1,-1);};row.appendChild(body);row.appendChild(btn);frag.appendChild(row);box.appendChild(frag);
  }
  function esc(x){return String(x||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}

  function bindFit() {
    if (ROOT.__mmle5fit) return;
    ROOT.__mmle5fit = true;
    var run = function () {
      if (fitTimer) clearTimeout(fitTimer);
      fitTimer = setTimeout(function () {
        var shell = DOC.getElementById(IDS.shell);
        if (shell && shell.classList.contains('on')) layoutShell();
      }, 100);
    };
    ROOT.addEventListener('resize', run, { passive: true });
    ROOT.addEventListener('orientationchange', function () { setTimeout(run, 180); });
  }

  function openShell() {
    injectCss();
    mount();
    bindFit();
    bindPlayerEvents();
    var main = DOC.getElementById('m3-main');
    if (main && playUrl) {
      if (main.src !== playUrl) main.src = playUrl;
      main.style.display = 'block';
      var hold = DOC.getElementById('m3-hold');
      if (hold) hold.style.display = 'none';
    }
    if (DOC.getElementById(IDS.full)?.classList.contains('on')) closeFullscreen();
    closePip(false);
    returnPlayerToStage();
    layoutShell();
    DOC.getElementById(IDS.dim).classList.add('on');
    DOC.getElementById(IDS.shell).classList.add('on');
    setTimeout(layoutShell, 30);
  }

  function fold(toPip) {
    DOC.getElementById(IDS.dim)?.classList.remove('on');
    DOC.getElementById(IDS.shell)?.classList.remove('on');
    if (toPip && cfg.pipKeep && playUrl) openPip();
  }

  function movePlayerTo(container, className) {
    var frame = DOC.getElementById('m3-main');
    if (!frame || !container) return;
    if (className) frame.className = className;
    container.appendChild(frame);
  }

  function returnPlayerToStage() {
    var stage = DOC.querySelector('#' + IDS.shell + ' .m3-stage');
    var frame = DOC.getElementById('m3-main');
    if (!stage || !frame) return;
    frame.className = '';
    frame.style.display = playUrl ? 'block' : 'none';
    stage.insertBefore(frame, stage.firstChild);
  }

  function openPip() {
    var box = DOC.getElementById(IDS.pip);
    var frame = DOC.getElementById('m3-main');
    if (!box || !frame || !playUrl) return;
    movePlayerTo(box, '');
    var pt=DOC.getElementById('m5-pip-title'); if(pt) pt.textContent=currentTitle();
    frame.style.display = 'block';
    box.classList.add('on');
  }

  function closePip(stop) {
    var box = DOC.getElementById(IDS.pip);
    if (box) box.classList.remove('on');
    if (stop) {
      var frame = DOC.getElementById('m3-main');
      if (frame) frame.src = 'about:blank';
      playUrl = '';
    } else {
      returnPlayerToStage();
    }
  }

  function openFullscreen() {
    var full = DOC.getElementById(IDS.full);
    var frame = DOC.getElementById('m3-main');
    if (!full || !frame || !playUrl) return;
    closePip(false);
    movePlayerTo(full, 'mm-full-video');
    frame.style.display = 'block';
    full.classList.add('on');
  }

  function closeFullscreen() {
    var full = DOC.getElementById(IDS.full);
    if (full) full.classList.remove('on');
    returnPlayerToStage();
  }

  function bindSwipeSeek() {
    var stage = DOC.getElementById('m3-stage');
    if (!stage || stage.dataset.swipeBound === '1') return;
    stage.dataset.swipeBound = '1';
    var sx = 0, sy = 0, active = false;
    stage.addEventListener('touchstart', function(e) {
      if (e.touches.length !== 1) return;
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; active = true;
    }, {passive:true});
    stage.addEventListener('touchend', function(e) {
      if (!active || !e.changedTouches.length) return;
      active = false;
      var dx = e.changedTouches[0].clientX - sx;
      var dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
      var seconds = Math.max(5, Math.min(60, Math.round(Math.abs(dx) / 5)));
      sendSeek(seconds * (dx > 0 ? 1 : -1));
    }, {passive:true});
  }

  function sendSeek(delta) {
    var frame = DOC.getElementById('m3-main');
    if (!frame || !frame.contentWindow) return;
    // Cross-origin Bilibili VOD embeds do not expose the HTML5 video element.
    // Send only compatible postMessage forms; unsupported players safely ignore them.
    var msgs = [
      {type:'seek', value:delta},
      {type:'seekRelative', value:delta},
      {type:'setCurrentTime', value:delta}
    ];
    msgs.forEach(function(m) {
      try { frame.contentWindow.postMessage('setPlayer-' + JSON.stringify(m), '*'); } catch(e) {}
    });
    tip((delta > 0 ? '快进 ' : '快退 ') + Math.abs(delta) + ' 秒');
  }

  function markLoop() {
    DOC.querySelectorAll('#' + IDS.shell + ' [data-loop]').forEach(function (btn) {
      btn.classList.toggle('on', btn.getAttribute('data-loop') === cfg.loopMode);
    });
  }

  function favoriteKey(item) { return item.kind==='series' ? seriesKey(item) : keyOf(item); }
  function isShelved(series) { var k=favoriteKey(series); return (cfg.shelves||[]).some(function(s){return favoriteKey(s)===k;}); }
  function toggleShelf(item) {
    var k=favoriteKey(item), idx=(cfg.shelves||[]).findIndex(function(s){return favoriteKey(s)===k;});
    if(idx>=0){cfg.shelves.splice(idx,1);tip('已取消收藏');}
    else {var copy=JSON.parse(JSON.stringify(item)); if(copy.kind==='series') copy.open=false; cfg.shelves.unshift(copy);tip('已收藏');}
    writeCfg();drawQueue();drawShelf();
  }

  async function resolveShortLink(href) {
    try {
      var res = await fetch(href, {redirect:'follow', credentials:'omit'});
      if (res.url && res.url !== href) {
        var hit = decodeLink(res.url);
        if (hit) return hit;
      }
    } catch(e) {}
    return null;
  }

  async function intake(playNow) {
    var input=DOC.getElementById('m3-in'), raw=String(input&&input.value||'').trim(); if(!raw){tip('请输入链接或标题','warning');return;}
    if(cfg.source==='web'){
      parseCache.last={kind:'web',title:raw};drawParseResults();tip('已生成全网合法来源搜索入口');return;
    }
    var hit=decodeLink(raw);
    if(!hit){tip('无法识别当前来源链接','warning');return;}
    if(hit.kind==='short'){
      tip('正在解析短链…');var resolved=await resolveShortLink(hit.href);if(!resolved){tip('短链跳转被浏览器跨域限制；请粘贴跳转后的完整链接','warning');return;}hit=resolved;
    }
    if(hit.kind==='media'||hit.kind==='season'){
      tip('正在拉取完整目录…');var series=hit.kind==='media'?await fetchSeriesByMedia(hit.mediaId):await fetchSeriesBySeason(hit.seasonId);
      if(!series||!series.episodes||!series.episodes.length){tip('无法从公开接口取得全集目录；不是硬编码缺集，请改粘贴具体 ep/BV 或浏览器打开合集','warning');return;}
      var exist=cfg.queue.findIndex(function(x){return x.kind==='series'&&seriesKey(x)===seriesKey(series);});
      if(exist<0){series.open=true;cfg.queue.push(series);exist=cfg.queue.length-1;}else{cfg.queue[exist].episodes=series.episodes;cfg.queue[exist].open=true;}
      parseCache.last=series;drawQueue();drawParseResults();writeCfg();if(input)input.value='';tip('已加入《'+series.title+'》共 '+series.episodes.length+' 集');if(playNow){showPane('watch');jumpItem(exist,0);}return;
    }
    if(hit.kind==='pack'){var item={kind:'external',title:hit.label||'合集',href:hit.href,label:hit.label||'合集'};cfg.queue.push(item);parseCache.last=item;drawQueue();drawParseResults();writeCfg();if(input)input.value='';tip('已加入外部合集入口；对方页面不允许内嵌时会在浏览器打开');if(playNow){showPane('watch');jumpItem(cfg.queue.length-1,-1);}return;}
    if(hit.kind==='creator'){tip('已移除UP/账号功能','warning');return;}
    if(cfg.source==='tencent'||cfg.source==='mango'){hit={kind:'external',href:raw,label:raw,title:raw};}
    if(!cfg.queue.some(function(x){return keyOf(x)===keyOf(hit);})){cfg.queue.push(hit);}else{tip('队列里已有');}
    parseCache.last=hit;drawQueue();drawParseResults();writeCfg();if(input)input.value='';if(playNow){showPane('watch');jumpItem(cfg.queue.length-1,-1);}
  }

  function drawQueue() {
    var box = DOC.getElementById('m3-q');
    if (!box) return;
    box.innerHTML = '';
    if (!cfg.queue.length) {
      box.innerHTML = '<div class="m3-void">队列是空的</div>';
      return;
    }
    var frag = DOC.createDocumentFragment();
    cfg.queue.forEach(function (item, idx) {
      if (item.kind === 'series') {
        frag.appendChild(renderFolder(item, idx, false));
      } else {
        frag.appendChild(renderFlat(item, idx));
      }
    });
    box.appendChild(frag);
  }

  function renderFlat(item, idx) {
    var row = DOC.createElement('div');
    row.className = 'm3-row' + (cfg.cursor === idx && cfg.epCursor < 0 ? ' now' : '');
    var body = DOC.createElement('div');
    body.className = 'body';
    var b = DOC.createElement('b');
    b.textContent = item.label || keyOf(item);
    b.onclick = function () { jumpItem(idx, -1); };
    var small = DOC.createElement('small');
    small.textContent = item.episodeId ? '单集' : '视频';
    body.appendChild(b);
    body.appendChild(small);
    var x = DOC.createElement('button');
    x.type = 'button';
    x.className = 'x';
    x.textContent = '×';
    x.onclick = function (e) {
      e.stopPropagation();
      removeQueue(idx);
    };
    var fav = DOC.createElement('button'); fav.type='button'; fav.className='fav'+(isShelved(item)?' on':''); fav.textContent=isShelved(item)?'★':'☆'; fav.onclick=function(e){e.stopPropagation();toggleShelf(item);};
    row.appendChild(body); row.appendChild(fav); row.appendChild(x);
    return row;
  }

  function renderFolder(series, idx, fromShelf) {
    var wrap = DOC.createElement('div');
    wrap.className = 'm3-folder' + (series.open ? ' open' : '');
    var top = DOC.createElement('div');
    top.className = 'top';
    var body = DOC.createElement('div');
    body.className = 'body';
    var b = DOC.createElement('b');
    b.textContent = (series.open ? '▼ ' : '▶ ') + (series.title || '剧集') + ' ›';
    b.onclick = function () {
      series.open = !series.open;
      if (!fromShelf) writeCfg();
      if (fromShelf) drawShelf();
      else drawQueue();
    };
    var small = DOC.createElement('small');
    small.textContent = series.packOnly
      ? '合集（浏览器）'
      : ((series.episodes && series.episodes.length) + ' 集');
    body.appendChild(b);
    body.appendChild(small);
    top.appendChild(body);

    var fav = DOC.createElement('button');
    fav.type = 'button';
    fav.className = 'fav' + (isShelved(series) ? ' on' : '');
    fav.textContent = isShelved(series) ? '★' : '☆';
    fav.title = '收藏整部';
    fav.onclick = function (e) {
      e.stopPropagation();
      toggleShelf(series);
    };
    top.appendChild(fav);

    if (!fromShelf) {
      var x = DOC.createElement('button');
      x.type = 'button';
      x.className = 'x';
      x.textContent = '×';
      x.onclick = function (e) {
        e.stopPropagation();
        removeQueue(idx);
      };
      top.appendChild(x);
    } else {
      var add = DOC.createElement('button');
      add.type = 'button';
      add.className = 'm3-btn sm';
      add.textContent = '加入队列';
      add.onclick = function (e) {
        e.stopPropagation();
        pushSeriesToQueue(series);
      };
      top.appendChild(add);
      var del = DOC.createElement('button');
      del.type = 'button';
      del.className = 'x';
      del.textContent = '×';
      del.onclick = function (e) {
        e.stopPropagation();
        cfg.shelves.splice(idx, 1);
        writeCfg();
        drawShelf();
      };
      top.appendChild(del);
    }

    wrap.appendChild(top);

    var eps = DOC.createElement('div');
    eps.className = 'eps';
    if (series.packOnly && series.href) {
      var openBtn = DOC.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'm3-btn sm';
      openBtn.style.margin = '6px';
      openBtn.textContent = '浏览器打开合集';
      openBtn.onclick = function () { ROOT.open(series.href, '_blank'); };
      eps.appendChild(openBtn);
    } else {
      (series.episodes || []).forEach(function (ep, epIdx) {
        var row = DOC.createElement('div');
        var playing = !fromShelf && cfg.cursor === idx && cfg.epCursor === epIdx;
        row.className = 'm3-ep' + (playing ? ' now' : '');
        var t = DOC.createElement('div');
        t.className = 'body';
        t.textContent = ep.label || ('第' + (epIdx + 1) + '集');
        t.onclick = function () {
          if (fromShelf) {
            var qi = pushSeriesToQueue(series);
            jumpItem(qi, epIdx);
            showPane('watch');
          } else {
            jumpItem(idx, epIdx);
          }
        };
        var play = DOC.createElement('button');
        play.type = 'button';
        play.className = 'm3-btn sm';
        play.textContent = '播';
        play.onclick = function () { t.onclick(); };
        row.appendChild(t);
        row.appendChild(play);
        eps.appendChild(row);
      });
    }
    wrap.appendChild(eps);
    return wrap;
  }

  function pushSeriesToQueue(series) {
    var k = seriesKey(series);
    var exist = cfg.queue.findIndex(function (x) {
      return x.kind === 'series' && seriesKey(x) === k;
    });
    if (exist >= 0) {
      cfg.queue[exist].open = true;
      cfg.queue[exist].episodes = series.episodes.slice();
      drawQueue();
      writeCfg();
      return exist;
    }
    var copy = {
      kind: 'series',
      title: series.title,
      mediaId: series.mediaId || '',
      seasonId: series.seasonId || '',
      episodes: (series.episodes || []).slice(),
      open: true,
      href: series.href || '',
      packOnly: !!series.packOnly
    };
    cfg.queue.push(copy);
    drawQueue();
    writeCfg();
    tip('已加入队列《' + series.title + '》');
    return cfg.queue.length - 1;
  }

  function removeQueue(idx) {
    cfg.queue.splice(idx, 1);
    if (cfg.cursor === idx) {
      cfg.cursor = -1;
      cfg.epCursor = -1;
      halt();
      closePip(true);
    } else if (cfg.cursor > idx) cfg.cursor--;
    drawQueue();
    writeCfg();
  }

  function jumpItem(qIdx, epIdx) {
    if (qIdx < 0 || qIdx >= cfg.queue.length) return;
    var item = cfg.queue[qIdx];
    if (item.kind === 'external') { cfg.cursor=qIdx; cfg.epCursor=-1; playEpisode(item); drawQueue(); writeCfg(); showPane('watch'); return; }
    if (item.kind === 'series') {

      if (!item.episodes || !item.episodes.length) return;
      if (epIdx < 0) epIdx = 0;
      if (epIdx >= item.episodes.length) epIdx = 0;
      cfg.cursor = qIdx;
      cfg.epCursor = epIdx;
      item.open = true;
      playEpisode(item.episodes[epIdx]);
      drawQueue();
      writeCfg();
      showPane('watch');
      return;
    }
    cfg.cursor = qIdx;
    cfg.epCursor = -1;
    playEpisode(item);
    drawQueue();
    writeCfg();
    showPane('watch');
  }

  function sendSeekPercent(percent){var frame=DOC.getElementById('m3-main');if(!frame||!frame.contentWindow)return;try{frame.contentWindow.postMessage('setPlayer-'+JSON.stringify({type:'seekPercent',value:percent}),'*');}catch(e){}tip('已发送 '+percent+'% 进度控制；是否生效取决于当前播放器接口');}

  function currentTitle(){var x=cfg.queue[cfg.cursor];if(!x)return '';if(x.kind==='series')return x.title+' · 第'+(cfg.epCursor+1)+'集';return x.label||x.title||'';}

  function playEpisode(ep) {
    var src = ep && ep.kind==='external' ? ep.href : embedOf(ep);
    if (!src) return;
    playUrl = src;
    try { cfg.history = [{title: ep.label || ep.title || ep.href || '', href: src, at: Date.now()}].concat(cfg.history||[]).slice(0,100); writeCfg(); } catch(e) {}
    var main = DOC.getElementById('m3-main');
    var hold = DOC.getElementById('m3-hold');
    if (main) {
      if (main.src !== src) main.src = src;
      main.style.display = 'block';
    }
    if (hold) hold.style.display = 'none';
    var pipFrame = DOC.getElementById('m3-pip');
    var pip = DOC.getElementById(IDS.pip);
    if (pip && pip.classList.contains('on') && pipFrame && pipFrame.src !== src) pipFrame.src = src;
  }

  function reloadPlay() {
    if (cfg.cursor < 0) return;
    var item = cfg.queue[cfg.cursor];
    if (!item) return;
    if (item.kind === 'series') {
      var ep = item.episodes && item.episodes[cfg.epCursor];
      if (ep) playEpisode(ep);
    } else playEpisode(item);
  }

  function halt() {
    var main = DOC.getElementById('m3-main');
    var hold = DOC.getElementById('m3-hold');
    if (main) {
      main.src = 'about:blank';
      main.style.display = 'none';
    }
    if (hold) hold.style.display = 'flex';
    playUrl = '';
  }

  function bindPlayerEvents() {
    if (ROOT.__mmle5msg) return;
    ROOT.__mmle5msg = true;
    ROOT.addEventListener('message', function(e) {
      var d = e && e.data;
      if (typeof d !== 'string') return;
      if (d.indexOf('playerOperation-') !== 0) return;
      var raw = d.slice('playerOperation-'.length);
      try {
        var obj = JSON.parse(raw);
        var type = obj.type || '';
        if (type === 'ended' || type === 'endedVideo' || type === 'videoEnded' || type === 'end') {
          if (cfg.loopMode === 'single') reloadPlay();
          else step(1);
        }
      } catch(err) {}
    });
  }

  function step(dir) {
    if (!cfg.queue.length) return;
    if (cfg.cursor < 0) return jumpItem(0, 0);

    var item = cfg.queue[cfg.cursor];
    if (cfg.loopMode === 'single') {
      reloadPlay();
      return;
    }

    // 文件夹内顺序切集
    if (item && item.kind === 'series' && item.episodes && item.episodes.length && cfg.loopMode === 'order') {
      var nextEp = cfg.epCursor + dir;
      if (nextEp >= 0 && nextEp < item.episodes.length) {
        return jumpItem(cfg.cursor, nextEp);
      }
      // 出文件夹
      var nq = cfg.cursor + dir;
      if (nq < 0) nq = cfg.queue.length - 1;
      if (nq >= cfg.queue.length) nq = 0;
      var target = cfg.queue[nq];
      if (target.kind === 'series') {
        return jumpItem(nq, dir > 0 ? 0 : Math.max(0, (target.episodes || []).length - 1));
      }
      return jumpItem(nq, -1);
    }

    if (cfg.loopMode === 'shuffle') {
      if (cfg.queue.length === 1 && item.kind === 'series' && item.episodes && item.episodes.length > 1) {
        var ei;
        do { ei = Math.floor(Math.random() * item.episodes.length); } while (ei === cfg.epCursor);
        return jumpItem(cfg.cursor, ei);
      }
      var qi;
      do { qi = Math.floor(Math.random() * cfg.queue.length); } while (qi === cfg.cursor && cfg.queue.length > 1);
      var t = cfg.queue[qi];
      if (t.kind === 'series' && t.episodes && t.episodes.length) {
        return jumpItem(qi, Math.floor(Math.random() * t.episodes.length));
      }
      return jumpItem(qi, -1);
    }

    var n = cfg.cursor + dir;
    if (n < 0) n = cfg.queue.length - 1;
    if (n >= cfg.queue.length) n = 0;
    var it = cfg.queue[n];
    if (it.kind === 'series') return jumpItem(n, dir > 0 ? 0 : Math.max(0, (it.episodes || []).length - 1));
    jumpItem(n, -1);
  }

  function drawShelf() {
    var box = DOC.getElementById('m3-shelf');
    var voidEl = DOC.getElementById('m3-shelf-void');
    if (!box) return;
    box.innerHTML = '';
    if (!cfg.shelves.length) {
      if (voidEl) voidEl.style.display = 'block';
      return;
    }
    if (voidEl) voidEl.style.display = 'none';
    var frag = DOC.createDocumentFragment();
    cfg.shelves.forEach(function (s, idx) {
      if (s.kind === 'series') frag.appendChild(renderFolder(s, idx, true));
      else {
        var row=renderFlat(s, idx); var buttons=row.querySelectorAll('button'); if(buttons.length) buttons[buttons.length-1].onclick=function(e){e.stopPropagation();cfg.shelves.splice(idx,1);writeCfg();drawShelf();}; frag.appendChild(row);
      }
    });
    box.appendChild(frag);
  }

  function dragify(node) {
    var sx, sy, left, top, moved;
    function begin(x, y) {
      moved = false;
      var r = node.getBoundingClientRect();
      sx = x; sy = y; left = r.left; top = r.top;
      node.style.right = 'auto';
      node.style.bottom = 'auto';
      node.style.left = left + 'px';
      node.style.top = top + 'px';
    }
    function go(x, y) {
      var dx = x - sx, dy = y - sy;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) moved = true;
      if (!moved) return;
      node.style.left = Math.max(0, Math.min(left + dx, ROOT.innerWidth - node.offsetWidth)) + 'px';
      node.style.top = Math.max(0, Math.min(top + dy, ROOT.innerHeight - node.offsetHeight)) + 'px';
    }
    function end() {
      node.dataset.moved = moved ? '1' : '0';
      setTimeout(function () { node.dataset.moved = '0'; }, 50);
    }
    node.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault();
      begin(e.clientX, e.clientY);
      var move = function (e) { go(e.clientX, e.clientY); };
      var up = function () {
        DOC.removeEventListener('mousemove', move);
        DOC.removeEventListener('mouseup', up);
        end();
      };
      DOC.addEventListener('mousemove', move);
      DOC.addEventListener('mouseup', up);
    });
    node.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      begin(e.touches[0].clientX, e.touches[0].clientY);
      var move = function (e) {
        if (e.touches.length !== 1) return;
        if (moved) e.preventDefault();
        go(e.touches[0].clientX, e.touches[0].clientY);
      };
      var up = function () {
        DOC.removeEventListener('touchmove', move);
        DOC.removeEventListener('touchend', up);
        end();
      };
      DOC.addEventListener('touchmove', move, { passive: false });
      DOC.addEventListener('touchend', up);
    }, { passive: true });
  }

  function boot() {
    try {
      injectCss();
      mount();
    } catch (e) {
      console.error('[mmle5]', e);
    }
  }

  function teardown() {
    try {
      [IDS.orb, IDS.shell, IDS.dim, IDS.pip, IDS.css].forEach(function (id) {
        var n = DOC.getElementById(id);
        if (n) n.remove();
      });
    } catch (e) {}
    ROOT.__mmle5 = false;
    ROOT.__mmle5msg = false;
  }



  if (typeof $ !== 'undefined') {
    $(boot);
    $(window).on('pagehide', teardown);
  } else {
    if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', boot);
    else boot();
    window.addEventListener('pagehide', teardown);
  }
})();
