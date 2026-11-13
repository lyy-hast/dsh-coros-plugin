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
        otherSport: '其他运动',
        sleepChart: '近 7 天睡眠',
        health: '健康与睡眠',
        schedule: '训练安排',
        // Two different empties: never had a plan (offer to create one) and a
        // rest week on an existing plan (do not). The weekly schedule alone
        // cannot tell them apart, so the plan library decides the wording.
        planEmptyHint: '这个账号还没有训练计划。点「创建训练计划」让 AI 按你的目标生成一份，或打开「训练安排」右上角的「详细」直接创建内置的四周计划。',
        planCreate: '创建训练计划',
        noSessionThisWeek: '本周暂无训练课',
        scheduleStartsOn: '训练从 {d} 开始。',
        planCount: '共 {n} 个计划',
        planCreateUnavailable: '现在打不开新会话。请先在左侧工作区新建一个会话，再输入 /coros-plan。',
        // The plan section. Two facts the copy has to carry, because neither is
        // discoverable from the COROS app afterwards: the API has no start-time
        // field, and a stored plan cannot be deleted.
        planTitle: '训练计划',
        planDetail: '详细',
        planBack: '返回看板',
        planPageSub: '插件内置的四周计划 · 先预览，确认后才写入高驰',
        planHint: '下面这份四周计划由插件内置，写入后在「训练安排」和高驰 App 里都能看到。写入不可撤销——高驰接口不支持删除计划。',
        planNoTime: '接口没有开始时间字段：18:30 / 17:30 只写在课程说明里，不会变成日程提醒。',
        planChecking: '正在读取…',
        planRange: '{a} → {b} · {w} 周 {n} 节 · 约 {d} km',
        planCreateAction: '创建训练计划',
        planConfirm: '确认创建，写入 {n} 节',
        planCancel: '取消',
        planThisWeek: '本周',
        planDanger: '确认后立刻创建，无法撤销。',
        planCreating: '正在创建…',
        planCreated: '已创建「{name}」，{n} 节。',
        planRejected: '高驰没有接受这份计划：{reason}',
        planConflict: '已有计划覆盖同一段时间：{list}。高驰不会合并两份计划，继续创建会在同一天出现两节课。',
        planReload: '重新读取',
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
        trainingLoad: '训练负荷比',
        runningLevelHint: '高驰对跑步能力的综合评分（40–100），综合基础、耐力、速度和冲刺四个维度，基于过去约 6 周训练数据。',
        runningLevelHintSource: '依据：COROS EvoLab',
        vo2maxHint: '身体在最大强度运动中每分钟、每公斤体重可摄取的最大氧气量；数值越高，有氧能力越强。由 COROS EvoLab 根据户外跑步估算。',
        vo2maxHintSource: '依据：COROS EvoLab · 户外跑步估算',
        thresholdPaceHint: '乳酸阈强度对应的配速，是阈值训练和强度区间划分的参考；配速越快，代表乳酸阈能力越强。',
        thresholdPaceHintSource: '依据：COROS EvoLab · 乳酸阈数据',
        trainingLoadHint: '短期训练负荷 ÷ 长期训练负荷，用于判断最近 7 天训练量相对长期基础是偏高还是偏低。如 0.68 表示 68%。',
        trainingLoadHintSource: '依据：COROS Training Status · 最新一天数据',
        predictions: '成绩预测',
        fromFitness: '来自体能评估',
        weekVolume: '近 7 天跑量',
        volume: '跑量',
        thisMonth: '本月',
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
        avgN: '近 {n} 天平均',
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
        otherSport: 'Other workout',
        sleepChart: 'Last 7 days',
        health: 'Health and sleep',
        schedule: 'Training schedule',
        planEmptyHint: 'No training plan on this account yet. Use “Create a training plan” to have one generated for your goal, or open “Details” at the top right of the schedule to create the built-in four-week plan.',
        planCreate: 'Create a training plan',
        noSessionThisWeek: 'No workout scheduled this week',
        scheduleStartsOn: 'Training starts on {d}.',
        planCount: '{n} plans',
        planCreateUnavailable: 'Cannot open a new session right now. Create one in the workspace on the left, then type /coros-plan.',
        planTitle: 'Training plan',
        planDetail: 'Details',
        planBack: 'Back to dashboard',
        planPageSub: 'The four-week plan built into the plugin · preview first, write only after you confirm',
        planHint: 'The four-week plan below is built into the plugin. Once written it shows up in the schedule above and in the COROS app. A write cannot be undone — the API has no way to delete a plan.',
        planNoTime: 'The API has no start-time field: 18:30 / 17:30 only appears in the session description, it does not become a reminder.',
        planChecking: 'Loading…',
        planRange: '{a} → {b} · {w} weeks, {n} sessions · ~{d} km',
        planCreateAction: 'Create training plan',
        planConfirm: 'Create it — {n} sessions',
        planCancel: 'Cancel',
        planThisWeek: 'This week',
        planDanger: 'This creates the plan immediately and cannot be undone.',
        planCreating: 'Creating…',
        planCreated: 'Created "{name}" with {n} sessions.',
        planRejected: 'COROS rejected the plan: {reason}',
        planConflict: 'An existing plan covers the same dates: {list}. COROS does not merge plans, so creating this one puts two sessions on those days.',
        planReload: 'Reload',
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
        trainingLoad: 'Training load ratio',
        runningLevelHint: 'COROS running-ability score (40–100), combining base, endurance, speed and sprint over roughly the last 6 weeks of training.',
        runningLevelHintSource: 'Source: COROS EvoLab',
        vo2maxHint: 'Maximum oxygen uptake per kilogram of body weight per minute at maximal effort; higher means better aerobic capacity, estimated by COROS EvoLab from outdoor runs.',
        vo2maxHintSource: 'Source: COROS EvoLab · outdoor-run estimate',
        thresholdPaceHint: 'Pace at lactate-threshold intensity, used for threshold training and pace zones; a faster pace indicates stronger threshold fitness.',
        thresholdPaceHintSource: 'Source: COROS EvoLab · lactate-threshold data',
        trainingLoadHint: 'Short-term training load ÷ long-term training load; shows whether the last 7 days are above or below your long-term base. For example, 0.68 means 68%.',
        trainingLoadHintSource: 'Source: COROS Training Status · latest day',
        predictions: 'Predictions',
        fromFitness: 'From fitness',
        weekVolume: 'Last 7 days',
        volume: 'Volume',
        thisMonth: 'This month',
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
        avgN: '{n}-day avg',
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

    // COROS returns the workout name in English ("Indoor Run"), which reads as
    // a foreign word inside an otherwise Chinese panel. The codes below are the
    // full dubbo sport-type list published in the querySportRecords tool
    // description; lib/coros-api.js keeps them on every record as
    // `sportTypeCode`, so the code is the primary key and the English name is
    // only a secondary lookup for records that arrive without a code.
    // Add a new sport by adding one row here: no other file changes.
    var SPORT_TYPES = {
      // ---- run ----
      100: { zh: '户外跑', en: 'Outdoor run' },
      101: { zh: '室内跑', en: 'Indoor run' },
      102: { zh: '越野跑', en: 'Trail run' },
      103: { zh: '跑道跑', en: 'Track run' },
      104: { zh: '徒步', en: 'Hike' },
      105: { zh: '登山', en: 'Mountain climb' },
      106: { zh: '多段攀岩', en: 'Multi-pitch climb' },
      // ---- bike ----
      200: { zh: '户外骑行', en: 'Outdoor bike' },
      201: { zh: '室内骑行', en: 'Indoor bike' },
      202: { zh: '电助力骑行', en: 'E-bike' },
      203: { zh: '砾石公路骑行', en: 'Gravel bike' },
      204: { zh: '山地骑行', en: 'Mountain bike' },
      205: { zh: '电助力山地骑行', en: 'Mountain e-bike' },
      299: { zh: '头盔骑行', en: 'Helmet bike' },
      // ---- swim ----
      300: { zh: '泳池游泳', en: 'Pool swim' },
      301: { zh: '公开水域游泳', en: 'Open water swim' },
      // ---- cardio / strength ----
      400: { zh: '健身课程', en: 'Gym cardio' },
      401: { zh: 'GPS 有氧', en: 'GPS cardio' },
      402: { zh: '力量训练', en: 'Strength' },
      // ---- ski ----
      500: { zh: '滑雪', en: 'Ski' },
      501: { zh: '单板滑雪', en: 'Snowboard' },
      502: { zh: '越野滑雪', en: 'XC ski' },
      503: { zh: '登山滑雪', en: 'Alpine touring' },
      // ---- air ----
      600: { zh: '飞行', en: 'Fighter' },
      // ---- water / row / fishing ----
      700: { zh: '划船', en: 'Rowing' },
      701: { zh: '室内划船', en: 'Indoor row' },
      702: { zh: '激流', en: 'Whitewater' },
      704: { zh: '平水', en: 'Flatwater' },
      705: { zh: '帆板', en: 'Windsurfing' },
      706: { zh: '速帆板', en: 'Speedsurfing' },
      707: { zh: '船钓（拟饵）', en: 'Boat fishing lure' },
      708: { zh: '岸钓（拟饵）', en: 'Shore fishing lure' },
      709: { zh: '塘钓（拟饵）', en: 'Pond fishing lure' },
      710: { zh: '皮划艇钓（拟饵）', en: 'Kayak fishing lure' },
      711: { zh: '近海钓鱼', en: 'Inshore fishing' },
      712: { zh: '远海钓鱼', en: 'Offshore fishing' },
      713: { zh: '船钓（飞蝇）', en: 'Boat fly fishing' },
      714: { zh: '岸钓（飞蝇）', en: 'Shore fly fishing' },
      715: { zh: '冲浪钓鱼', en: 'Surf fishing' },
      // ---- climb ----
      800: { zh: '室内单段攀岩', en: 'Indoor single pitch' },
      801: { zh: '抱石', en: 'Bouldering' },
      802: { zh: '户外攀岩', en: 'Outdoor climb' },
      // ---- walk / fitness ----
      900: { zh: '步行', en: 'Walk' },
      901: { zh: '跳绳', en: 'Jump rope' },
      902: { zh: '爬楼', en: 'Stair climbing' },
      903: { zh: '椭圆机', en: 'Elliptical' },
      904: { zh: '瑜伽', en: 'Yoga' },
      905: { zh: '普拉提', en: 'Pilates' },
      906: { zh: '拳击', en: 'Boxing' },
      // ---- ball ----
      1000: { zh: '羽毛球', en: 'Badminton' },
      1001: { zh: '乒乓球', en: 'Ping pong' },
      1002: { zh: '篮球', en: 'Basketball' },
      1003: { zh: '足球', en: 'Soccer' },
      1004: { zh: '匹克球', en: 'Pickleball' },
      1005: { zh: '网球', en: 'Tennis' },
      1006: { zh: '笼式网球', en: 'Padel' },
      // ---- leisure ----
      1100: { zh: '飞盘', en: 'Frisbee' },
      1101: { zh: '滑板', en: 'Skateboard' },
      1200: { zh: '综合健身', en: 'Hybrid fitness' },
      // ---- custom outdoor ----
      9800: { zh: '自定义户外球类', en: 'Custom outdoor ball' },
      9801: { zh: '自定义户外休闲', en: 'Custom outdoor leisure' },
      9802: { zh: '自定义户外山地', en: 'Custom outdoor mountain' },
      9803: { zh: '自定义户外高海拔', en: 'Custom outdoor high altitude' },
      9804: { zh: '自定义户外机动车', en: 'Custom outdoor motor vehicle' },
      9805: { zh: '自定义户外水上', en: 'Custom outdoor aquatics' },
      9806: { zh: '自定义户外探险', en: 'Custom outdoor adventure' },
      9807: { zh: '自定义户外其他', en: 'Custom outdoor other' },
      // ---- custom indoor ----
      9900: { zh: '自定义室内球类', en: 'Custom indoor ball' },
      9901: { zh: '自定义室内力量', en: 'Custom indoor strength' },
      9902: { zh: '自定义室内塑形', en: 'Custom indoor shape' },
      9903: { zh: '自定义室内舞蹈', en: 'Custom indoor dance' },
      9904: { zh: '自定义室内其他', en: 'Custom indoor other' },
      9999: { zh: '自定义运动', en: 'Custom workout' },
      // ---- multisport / route ----
      10000: { zh: '铁人三项', en: 'Triathlon' },
      10001: { zh: '自由组合', en: 'Free combine' },
      10002: { zh: '登山滑雪', en: 'Climb ski' },
      10003: { zh: '多段攀岩（组合）', en: 'Multi-pitch climb' },
      25301: { zh: '轨迹路线', en: 'Track route' },
    }

    // Lower-cased English name -> code, so a record that lost its sportTypeCode
    // can still be localised. Built from SPORT_TYPES itself to keep one source
    // of truth. A few spellings COROS uses in the workout title differ from the
    // tool-description wording, so they are aliased explicitly.
    var SPORT_NAME_ALIASES = {
      'run': 100,
      'indoor running': 101,
      'treadmill run': 101,
      'cycling': 200,
      'bike': 200,
      'indoor cycling': 201,
      'swimming': 300,
      'open water swimming': 301,
      'strength training': 402,
      'walking': 900,
      'hiking': 104,
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

    /**
     * POST JSON and read JSON back.
     *
     * Kept next to fetchJson rather than folded into it: only the write route
     * takes a body, and a shared helper that sometimes sends a payload invites
     * a GET that accidentally acquires one.
     */
    function postJson(path, payload) {
      return fetch(BASE + path, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload || {}),
      }).then(function (res) {
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

    /**
     * The soonest date the account's plans actually start, or '' when the
     * listing does not tell us. Plans are written starting the next Monday, so
     * a week-scoped schedule query legitimately comes back empty right after a
     * plan is created — this is what lets the card say when training resumes
     * instead of a bare "no workout this week".
     */
    function nextStartDate(plans, today) {
      if (!plans || !plans.length) return ''
      var now = today || todayStamp()
      var best = ''
      for (var i = 0; i < plans.length; i += 1) {
        var start = dateOnly(plans[i] && plans[i].startDate)
        if (!start || start < now) continue
        if (!best || start < best) best = start
      }
      return best
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

    // Reverse index (lower-cased English name -> code) derived from the map
    // above, so adding a sport stays a one-line edit.
    var SPORT_NAME_INDEX = (function () {
      var index = {}
      Object.keys(SPORT_TYPES).forEach(function (code) {
        index[String(SPORT_TYPES[code].en).toLowerCase()] = code
      })
      Object.keys(SPORT_NAME_ALIASES).forEach(function (name) {
        if (!index[name]) index[name] = String(SPORT_NAME_ALIASES[name])
      })
      return index
    })()

    // Sport family -> accent class on the activity row. Keyed by the numeric
    // code ranges COROS uses in SPORT_TYPES above, so a sport added to that map
    // inherits its family with no second edit. The last entry catches every
    // mapped sport that no earlier range claimed.
    var SPORT_FAMILIES = [
      { cls: 'is-rose', test: function (code) { return code >= 100 && code <= 106 } },
      { cls: 'is-indigo', test: function (code) { return (code >= 200 && code <= 205) || code === 299 } },
      { cls: 'is-blue', test: function (code) { return code >= 300 && code <= 301 } },
      { cls: 'is-amber', test: function (code) { return code >= 400 && code <= 402 } },
      { cls: 'is-blue', test: function (code) { return code >= 500 && code <= 503 } },
      { cls: 'is-blue', test: function (code) { return code >= 700 && code <= 715 } },
      { cls: 'is-amber', test: function (code) { return code >= 800 && code <= 802 } },
      { cls: 'is-amber', test: function (code) { return code >= 1000 && code <= 1006 } },
      { cls: 'is-indigo', test: function (code) { return code >= 10000 && code <= 10003 } },
      { cls: 'is-green', test: function () { return true } },
    ]

    function sportFamily(code) {
      if (isBlank(code)) return ''
      var n = Number(String(code).trim())
      if (!isFinite(n)) return ''
      for (var i = 0; i < SPORT_FAMILIES.length; i += 1) {
        if (SPORT_FAMILIES[i].test(n)) return SPORT_FAMILIES[i].cls
      }
      return ''
    }

    function sportMatch(record) {
      if (!record) return null
      var code = record.sportTypeCode
      if (!isBlank(code)) {
        var byCode = SPORT_TYPES[String(code).trim()]
        if (byCode) return { code: String(code).trim(), entry: byCode }
      }
      if (isBlank(record.sportType)) return null
      var name = String(record.sportType).trim().toLowerCase()
      if (SPORT_NAME_INDEX[name]) {
        var hit = SPORT_NAME_INDEX[name]
        return { code: hit, entry: SPORT_TYPES[hit] }
      }
      // Titles sometimes carry a qualifier ("Indoor Run 5K"), so retry on the
      // longest known name the title starts with before giving up.
      var candidates = Object.keys(SPORT_NAME_INDEX)
        .filter(function (known) {
          return known.length > 2 && name.indexOf(known) === 0
        })
        .sort(function (a, b) {
          return b.length - a.length
        })
      if (candidates.length) {
        var found = SPORT_NAME_INDEX[candidates[0]]
        return { code: found, entry: SPORT_TYPES[found] }
      }
      return null
    }

    /**
     * Workout name for the panel locale.
     *
     * Resolution order, most to least trustworthy: the numeric sportTypeCode
     * (stable across COROS renames), then the English name, then the prefix
     * match above. When nothing matches, the row shows the generic
     * "其他运动" label and the raw string is handed back so the caller can keep
     * it in a tooltip — an unmapped sport stays readable in Chinese, and the
     * English name is still discoverable when someone extends the map.
     */
    function sportLabel(record, locale, otherLabel) {
      var match = sportMatch(record)
      if (match) {
        var entry = match.entry
        return { text: entry[locale] || entry.en, raw: '', family: sportFamily(match.code) }
      }
      var raw = isBlank(record && record.sportType) ? '' : String(record.sportType).trim()
      return { text: otherLabel, raw: raw, family: '' }
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
  /* Graphic ink for the dial track and the sleep bars. It is derived from the
     foreground token, so the marks invert together with the theme: dark ink on
     the light theme, light ink on the dark one. The border tokens are surface
     hairlines (12% of the *opposite* colour), which is why painting a chart bar
     with them produced a near-black mark on the dark panel. */
  --cv2-ink-mark:color-mix(in srgb, var(--dsw-alias-label-primary,#0f1115) 18%, transparent);
  /* ---- colour palette -------------------------------------------------
     ONE derivation rule for every hue in the panel:

       hue = color-mix(in srgb, <host token> 64%, var(--dsw-alias-label-primary))

     The 36% share of label-primary is what makes a single declaration work
     in both themes. label-primary is near-black in the light theme and
     near-white in the dark one, so the same formula darkens the hue on
     white and lightens it on charcoal — no [data-ds-dark-theme] block and
     no second set of values to keep in sync.

     Why not the raw tokens? Measured, the raw state hues clear 3:1 on the
     light page but collapse on the two tinted surfaces this panel uses:
     on the light hero (#E9ECF2) success is 1.93:1 and warn 1.81:1; on the
     dark hero (#61666B) success is 2.55:1 and error 1.76:1. Mixing toward
     label-primary is the only way to keep one hue legible on all three
     surfaces in both themes. The shipped ratios are in
     docs/设计-COROS面板-v2-视觉规范.md §A7 and re-computed by
     .review-probe/color-lab3.mjs.

     Every hue below is decorative reinforcement: the number, the status
     word, the metric label or the per-bar hour text always carries the
     meaning, so no colour is load-bearing on its own. */
  --cv2-hue-indigo:color-mix(in srgb, var(--dsw-alias-state-business-primary,#4176e6) 64%, var(--dsw-alias-label-primary,#0f1115));
  --cv2-hue-blue:color-mix(in srgb, var(--dsw-static-blue-500,#3b82f6) 64%, var(--dsw-alias-label-primary,#0f1115));
  --cv2-hue-green:color-mix(in srgb, var(--dsw-alias-state-success-primary,#22c55e) 64%, var(--dsw-alias-label-primary,#0f1115));
  --cv2-hue-amber:color-mix(in srgb, var(--dsw-alias-state-warn-primary,#f59e0b) 64%, var(--dsw-alias-label-primary,#0f1115));
  --cv2-hue-rose:color-mix(in srgb, var(--dsw-alias-state-error-primary,#f25a5a) 64%, var(--dsw-alias-label-primary,#0f1115));
  /* Secondary text needs a stronger ink than label-secondary on the two
     surfaces this panel tints. On the dark hero (#61666B) label-secondary is
     only 3.85:1 — below the 4.5:1 that 12px text needs — and on the light hero
     it is 4.90:1, i.e. barely clear. Mixing 45% secondary with 55%
     label-primary lifts the note and metric labels to 9.40:1 (light) and
     4.67:1 (dark) while staying visibly weaker than label-primary itself
     (15.97:1 / 5.55:1), so the hero keeps a three-step text hierarchy. */
  --cv2-ink-soft:color-mix(in srgb, var(--dsw-alias-label-secondary,#61666b) 45%, var(--dsw-alias-label-primary,#0f1115));
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
.cv2-tbtn:disabled{color:var(--dsw-alias-label-secondary,#61666b);opacity:.5;cursor:default;box-shadow:none}
.cv2-tbtn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#0f1115);outline-offset:2px}
.cv2-tbtn svg{display:block}

/* ---- hero ---- */
.cv2-hero{margin-top:4px;background:var(--dsw-alias-bg-overlay,#e9ecf2);border-radius:16px;padding:20px}
.cv2-hero-grid{display:grid;grid-template-columns:88px minmax(0,1fr);column-gap:20px;row-gap:16px;align-items:center}
.cv2-ring{position:relative;width:88px;height:88px;flex:none;--cv2-ring-arc:var(--cv2-ink-soft)}
.cv2-ring svg{display:block}
/* Recovery arc colour = recovery state. The arc is an 8px round-capped stroke
   lying on the tinted hero (#E9ECF2 light / #61666B dark), so it needs 3:1
   against that card in BOTH themes.

   The palette splits two ways on that card. All five hues clear it in light
   (green 4.01, amber 3.82, indigo 6.34, blue 5.77, rose 5.37). In dark blue
   (2.55) and rose (2.64) fall under 3:1 and are barred from the hero
   entirely; indigo technically scrapes through at 3.06 — but only 0.06 over
   the floor, and that figure depends on which business-primary the host
   ships (#6E9BF2 -> 3.06, #7AAAFF -> 3.39), so it is not a margin an 8px
   stroke should be trusted to.

   The real reason green/amber paint the arc is meaning, not headroom: those
   are the only two hues this panel already uses for recovery state — the same
   pair that colours the status glyph one line below. Indigo means capability
   (HRV, cycling), rose means resting HR and running, blue means sleep. Arc
   colour matching the glyph beside it is the whole point of the change;
   borrowing a hue that already means something else would trade a black ring
   for a misleading one.

   Two classes cover every known level: good AND mid render green, low renders
   amber — mid (recovering) still belongs to the "you can train" side of the
   answer, and it sits beside a neutral gauge glyph rather than a colour. With
   no tone at all (recovery.level missing) the arc falls back to the neutral
   --cv2-ink-soft wash: we do not know the state, so the arc must not claim one.
   That fallback is 10.10:1 light / 4.72:1 dark on the hero. */
.cv2-ring.is-good{--cv2-ring-arc:var(--cv2-hue-green)}
.cv2-ring.is-low{--cv2-ring-arc:var(--cv2-hue-amber)}
.cv2-ring-txt{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;line-height:28px;letter-spacing:-.01em;font-variant-numeric:tabular-nums}
.cv2-status{min-width:0}
.cv2-status-row{display:flex;align-items:center;gap:8px;min-width:0}
.cv2-dot{width:8px;height:8px;border-radius:999px;flex:none;background:var(--cv2-ink-soft)}
/* Icon chip. The glyph is drawn with currentColor and the disc behind it is a
   tint of that same colour, so a colour only has to be set once and both the
   icon and its halo follow — no per-icon colour values anywhere.

   The tones are the five palette hues, never the raw state tokens: on a page
   surface the raw hues are legible, but the hero is a tinted card where they
   are not (success is 1.93:1 on #E9ECF2 and 2.55:1 on #61666B), and one chip
   rule serves every surface. The is-good / is-low classes are the state names
   the recovery dial uses; is-rose … is-amber are the same values under their
   domain names, for the health KPIs and the chart title. */
.cv2-ic{display:inline-flex;align-items:center;justify-content:center;flex:none;width:20px;height:20px;border-radius:999px;color:var(--dsw-alias-label-secondary,#61666b);background:color-mix(in srgb, currentColor 14%, transparent)}
.cv2-ic svg{display:block}
.cv2-ic.is-good,.cv2-ic.is-green{color:var(--cv2-hue-green)}
.cv2-ic.is-low,.cv2-ic.is-amber{color:var(--cv2-hue-amber)}
.cv2-ic.is-rose{color:var(--cv2-hue-rose)}
.cv2-ic.is-indigo{color:var(--cv2-hue-indigo)}
.cv2-ic.is-blue{color:var(--cv2-hue-blue)}
.cv2-status-word{font-size:18px;font-weight:600;line-height:24px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* On the hero the chip loses its disc and keeps only the glyph. The disc is a
   14% tint of the glyph colour, and compositing it under the glyph pulls the
   measured contrast down to 2.46-2.98:1 — below 3:1 — because the glyph then
   sits on its own halo instead of on the card. Flat glyphs measure 4.01:1
   (good) and 3.82:1 (low) on the light hero and 3.30:1 / 3.46:1 on the dark
   one. Elsewhere the disc stays, where it separates the glyph from the page. */
.cv2-status-row .cv2-ic{background:transparent}
/* The hero is a tinted card (#E9ECF2 light / #61666B dark), where label-secondary
   drops to 4.90:1 and 3.85:1 — the dark case is below 4.5:1 for 12px text.
   --cv2-ink-soft keeps the hero's supporting text at 9.40:1 / 4.67:1 while
   staying weaker than the value text beside it. */
.cv2-note{margin:2px 0 0;font-size:12px;line-height:18px;color:var(--cv2-ink-soft)}
.cv2-metrics{grid-column:1 / -1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr))}
.cv2-m{position:relative;padding-left:16px;border-left:.5px solid var(--dsw-alias-border-l2,#e5e5e5);min-width:0}
.cv2-m:first-child{border-left:0;padding-left:0}
.cv2-hk{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#61666b);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cv2-mv{margin:2px 0 0;font-size:18px;font-weight:600;line-height:24px;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cv2-mu{margin-left:2px;font-size:12px;font-weight:400;color:var(--dsw-alias-label-secondary,#61666b)}
/* Metric glossary: the whole cell is the trigger, but the dotted underline on
   the label is what tells a reader there is something behind it. The card sits
   above the hero's first row and flips alignment at the two ends of the row so
   it never leaves the panel viewport. */
.cv2-m.has-tip{cursor:help;outline:none}
.cv2-m.has-tip:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#0f1115);outline-offset:3px;border-radius:4px}
.cv2-m.has-tip .cv2-hk{text-decoration:underline dotted;text-underline-offset:2px;text-decoration-color:color-mix(in srgb,var(--cv2-ink-soft) 55%,transparent)}
.cv2-tip{position:absolute;z-index:30;left:50%;bottom:calc(100% + 10px);width:272px;padding:10px 12px 11px;border-radius:8px;background:var(--dsw-alias-label-primary,#0f1115);color:var(--dsw-alias-bg-base,#fff);box-shadow:0 10px 30px rgba(15,17,21,.18);opacity:0;visibility:hidden;pointer-events:none;transform:translateX(-50%) translateY(2px);transition:opacity .12s ease,transform .12s ease,visibility .12s ease;white-space:normal;text-align:left;font-weight:400;font-variant-numeric:normal}
.cv2-tip::after{content:'';position:absolute;bottom:-4px;left:50%;width:8px;height:8px;margin-left:-4px;background:inherit;transform:rotate(45deg)}
.cv2-tip-t{display:block;font-size:13px;line-height:20px;font-weight:600;margin:0 0 3px}
.cv2-tip-b{display:block;font-size:12px;line-height:18px;margin:0}
.cv2-tip-s{display:block;font-size:11px;line-height:16px;margin-top:6px;opacity:.65}
.cv2-m.has-tip:hover .cv2-tip,.cv2-m.has-tip:focus .cv2-tip,.cv2-m.has-tip:focus-within .cv2-tip{opacity:1;visibility:visible;transform:translateX(-50%) translateY(0)}
.cv2-m.has-tip:first-child .cv2-tip{left:0;transform:translateX(0) translateY(2px)}
.cv2-m.has-tip:first-child:hover .cv2-tip,.cv2-m.has-tip:first-child:focus .cv2-tip,.cv2-m.has-tip:first-child:focus-within .cv2-tip{transform:translateX(0) translateY(0)}
.cv2-m.has-tip:first-child .cv2-tip::after{left:24px;margin-left:0}
.cv2-m.has-tip:last-child .cv2-tip{left:auto;right:0;transform:translateX(0) translateY(2px)}
.cv2-m.has-tip:last-child:hover .cv2-tip,.cv2-m.has-tip:last-child:focus .cv2-tip,.cv2-m.has-tip:last-child:focus-within .cv2-tip{transform:translateX(0) translateY(0)}
.cv2-m.has-tip:last-child .cv2-tip::after{right:24px;left:auto;margin-left:0}
/* Only inside the hero, where the surface is tinted: metric labels and units
   there sit on #E9ECF2 / #61666B and need --cv2-ink-soft. The same classes on
   the page keep label-secondary, which is already 5.80:1 on white. */
.cv2-metrics .cv2-hk,.cv2-metrics .cv2-mu{color:var(--cv2-ink-soft)}
/* Run volume lives on its own line under the four fitness metrics: the two
   windows (7 days / this month) share one unit and one visual rank, so they
   read as a pair rather than as a fifth and sixth KPI. */
.cv2-volstrip{grid-column:1 / -1;display:flex;align-items:baseline;gap:10px;margin-top:-2px;padding-top:10px;border-top:.5px solid var(--dsw-alias-border-l2,#e5e5e5);min-width:0}
.cv2-volstrip-k{flex:none;font-size:12px;line-height:18px;color:var(--cv2-ink-soft)}
.cv2-volitem{display:flex;align-items:baseline;gap:6px;font-size:12px;line-height:18px;color:var(--cv2-ink-soft);white-space:nowrap}
.cv2-volitem b{font-size:15px;font-weight:600;line-height:22px;color:var(--dsw-alias-label-primary,#0f1115);font-variant-numeric:tabular-nums}
.cv2-volitem .cv2-mu,.cv2-volstrip .cv2-mu{margin-left:1px;color:var(--cv2-ink-soft)}
.cv2-voldiv{width:1px;height:12px;background:var(--dsw-alias-border-l2,#e5e5e5);align-self:center}

/* ---- section scaffold ---- */
.cv2-cols{display:grid;grid-template-columns:minmax(0,1fr);row-gap:24px;margin-top:28px}
.cv2-col{display:contents}
.cv2-sec{min-width:0}
.cv2-sec-h{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:8px}
.cv2-sec-t{margin:0;font-size:14px;font-weight:500;line-height:20px}
.cv2-sec-m{flex:none;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#61666b)}
/* Right side of a section header: the count and the way in share one row and
   one baseline, so a card with both does not grow a second header line. */
.cv2-sec-end{flex:none;display:inline-flex;align-items:baseline;gap:10px}
/* The header affordance keeps the header's 12px type instead of the 13px
   cv2-tbtn size: it is a way into a section, not a page action, and at 13px
   it competes with the button row in the page head one line above. */
.cv2-sec-a{flex:none;height:22px;margin:-1px -6px -1px 0;padding:0 6px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary,#0f1115);font:inherit;font-size:12px;line-height:18px;cursor:pointer}
.cv2-sec-a:hover{background:var(--dsw-alias-bg-overlay,#e9ecf2)}
.cv2-sec-a:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#0f1115);outline-offset:1px}
.cv2-rows{display:flex;flex-direction:column}
.cv2-row{border-bottom:.5px solid var(--dsw-alias-border-l2,#e5e5e5);padding:12px 2px}
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
/* Discipline accent: a 6px dot before the sport name, coloured by sport family
   (run = rose, bike = indigo, swim/water = blue, strength/climb/ball = amber,
   everything else mapped = green). It is pure decoration — the name is printed
   beside it — so it adds nothing a reader has to decode, and an unmapped sport
   gets no dot at all instead of a guessed colour. */
.cv2-act-name{font-size:13px;font-weight:600;line-height:20px}
.cv2-act-name.has-hue{display:inline-flex;align-items:center;gap:6px}
.cv2-act-name.has-hue::before{content:'';flex:none;width:6px;height:6px;border-radius:999px;background:var(--cv2-act-hue)}
.cv2-act-name.is-rose{--cv2-act-hue:var(--cv2-hue-rose)}
.cv2-act-name.is-indigo{--cv2-act-hue:var(--cv2-hue-indigo)}
.cv2-act-name.is-blue{--cv2-act-hue:var(--cv2-hue-blue)}
.cv2-act-name.is-amber{--cv2-act-hue:var(--cv2-hue-amber)}
.cv2-act-name.is-green{--cv2-act-hue:var(--cv2-hue-green)}
.cv2-act-date{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#61666b);font-variant-numeric:tabular-nums}
.cv2-act-nums{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));column-gap:12px}
.cv2-act-n{min-width:0}
.cv2-act-v{font-size:13px;font-weight:600;line-height:20px;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cv2-act-k{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary,#61666b);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* ---- health ---- */
.cv2-hgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:24px;row-gap:14px}
.cv2-kpi{display:flex;align-items:center;gap:8px;min-width:0}
.cv2-kpi-body{min-width:0}
.cv2-chart{margin-top:16px}
.cv2-chart-head{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.cv2-chart-t{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#61666b)}
.cv2-bars{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);column-gap:8px;align-items:end}
.cv2-col-b{display:flex;flex-direction:column;justify-content:flex-end;gap:2px;min-width:0}
.cv2-bar-v{font-size:11px;line-height:14px;color:var(--dsw-alias-label-secondary,#61666b);text-align:center;font-variant-numeric:tabular-nums}
.cv2-bar-slot{height:40px;display:flex;align-items:flex-end;justify-content:center}
/* Sleep bars carry the one hue that has a fixed meaning in this panel: blue
   is "sleep". Today's bar stays label-primary so the current day is separated
   by VALUE (18.90:1 / 17.45:1 against the page) rather than by a second hue —
   a hue-only highlight would be an encoding that disappears for a colour-blind
   reader. Every bar still prints its own hour count above it, so the colour
   never carries information on its own. */
.cv2-bar{width:100%;max-width:56px;min-height:2px;border-radius:2px 2px 0 0;background:var(--cv2-hue-blue)}
.cv2-bar.is-today{background:var(--dsw-alias-label-primary,#0f1115)}
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
.cv2-state{display:flex;align-items:center;gap:8px;padding:16px;border:.5px solid var(--dsw-alias-border-l2,#e5e5e5);border-radius:16px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary,#61666b)}
.cv2-state svg{display:block;flex:none}
.cv2-state.is-error{color:var(--dsw-alias-label-primary,#0f1115)}
.cv2-state.is-error svg{color:var(--cv2-hue-rose)}
.cv2-state-text{min-width:0}
.cv2-state-btn{flex:none;margin-left:auto;height:28px;padding:0 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary,#0f1115);font:inherit;font-size:13px;line-height:20px;cursor:pointer}
.cv2-state-btn:hover{box-shadow:0 0 0 6px var(--dsw-alias-bg-overlay,#e9ecf2)}
.cv2-state-btn.is-primary{height:30px;padding:0 12px;border-radius:8px;background:var(--dsw-alias-brand-primary,#0f1115);color:var(--dsw-alias-bg-base,#fff)}
.cv2-state-btn.is-primary:hover{box-shadow:none;opacity:.9}
.cv2-state-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#0f1115);outline-offset:2px}
.cv2-sk{display:flex;flex-direction:column;gap:8px;padding:12px 2px}
.cv2-sk i{display:block;height:12px;border-radius:3px;background:var(--dsw-alias-bg-overlay,#e9ecf2)}
.cv2-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}

/* ---- training plan ---- */
.cv2-plan-lede{margin:12px 0 0;font-size:13px;line-height:20px;font-weight:600}
.cv2-plan-overview{margin:4px 0 0;font-size:12px;line-height:19px;color:var(--dsw-alias-label-secondary,#61666b)}
.cv2-plan-rows{display:flex;flex-direction:column;gap:14px;margin-top:14px}
.cv2-plan-week{display:flex;flex-direction:column}
.cv2-plan-weekhead{display:flex;align-items:baseline;gap:8px;padding-bottom:2px;border-bottom:.5px solid var(--dsw-alias-border-l2,#e5e5e5)}
.cv2-plan-weeklabel{font-size:12px;line-height:18px;font-weight:600}
.cv2-plan-weektheme{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#61666b)}
.cv2-plan-weekkm{margin-left:auto;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#61666b);font-variant-numeric:tabular-nums}
.cv2-plan-row{display:grid;grid-template-columns:78px minmax(0,1fr);column-gap:10px;align-items:baseline;padding:7px 2px;border-bottom:.5px solid var(--dsw-alias-border-l2,#e5e5e5)}
.cv2-plan-row:last-child{border-bottom:0}
.cv2-plan-when{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#61666b);font-variant-numeric:tabular-nums;white-space:nowrap}
.cv2-plan-name{font-size:13px;line-height:20px;min-width:0}
.cv2-plan-sub{display:block;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#61666b)}
.cv2-plan-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.cv2-plan-danger{margin:10px 0 0;font-size:12px;line-height:18px;color:var(--cv2-hue-rose)}
/* The week the athlete is running now, when every week is on the same page.
   Only a mark and a label: the rows underneath are unchanged, because on a
   detail page the reader is comparing weeks, not being steered to one. */
.cv2-plan-week.is-live .cv2-plan-weekhead{border-bottom-color:var(--dsw-alias-border-l1,#d1d1d1)}
.cv2-plan-tag{flex:none;padding:0 6px;border-radius:999px;background:var(--dsw-alias-bg-overlay,#e9ecf2);color:var(--dsw-alias-label-secondary,#61666b);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums}

/* ---- detail page ---- */
/* A sub-page of the panel, not a new panel: it keeps the page width and the
   head block so the two views read as the same document, and only adds the row
   that leads back. */
.cv2-backrow{display:flex;align-items:center;gap:4px;padding:20px 0 0}
.cv2-backrow .cv2-tbtn{margin-left:-8px}
.cv2-detail .cv2-head{padding-top:8px}

/* ---- footer ---- */
.cv2-foot{margin-top:32px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary,#61666b)}

/* ---- sign-in ---- */
.cv2-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 12px;border:0;border-radius:8px;background:var(--dsw-alias-brand-primary,#0f1115);color:var(--dsw-alias-bg-base,#fff);font:inherit;font-size:13px;line-height:20px;cursor:pointer}
.cv2-btn:disabled{opacity:.6;cursor:default}
.cv2-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#0f1115);outline-offset:2px}
.cv2-btn.is-quiet{background:transparent;border:.5px solid var(--dsw-alias-border-l2,#e5e5e5);color:var(--dsw-alias-label-primary,#0f1115)}
.cv2-iframe{width:100%;height:min(520px,70vh);border:.5px solid var(--dsw-alias-border-l2,#e5e5e5);border-radius:16px;background:var(--dsw-alias-bg-base,#fff)}
.cv2-hint{margin:10px 0 0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#61666b)}
.cv2-bar-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
.cv2-bar-row p{margin:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary,#61666b)}
.cv2-expired{display:flex;align-items:center;gap:8px;margin:0 0 12px;font-size:13px;line-height:20px}
.cv2-expired .cv2-dot{background:var(--cv2-hue-amber)}

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
  .cv2-volstrip{flex-wrap:wrap;row-gap:4px}
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

    // The way back off the plan page. Mirrors the sidebar discipline: one svg,
    // currentColor, no literal ink — the surrounding `.cv2-tbtn` owns the colour.
    function ArrowLeftIcon() {
      return h(
        'svg',
        { viewBox: '0 0 16 16', width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', 'aria-hidden': 'true' },
        h('path', { d: 'M12.5 8h-9' }),
        h('path', { d: 'M7 3.5 2.5 8 7 12.5' }),
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

    /* Status glyphs for the recovery dial and the health KPIs. Like every other
       icon in this file they paint with `currentColor` and never with a literal
       colour, so the surrounding `.cv2-ic` chip decides the tone. */
    function DoneIcon() {
      return h(
        'svg',
        { viewBox: '0 0 16 16', width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
        h('path', { d: 'M3.25 8.4 6.4 11.5 12.75 4.75' }),
      )
    }

    function GaugeIcon() {
      return h(
        'svg',
        { viewBox: '0 0 16 16', width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', 'aria-hidden': 'true' },
        h('path', { d: 'M2.75 11.5a5.75 5.75 0 1 1 10.5 0' }),
        h('path', { d: 'M8 11.25 11 6.6' }),
      )
    }

    function HeartIcon() {
      return h(
        'svg',
        { viewBox: '0 0 16 16', width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
        h('path', { d: 'M8 13s-4.75-2.9-4.75-6.1a2.85 2.85 0 0 1 4.75-2.2 2.85 2.85 0 0 1 4.75 2.2C12.75 10.1 8 13 8 13Z' }),
      )
    }

    function PulseIcon() {
      return h(
        'svg',
        { viewBox: '0 0 16 16', width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
        h('path', { d: 'M1.75 8.25h2.5l1.4-3.6 2.2 6.7 1.35-3.1h4.8' }),
      )
    }

    function MoonIcon() {
      return h(
        'svg',
        { viewBox: '0 0 16 16', width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
        h('path', { d: 'M13 9.4A5.5 5.5 0 0 1 6.6 3a5.4 5.4 0 1 0 6.4 6.4Z' }),
      )
    }

    function StepsIcon() {
      return h(
        'svg',
        { viewBox: '0 0 16 16', width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
        h('path', { d: 'M5.4 9.6c1.3 0 2.1.9 2.1 2.2 0 1.5-.3 2.6-1.9 2.6S3.4 13.2 3.4 11.7c0-1.2.7-2.1 2-2.1Z' }),
        h('path', { d: 'M10.9 2.4c1.5 0 2.3 1.1 2.3 2.6 0 1.9-.6 3.1-2.2 3.1S8.6 6.9 8.6 5c0-1.5.8-2.6 2.3-2.6Z' }),
      )
    }

    // Which glyph a recovery tone gets. Keeping the mapping here means the
    // markup below stays one line per state.
    var TONE_ICONS = { good: DoneIcon, low: AlertIcon, mid: GaugeIcon }

    function StatusIcon(props) {
      var Glyph = TONE_ICONS[props.tone] || GaugeIcon
      var cls = 'cv2-ic'
      if (props.tone === 'good') cls += ' is-good'
      else if (props.tone === 'low') cls += ' is-low'
      return h('span', { className: cls, 'aria-hidden': 'true' }, h(Glyph))
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
      /* Arc colour comes from the recovery TONE via the .cv2-ring classes; the
         stroke itself just points at --cv2-ring-arc so no hue is hardcoded per
         theme. Unknown state (no tone) falls back to neutral ink-soft. */
      var cls = 'cv2-ring'
      if (props.tone === 'good' || props.tone === 'mid') cls += ' is-good'
      else if (props.tone === 'low') cls += ' is-low'
      return h(
        'div',
        { className: cls },
        h(
          'svg',
          { width: 88, height: 88, viewBox: '0 0 88 88', 'aria-hidden': 'true', focusable: 'false' },
          h('circle', { cx: 44, cy: 44, r: radius, fill: 'none', strokeWidth: 8, stroke: 'var(--cv2-ink-mark)' }),
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
                stroke: 'var(--cv2-ring-arc)',
                transform: 'rotate(-90 44 44)',
              })
            : null,
        ),
        h('span', { className: 'cv2-ring-txt' }, percent === null ? '—' : percent + '%'),
      )
    }

    /* ------------------------------------------------------------- fragments */

    /* A section header, with an optional trailing affordance.
     *
     * `action` exists because the training plan stopped being a block on the
     * dashboard: the schedule card only carries a way into the detail page now,
     * and that entry has to sit in the header — putting it under the rows would
     * repeat "there is more below", which is exactly what this change removes.
     * The button carries its own class so it keeps the 12px header type. */
    function Section(props) {
      var meta = props.meta
      var hasMeta = meta !== undefined && meta !== null && meta !== ''
      var action = props.action
      return h(
        'section',
        { className: 'cv2-sec' },
        h(
          'div',
          { className: 'cv2-sec-h' },
          h('h2', { className: 'cv2-sec-t' }, props.title),
          hasMeta || action
            ? h(
                'span',
                { className: 'cv2-sec-end' },
                hasMeta ? h('span', { className: 'cv2-sec-m' }, meta) : null,
                action
                  ? h(
                      'button',
                      { type: 'button', className: 'cv2-sec-a', onClick: action.onClick, title: action.title || undefined },
                      action.label,
                    )
                  : null,
              )
            : null,
        ),
        props.children,
      )
    }

    function StateBlock(props) {
      var isError = props.tone === 'error'
      // `onRetry` is the recovery affordance; `action` is the forward one the
      // empty state needs (create the first plan). They are separate props
      // because the retry button already had a fixed look and the action has to
      // read as the primary thing to do, not as a link back into the same load.
      var action = props.action
      return h(
        'div',
        { className: 'cv2-state' + (isError ? ' is-error' : '') },
        isError ? h(AlertIcon) : h(CalendarIcon),
        h('span', { className: 'cv2-state-text' }, props.message),
        action
          ? h(
              'button',
              { type: 'button', className: 'cv2-state-btn is-primary', onClick: action.onClick },
              action.label,
            )
          : null,
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

    /** True when a record belongs to the four COROS running codes (100–103). */
    function isRunningRecord(record) {
      var code = numOf(record && record.sportTypeCode)
      if (code !== undefined) return code >= 100 && code <= 103
      // Older payloads can omit sportTypeCode; the English activity name still
      // tells a run apart from a ride/swim without guessing a numeric code.
      var name = String((record && record.sportType) || '').toLowerCase()
      return name.indexOf('run') !== -1 || name.indexOf('跑') !== -1
    }

    /** Sum of `distance` across the range, in whatever unit COROS reported. */
    function rangeVolume(records, options) {
      var runningOnly = Boolean(options && options.runningOnly)
      var total = 0
      var unit = 'km'
      for (var i = 0; i < records.length; i += 1) {
        if (runningOnly && !isRunningRecord(records[i])) continue
        var value = numOf(records[i].distance)
        if (value === undefined) continue
        total += value
        var found = unitSuffix(records[i].distance)
        if (found) unit = found
      }
      if (total === 0) return null
      // Keep one decimal at every scale: a month total is commonly three
      // digits, and rounding 128.5 to 129 would hide the half kilometre the
      // weekly number exposes.
      return { value: total.toFixed(1), unit: unit }
    }

    /** A loaded range with no runs is a real 0.0 km; a missing range is "—". */
    function volumeDisplay(volume, loaded) {
      if (volume) return volume
      return loaded ? { value: '0.0', unit: 'km' } : { value: '—', unit: '' }
    }

    function Hero(props) {
      var t = props.t
      var locale = props.locale
      var recovery = props.recovery
      var fitness = props.fitness
      var trainingLoad = props.trainingLoad
      var records = (props.activities && props.activities.records) || []
      var weekRecords = props.activities && props.activities.weekRecords
      if (!Array.isArray(weekRecords)) weekRecords = records
      var monthRecords = props.activities && props.activities.monthRecords
      var hasWeekRecords = Array.isArray(weekRecords)
      var hasMonthRecords = Array.isArray(monthRecords)
      var hasAnyRecords =
        (hasWeekRecords && weekRecords.length > 0) || (hasMonthRecords && monthRecords.length > 0)

      if (!recovery && !fitness && !hasAnyRecords) return null

      var percent = recovery ? numOf(recovery.percent) : undefined
      var hasPercent = percent !== undefined
      var level = recovery && recovery.level ? String(recovery.level) : ''
      var tone = levelTone(level)
      var word = levelText(level, locale)

      var metrics = []
      // Running level comes first: it is the single number that answers "how
      // fit am I", while VO2max is the more technical companion value.
      if (fitness && !isBlank(fitness.runningLevel)) {
        metrics.push({
          key: 'rl',
          label: t('runningLevel'),
          value: String(fitness.runningLevel),
          unit: '/100',
          hint: { title: t('runningLevel'), body: t('runningLevelHint'), source: t('runningLevelHintSource') },
        })
      }
      if (fitness && !isBlank(fitness.vo2max)) {
        var vo2 = splitUnit(fitness.vo2max)
        metrics.push({
          key: 'vo2',
          label: t('vo2max'),
          value: vo2.value,
          unit: vo2.unit || 'ml/kg',
          hint: { title: t('vo2max'), body: t('vo2maxHint'), source: t('vo2maxHintSource') },
        })
      }
      if (fitness && !isBlank(fitness.thresholdPace)) {
        var pace = splitUnit(fitness.thresholdPace)
        metrics.push({
          key: 'tp',
          label: t('thresholdPace'),
          value: pace.value,
          unit: pace.unit || '/km',
          hint: { title: t('thresholdPace'), body: t('thresholdPaceHint'), source: t('thresholdPaceHintSource') },
        })
      }
      var loadRatio = trainingLoad && !isBlank(trainingLoad.loadRatio) ? splitUnit(trainingLoad.loadRatio) : null
      var hasFitnessMetrics =
        fitness &&
        (!isBlank(fitness.vo2max) || !isBlank(fitness.runningLevel) || !isBlank(fitness.thresholdPace))
      if (hasFitnessMetrics || loadRatio) {
        // Keep the fourth slot even when the training-load request has no data:
        // the metric is part of the agreed layout and a dash is honest.
        metrics.push({
          key: 'tl',
          label: t('trainingLoad'),
          value: loadRatio ? loadRatio.value : '—',
          unit: loadRatio && loadRatio.unit ? loadRatio.unit : '',
          hint: { title: t('trainingLoad'), body: t('trainingLoadHint'), source: t('trainingLoadHintSource') },
        })
      }

      var weekVolume = hasWeekRecords ? rangeVolume(weekRecords, { runningOnly: true }) : null
      var monthVolume = hasMonthRecords ? rangeVolume(monthRecords, { runningOnly: true }) : null
      var weekDisplay = volumeDisplay(weekVolume, hasWeekRecords)
      var monthDisplay = volumeDisplay(monthVolume, hasMonthRecords)
      var showVolumeStrip =
        (hasWeekRecords && weekRecords.length > 0) || (hasMonthRecords && monthRecords.length > 0)

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
          h(RecoveryRing, { percent: hasPercent ? percent : null, tone: tone }),
          h(
            'div',
            { className: 'cv2-status' },
            h(
              'div',
              { className: 'cv2-status-row' },
              word ? h(StatusIcon, { tone: tone }) : null,
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
                    {
                      className: 'cv2-m' + (metric.hint ? ' has-tip' : ''),
                      key: metric.key,
                      tabIndex: metric.hint ? 0 : undefined,
                      'aria-describedby': metric.hint ? 'cv2-tip-' + metric.key : undefined,
                    },
                    h('p', { className: 'cv2-hk' }, metric.label),
                    h(
                      'p',
                      { className: 'cv2-mv' },
                      metric.value,
                      metric.unit ? h('span', { className: 'cv2-mu' }, metric.unit) : null,
                    ),
                    metric.hint
                      ? h(
                          'div',
                          { className: 'cv2-tip', id: 'cv2-tip-' + metric.key, role: 'tooltip' },
                          h('strong', { className: 'cv2-tip-t' }, metric.hint.title),
                          h('span', { className: 'cv2-tip-b' }, metric.hint.body),
                          metric.hint.source ? h('span', { className: 'cv2-tip-s' }, metric.hint.source) : null,
                        )
                      : null,
                  )
                }),
              )
            : null,
          showVolumeStrip
            ? h(
                'div',
                { className: 'cv2-volstrip' },
                h('span', { className: 'cv2-volstrip-k' }, t('volume')),
                h(
                  'span',
                  { className: 'cv2-volitem' },
                  h('span', null, t('lastDays', { n: 7 })),
                  h('b', null, weekDisplay.value),
                  weekDisplay.unit ? h('span', { className: 'cv2-mu' }, weekDisplay.unit) : null,
                ),
                h('span', { className: 'cv2-voldiv' }),
                h(
                  'span',
                  { className: 'cv2-volitem' },
                  h('span', null, t('thisMonth')),
                  h('b', null, monthDisplay.value),
                  monthDisplay.unit ? h('span', { className: 'cv2-mu' }, monthDisplay.unit) : null,
                ),
              )
            : null,
        ),
      )
    }

    function ScheduleSection(props) {
      var t = props.t
      var data = props.data
      var entries = (data && data.entries) || []
      var library = props.library || null

      // The way into the plan page. It is on the schedule header rather than
      // under the rows because the plan is not a fact about this week: it is
      // the four-week programme behind the week, and the header is where the
      // section says "there is a document behind me". Offered in every state
      // that can be described, including the empty one — a fresh account is
      // exactly where the plan page has something to offer.
      var detail = props.onOpenPlan ? { label: t('planDetail'), onClick: props.onOpenPlan, title: t('planTitle') } : undefined

      if (props.error) {
        return h(
          Section,
          { title: t('schedule') },
          h(StateBlock, { tone: 'error', message: t('failureRetained'), retryLabel: t('retry'), onRetry: props.onRetry }),
        )
      }
      // Loading is not emptiness. Before the first response arrives the panel
      // renders skeletons, but a refresh keeps the previous data, so this
      // branch only fires when a load is in flight with nothing to show yet.
      if (!data) {
        if (props.loading) return h(Section, { title: t('schedule') }, h(Skeleton))
        return h(Section, { title: t('schedule') }, h(StateBlock, { message: t('noSessionThisWeek') }))
      }

      if (data.empty || entries.length === 0) {
        // "No workout this week" and "this account has no plan at all" look
        // identical in the weekly schedule, and only the second one may offer
        // creation: createTrainingPlan stores a NEW plan instead of merging
        // into the running one, so offering it during a rest week would strand
        // the athlete with two overlapping plans. The plan library answers
        // whether any plan exists; when that query failed — or answered only
        // for a narrower status filter — we stay neutral rather than guessing.
        var never, hasPlans, unknown
        if (!library || library.conclusive !== true) unknown = true
        else if (library.empty === true) never = true
        else hasPlans = true

        if (never) {
          return h(
            Section,
            { title: t('schedule'), action: detail },
            h(StateBlock, {
              message: t('planEmptyHint'),
              action: { label: t('planCreate'), onClick: props.onCreatePlan },
            }),
            props.note ? h('p', { className: 'cv2-note', role: 'status' }, props.note) : null,
          )
        }
        var meta = !unknown && hasPlans ? t('planCount', { n: library.total }) : undefined
        // A rest week and "the plan I just created starts on Monday" look the
        // same in a week-scoped query, and the second one is the common case:
        // plans are always written starting the next Monday. The library now
        // carries each plan's dates, so say when the training actually starts
        // instead of leaving the athlete with a bare "no workout this week"
        // right under a plan that is plainly listed below.
        var startsOn = nextStartDate(library && library.plans, props.today)
        return h(
          Section,
          { title: t('schedule'), meta: meta, action: detail },
          h(StateBlock, { message: t('noSessionThisWeek') }),
          startsOn ? h('p', { className: 'cv2-note' }, t('scheduleStartsOn', { d: startsOn })) : null,
        )
      }
      // The weekly schedule answers with one dated block per session, so every
      // entry now carries the day it happens on. That date is also what makes
      // the card truthful: the whole week is shown in order, because a four
      // session week cut down to three used to hide the long run — the one
      // workout the athlete is actually planning around.
      var ordered = entries.slice().sort(function (left, right) {
        var a = String(left.date || left.Date || left.day || left.Day || '')
        var b = String(right.date || right.Date || right.day || right.Day || '')
        if (a === b) return 0
        if (!a) return 1
        if (!b) return -1
        return a < b ? -1 : 1
      })

      var rows = ordered.map(function (entry, index) {
        var when = entry.date || entry.Date || entry.day || entry.Day || ''
        var details = []
        var detailKeys = ['type', 'Type', 'workout', 'Workout', 'duration', 'Duration', 'Estimated Time', 'distance', 'Distance']
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
      return h(Section, { title: t('schedule'), meta: t('thisWeek', { n: entries.length }), action: detail }, h('div', { className: 'cv2-rows' }, rows))
    }

    /**
     * The training plan, as its own page.
     *
     * It used to be a block inside the dashboard, directly under the schedule.
     * That put four weeks of sessions between the athlete and everything below
     * it — and made the dashboard answer a question ("what does my plan look
     * like in three weeks") that nobody asks while scanning today's numbers.
     * The schedule section now carries a single way in, and the plan lives here.
     *
     * The plan is composed by the host, not here. That is deliberate: what the
     * athlete is asked to confirm has to be the exact thing the writer stores,
     * and a second copy of the four-week cycle in the browser would eventually
     * drift from the one on the server. So this component renders a plan it did
     * not build, and the write sends only the start date — the host rebuilds the
     * payload from its own code, which is what stops a tampered body from
     * injecting arbitrary sessions into the account.
     *
     * Because the page has the whole viewport, all four weeks are rendered at
     * once instead of the one-week-at-a-time pager the dashboard block used:
     * "detail" is the promise this page makes, and a plan that fits on one
     * screen no longer needs paging.
     */
    function PlanPage(props) {
      var t = props.t
      var locale = props.locale
      var state = React.useState({ phase: 'checking', plan: null, preview: null, report: null, error: null })
      var current = state[0]
      var setState = state[1]

      function patch(fields) {
        setState(function (prev) {
          var next = {}
          for (var key in prev) next[key] = prev[key]
          for (var name in fields) next[name] = fields[name]
          return next
        })
      }

      // The week the athlete is actually living in. Kept from the paged block:
      // with every week on screen at once, this is what tells the reader which
      // of the four rows sets is the one they are running now.
      function liveWeekIndex(weeks) {
        var today = props.today || todayStamp()
        if (!weeks || !weeks.length) return -1
        for (var i = 0; i < weeks.length; i += 1) {
          var start = String(weeks[i].weekStart || '')
          var end = String(weeks[i].weekEnd || '')
          if (start && end && start <= today && today <= end) return i
        }
        var last = weeks[weeks.length - 1]
        if (last && String(last.weekEnd || '') && String(last.weekEnd) < today) return weeks.length - 1
        return -1
      }

      // A dead session is not a failure of the plan: retrying would fail the
      // same way forever. It is the panel's state, so hand it upwards — the
      // owner swaps in the sign-in card, and signing back in returns here.
      // Without an owner to hand it to, it degrades to an ordinary error: the
      // page must never sit on "正在读取…" waiting for a rescue that is not
      // coming.
      function expired(err) {
        if (!err) return false
        if (err.code !== 'unauthenticated' && err.status !== 401) return false
        if (typeof props.onExpired !== 'function') return false
        props.onExpired()
        return true
      }

      // Read-only, and it runs on mount: the plan is fixed content, so showing
      // it costs nothing and a button that only reveals it would be a step the
      // athlete has to take for no reason.
      function check() {
        patch({ phase: 'checking', error: null, report: null })
        fetchJson('/plan/preview?lang=' + encodeURIComponent(locale))
          .then(function (body) {
            patch({ phase: 'ready', plan: body.plan, preview: body.preview, report: null })
          })
          .catch(function (err) {
            if (expired(err)) return
            patch({ phase: 'idle', plan: null, preview: null, error: err.message })
          })
      }

      React.useEffect(function () {
        check()
      }, [])

      // The confirmation step is local: the first click only changes what is on
      // screen. There is no delete tool for a plan, so the last click is the
      // only guard that exists.
      function write() {
        patch({ phase: 'writing', error: null })
        postJson('/plan/write', {
          startDate: current.plan.startDate,
          lang: locale,
          confirm: true,
        })
          .then(function (body) {
            patch({ phase: 'done', plan: body.plan, report: body.report })
            // Optional, and nobody passes it today: the page is the only thing
            // on screen once the dashboard is gone, and going back re-mounts
            // the dashboard, which reads the account afresh anyway. Kept as a
            // hook so a future owner of this page can react to a real write
            // without having to edit the write path itself.
            if (body.report && body.report.created && typeof props.onWritten === 'function') props.onWritten()
          })
          .catch(function (err) {
            if (expired(err)) return
            patch({ phase: 'ready', error: err.message })
          })
      }

      var phase = current.phase
      var plan = current.plan
      var preview = current.preview
      var report = current.report

      var meta = plan
        ? t('planRange', { a: plan.startDate, b: plan.endDate, w: plan.totalWeeks, n: plan.sessionCount, d: plan.totalDistanceKm })
        : null

      // One row per session, grouped under its week. The week header carries the
      // weekly volume because that is the number the athlete actually tracks;
      // the plan total is in the page subtitle.
      var weeks = plan && plan.weeks ? plan.weeks : []
      var liveIndex = liveWeekIndex(weeks)

      var weeksView = weeks.map(function (week, weekIndex) {
        var isLive = weekIndex === liveIndex
        return h(
          'section',
          { className: 'cv2-plan-week' + (isLive ? ' is-live' : ''), key: week.index || weekIndex },
          h(
            'div',
            { className: 'cv2-plan-weekhead' },
            h('span', { className: 'cv2-plan-weeklabel' }, week.label),
            h('span', { className: 'cv2-plan-weektheme' }, week.theme),
            isLive ? h('span', { className: 'cv2-plan-tag' }, t('planThisWeek')) : null,
            h('span', { className: 'cv2-plan-weekkm' }, week.distanceKm + ' km'),
          ),
          week.sessions.map(function (row, index) {
            return h(
              'div',
              { className: 'cv2-plan-row', key: index },
              h('span', { className: 'cv2-plan-when' }, row.dateLabel + ' ' + row.weekday),
              h(
                'span',
                { className: 'cv2-plan-name' },
                row.name,
                h('span', { className: 'cv2-plan-sub' }, row.time + ' · ' + row.detail + ' · ' + row.distanceKm + ' km'),
              ),
            )
          }),
        )
      })

      var conflicts = preview && preview.library && preview.library.conflicts ? preview.library.conflicts : []
      var problems = preview && preview.problems ? preview.problems : []

      var body
      if (phase === 'idle') {
        // Reached when the automatic check failed. Nothing on this page can be
        // trusted then, so it offers the one thing that helps: try again.
        body = h(
          'div',
          { className: 'cv2-plan-acts' },
          h('button', { type: 'button', className: 'cv2-btn', onClick: check }, t('planReload')),
        )
      } else if (phase === 'checking') {
        body = h('p', { className: 'cv2-note', role: 'status' }, t('planChecking'))
      } else if (phase === 'writing') {
        body = h('p', { className: 'cv2-note', role: 'status' }, t('planCreating'))
      } else if (phase === 'done' && report) {
        body = h(
          'div',
          null,
          h(
            'p',
            { className: 'cv2-note', role: 'status' },
            report.created
              ? t('planCreated', { name: report.planName, n: report.sessionCount })
              : t('planRejected', { reason: report.reason || '' }),
          ),
          h('div', { className: 'cv2-plan-acts' },
            h('button', { type: 'button', className: 'cv2-btn is-quiet', onClick: check }, t('planReload')),
          ),
        )
      } else if (plan) {
        var actions
        if (phase === 'confirming') {
          actions = h(
            'div',
            { className: 'cv2-plan-acts' },
            h('button', { type: 'button', className: 'cv2-btn', onClick: write }, t('planConfirm', { n: plan.sessionCount })),
            h('button', { type: 'button', className: 'cv2-btn is-quiet', onClick: function () { patch({ phase: 'ready' }) } }, t('planCancel')),
          )
        } else {
          actions = h(
            'div',
            { className: 'cv2-plan-acts' },
            h('button', { type: 'button', className: 'cv2-btn', onClick: function () { patch({ phase: 'confirming' }) } }, t('planCreateAction')),
            h('button', { type: 'button', className: 'cv2-btn is-quiet', onClick: check }, t('planReload')),
          )
        }

        body = h(
          'div',
          null,
          h('p', { className: 'cv2-note' }, t('planHint')),
          h('p', { className: 'cv2-note' }, t('planNoTime')),
          problems.length ? h('p', { className: 'cv2-plan-danger' }, problems.join('；')) : null,
          conflicts.length
            ? h('p', { className: 'cv2-plan-danger' }, t('planConflict', {
                list: conflicts.map(function (entry) { return entry.title + ' ' + entry.startDate + '→' + entry.endDate }).join('、'),
              }))
            : null,
          plan.planName ? h('p', { className: 'cv2-plan-lede' }, plan.planName) : null,
          plan.planOverview ? h('p', { className: 'cv2-plan-overview' }, plan.planOverview) : null,
          h('div', { className: 'cv2-plan-rows' }, weeksView),
          phase === 'confirming' ? h('p', { className: 'cv2-plan-danger' }, t('planDanger')) : null,
          actions,
        )
      }

      return h(
        'div',
        { className: 'cv2-detail' },
        h(
          'div',
          { className: 'cv2-backrow' },
          h(
            'button',
            { type: 'button', className: 'cv2-tbtn', onClick: props.onBack },
            h(ArrowLeftIcon),
            t('planBack'),
          ),
        ),
        // No refresh in the head: every state that can be re-read already
        // carries its own 重新读取 next to the action it belongs to, and a
        // second copy one line above would be the same button twice.
        h(
          'div',
          { className: 'cv2-head' },
          h(
            'div',
            { className: 'cv2-head-main' },
            h('h1', { className: 'cv2-h1' }, t('planTitle')),
            h('p', { className: 'cv2-sub' }, meta || t('planPageSub')),
          ),
        ),
        current.error ? h('p', { className: 'cv2-plan-danger', role: 'alert' }, current.error) : null,
        body,
      )
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
        var sport = sportLabel(record, props.locale, t('otherSport'))
        var sportProps = { className: 'cv2-act-name' }
        // The family dot is added only when the sport resolved to a known
        // family, so an unmapped sport shows its name with no colour claim.
        if (sport.family) sportProps.className += ' has-hue ' + sport.family
        // Unmapped sports still show the COROS name on hover, so nobody has to
        // guess which unknown sport a row stands for.
        if (sport.raw) sportProps.title = sport.raw
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
              h('span', sportProps, sport.text),
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
        kpis.push({ key: 'rhr', icon: HeartIcon, tone: 'is-rose', label: t('restingHr'), value: rhr.value, unit: rhr.unit || 'bpm' })
      }
      if (!isBlank(data.hrvBaseline)) {
        var hrv = splitUnit(data.hrvBaseline)
        kpis.push({ key: 'hrv', icon: PulseIcon, tone: 'is-indigo', label: t('hrv'), value: hrv.value, unit: hrv.unit || 'ms' })
      }
      // "Last night" is the newest wake-up day, which is the day COROS dates
      // sleep by; steps for the same day are usually still partial, so they are
      // labelled by their own day rather than merged into one line.
      var newest = days.length ? days[days.length - 1] : null
      if (newest && !isBlank(newest.sleepTotal)) {
        var sleep = splitUnit(newest.sleepTotal)
        kpis.push({ key: 'sleep', icon: MoonIcon, tone: 'is-blue', label: t('sleep'), value: sleep.value, unit: sleep.unit })
      }
      if (newest && !isBlank(newest.steps)) {
        kpis.push({ key: 'steps', icon: StepsIcon, tone: 'is-green', label: t('steps'), value: String(numOf(newest.steps) !== undefined ? numOf(newest.steps).toLocaleString('en-US') : newest.steps), unit: '' })
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
            { className: 'cv2-chart-head' },
            h('span', { className: 'cv2-ic is-blue', 'aria-hidden': 'true' }, h(MoonIcon)),
            h('span', { className: 'cv2-chart-t' }, t('sleepChart')),
          ),
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
                var Glyph = kpi.icon
                return h(
                  'div',
                  { className: 'cv2-kpi', key: kpi.key },
                  h('span', { className: 'cv2-ic ' + kpi.tone, 'aria-hidden': 'true' }, h(Glyph)),
                  h(
                    'div',
                    { className: 'cv2-kpi-body' },
                    h('p', { className: 'cv2-hk' }, kpi.label),
                    h('p', { className: 'cv2-mv' }, kpi.value, kpi.unit ? h('span', { className: 'cv2-mu' }, kpi.unit) : null),
                  ),
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
        if (isFinite(avg) && avg > 0) {
          parts.push(t('avgN', { n: chartDays.length }) + ' ' + Math.floor(avg / 60) + 'h ' + Math.round(avg % 60) + 'min')
        }
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
      var noteRef = React.useState(null)
      var note = noteRef[0]
      var setNote = noteRef[1]

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

      // Open a fresh session seeded with the plan command. Handled here rather
      // than in a slot handler because the CTA lives inside the schedule
      // section and only this component knows the current data.
      function createPlan() {
        var uiWorkspace = typeof props.getUiWorkspace === 'function' ? props.getUiWorkspace() : null
        if (!uiWorkspace || typeof uiWorkspace.startSession !== 'function') {
          // Without the service there is no session to open; say so instead of
          // doing nothing, which reads as a broken button.
          setNote(t('planCreateUnavailable'))
          return
        }
        setNote(null)
        // `prompt` seeds the composer; the leading token is what the command
        // parser adjudicates on Enter, so the user still confirms before any
        // data is read. `replace` overwrites a half-written draft so the token
        // cannot land in the middle of unrelated text.
        uiWorkspace.startSession(undefined, {
          prompt: '/coros-plan ',
          whenDraftExists: 'replace',
        })
      }

      var sections = (current.data && current.data.sections) || {}
      var profile = sections.profile || null
      var errors = (current.data && current.data.errors) || []
      var errorBySection = {}
      for (var i = 0; i < errors.length; i += 1) {
        errorBySection[errors[i].section] = errors[i].message
      }
      // A failure before the first response has no per-section list to read:
      // every request failed together, so each section must still say so
      // rather than render as if the account were simply empty.
      var fatalError = !current.data && current.error ? current.error : undefined
      function sectionError(name) {
        return errorBySection[name] || fatalError
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
          h(Hero, {
            t: t,
            locale: locale,
            recovery: sections.recovery,
            fitness: sections.fitness,
            trainingLoad: sections.trainingLoad,
            activities: sections.activities,
          }),
          h(
            'div',
            { className: 'cv2-cols' },
            h(
              'div',
              { className: 'cv2-col' },
              h(ScheduleSection, {
                t: t,
                data: sections.schedule,
                library: sections.planLibrary,
                loading: current.loading,
                error: sectionError('schedule'),
                note: note,
                onCreatePlan: createPlan,
                onOpenPlan: props.onOpenPlan,
                onRetry: load,
              }),
              h(ActivitiesSection, {
                t: t,
                locale: locale,
                data: sections.activities,
                error: sectionError('activities'),
                days: days,
                onRetry: load,
              }),
            ),
            h(
              'div',
              { className: 'cv2-col' },
              h(HealthSection, { t: t, data: sections.health, error: sectionError('health'), days: days, onRetry: load }),
              h(PredictionsSection, { t: t, locale: locale, fitness: sections.fitness, error: sectionError('fitness'), onRetry: load }),
              h(DevicesSection, { t: t, data: sections.devices, error: sectionError('devices'), onRetry: load }),
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

      // Which view of the panel is showing: the dashboard, or the training plan
      // page it can open. It lives here, above both, because the schedule — the
      // only thing that opens the page — is a child of the dashboard, and the
      // page has to survive the dashboard unmounting underneath it.
      //
      // Deliberately not a hash route or history entry: this panel is one slot
      // in a host that owns the URL, and pushing a route from inside a slot
      // would fight the host's own navigation. A plain piece of state gets the
      // same "go there, come back" behaviour and leaves no trail to get wrong.
      var viewRef = React.useState('dashboard')
      var view = viewRef[0]
      var setView = viewRef[1]
      var rootRef = React.useRef(null)

      // Moving between views must not leave the reader half-way down the page
      // they just left: `.cv2-root` is the element with `overflow-y` in SHEET,
      // so it is the one that has to go back to the top. Reached through a ref
      // rather than a document query so two panels on screen cannot scroll each
      // other.
      function go(next) {
        setView(next)
        if (typeof window !== 'undefined' && window.requestAnimationFrame) {
          window.requestAnimationFrame(function () {
            var root = rootRef.current
            if (!root) return
            if (typeof root.scrollTo === 'function') root.scrollTo({ top: 0 })
            else root.scrollTop = 0
          })
        }
      }

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
        // The plan page is only reachable once the panel is signed in, so the
        // view switch lives inside this branch: signing out has to land on the
        // sign-in card, not on a plan page that no longer has an account.
        if (view === 'plan') {
          body = h(PlanPage, {
            t: t,
            locale: locale,
            onBack: function () { go('dashboard') },
            // The page reads the account too, so it can be the first to find
            // the session gone. Handing it up swaps in the sign-in card; the
            // view stays `plan`, so signing back in lands right here and the
            // page mounts again with a fresh account.
            onExpired: function () {
              setState({ phase: 'expired' })
            },
            // No `onWritten`: there is no dashboard mounted to notify. Going
            // back re-mounts the dashboard, which reads the account afresh, so
            // a plan created here shows up in the schedule on its own.
          })
        } else {
          body = h(Dashboard, {
            t: t,
            locale: locale,
            getUiWorkspace: props.getUiWorkspace,
            onSignOut: signOut,
            onOpenPlan: function () { go('plan') },
            onExpired: function () {
              setState({ phase: 'expired' })
            },
          })
        }
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
        { className: 'cv2-root', ref: rootRef },
        h('style', { dangerouslySetInnerHTML: { __html: SHEET } }),
        h('div', { className: 'cv2-page' }, body),
      )
    }

    /* ------------------------------------------------------------ bootstrap */

    function apply(ctx) {
      var localeId = detectLocale(ctx)
      var t = makeT(localeId)

      // Read lazily and optionally: `uiWorkspace` is a shipped service, but
      // declaring it in `inject` would park this whole panel if a host build
      // ever renamed it, and the schedule CTA can degrade to a note instead.
      function getUiWorkspace() {
        if (typeof ctx.get !== 'function') return null
        var service = ctx.get('uiWorkspace')
        return service || null
      }

      // The panel body. Keyed by the same id the sidebar row uses; the host
      // dispatches `entryKey` from the active panel id, so they must be equal.
      ctx.slots.inject('main', function () {
        return ctx.slots.register({ name: 'main', key: PANEL_ID }, function CorosSportPanel() {
          return h(Panel, { t: t, locale: localeId, getUiWorkspace: getUiWorkspace })
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
