// Client half of the COROS Sport plugin.
//
// Two registrations make the feature reachable:
//   sidebar.panellist -> the "高驰运动" row in the global panel list
//   main              -> the panel body, dispatched by that same id
//
// The id of both must match, and it must differ from every shipped entry:
// reusing one would replace that entry instead of adding a row.
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
        noSchedule: '没有训练安排',
        expired: '登录已过期，请重新登录',
        failure: '读取失败',
        warranty: '保修至',
        serial: '序列号',
        level: '状态',
        fullRecovery: '完全恢复',
        vo2max: '最大摄氧量',
        runningLevel: '跑步水平',
        thresholdPace: '阈值配速',
        predictions: '成绩预测',
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
        noSchedule: 'No training scheduled',
        expired: 'Your session expired. Please sign in again.',
        failure: 'Could not load',
        warranty: 'Warranty until',
        serial: 'Serial',
        level: 'Level',
        fullRecovery: 'Full recovery',
        vo2max: 'VO2max',
        runningLevel: 'Running level',
        thresholdPace: 'Threshold pace',
        predictions: 'Predictions',
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
        localeNote: '',
        footnote: 'Data comes from the COROS MCP endpoint, for personal review only',
      },
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

    /* --------------------------------------------------------------- styles */

    var C = {
      bg: 'var(--dsw-alias-bg-base)',
      layer1: 'var(--dsw-alias-bg-layer-1)',
      layer2: 'var(--dsw-alias-bg-layer-2)',
      border1: 'var(--dsw-alias-border-l1)',
      border2: 'var(--dsw-alias-border-l2)',
      text: 'var(--dsw-alias-label-primary)',
      muted: 'var(--dsw-alias-label-secondary)',
      brand: 'var(--dsw-alias-brand-primary)',
      error: 'var(--dsw-alias-state-error-primary)',
      success: 'var(--dsw-alias-state-success-primary)',
      warn: 'var(--dsw-alias-state-warn-primary)',
      idle: 'var(--dsw-alias-state-idle-primary)',
    }

    var pageStyle = {
      height: '100%',
      overflow: 'auto',
      background: C.bg,
      color: C.text,
      fontFamily: 'inherit',
      padding: '24px 28px 48px',
      boxSizing: 'border-box',
    }

    var innerStyle = { maxWidth: '880px', margin: '0 auto' }

    var headerStyle = {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: '16px',
      marginBottom: '20px',
    }

    var cardStyle = {
      background: C.layer1,
      border: '1px solid ' + C.border1,
      borderRadius: '12px',
      padding: '16px 18px',
      marginBottom: '14px',
    }

    var cardTitleStyle = {
      fontSize: '13px',
      fontWeight: 600,
      color: C.muted,
      letterSpacing: '0.02em',
      marginBottom: '10px',
      textTransform: 'none',
    }

    var rowStyle = { display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px', fontSize: '13px', lineHeight: '20px' }
    var keyStyle = { color: C.muted, minWidth: '88px', flexShrink: 0 }
    var valueStyle = { color: C.text, wordBreak: 'break-word' }

    function buttonStyle(primary) {
      return {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: '7px 14px',
        borderRadius: '8px',
        border: '1px solid ' + (primary ? 'transparent' : C.border2),
        background: primary ? C.brand : 'transparent',
        color: primary ? 'var(--dsw-alias-bg-base)' : C.text,
        fontFamily: 'inherit',
        fontSize: '13px',
        lineHeight: '18px',
        cursor: 'pointer',
      }
    }

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
            color: props && props.active ? C.brand : 'inherit',
          },
        },
        h(CorosMark, { size: size }),
      )
    }

    /* ------------------------------------------------------------- fragments */

    function Field(props) {
      if (props.value === undefined || props.value === null || props.value === '') return null
      return h('div', { style: rowStyle }, h('span', { style: keyStyle }, props.label), h('span', { style: valueStyle }, props.value))
    }

    function Card(props) {
      return h('section', { style: cardStyle }, props.title ? h('div', { style: cardTitleStyle }, props.title) : null, props.children)
    }

    function ErrorNote(props) {
      if (!props.message) return null
      return h(
        'div',
        {
          style: {
            marginTop: '8px',
            padding: '8px 10px',
            borderRadius: '8px',
            background: C.layer2,
            border: '1px solid ' + C.border1,
            color: C.error,
            fontSize: '12px',
            lineHeight: '18px',
            wordBreak: 'break-word',
          },
        },
        props.message,
      )
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
        { style: innerStyle },
        h(
          'div',
          { style: headerStyle },
          h(
            'div',
            null,
            h('h1', { style: { fontSize: '20px', fontWeight: 600, margin: '0 0 6px' } }, t('signInTitle')),
            h('p', { style: { margin: 0, color: C.muted, fontSize: '13px', lineHeight: '20px', maxWidth: '560px' } }, t('signInBody')),
          ),
        ),
        attempt
          ? h(
              'div',
              null,
              h(
                'div',
                {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    marginBottom: '10px',
                  },
                },
                h('div', { style: { fontSize: '13px', color: C.muted } }, t('signInPending')),
                h('button', { type: 'button', onClick: cancel, style: buttonStyle(false) }, t('cancel')),
              ),
              h('iframe', {
                // The consent page refuses server-side fetches and cannot be
                // driven by us, so the user must see and operate it directly.
                src: attempt.loginUrl,
                title: 'COROS',
                style: {
                  width: '100%',
                  height: '520px',
                  border: '1px solid ' + C.border2,
                  borderRadius: '12px',
                  background: '#fff',
                },
                referrerPolicy: 'no-referrer',
              }),
              h('div', { style: { marginTop: '10px', fontSize: '12px', color: C.muted } }, t('signInWaiting')),
            )
          : h(
              'div',
              null,
              h('button', { type: 'button', onClick: start, disabled: busy, style: buttonStyle(true) }, busy ? t('signInWaiting') : t('signInButton')),
              h(ErrorNote, { message: error }),
            ),
      )
    }

    /* ------------------------------------------------------------ dashboard */

    function Devices(props) {
      var t = props.t
      var body = props.data
      if (!body) return null
      if (!body.devices || body.devices.length === 0) {
        return h(Card, { title: t('devices') }, h('div', { style: { color: C.muted, fontSize: '13px' } }, t('noDevices')))
      }
      return h(
        Card,
        { title: t('devices') },
        body.devices.map(function (device, index) {
          return h(
            'div',
            {
              key: index,
              style: {
                paddingTop: index === 0 ? 0 : '12px',
                marginTop: index === 0 ? 0 : '12px',
                borderTop: index === 0 ? 'none' : '1px solid ' + C.border1,
              },
            },
            h('div', { style: { fontSize: '14px', fontWeight: 600, marginBottom: '6px' } }, device.name),
            h(Field, { label: t('serial'), value: device.serialNumber }),
            h(Field, { label: t('warranty'), value: device.warrantyExpires }),
          )
        }),
      )
    }

    function Vitals(props) {
      var t = props.t
      var recovery = props.recovery
      var fitness = props.fitness
      var items = []
      if (recovery && recovery.percent !== undefined) {
        items.push(h(Field, { key: 'r', label: t('recovery'), value: recovery.percent + '% · ' + (recovery.level || '') }))
        if (recovery.estimatedFullRecovery) items.push(h(Field, { key: 'rf', label: t('fullRecovery'), value: recovery.estimatedFullRecovery }))
      }
      if (fitness) {
        if (fitness.vo2max !== undefined) items.push(h(Field, { key: 'v', label: t('vo2max'), value: fitness.vo2max }))
        if (fitness.runningLevel !== undefined) items.push(h(Field, { key: 'rl', label: t('runningLevel'), value: fitness.runningLevel }))
        if (fitness.thresholdPace) items.push(h(Field, { key: 'tp', label: t('thresholdPace'), value: fitness.thresholdPace }))
      }
      if (items.length === 0) return null
      return h(Card, { title: t('fitness') }, items)
    }

    function Activities(props) {
      var t = props.t
      var data = props.data
      if (!data) return null
      if (!data.records || data.records.length === 0) {
        return h(Card, { title: t('activities') }, h('div', { style: { color: C.muted, fontSize: '13px' } }, t('noActivities')))
      }
      return h(
        Card,
        { title: t('activities') },
        data.records.map(function (record, index) {
          var meta = []
          if (record.distance) meta.push(record.distance)
          if (record.duration) meta.push(record.duration)
          if (record.averagePace) meta.push(record.averagePace)
          if (record.averageHeartRate) meta.push(record.averageHeartRate)
          return h(
            'div',
            {
              key: index,
              style: {
                paddingTop: index === 0 ? 0 : '10px',
                marginTop: index === 0 ? 0 : '10px',
                borderTop: index === 0 ? 'none' : '1px solid ' + C.border1,
              },
            },
            h(
              'div',
              { style: { display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '13px', marginBottom: '3px' } },
              h('span', { style: { fontWeight: 600 } }, record.sportType || ''),
              h('span', { style: { color: C.muted } }, record.date || ''),
            ),
            h('div', { style: { fontSize: '12px', color: C.muted, lineHeight: '18px' } }, meta.join(' · ')),
          )
        }),
      )
    }

    function Health(props) {
      var t = props.t
      var data = props.data
      if (!data || (!data.days || data.days.length === 0) && !data.restingHeartRate) return null
      var head = []
      if (data.restingHeartRate) head.push(h(Field, { key: 'rhr', label: t('restingHr'), value: data.restingHeartRate }))
      if (data.hrvBaseline) head.push(h(Field, { key: 'hrv', label: t('hrv'), value: data.hrvBaseline }))
      var recent = (data.days || []).slice(-3).reverse()
      return h(
        Card,
        { title: t('health') },
        head,
        recent.map(function (day) {
          return h(
            'div',
            { key: day.date, style: { marginTop: head.length ? '10px' : 0, fontSize: '12px', color: C.muted, lineHeight: '19px' } },
            h('div', { style: { color: C.text, fontSize: '13px', marginBottom: '2px' } }, day.date),
            [
              day.steps !== undefined ? t('steps') + ' ' + day.steps : null,
              day.sleepTotal ? t('sleep') + ' ' + day.sleepTotal : null,
              day.deep ? t('deep') + ' ' + day.deep : null,
              day.stress ? t('stress') + ' ' + day.stress : null,
            ]
              .filter(Boolean)
              .join(' · '),
          )
        }),
      )
    }

    function Schedule(props) {
      var t = props.t
      var data = props.data
      if (!data) return null
      if (data.empty || !data.entries || data.entries.length === 0) return null
      return h(
        Card,
        { title: t('schedule') },
        data.entries.slice(0, 5).map(function (entry, index) {
          return h('div', { key: index, style: { fontSize: '13px', lineHeight: '20px' } }, entry.title)
        }),
      )
    }

    function Dashboard(props) {
      var t = props.t
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
            setState({ loading: false, data: null, error: err.message })
          })
      }

      React.useEffect(
        function () {
          load()
          return undefined
        },
        [],
      )

      var profile = current.data && current.data.sections ? current.data.sections.profile : null
      var sections = (current.data && current.data.sections) || {}
      var errors = (current.data && current.data.errors) || []

      return h(
        'div',
        null,
        h(
          'div',
          { style: headerStyle },
          h(
            'div',
            null,
            h(
              'h1',
              { style: { fontSize: '20px', fontWeight: 600, margin: '0 0 6px' } },
              profile && profile.nickname ? profile.nickname : t('title'),
            ),
            h(
              'p',
              { style: { margin: 0, color: C.muted, fontSize: '13px', lineHeight: '20px' } },
              [t('subtitle'), current.data && current.data.range ? t('lastDays', { n: current.data.range.days }) : null]
                .filter(Boolean)
                .join(' · '),
            ),
          ),
          h(
            'div',
            { style: { display: 'flex', gap: '8px', flexShrink: 0 } },
            h('button', { type: 'button', onClick: load, style: buttonStyle(false) }, t('refresh')),
            h('button', { type: 'button', onClick: props.onSignOut, style: buttonStyle(false) }, t('signOut')),
          ),
        ),
        current.error ? h(ErrorNote, { message: t('failure') + ': ' + current.error }) : null,
        current.loading && !current.data ? h('div', { style: { color: C.muted, fontSize: '13px' } }, t('loading')) : null,
        h(Devices, { t: t, data: sections.devices }),
        h(Vitals, { t: t, recovery: sections.recovery, fitness: sections.fitness }),
        h(Activities, { t: t, data: sections.activities }),
        h(Health, { t: t, data: sections.health }),
        h(Schedule, { t: t, data: sections.schedule }),
        errors.length
          ? h(
              Card,
              { title: t('failure') },
              errors.map(function (item, index) {
                return h('div', { key: index, style: { fontSize: '12px', color: C.muted, lineHeight: '19px' } }, item.section + ': ' + item.message)
              }),
            )
          : null,
        h('div', { style: { marginTop: '18px', fontSize: '11px', color: C.muted } }, t('footnote')),
      )
    }

    /* ------------------------------------------------------------- the panel */

    function Panel(props) {
      var t = props.t
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
        body = h('div', { style: { color: C.muted, fontSize: '13px' } }, t('loading'))
      } else if (state.phase === 'ready') {
        body = h(Dashboard, {
          t: t,
          onSignOut: signOut,
          onExpired: function () {
            setState({ phase: 'expired' })
          },
        })
      } else if (state.phase === 'expired') {
        body = h(
          'div',
          null,
          h('div', { style: { color: C.warn, fontSize: '13px', marginBottom: '12px' } }, t('expired')),
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

      return h('div', { style: pageStyle }, h('div', { style: innerStyle }, body))
    }

    /* ------------------------------------------------------------ bootstrap */

    function apply(ctx) {
      var localeId = detectLocale(ctx)
      var t = makeT(localeId)

      // The panel body. Keyed by the same id the sidebar row uses; the host
      // dispatches `entryKey` from the active panel id, so they must be equal.
      ctx.slots.inject('main', function () {
        return ctx.slots.register({ name: 'main', key: PANEL_ID }, function CorosSportPanel() {
          return h(Panel, { t: t })
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
