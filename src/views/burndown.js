// src/views/burndown.js
import * as d3 from 'd3'
import { burndownLines } from '../state/derived.js'
import { formatCurrency, formatPercent } from '../lib/format.js'

export function render(rootEl, state, { mode }) {
  const { ideal, actual } = burndownLines(state)
  const { startDate, targetEndDate, totalBudget } = state.meta

  if (!startDate || !targetEndDate) {
    rootEl.innerHTML = '<div class="section-title">Burndown</div><p class="text-muted" style="padding:24px 0;text-align:center">Set a project start and end date in ⚙ Settings to see the burndown chart.</p>'
    return
  }

  rootEl.innerHTML = '<div class="section-title">Burndown</div><div class="chart-container" id="burndown-svg-wrap" style="position:relative"></div>'

  const wrap = rootEl.querySelector('#burndown-svg-wrap')
  const W = Math.max(wrap.clientWidth || 800, 400)
  const H = 260
  const margin = { top: 16, right: 24, bottom: 32, left: 80 }
  const w = W - margin.left - margin.right
  const h = H - margin.top - margin.bottom

  const svg = d3.select(wrap).append('svg').attr('width', W).attr('height', H)
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  const x = d3.scaleTime().domain([new Date(startDate), new Date(targetEndDate)]).range([0, w])
  const budget = totalBudget ?? state.tasks.reduce((s, t) => s + (t.budget || 0), 0)

  const isPercent = mode === '%'
  const toY = val => isPercent ? (budget ? (val / budget) * 100 : 0) : val
  const yMax = isPercent ? 105 : Math.max(budget * 1.05, 1)
  const y = d3.scaleLinear().domain([0, yMax]).range([h, 0]).nice()

  const yFmt = isPercent ? v => `${Math.round(v)}%` : v => formatCurrency(v)
  g.append('g').attr('transform', `translate(0,${h})`).call(
    d3.axisBottom(x).ticks(6).tickFormat(d3.timeFormat('%b %y'))
  )
  g.append('g').call(d3.axisLeft(y).ticks(5).tickFormat(yFmt))

  const lineGen = d3.line()
    .x(d => x(new Date(d.date)))
    .y(d => y(toY(d.value)))
    .curve(d3.curveLinear)

  // Ideal line
  if (ideal.length >= 2) {
    g.append('path')
      .datum(ideal)
      .attr('fill', 'none')
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '6,4')
      .attr('d', lineGen)
  }

  // Actual line
  if (actual.length > 1) {
    g.append('path')
      .datum(actual)
      .attr('fill', 'none')
      .attr('stroke', '#d97706')
      .attr('stroke-width', 2.5)
      .attr('d', lineGen)

    g.selectAll('.actual-dot')
      .data(actual.slice(1))
      .join('circle')
      .attr('class', 'actual-dot')
      .attr('cx', d => x(new Date(d.date)))
      .attr('cy', d => y(toY(d.value)))
      .attr('r', 4)
      .attr('fill', '#d97706')
  } else {
    // No payments yet: single dot at budget on startDate
    g.append('circle')
      .attr('cx', x(new Date(startDate)))
      .attr('cy', y(toY(budget)))
      .attr('r', 5)
      .attr('fill', '#d97706')
  }

  // Phase milestone ticks
  state.phases.forEach(phase => {
    const phaseTasks = state.tasks.filter(t => t.phaseId === phase.id && t.endDate)
    if (!phaseTasks.length) return
    const lastEnd = phaseTasks.map(t => t.endDate).sort().at(-1)
    const xPos = x(new Date(lastEnd))
    if (xPos < 0 || xPos > w) return
    g.append('line')
      .attr('x1', xPos).attr('x2', xPos).attr('y1', 0).attr('y2', h)
      .attr('stroke', phase.color).attr('stroke-width', 1).attr('stroke-dasharray', '3,3').attr('opacity', .5)
    g.append('text')
      .attr('x', xPos + 3).attr('y', 12).attr('font-size', 9).attr('fill', phase.color)
      .text(phase.name)
  })

  // Hover tooltip
  const tooltip = d3.select(wrap).append('div')
    .style('position', 'absolute').style('background', '#1e293b').style('color', '#fff')
    .style('padding', '6px 10px').style('border-radius', '4px').style('font-size', '12px')
    .style('pointer-events', 'none').style('opacity', 0).style('white-space', 'nowrap')

  const totalDays = d3.timeDay.count(new Date(startDate), new Date(targetEndDate))

  svg.on('mousemove', function(event) {
    const [mx] = d3.pointer(event, g.node())
    if (mx < 0 || mx > w) { tooltip.style('opacity', 0); return }
    const date = x.invert(mx)
    const daysPast = d3.timeDay.count(new Date(startDate), date)
    const idealVal = budget - (budget * daysPast / totalDays)
    const closest = actual.reduce((prev, cur) =>
      Math.abs(new Date(cur.date) - date) < Math.abs(new Date(prev.date) - date) ? cur : prev
    )
    const actualVal = closest.value
    const variance = actualVal - idealVal
    const fmt = isPercent
      ? v => formatPercent(budget ? (v / budget) * 100 : 0)
      : v => formatCurrency(v)
    tooltip.style('opacity', 1)
      .html(`<b>${date.toISOString().slice(0,10)}</b><br>Actual: ${fmt(actualVal)}<br>Ideal: ${fmt(idealVal)}<br>Variance: ${variance >= 0 ? '+' : ''}${fmt(variance)}`)
      .style('left', (event.offsetX + 12) + 'px')
      .style('top', (event.offsetY - 40) + 'px')
  })
  svg.on('mouseleave', () => tooltip.style('opacity', 0))
}
