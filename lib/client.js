// Client half of the COROS Sport plugin.
//
// Two registrations make the feature reachable:
//   sidebar.panellist -> the "高驰运动" row in the global panel list
//   main              -> the panel body, dispatched by that same id
//
// The id of both must match, and it must differ from every shipped entry:
// reusing one would replace that entry instead of adding a row.
//
// Layout note: `main` slot content receives no props, so nothing here can read
// the available width from JS. The panel root is therefore a CSS *container*
// (`container-type: inline-size`) and every responsive rule is a `@container`
// query keyed off it. The stylesheet is rendered inside the panel tree rather
// than appended to <head> so it also applies if the host ever mounts the slot
// into a shadow root.
window.__ModuleLoader__.load({
  id: 'dsh-coros-sport',
  factory: function (require) {
    var React = require('react')

    var PANEL_ID = 'coros-sport'
    var PANEL_ORDER = 5
    var BASE = '/coros-sport'

    /* ------------------------------------------------------------- helpers */

    function h(type, props) {
      var children = Array.prototype.slice.call(arguments, 2)
      return React.createElement.apply(React, [type, props || null].concat(children))
    }

    var DICT = {
      zh: {
        title: '高驰运动',
        subtitle: 'COROS 账号 · 设备与运动健康总览',
        signInTitle: '登录高驰账号',
        signInBody: '登录在下方窗口内完成，不会跳出 DeepSeek Harness。凭据只保存在本机。',
        signInButton: '开始登录',
        signInPending: '请在上方窗口内完成高驰账号登录',
        signInWaiting: '等待授权结果…',
        cancel: '取消',
        retry: '重试',
        signOut: '退出登录',
        refresh: '刷新',
        loading: '正在读取高驰数据…',
        devices: '绑定设备',
        noDevices: '该账号下没有绑定设备',
        recovery: '恢复状态',
        fitness: '体能评估',
        activities: '近期运动',
        noActivities: '所选区间内没有运动记录',
        health: '健康与睡眠',
        schedule: '训练安排',
        noSchedule: '该账号还没有训练计划',
        expired: '登录已过期，请重新登录',
        failure: '读取失败',
        failureRetained: '读取失败，已保留上次数据',
        warranty: '保修至',
        serial: '序列号',
        level: '状态',
        fullRecovery: '完全恢复',
        fullRecoveryNow: '已完全恢复',
        vo2max: '最大摄氧量',
        runningLevel: '跑步水平',
        thresholdPace: '阈值配速',
        predictions: '成绩预测',
        fromFitness: '来自体能评估',
        weekVolume: '近 7 天跑量',
        restingHr: '静息心率',
        hrv: 'HRV 基线',
        steps: '步数',
        sleep: '睡眠',
        deep: '深睡',
        rem: 'REM',
        stress: '压力',
        duration: '时长',
        distance: '距离',
        pace: '配速',
        heartRate: '心率',
        calories: '消耗',
        lastDays: '近 {n} 天',
        today: '今天',
        tomorrow: '明天',
        thisWeek: '本周 {n} 项',
        rangeSummary: '近 {n} 天 · {c} 次 · {d} km',
        deviceCount: '{n} 台',
        avg7: '7 天平均',
        updatedAt: '更新于 {t}',
        localeNote: '',
        footnote: '数据来自 COROS MCP，仅供个人查看',
      },
      en: {
        title: 'COROS Sport',
        subtitle: 'COROS account · devices, workouts and health',
        signInTitle: 'Sign in to COROS',
        signInBody: 'Sign-in happens in the window below and never leaves DeepSeek Harness. Credentials stay on this machine.',
        signInButton: 'Start sign-in',
        signInPending: 'Complete the COROS sign-in in the window above',
        signInWaiting: 'Waiting for authorization…',
        cancel: 'Cancel',
        retry: 'Retry',
        signOut: 'Sign out',
        refresh: 'Refresh',
        loading: 'Reading COROS data…',
        devices: 'Bound devices',
        noDevices: 'No device is bound to this account',
        recovery: 'Recovery',
        fitness: 'Fitness',
        activities: 'Recent activities',
        noActivities: 'No activity in the selected range',
        health: 'Health and sleep',
        schedule: 'Training schedule',
        noSchedule: 'No training plan on this account yet',
        expired: 'Your session expired. Please sign in again.',
        failure: 'Could not load',
        failureRetained: 'Could not load, showing the last data',
        warranty: 'Warranty until',
        serial: 'Serial',
        level: 'Level',
        fullRecovery: 'Full recovery',
        fullRecoveryNow: 'Fully recovered',
        vo2max: 'VO2max',
        runningLevel: 'Running level',
        thresholdPace: 'Threshold pace',
        predictions: 'Predictions',
        fromFitness: 'From fitness',
        weekVolume: 'Last 7 days',
        restingHr: 'Resting HR',
        hrv: 'HRV baseline',
        steps: 'Steps',
        sleep: 'Sleep',
        deep: 'Deep',
        rem: 'REM',
        stress: 'Stress',
        duration: 'Duration',
        distance: 'Distance',
        pace: 'Pace',
        heartRate: 'Heart rate',
        calories: 'Calories',
        lastDays: 'Last {n} days',
        today: 'Today',
        tomorrow: 'Tomorrow',
        thisWeek: '{n} this week',
        rangeSummary: 'Last {n} days · {c} runs · {d} km',
        deviceCount: '{n} device',
        avg7: '7-day avg',
        updatedAt: 'Updated {t}',
        localeNote: '',
        footnote: 'Data comes from the COROS MCP endpoint, for personal review only',
      },
    }

    // Recovery / readiness words come back from COROS in English. Mapping them
    // keeps the Chinese panel from showing "Fresh" next to Chinese labels, and
    // gives the English panel a consistent verb phrase instead of a noun.
    var LEVELS = {
      fresh: { zh: '状态良好', en: 'Ready to train', tone: 'good' },
      primed: { zh: '状态上佳', en: 'Primed', tone: 'good' },
      rested: { zh: '已充分休息', en: 'Well rested', tone: 'good' },
      rising: { zh: '状态回升', en: 'Rising', tone: 'good' },
      normal: { zh: '状态正常', en: 'Normal', tone: 'good' },
      recovering: { zh: '恢复中', en: 'Recovering', tone: 'mid' },
      strained: { zh: '略疲劳', en: 'Strained', tone: 'low' },
      tired: { zh: '疲劳', en: 'Tired', tone: 'low' },
      overreached: { zh: '过度负荷', en: 'Overreached', tone: 'low' },
      overloaded: { zh: '过度负荷', en: 'Overloaded', tone: 'low' },
      'very tired': { zh: '很疲劳', en: 'Very tired', tone: 'low' },
    }

    var PREDICTION_LABELS = {
      '5 km': { zh: '5 公里', en: '5 km' },
      '5k': { zh: '5 公里', en: '5 km' },
      '10 km': { zh: '10 公里', en: '10 km' },
      '10k': { zh: '10 公里', en: '10 km' },
      'half marathon': { zh: '半程马拉松', en: 'Half marathon' },
      'marathon': { zh: '马拉松', en: 'Marathon' },
    }

    function detectLocale(ctx) {
      try {
        var locale = ctx.get ? ctx.get('locale') : null
        var snapshot = locale && locale.getLocale ? locale.getLocale() : null
        var id = snapshot && (snapshot.id || snapshot.locale || snapshot.language)
        if (typeof id === 'string' && id.toLowerCase().indexOf('zh') === 0) return 'zh'
        if (typeof id === 'string') return 'en'
      } catch (err) {
        /* fall through to the default */
      }
      return 'zh'
    }

    function makeT(localeId) {
      var table = DICT[localeId] || DICT.zh
      return function (key, vars) {
        var text = table[key] || DICT.zh[key] || key
        if (!vars) return text
        return Object.keys(vars).reduce(function (acc, name) {
          return acc.split('{' + name + '}').join(String(vars[name]))
        }, text)
      }
    }

    function fetchJson(path) {
      return fetch(BASE + path, { credentials: 'same-origin' }).then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok || body.ok === false) {
            var error = new Error(body && body.error ? body.error : 'HTTP ' + res.status)
            error.code = body && body.code
            error.status = res.status
            throw error
          }
          return body
        })
      })
    }

    /* -------------------------------------------------------- value shaping */

    function isBlank(value) {
      return value === undefined || value === null || value === '' || value === '—'
    }

    /**
     * COROS hands back values with the unit already inline ("7.11 km",
     * "5:00 /km", "157 bpm", "1:50:38"). Split the leading numeric run from the
     * trailing unit so the two can carry different type sizes without the
     * caller knowing which shape arrived.
     */
    function splitUnit(value) {
      if (isBlank(value)) return null
      var text = String(value).trim()
      var match = /^([-\d][\d.,:]*)\s*(.*)$/.exec(text)
      if (!match) return { value: text, unit: '' }
      return { value: match[1], unit: match[2] }
    }

    function numOf(value) {
      if (isBlank(value)) return undefined
      var match = String(value).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)
      return match ? Number(match[0]) : undefined
    }

    function unitSuffix(value) {
      var parsed = splitUnit(value)
      return parsed && parsed.unit ? parsed.unit : ''
    }

    function minutesOf(value) {
      if (isBlank(value)) return 0
      var text = String(value)
      var hours = /(\d+)\s*h/i.exec(text)
      var mins = /(\d+)\s*m/i.exec(text)
      return (hours ? Number(hours[1]) * 60 : 0) + (mins ? Number(mins[1]) : 0)
    }

    function todayStamp() {
      var now = new Date()
      var month = String(now.getMonth() + 1).padStart(2, '0')
      var day = String(now.getDate()).padStart(2, '0')
      return now.getFullYear() + '-' + month + '-' + day
    }

    /** `2026-10-30` -> 今天 / 明天 / 10-30, whichever is most useful. */
    function dayLabel(rawStamp, t) {
      var stamp = String(rawStamp || '').trim()
      if (!stamp) return ''
      var match = /(\d{4})-(\d{2})-(\d{2})/.exec(stamp)
      if (!match) return stamp
      var now = new Date()
      var target = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
      var start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      var delta = Math.round((target.getTime() - start.getTime()) / 86400000)
      if (delta === 0) return t('today')
      if (delta === 1) return t('tomorrow')
      return match[2] + '-' + match[3]
    }

    function formatStamp(iso) {
      if (!iso) return ''
      var date = new Date(iso)
      if (isNaN(date.getTime())) return ''
      var pad = function (n) {
        return String(n).padStart(2, '0')
      }
      return (
        date.getFullYear() +
        '-' +
        pad(date.getMonth() + 1) +
        '-' +
        pad(date.getDate()) +
        ' ' +
        pad(date.getHours()) +
        ':' +
        pad(date.getMinutes())
      )
    }

    /** Warranty/expiry timestamps only matter to the day; drop the clock. */
    function dateOnly(value) {
      var match = /(\d{4}-\d{2}-\d{2})/.exec(String(value || ''))
      return match ? match[1] : String(value || '')
    }

    function trimPredictionLabel(label) {
      return String(label || '')
        .replace(/\s*Prediction\s*$/i, '')
        .trim()
    }

    function predictionText(label, locale) {
      var key = trimPredictionLabel(label).toLowerCase()
      var mapped = PREDICTION_LABELS[key]
      if (mapped) return mapped[locale] || mapped.en
      return trimPredictionLabel(label)
    }

    function levelText(level, locale) {
      if (isBlank(level)) return ''
      var entry = LEVELS[String(level).trim().toLowerCase()]
      if (!entry) return String(level)
      return entry[locale] || entry.en
    }

    function levelTone(level) {
      if (isBlank(level)) return 'idle'
      var entry = LEVELS[String(level).trim().toLowerCase()]
      if (!entry) return 'idle'
      return entry.tone === 'good' ? 'good' : entry.tone === 'low' ? 'low' : 'mid'
    }

    /* -------------------------------------------------------------- tokens */

    // Only the 14 aliases the host exposes are referenced, and every reference
    // carries a fallback observed in the light theme. The tokens are NEVER
    // re-declared on our root: redeclaring them here would pin the panel to the
    // light values and break the host's dark theme.
    var SHEET = `
.cv2-root{
  container-type:inline-size;
  height:100%;
  overflow-y:auto;
  overflow-x:hidden;
  background:var(--dsw-alias-bg-base,#fff);
  color:var(--dsw-alias-label-primary,#0f1115);
  font-family:inherit;
}
.cv2-page{max-width:1120px;margin:0 auto;padding:0 clamp(16px,3.5cqw,40px) 40px}

/* ---- header ---- */
.cv2-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:24px 0 20px}
.cv2-head-main{min-width:0}
.cv2-h1{margin:0;font-size:20px;font-weight:500;line-height:28px}
.cv2-sub{margin:4px 0 0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary,#61666b)}
.cv2-acts{display:flex;align-items:center;gap:4px;flex:none;margin-bottom:1px}
.cv2-tbtn{display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary,#0f1115);font:inherit;font-size:13px;line-height:20px;cursor:pointer}
.cv2-tbtn:hover{box-shadow:0 0 0 6px var(--dsw-alias-bg-overlay,#e9ecf2)}
.cv2-tbtn.is-muted{color:var(--dsw-alias-label-secondary,#61666b)}
.cv2-tbtn:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#4176e6));outline-offset:2px}
.cv2-tbtn svg{display:block}

/* ---- hero ---- */
.cv2-hero{margin-top:4px;background:var(--dsw-alias-bg-overlay,#e9ecf2);border-radius:16px;padding:20px}
.cv2-hero-grid{display:grid;grid-template-columns:88px minmax(0,1fr);column-gap:20px;row-gap:16px;align-items:center}
.cv2-ring{position:relative;width:88px;height:88px;flex:none}
.cv2-ring svg{display:block}
.cv2-ring-txt{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;line-height:28px;letter-spacing:-.01em;font-variant-numeric:tabular-nums}
.cv2-status{min-width:0}
.cv2-status-row{display:flex;align-items:center;gap:8px;min-width:0}
.cv2-dot{width:8px;height:8px;border-radius:999px;flex:none;background:var(--dsw-alias-state-idle-primary,#d4d4d4)}
.cv2-dot.good{background:var(--dsw-alias-state-success-primary,#22c55e)}
.cv2-dot.low{background:var(--dsw-alias-state-warn-primary,#f59e0b)}
.cv2-status-word{font-size:18px;font-weight:600;line-height:24px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cv2-note{margin:2px 0 0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#61666b)}
.cv2-metrics{grid-column:1 / -1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr))}
.cv2-m{padding-left:16px;border-left:.5px solid var(--dsw-alias-border-l2,rgba(0,0,0,.10));min-width:0}
.cv2-m:first-child{border-left:0;padding-left:0}
.cv2-hk{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#61666b);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cv2-mv{margin:2px 0 0;font-size:18px;font-weight:600;line-height:24px;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cv2-mu{margin-left:2px;font-size:12px;font-weight:400;color:var(--dsw-alias-label-secondary,#61666b)}

/* ---- section scaffold ---- */
.cv2-cols{display:grid;grid-template-columns:minmax(0,1fr);row-gap:24px;margin-top:28px}
.cv2-col{display:contents}
.cv2-sec{min-width:0}
.cv2-sec-h{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:8px}
.cv2-sec-t{margin:0;font-size:14px;font-weight:500;line-height:20px}
.cv2-sec-m{flex:none;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#61666b)}
.cv2-rows{display:flex;flex-direction:column}
.cv2-row{border-bottom:.5px solid var(--dsw-alias-border-l2,rgba(0,0,0,.10));padding:12px 2px}
.cv2-row:last-child{border-bottom:0}

/* ---- training schedule ---- */
.cv2-pl{display:grid;grid-template-columns:76px minmax(0,1fr);column-gap:12px;align-items:baseline}
.cv2-pl.no-when{grid-template-columns:minmax(0,1fr)}
.cv2-pl-when{font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary,#61666b);font-variant-numeric:tabular-nums;white-space:nowrap}
.cv2-pl-t{font-size:13px;font-weight:600;line-height:20px}
.cv2-pl-d{margin:2px 0 0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#61666b)}

/* ---- activities ---- */
.cv2-act{display:grid;grid-template-columns:minmax(0,1fr);row-gap:8px;align-items:center}
.cv2-act-main{display:flex;align-items:baseline;gap:8px;min-width:0;flex-wrap:wrap}
.cv2-act-name{font-size:13px;font-weight:600;line-height:20px}
.cv2-act-date{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#61666b);font-variant-numeric:tabular-nums}
.cv2-act-nums{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));column-gap:12px}
.cv2-act-n{min-width:0}
.cv2-act-v{font-size:13px;font-weight:600;line-height:20px;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cv2-act-k{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary,#61666b);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* ---- health ---- */
.cv2-hgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:24px;row-gap:14px}
.cv2-chart{margin-top:16px}
.cv2-bars{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));column-gap:8px;align-items:end}
.cv2-col-b{display:flex;flex-direction:column;justify-content:flex-end;gap:2px;min-width:0}
.cv2-bar-v{font-size:11px;line-height:14px;color:var(--dsw-alias-label-secondary,#61666b);text-align:center;font-variant-numeric:tabular-nums}
.cv2-bar-slot{height:40px;display:flex;align-items:flex-end}
.cv2-bar{width:100%;min-height:2px;border-radius:2px 2px 0 0;background:var(--dsw-alias-border-l2,rgba(0,0,0,.10))}
.cv2-bar.is-today{background:var(--dsw-alias-label-secondary,#61666b)}
.cv2-xlab{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary,#61666b);text-align:center;font-variant-numeric:tabular-nums}
.cv2-chart-note{margin:10px 0 0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#61666b)}

/* ---- predictions ---- */
.cv2-preds{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:24px;row-gap:14px}
.cv2-pred{min-width:0}
.cv2-pred-v{margin:2px 0 0;font-size:15px;font-weight:600;line-height:22px;font-variant-numeric:tabular-nums}

/* ---- devices ---- */
.cv2-dev{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;padding:10px 2px}
.cv2-dev-name{font-size:13px;font-weight:600;line-height:20px}
.cv2-dev-meta{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#61666b);font-variant-numeric:tabular-nums}
.cv2-dev-sep{color:var(--dsw-alias-label-secondary,#61666b)}

/* ---- empty / error / skeleton ---- */
.cv2-state{display:flex;align-items:center;gap:8px;padding:16px;border:.5px solid var(--dsw-alias-border-l2,rgba(0,0,0,.10));border-radius:16px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary,#61666b)}
.cv2-state svg{display:block;flex:none}
.cv2-state.is-error{color:var(--dsw-alias-label-primary,#0f1115)}
.cv2-state.is-error svg{color:var(--dsw-alias-state-error-primary,#f25a5a)}
.cv2-state-text{min-width:0}
.cv2-state-btn{flex:none;margin-left:auto;height:28px;padding:0 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary,#0f1115);font:inherit;font-size:13px;line-height:20px;cursor:pointer}
.cv2-state-btn:hover{box-shadow:0 0 0 6px var(--dsw-alias-bg-overlay,#e9ecf2)}
.cv2-state-btn:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#4176e6));outline-offset:2px}
.cv2-sk{display:flex;flex-direction:column;gap:8px;padding:12px 2px}
.cv2-sk i{display:block;height:12px;border-radius:3px;background:var(--dsw-alias-bg-overlay,#e9ecf2)}
.cv2-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}

/* ---- footer ---- */
.cv2-foot{margin-top:32px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary,#61666b)}

/* ---- sign-in ---- */
.cv2-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 12px;border:0;border-radius:8px;background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary,#0f1115));color:var(--dsw-alias-label-primary-foreground,#fff);font:inherit;font-size:13px;line-height:20px;cursor:pointer}
.cv2-btn:disabled{opacity:.6;cursor:default}
.cv2-btn:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#4176e6));outline-offset:2px}
.cv2-btn.is-quiet{background:transparent;border:.5px solid var(--dsw-alias-border-l2,rgba(0,0,0,.10));color:var(--dsw-alias-label-primary,#0f1115)}
.cv2-iframe{width:100%;height:min(520px,70vh);border:.5px solid var(--dsw-alias-border-l2,rgba(0,0,0,.10));border-radius:16px;background:#fff}
.cv2-hint{margin:10px 0 0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#61666b)}
.cv2-bar-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
.cv2-bar-row p{margin:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary,#61666b)}
.cv2-expired{display:flex;align-items:center;gap:8px;margin:0 0 12px;font-size:13px;line-height:20px}
.cv2-expired .cv2-dot{background:var(--dsw-alias-state-warn-primary,#f59e0b)}

/* ---- two columns (>=940 container px) ---- */
@container (min-width:940px){
  .cv2-hero-grid{grid-template-columns:88px 154px minmax(0,1fr)}
  .cv2-metrics{grid-column:auto;align-self:center}
  .cv2-cols{grid-template-columns:minmax(0,1.62fr) minmax(320px,1fr);column-gap:32px;row-gap:28px;align-items:start}
  .cv2-col{display:flex;flex-direction:column;row-gap:28px;min-width:0}
  .cv2-act{grid-template-columns:minmax(0,1fr) auto;column-gap:16px;row-gap:0}
  .cv2-act-nums{grid-template-columns:repeat(4,72px);justify-content:end}
}

/* ---- very narrow (<520 container px) ---- */
@container (max-width:519px){
  .cv2-hero-grid{row-gap:16px}
  .cv2-metrics{grid-template-columns:repeat(2,minmax(0,1fr));row-gap:16px}
  .cv2-m{padding-left:16px}
  .cv2-m:nth-child(odd){border-left:0;padding-left:0}
  .cv2-act{row-gap:10px}
  .cv2-act-nums{grid-template-columns:repeat(2,minmax(0,1fr));row-gap:10px}
  .cv2-hgrid{grid-template-columns:minmax(0,1fr)}
  .cv2-preds{grid-template-columns:minmax(0,1fr)}
  .cv2-pl{grid-template-columns:minmax(0,1fr);row-gap:2px}
  .cv2-head{flex-direction:column;align-items:stretch}
  .cv2-acts{align-self:flex-start;margin-left:-8px}
}
`

    /* ---------------------------------------------------------------- icons */

    // Drawn from the COROS brand mark so the row is recognisable at 20px.
    function CorosMark(props) {
      var size = props && props.size ? props.size : 20
      return h(
        'svg',
        {
          viewBox: '0 0 1024 1024',
          width: size,
          height: size,
          fill: 'currentColor',
          'aria-hidden': 'true',
          focusable: 'false',
          style: { display: 'block' },
        },
        h('path', {
          d: 'M611.286 226.385l313.26 182.007 0.529 377.932-312.729 181.118-52.831-28.513 245.176-182.367-3.436-314.288-245.176-182.367 52.831-28.425zM171.16 335.14l34.868 304.151 275.383 158.96 279.049-118.712v56.856l-313.768 181.118-326.584-192.513V366.788l51.031-31.627zM569.195 56.558l312.73 181.118 1.801 60.139-280.044-121.804-274.918 159.765-37.028 301.757-49.061-28.428 0.508-363.125 325.011-189.422z',
        }),
      )
    }

    function SidebarIcon(props) {
      var size = props && typeof props.size === 'number' ? Math.max(14, Math.min(28, props.size)) : 20
      return h(
        'span',
        {
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            color: props && props.active ? 'var(--dsw-alias-brand-primary,#0f1115)' : 'inherit',
          },
        },
        h(CorosMark, { size: size }),
      )
    }

    function RefreshIcon() {
      return h(
        'svg',
        { viewBox: '0 0 16 16', width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', 'aria-hidden': 'true' },
        h('path', { d: 'M13 8a5 5 0 1 1-1.6-3.7' }),
        h('path', { d: 'M13.2 3.2v2.9h-2.9' }),
      )
    }

    function CalendarIcon() {
      return h(
        'svg',
        { viewBox: '0 0 16 16', width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', 'aria-hidden': 'true' },
        h('rect', { x: 2.25, y: 3.25, width: 11.5, height: 10.5, rx: 1.75 }),
        h('path', { d: 'M2.25 6.75h11.5' }),
        h('path', { d: 'M5.5 1.75v3M10.5 1.75v3' }),
      )
    }

    function AlertIcon() {
      return h(
        'svg',
        { viewBox: '0 0 16 16', width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', 'aria-hidden': 'true' },
        h('circle', { cx: 8, cy: 8, r: 5.75 }),
        h('path', { d: 'M8 5v3.5' }),
        h('path', { d: 'M8 11h.01' }),
      )
    }

    /**
     * Recovery dial. Two rings: a track and the progress arc. The number is
     * real text laid over the SVG, so the ring itself stays decorative.
     */
    function RecoveryRing(props) {
      var percent = typeof props.percent === 'number' ? Math.max(0, Math.min(100, props.percent)) : null
      var radius = 40
      var circumference = 2 * Math.PI * radius
      var offset = percent === null ? circumference : circumference * (1 - percent / 100)
      return h(
        'div',
        { className: 'cv2-ring' },
        h(
          'svg',
          { width: 88, height: 88, viewBox: '0 0 88 88', 'aria-hidden': 'true', focusable: 'false' },
          h('circle', { cx: 44, cy: 44, r: radius, fill: 'none', strokeWidth: 8, stroke: 'var(--dsw-alias-border-l2,rgba(0,0,0,.10))' }),
          percent !== null
            ? h('circle', {
                cx: 44,
                cy: 44,
                r: radius,
                fill: 'none',
                strokeWidth: 8,
                strokeLinecap: 'round',
                strokeDasharray: circumference.toFixed(2),
                strokeDashoffset: offset.toFixed(2),
                stroke: 'var(--dsw-alias-brand-primary,#0f1115)',
                transform: 'rotate(-90 44 44)',
              })
            : null,
        ),
        h('span', { className: 'cv2-ring-txt' }, percent === null ? '—' : percent + '%'),
      )
    }

    /* ------------------------------------------------------------- fragments */

    function Section(props) {
      var meta = props.meta
      var hasMeta = meta !== undefined && meta !== null && meta !== ''
      return h(
        'section',
        { className: 'cv2-sec' },
        h(
          'div',
          { className: 'cv2-sec-h' },
          h('h2', { className: 'cv2-sec-t' }, props.title),
          hasMeta ? h('span', { className: 'cv2-sec-m' }, meta) : null,
        ),
        props.children,
      )
    }

    function StateBlock(props) {
      var isError = props.tone === 'error'
      return h(
        'div',
        { className: 'cv2-state' + (isError ? ' is-error' : '') },
        isError ? h(AlertIcon) : h(CalendarIcon),
        h('span', { className: 'cv2-state-text' }, props.message),
        props.onRetry
          ? h(
              'button',
              { type: 'button', className: 'cv2-state-btn', onClick: props.onRetry },
              props.retryLabel,
            )
          : null,
      )
    }

    function Skeleton(props) {
      var rows = []
      for (var i = 0; i < (props.rows || 2); i += 1) {
        rows.push(h('i', { key: i, style: { width: i % 2 === 0 ? '34%' : '62%' } }))
      }
      return h('div', { className: 'cv2-sk', 'aria-hidden': 'true' }, rows)
    }

    /* ---------------------------------------------------------- sign-in flow */

    function SignIn(props) {
      var t = props.t
      var started = React.useState(null)
      var attempt = started[0]
      var setAttempt = started[1]
      var busyRef = React.useState(false)
      var busy = busyRef[0]
      var setBusy = busyRef[1]
      var errorRef = React.useState(null)
      var error = errorRef[0]
      var setError = errorRef[1]

      function start() {
        setBusy(true)
        setError(null)
        fetchJson('/login/start')
          .then(function (body) {
            setAttempt(body)
          })
          .catch(function (err) {
            setError(err.message)
          })
          .finally(function () {
            setBusy(false)
          })
      }

      function cancel() {
        var current = attempt
        setAttempt(null)
        if (current && current.loginId) {
          fetch(BASE + '/login/cancel?loginId=' + encodeURIComponent(current.loginId), { method: 'POST' }).catch(function () {})
        }
      }

      // Poll only while an attempt is live; the ticket is redeemed host-side on
      // the first `authorized` answer, so a slow poll loses nothing.
      React.useEffect(
        function () {
          if (!attempt || !attempt.loginId) return undefined
          var cancelled = false
          var timer = null
          function tick() {
            fetchJson('/login/poll?loginId=' + encodeURIComponent(attempt.loginId))
              .then(function (body) {
                if (cancelled) return
                if (body.state === 'authenticated') {
                  setAttempt(null)
                  props.onSignedIn()
                  return
                }
                if (body.state === 'pending') {
                  timer = setTimeout(tick, attempt.intervalMs || 3000)
                  return
                }
                setAttempt(null)
                setError(body.message || t('expired'))
              })
              .catch(function (err) {
                if (cancelled) return
                setAttempt(null)
                setError(err.message)
              })
          }
          timer = setTimeout(tick, attempt.intervalMs || 3000)
          return function () {
            cancelled = true
            if (timer) clearTimeout(timer)
          }
        },
        [attempt && attempt.loginId],
      )

      return h(
        'div',
        null,
        h(
          'div',
          { className: 'cv2-head' },
          h(
            'div',
            { className: 'cv2-head-main' },
            h('h1', { className: 'cv2-h1' }, t('signInTitle')),
            h('p', { className: 'cv2-sub' }, t('signInBody')),
          ),
        ),
        attempt
          ? h(
              'div',
              null,
              h(
                'div',
                { className: 'cv2-bar-row' },
                h('p', null, t('signInPending')),
                h('button', { type: 'button', onClick: cancel, className: 'cv2-btn is-quiet' }, t('cancel')),
              ),
              h('iframe', {
                // The consent page refuses server-side fetches and cannot be
                // driven by us, so the user must see and operate it directly.
                src: attempt.loginUrl,
                title: 'COROS',
                className: 'cv2-iframe',
                referrerPolicy: 'no-referrer',
              }),
              h('p', { className: 'cv2-hint' }, t('signInWaiting')),
            )
          : h(
              'div',
              null,
              h('button', { type: 'button', onClick: start, disabled: busy, className: 'cv2-btn' }, busy ? t('signInWaiting') : t('signInButton')),
              error ? h(StateBlock, { tone: 'error', message: error }) : null,
            ),
      )
    }

    /* ------------------------------------------------------------ dashboard */

    /** Sum of `distance` across the range, in whatever unit COROS reported. */
    function rangeVolume(records) {
      var total = 0
      var unit = 'km'
      for (var i = 0; i < records.length; i += 1) {
        var value = numOf(records[i].distance)
        if (value === undefined) continue
        total += value
        var found = unitSuffix(records[i].distance)
        if (found) unit = found
      }
      if (total === 0) return null
      return { value: total < 100 ? total.toFixed(1) : String(Math.round(total)), unit: unit }
    }

    function Hero(props) {
      var t = props.t
      var locale = props.locale
      var recovery = props.recovery
      var fitness = props.fitness
      var records = (props.activities && props.activities.records) || []

      if (!recovery && !fitness && records.length === 0) return null

      var percent = recovery ? numOf(recovery.percent) : undefined
      var hasPercent = percent !== undefined
      var level = recovery && recovery.level ? String(recovery.level) : ''
      var tone = levelTone(level)
      var word = levelText(level, locale)

      var metrics = []
      if (fitness && !isBlank(fitness.vo2max)) {
        var vo2 = splitUnit(fitness.vo2max)
        metrics.push({ key: 'vo2', label: t('vo2max'), value: vo2.value, unit: vo2.unit || 'ml/kg' })
      }
      if (fitness && !isBlank(fitness.runningLevel)) {
        metrics.push({ key: 'rl', label: t('runningLevel'), value: String(fitness.runningLevel), unit: '/100' })
      }
      if (fitness && !isBlank(fitness.thresholdPace)) {
        var pace = splitUnit(fitness.thresholdPace)
        metrics.push({ key: 'tp', label: t('thresholdPace'), value: pace.value, unit: pace.unit || '/km' })
      }
      var volume = rangeVolume(records)
      if (volume) {
        metrics.push({ key: 'vol', label: t('weekVolume'), value: volume.value, unit: volume.unit })
      }

      var fullRecovery = recovery && recovery.estimatedFullRecovery
      var noteText = null
      if (fullRecovery) {
        // "0h" means there is nothing left to recover; spelling that out reads
        // better than printing a zero-hour duration.
        noteText = minutesOf(fullRecovery) === 0 ? t('fullRecoveryNow') : t('fullRecovery') + ' · ' + fullRecovery
      }

      return h(
        'section',
        { className: 'cv2-hero' },
        h(
          'div',
          { className: 'cv2-hero-grid' },
          h(RecoveryRing, { percent: hasPercent ? percent : null }),
          h(
            'div',
            { className: 'cv2-status' },
            h(
              'div',
              { className: 'cv2-status-row' },
              word ? h('span', { className: 'cv2-dot ' + tone, 'aria-hidden': 'true' }) : null,
              h('span', { className: 'cv2-status-word' }, word || t('recovery')),
            ),
            noteText ? h('p', { className: 'cv2-note' }, noteText) : null,
          ),
          metrics.length
            ? h(
                'div',
                { className: 'cv2-metrics' },
                metrics.map(function (metric) {
                  return h(
                    'div',
                    { className: 'cv2-m', key: metric.key },
                    h('p', { className: 'cv2-hk' }, metric.label),
                    h(
                      'p',
                      { className: 'cv2-mv' },
                      metric.value,
                      metric.unit ? h('span', { className: 'cv2-mu' }, metric.unit) : null,
                    ),
                  )
                }),
              )
            : null,
        ),
      )
    }

    function ScheduleSection(props) {
      var t = props.t
      var data = props.data
      var entries = (data && data.entries) || []
      if (props.error) {
        return h(
          Section,
          { title: t('schedule') },
          h(StateBlock, { tone: 'error', message: t('failureRetained'), retryLabel: t('retry'), onRetry: props.onRetry }),
        )
      }
      if (!data || data.empty || entries.length === 0) {
        return h(
          Section,
          { title: t('schedule') },
          h(StateBlock, { message: t('noSchedule') }),
        )
      }
      var rows = entries.slice(0, 3).map(function (entry, index) {
        var when = entry.date || entry.Date || entry.day || entry.Day || ''
        var details = []
        var detailKeys = ['type', 'Type', 'workout', 'Workout', 'duration', 'Duration', 'distance', 'Distance']
        for (var i = 0; i < detailKeys.length; i += 1) {
          var value = entry[detailKeys[i]]
          if (!isBlank(value)) details.push(String(value))
        }
        var label = dayLabel(when, t)
        return h(
          'div',
          { className: 'cv2-row', key: index },
          h(
            'div',
            { className: 'cv2-pl' + (label ? '' : ' no-when') },
            label ? h('span', { className: 'cv2-pl-when' }, label) : null,
            h(
              'div',
              null,
              h('div', { className: 'cv2-pl-t' }, entry.title || ''),
              details.length ? h('p', { className: 'cv2-pl-d' }, details.join(' · ')) : null,
            ),
          ),
        )
      })
      return h(Section, { title: t('schedule'), meta: t('thisWeek', { n: entries.length }) }, h('div', { className: 'cv2-rows' }, rows))
    }

    function ActivitiesSection(props) {
      var t = props.t
      var data = props.data
      var records = (data && data.records) || []
      if (props.error) {
        return h(
          Section,
          { title: t('activities') },
          h(StateBlock, { tone: 'error', message: t('failureRetained'), retryLabel: t('retry'), onRetry: props.onRetry }),
        )
      }
      if (records.length === 0) {
        return h(Section, { title: t('activities') }, h(StateBlock, { message: t('noActivities') }))
      }
      var visible = records.slice(0, 4)
      var volume = rangeVolume(records)
      var meta = t('rangeSummary', {
        n: props.days,
        c: records.length,
        d: volume ? volume.value : '0',
      })
      var rows = visible.map(function (record, index) {
        var cells = [
          { key: 'd', value: splitUnit(record.distance), label: t('distance') },
          { key: 't', value: splitUnit(record.duration), label: t('duration') },
          // The unit belongs to the value, not to the label: repeating it under
          // every number ("/km" over "5:00 /km") is pure noise.
          { key: 'p', value: splitUnit(record.averagePace), label: t('pace') },
          { key: 'h', value: splitUnit(record.averageHeartRate), label: t('heartRate') },
        ]
        return h(
          'div',
          { className: 'cv2-row', key: index },
          h(
            'div',
            { className: 'cv2-act' },
            h(
              'div',
              { className: 'cv2-act-main' },
              h('span', { className: 'cv2-act-name' }, record.sportType || ''),
              record.date ? h('span', { className: 'cv2-act-date' }, record.date) : null,
            ),
            h(
              'div',
              { className: 'cv2-act-nums' },
              cells.map(function (cell) {
                if (!cell.value) return h('div', { className: 'cv2-act-n', key: cell.key })
                return h(
                  'div',
                  { className: 'cv2-act-n', key: cell.key },
                  h('div', { className: 'cv2-act-v' }, cell.value.value, cell.value.unit ? h('span', { className: 'cv2-mu' }, ' ' + cell.value.unit) : null),
                  h('div', { className: 'cv2-act-k' }, cell.label),
                )
              }),
            ),
          ),
        )
      })
      return h(Section, { title: t('activities'), meta: meta }, h('div', { className: 'cv2-rows' }, rows))
    }

    function HealthSection(props) {
      var t = props.t
      var data = props.data
      if (props.error) {
        return h(
          Section,
          { title: t('health') },
          h(StateBlock, { tone: 'error', message: t('failureRetained'), retryLabel: t('retry'), onRetry: props.onRetry }),
        )
      }
      var days = (data && data.days) || []
      var hasKpi = data && (!isBlank(data.restingHeartRate) || !isBlank(data.hrvBaseline))
      if (!hasKpi && days.length === 0) return null

      var kpis = []
      if (!isBlank(data.restingHeartRate)) {
        var rhr = splitUnit(data.restingHeartRate)
        kpis.push({ key: 'rhr', label: t('restingHr'), value: rhr.value, unit: rhr.unit || 'bpm' })
      }
      if (!isBlank(data.hrvBaseline)) {
        var hrv = splitUnit(data.hrvBaseline)
        kpis.push({ key: 'hrv', label: t('hrv'), value: hrv.value, unit: hrv.unit || 'ms' })
      }
      // "Last night" is the newest wake-up day, which is the day COROS dates
      // sleep by; steps for the same day are usually still partial, so they are
      // labelled by their own day rather than merged into one line.
      var newest = days.length ? days[days.length - 1] : null
      if (newest && !isBlank(newest.sleepTotal)) {
        var sleep = splitUnit(newest.sleepTotal)
        kpis.push({ key: 'sleep', label: t('sleep'), value: sleep.value, unit: sleep.unit })
      }
      if (newest && !isBlank(newest.steps)) {
        kpis.push({ key: 'steps', label: t('steps'), value: String(numOf(newest.steps) !== undefined ? numOf(newest.steps).toLocaleString('en-US') : newest.steps), unit: '' })
      }

      var chartDays = days.slice(-7)
      var maxMinutes = 0
      var totals = []
      for (var i = 0; i < chartDays.length; i += 1) {
        var minutes = minutesOf(chartDays[i].sleepTotal)
        totals.push(minutes)
        if (minutes > maxMinutes) maxMinutes = minutes
      }
      // Relative to the best night in the window. An absolute floor (e.g. 10h) would
      // flatten a normal 7-9h week into a row of near-equal bars, which is exactly the
      // pattern a sleeper needs to see vary; every bar carries its own hour label, so
      // the scale is never ambiguous.
      var scale = maxMinutes > 0 ? maxMinutes : 0
      var today = todayStamp()
      var hours = totals.map(function (m) {
        return m > 0 ? (m / 60).toFixed(1) : '—'
      })

      var bars = null
      if (chartDays.length >= 2 && maxMinutes > 0) {
        bars = h(
          'div',
          { className: 'cv2-chart' },
          h(
            'div',
            { className: 'cv2-bars', role: 'img', 'aria-label': chartDays.map(function (day) { return day.date + ' ' + (day.sleepTotal || '—') }).join('; ') },
            chartDays.map(function (day, index) {
              var minutes = totals[index]
              var height = minutes > 0 ? Math.max(2, Math.round((minutes / scale) * 40)) : 2
              var isToday = day.date === today
              return h(
                'div',
                { className: 'cv2-col-b', key: day.date || index },
                h('div', { className: 'cv2-bar-v' }, hours[index]),
                h('div', { className: 'cv2-bar-slot' }, h('div', { className: 'cv2-bar' + (isToday ? ' is-today' : ''), style: { height: height } })),
                h('div', { className: 'cv2-xlab' }, day.date ? day.date.slice(8) : ''),
              )
            }),
          ),
          h('p', { className: 'cv2-chart-note' }, chartNote(t, chartDays, totals, maxMinutes)),
        )
      }

      return h(
        Section,
        { title: t('health'), meta: t('lastDays', { n: props.days }) },
        kpis.length
          ? h(
              'div',
              { className: 'cv2-hgrid' },
              kpis.map(function (kpi) {
                return h(
                  'div',
                  { className: 'cv2-pred', key: kpi.key },
                  h('p', { className: 'cv2-hk' }, kpi.label),
                  h('p', { className: 'cv2-mv' }, kpi.value, kpi.unit ? h('span', { className: 'cv2-mu' }, kpi.unit) : null),
                )
              }),
            )
          : null,
        bars,
      )
    }

    function chartNote(t, chartDays, totals, maxMinutes) {
      var parts = []
      if (maxMinutes > 0) {
        var sum = totals.reduce(function (acc, v) {
          return acc + v
        }, 0)
        var avg = sum / totals.filter(function (v) { return v > 0 }).length
        if (isFinite(avg) && avg > 0) parts.push(t('avg7') + ' ' + Math.floor(avg / 60) + 'h ' + Math.round(avg % 60) + 'min')
      }
      var newest = chartDays[chartDays.length - 1]
      if (newest && newest.sleepDeep) parts.push(t('deep') + ' ' + newest.sleepDeep)
      if (newest && newest.sleepRem) parts.push(t('rem') + ' ' + newest.sleepRem)
      return parts.join(' · ')
    }

    function PredictionsSection(props) {
      var t = props.t
      var locale = props.locale
      var fitness = props.fitness
      if (props.error) {
        return h(
          Section,
          { title: t('predictions') },
          h(StateBlock, { tone: 'error', message: t('failureRetained'), retryLabel: t('retry'), onRetry: props.onRetry }),
        )
      }
      var predictions = (fitness && fitness.predictions) || []
      if (predictions.length === 0) return null
      return h(
        Section,
        { title: t('predictions'), meta: t('fromFitness') },
        h(
          'div',
          { className: 'cv2-preds' },
          predictions.slice(0, 4).map(function (prediction, index) {
            return h(
              'div',
              { className: 'cv2-pred', key: index },
              h('p', { className: 'cv2-hk' }, predictionText(prediction.label, locale)),
              h('p', { className: 'cv2-pred-v' }, prediction.value),
            )
          }),
        ),
      )
    }

    function DevicesSection(props) {
      var t = props.t
      var data = props.data
      if (props.error) {
        return h(
          Section,
          { title: t('devices') },
          h(StateBlock, { tone: 'error', message: t('failureRetained'), retryLabel: t('retry'), onRetry: props.onRetry }),
        )
      }
      if (!data) return null
      var devices = data.devices || []
      if (devices.length === 0) {
        return h(Section, { title: t('devices') }, h(StateBlock, { message: t('noDevices') }))
      }
      return h(
        Section,
        { title: t('devices'), meta: t('deviceCount', { n: devices.length }) },
        h(
          'div',
          null,
          devices.map(function (device, index) {
            var parts = [h('span', { className: 'cv2-dev-name', key: 'n' }, device.name || '')]
            if (device.serialNumber) {
              parts.push(h('span', { className: 'cv2-dev-sep', key: 's1', 'aria-hidden': 'true' }, '·'))
              parts.push(h('span', { className: 'cv2-dev-meta', key: 's2' }, device.serialNumber))
            }
            if (device.warrantyExpires) {
              parts.push(h('span', { className: 'cv2-dev-sep', key: 'w1', 'aria-hidden': 'true' }, '·'))
              parts.push(h('span', { className: 'cv2-dev-meta', key: 'w2' }, t('warranty') + ' ' + dateOnly(device.warrantyExpires)))
            }
            return h('div', { className: 'cv2-dev', key: index }, parts)
          }),
        ),
      )
    }

    function Dashboard(props) {
      var t = props.t
      var locale = props.locale
      var state = React.useState({ loading: true, data: null, error: null })
      var current = state[0]
      var setState = state[1]

      function load() {
        setState(function (prev) {
          return { loading: true, data: prev.data, error: null }
        })
        fetchJson('/overview')
          .then(function (body) {
            setState({ loading: false, data: body, error: null })
          })
          .catch(function (err) {
            if (err && (err.code === 'unauthenticated' || err.status === 401)) {
              props.onExpired()
              return
            }
            setState(function (prev) {
              return { loading: false, data: prev.data, error: err.message }
            })
          })
      }

      React.useEffect(
        function () {
          load()
          return undefined
        },
        [],
      )

      var sections = (current.data && current.data.sections) || {}
      var profile = sections.profile || null
      var errors = (current.data && current.data.errors) || []
      var errorBySection = {}
      for (var i = 0; i < errors.length; i += 1) {
        errorBySection[errors[i].section] = errors[i].message
      }
      var days = current.data && current.data.range ? current.data.range.days : 7
      var firstLoad = current.loading && !current.data

      var subtitleParts = [t('subtitle')]
      if (current.data && current.data.range) subtitleParts.push(t('lastDays', { n: days }))

      var body
      if (firstLoad) {
        body = h(
          'div',
          null,
          h(
            'div',
            { className: 'cv2-hero' },
            h(Skeleton, { rows: 2 }),
          ),
          h(
            'div',
            { className: 'cv2-cols' },
            h('div', { className: 'cv2-col' }, h(Section, { title: t('schedule') }, h(Skeleton)), h(Section, { title: t('activities') }, h(Skeleton))),
            h('div', { className: 'cv2-col' }, h(Section, { title: t('health') }, h(Skeleton))),
          ),
          h('p', { className: 'cv2-sr', role: 'status' }, t('loading')),
        )
      } else {
        body = h(
          'div',
          null,
          h(Hero, { t: t, locale: locale, recovery: sections.recovery, fitness: sections.fitness, activities: sections.activities }),
          h(
            'div',
            { className: 'cv2-cols' },
            h(
              'div',
              { className: 'cv2-col' },
              h(ScheduleSection, { t: t, data: sections.schedule, error: errorBySection.schedule, onRetry: load }),
              h(ActivitiesSection, { t: t, data: sections.activities, error: errorBySection.activities, days: days, onRetry: load }),
            ),
            h(
              'div',
              { className: 'cv2-col' },
              h(HealthSection, { t: t, data: sections.health, error: errorBySection.health, days: days, onRetry: load }),
              h(PredictionsSection, { t: t, locale: locale, fitness: sections.fitness, error: errorBySection.fitness, onRetry: load }),
              h(DevicesSection, { t: t, data: sections.devices, error: errorBySection.devices, onRetry: load }),
            ),
          ),
        )
      }

      var footParts = [t('footnote')]
      var stamp = formatStamp(current.data && current.data.fetchedAt)
      if (stamp) footParts.push(t('updatedAt', { t: stamp }))

      return h(
        'div',
        null,
        h(
          'div',
          { className: 'cv2-head' },
          h(
            'div',
            { className: 'cv2-head-main' },
            h('h1', { className: 'cv2-h1' }, profile && profile.nickname ? profile.nickname : t('title')),
            h('p', { className: 'cv2-sub' }, subtitleParts.join(' · ')),
          ),
          h(
            'div',
            { className: 'cv2-acts' },
            h('button', { type: 'button', onClick: load, className: 'cv2-tbtn' }, h(RefreshIcon), t('refresh')),
            h('button', { type: 'button', onClick: props.onSignOut, className: 'cv2-tbtn is-muted' }, t('signOut')),
          ),
        ),
        current.error && current.data
          ? h(StateBlock, { tone: 'error', message: t('failureRetained'), retryLabel: t('retry'), onRetry: load })
          : null,
        body,
        h('p', { className: 'cv2-foot' }, footParts.join(' · ')),
      )
    }

    /* ------------------------------------------------------------- the panel */

    function Panel(props) {
      var t = props.t
      var locale = props.locale
      var stateRef = React.useState({ phase: 'loading' })
      var state = stateRef[0]
      var setState = stateRef[1]

      function refreshStatus() {
        return fetchJson('/status')
          .then(function (body) {
            if (body.state === 'authenticated') setState({ phase: 'ready' })
            else if (body.state === 'expired') setState({ phase: 'expired', message: body.error })
            else setState({ phase: 'signed-out' })
          })
          .catch(function (err) {
            setState({ phase: 'signed-out', message: err.message })
          })
      }

      React.useEffect(
        function () {
          refreshStatus()
          return undefined
        },
        [],
      )

      function signOut() {
        fetch(BASE + '/logout', { method: 'POST' })
          .catch(function () {})
          .finally(function () {
            setState({ phase: 'signed-out' })
          })
      }

      var body
      if (state.phase === 'loading') {
        body = h(
          'div',
          { className: 'cv2-head' },
          h('div', { className: 'cv2-head-main' }, h('h1', { className: 'cv2-h1' }, t('title')), h('p', { className: 'cv2-sub' }, t('loading'))),
        )
      } else if (state.phase === 'ready') {
        body = h(Dashboard, {
          t: t,
          locale: locale,
          onSignOut: signOut,
          onExpired: function () {
            setState({ phase: 'expired' })
          },
        })
      } else if (state.phase === 'expired') {
        body = h(
          'div',
          null,
          h(
            'p',
            { className: 'cv2-expired' },
            h('span', { className: 'cv2-dot', 'aria-hidden': 'true' }),
            h('span', null, t('expired')),
          ),
          h(SignIn, {
            t: t,
            onSignedIn: function () {
              setState({ phase: 'ready' })
            },
          }),
        )
      } else {
        body = h(SignIn, {
          t: t,
          onSignedIn: function () {
            setState({ phase: 'ready' })
          },
        })
      }

      return h(
        'div',
        { className: 'cv2-root' },
        h('style', { dangerouslySetInnerHTML: { __html: SHEET } }),
        h('div', { className: 'cv2-page' }, body),
      )
    }

    /* ------------------------------------------------------------ bootstrap */

    function apply(ctx) {
      var localeId = detectLocale(ctx)
      var t = makeT(localeId)

      // The panel body. Keyed by the same id the sidebar row uses; the host
      // dispatches `entryKey` from the active panel id, so they must be equal.
      ctx.slots.inject('main', function () {
        return ctx.slots.register({ name: 'main', key: PANEL_ID }, function CorosSportPanel() {
          return h(Panel, { t: t, locale: localeId })
        })
      })

      // The sidebar row. order 5 places it right after the plugin market and
      // before the scheduled-task entry.
      ctx.slots.inject('sidebar.panellist', function () {
        return ctx.slots.register(
          { name: 'sidebar.panellist', id: PANEL_ID, order: PANEL_ORDER, label: function () { return t('title') } },
          function CorosSportIcon(ownerProps) {
            return h(SidebarIcon, ownerProps)
          },
        )
      })
    }

    return { inject: ['slots'], apply: apply }
  },
})
