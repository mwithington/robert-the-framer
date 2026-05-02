// src/views/gantt.js
import * as d3 from 'd3'
import { criticalPath } from '../state/derived.js'
import { updateTask } from '../state/mutations.js'
import { formatDate } from '../lib/dates.js'

const ROW_H = 28
const LABEL_W = 180
const PHASE_H = 24

export function render(rootEl, state, { onTaskClick }) {
  const { phases, tasks, meta } = state
  if (!meta.startDate || !meta.targetEndDate) {
    rootEl.innerHTML = '<div class="section-title">Gantt</div><p class="text-muted" style="padding:24px 0;text-align:center">Set a project start and end date in ⚙ Settings to see the Gantt chart.</p>'
    return
  }

  rootEl.innerHTML = '<div class="section-title">Gantt <span class="text-sm text-muted">(drag bars to reschedule · drag right edge to resize · drag ● at bar end to link dependency)</span></div><div class="chart-container" id="gantt-wrap"></div>'

  const wrap = rootEl.querySelector('#gantt-wrap')
  const W = Math.max(wrap.clientWidth || 800, 600)
  const chartW = W - LABEL_W

  const domainStart = new Date(meta.startDate)
  const domainEnd = new Date(meta.targetEndDate)
  const xScale = d3.scaleTime().domain([domainStart, domainEnd]).range([0, chartW])

  const sortedPhases = [...phases].sort((a, b) => a.order - b.order)
  const rows = []
  sortedPhases.forEach(phase => {
    const phaseTasks = tasks.filter(t => t.phaseId === phase.id).sort((a, b) => {
      if (!a.startDate) return 1
      if (!b.startDate) return -1
      return a.startDate.localeCompare(b.startDate)
    })
    if (!phaseTasks.length) return
    rows.push({ type: 'phase', phase })
    phaseTasks.forEach(task => rows.push({ type: 'task', task, phase }))
  })

  const totalH = rows.reduce((h, r) => h + (r.type === 'phase' ? PHASE_H : ROW_H), 0)
  const svgH = totalH + 32

  const svg = d3.select(wrap).append('svg')
    .attr('width', W).attr('height', svgH)
    .style('display', 'block')

  // Arrow marker
  svg.append('defs').append('marker')
    .attr('id', 'gantt-arrow').attr('viewBox', '0 -4 8 8').attr('refX', 7).attr('refY', 0)
    .attr('markerWidth', 5).attr('markerHeight', 5).attr('orient', 'auto')
    .append('path').attr('d', 'M0,-4L8,0L0,4').attr('fill', '#94a3b8')

  svg.append('defs').append('marker')
    .attr('id', 'gantt-arrow-critical').attr('viewBox', '0 -4 8 8').attr('refX', 7).attr('refY', 0)
    .attr('markerWidth', 5).attr('markerHeight', 5).attr('orient', 'auto')
    .append('path').attr('d', 'M0,-4L8,0L0,4').attr('fill', '#dc2626')

  // Clip chart area
  svg.append('defs').append('clipPath').attr('id', 'gantt-clip')
    .append('rect').attr('width', chartW).attr('height', svgH)

  const labelG = svg.append('g')
  const chartG = svg.append('g')
    .attr('transform', `translate(${LABEL_W},0)`)
    .attr('clip-path', 'url(#gantt-clip)')

  // Axis (top)
  chartG.append('g').attr('transform', 'translate(0,20)').call(
    d3.axisTop(xScale).ticks(d3.timeWeek.every(2)).tickFormat(d3.timeFormat('%b %d'))
  )

  // Grid lines
  xScale.ticks(d3.timeWeek.every(2)).forEach(tick => {
    chartG.append('line')
      .attr('x1', xScale(tick)).attr('x2', xScale(tick))
      .attr('y1', 24).attr('y2', svgH)
      .attr('stroke', '#f1f5f9').attr('stroke-width', 1)
  })

  const cp = criticalPath(state)
  const taskMap = new Map(tasks.map(t => [t.id, t]))

  let y = 24
  const taskYMap = new Map()

  rows.forEach(row => {
    if (row.type === 'phase') {
      labelG.append('rect').attr('x', 0).attr('y', y).attr('width', LABEL_W).attr('height', PHASE_H)
        .attr('fill', row.phase.color).attr('opacity', .12)
      labelG.append('text').attr('x', 8).attr('y', y + PHASE_H / 2 + 5)
        .attr('class', 'gantt-phase-label').attr('font-size', 12).attr('fill', row.phase.color)
        .text(row.phase.name)
      chartG.append('rect').attr('x', 0).attr('y', y).attr('width', chartW).attr('height', PHASE_H)
        .attr('fill', row.phase.color).attr('opacity', .04)
      y += PHASE_H
    } else {
      const { task, phase } = row
      taskYMap.set(task.id, y)

      // Label
      const lrow = labelG.append('g').attr('transform', `translate(0,${y})`).style('cursor', 'pointer')
      lrow.append('rect').attr('width', LABEL_W).attr('height', ROW_H).attr('fill', 'transparent')
      lrow.append('text').attr('x', 16).attr('y', ROW_H / 2 + 4).attr('font-size', 12)
        .attr('class', 'gantt-task-label')
        .text(task.name.length > 22 ? task.name.slice(0, 21) + '…' : task.name)
      lrow.on('click', () => onTaskClick && onTaskClick(task.id))

      if (task.startDate && task.endDate) {
        const bx = xScale(new Date(task.startDate))
        const bw = Math.max(4, xScale(new Date(task.endDate)) - xScale(new Date(task.startDate)))
        const by = y + 4
        const bh = ROW_H - 8

        const totalDays = d3.timeDay.count(domainStart, domainEnd)
        const pxPerDay = chartW / totalDays

        const barG = chartG.append('g').datum({ task, phase })

        // Background (full bar, dimmed)
        barG.append('rect').attr('class', 'gantt-bar-bg')
          .attr('x', bx).attr('y', by).attr('width', bw).attr('height', bh)
          .attr('fill', phase.color).attr('rx', 3)

        // Progress fill
        barG.append('rect').attr('class', 'gantt-bar')
          .attr('x', bx).attr('y', by)
          .attr('width', bw * ((task.progress || 0) / 100))
          .attr('height', bh)
          .attr('fill', phase.color).attr('rx', 3)

        // Critical path ring
        if (cp.has(task.id)) {
          barG.append('rect').attr('class', 'gantt-critical')
            .attr('x', bx).attr('y', by).attr('width', bw).attr('height', bh)
            .attr('fill', 'none').attr('rx', 3)
        }

        // Tooltip title on bar
        barG.append('title').text(`${task.name}\n${task.startDate} → ${task.endDate}\n${task.progress}% complete`)

        // Drag: move whole bar
        const moveDrag = d3.drag()
          .on('start', function(event, d) {
            d3.select(this.parentNode).raise()
            this._x0 = event.x
            this._start0 = d.task.startDate
            this._end0 = d.task.endDate
          })
          .on('drag', function(event, d) {
            const daysDx = Math.round((event.x - this._x0) / pxPerDay)
            const newStart = new Date(this._start0)
            newStart.setUTCDate(newStart.getUTCDate() + daysDx)
            const newBx = xScale(newStart)
            d3.select(this.parentNode).selectAll('.gantt-bar-bg,.gantt-bar,.gantt-critical')
              .attr('x', sel => sel === '.gantt-bar'
                ? newBx
                : newBx)
            // Just reposition the whole group for preview
            d3.select(this.parentNode).attr('transform', `translate(${newBx - bx},0)`)
          })
          .on('end', function(event, d) {
            d3.select(this.parentNode).attr('transform', null)
            const daysDx = Math.round((event.x - this._x0) / pxPerDay)
            if (daysDx !== 0) {
              const ns = new Date(this._start0); ns.setUTCDate(ns.getUTCDate() + daysDx)
              const ne = new Date(this._end0); ne.setUTCDate(ne.getUTCDate() + daysDx)
              updateTask(d.task.id, {
                startDate: formatDate(ns),
                endDate: formatDate(ne)
              })
            }
          })

        barG.select('.gantt-bar-bg').call(moveDrag)
        barG.select('.gantt-bar').call(moveDrag)

        // Resize handle (right edge)
        const resizeHandleEl = chartG.append('rect').attr('class', 'gantt-resize-handle')
          .attr('x', bx + bw - 5).attr('y', by).attr('width', 8).attr('height', bh)
          .datum({ task })

        const resizeDrag = d3.drag()
          .on('start', function(event, d) {
            this._x0 = event.x
            this._end0 = d.task.endDate
          })
          .on('drag', function(event, d) {
            const daysDx = Math.round((event.x - this._x0) / pxPerDay)
            const newEnd = new Date(this._end0); newEnd.setUTCDate(newEnd.getUTCDate() + daysDx)
            const newW = Math.max(4, xScale(newEnd) - bx)
            barG.select('.gantt-bar-bg').attr('width', newW)
            d3.select(this).attr('x', bx + newW - 5)
          })
          .on('end', function(event, d) {
            const daysDx = Math.round((event.x - this._x0) / pxPerDay)
            if (daysDx !== 0) {
              const newEnd = new Date(this._end0); newEnd.setUTCDate(newEnd.getUTCDate() + daysDx)
              updateTask(d.task.id, { endDate: formatDate(newEnd) })
            }
          })
        resizeHandleEl.call(resizeDrag)

        // Dependency handle circle at bar right edge
        let _dragLine = null
        const depHandle = chartG.append('circle').attr('class', 'dep-handle')
          .attr('cx', bx + bw).attr('cy', by + bh / 2).attr('r', 5)
          .datum({ task })

        depHandle.call(d3.drag()
          .on('start', function(event) {
            _dragLine = chartG.append('line').attr('class', 'dep-arrow')
              .attr('x1', bx + bw).attr('y1', by + bh / 2)
              .attr('x2', event.x).attr('y2', event.y)
              .attr('stroke-dasharray', '4,3').attr('stroke', '#94a3b8')
          })
          .on('drag', function(event) {
            if (_dragLine) _dragLine.attr('x2', event.x).attr('y2', event.y)
          })
          .on('end', function(event) {
            if (_dragLine) { _dragLine.remove(); _dragLine = null }
            const targetEl = document.elementFromPoint(event.sourceEvent.clientX, event.sourceEvent.clientY)
            if (!targetEl) return
            const targetDatum = d3.select(targetEl).datum()
            if (targetDatum?.task && targetDatum.task.id !== task.id) {
              const existing = task.dependsOn || []
              if (!existing.includes(targetDatum.task.id)) {
                try {
                  updateTask(task.id, { dependsOn: [...existing, targetDatum.task.id] })
                } catch (e) {
                  import('../lib/ui.js').then(({ showToast }) => showToast(e.message, 'error'))
                }
              }
            }
          })
        )

        barG.on('mouseenter', () => depHandle.attr('opacity', .8))
          .on('mouseleave', () => depHandle.attr('opacity', 0))
      }

      y += ROW_H
    }
  })

  // Draw dependency arrows (inserted before bars so they're under them)
  tasks.forEach(task => {
    if (!task.startDate) return
    const ty = taskYMap.get(task.id)
    if (ty === undefined) return

    task.dependsOn.forEach(depId => {
      const dep = taskMap.get(depId)
      if (!dep || !dep.endDate) return
      const dy = taskYMap.get(dep.id)
      if (dy === undefined) return

      const sx = xScale(new Date(dep.endDate))
      const sy = dy + ROW_H / 2
      const tx = xScale(new Date(task.startDate))
      const tyc = ty + ROW_H / 2

      const isCritical = cp.has(task.id) && cp.has(dep.id)

      chartG.insert('path', ':first-child')
        .attr('class', 'dep-arrow')
        .attr('d', `M${sx},${sy} C${(sx+tx)/2},${sy} ${(sx+tx)/2},${tyc} ${tx},${tyc}`)
        .attr('stroke', isCritical ? '#dc2626' : '#94a3b8')
        .attr('stroke-width', isCritical ? 2 : 1)
        .attr('marker-end', `url(#gantt-arrow${isCritical ? '-critical' : ''})`)
    })
  })
}
