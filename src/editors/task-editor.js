// src/editors/task-editor.js
import { openModal, closeModal } from '../lib/ui.js'
import { addTask, updateTask } from '../state/mutations.js'
import { getState } from '../state/store.js'
import { escapeHtml } from '../lib/escape.js'

export function open(taskId = null) {
  const state = getState()
  const task = taskId ? state.tasks.find(t => t.id === taskId) : null
  const isNew = !task

  openModal(box => {
    box.innerHTML = `
      <div class="modal-title">${isNew ? 'Add Task' : 'Edit Task'}</div>
      <div class="form-grid">
        <div class="form-group full">
          <label>Task Name</label>
          <input id="f-name" value="${escapeHtml(task?.name)}" placeholder="e.g. Slab pour" />
        </div>
        <div class="form-group">
          <label>Phase</label>
          <select id="f-phase">
            ${[...state.phases].sort((a, b) => a.order - b.order).map(p =>
              `<option value="${p.id}" ${task?.phaseId === p.id ? 'selected' : ''}>${p.name}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Budget ($)</label>
          <input id="f-budget" type="number" value="${task?.budget ?? 0}" />
        </div>
        <div class="form-group">
          <label>Start Date</label>
          <input id="f-start" type="date" value="${task?.startDate ?? ''}" />
        </div>
        <div class="form-group">
          <label>End Date</label>
          <input id="f-end" type="date" value="${task?.endDate ?? ''}" />
        </div>
        <div class="form-group">
          <label>Status</label>
          <select id="f-status">
            ${['not_started','in_progress','done','blocked'].map(s =>
              `<option value="${s}" ${task?.status === s ? 'selected' : ''}>${s.replace('_',' ')}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Progress (%)</label>
          <input id="f-progress" type="number" min="0" max="100" value="${task?.progress ?? 0}" />
        </div>
        <div class="form-group full">
          <label>Notes</label>
          <textarea id="f-notes">${escapeHtml(task?.notes)}</textarea>
        </div>
      </div>
      <div class="form-actions">
        <button id="btn-cancel">Cancel</button>
        <button class="primary" id="btn-save">Save</button>
      </div>
    `

    box.querySelector('#btn-cancel').addEventListener('click', closeModal)
    box.querySelector('#btn-save').addEventListener('click', () => {
      const fields = {
        phaseId: box.querySelector('#f-phase').value,
        name: box.querySelector('#f-name').value.trim(),
        budget: Number(box.querySelector('#f-budget').value) || 0,
        startDate: box.querySelector('#f-start').value || null,
        endDate: box.querySelector('#f-end').value || null,
        status: box.querySelector('#f-status').value,
        progress: Number(box.querySelector('#f-progress').value) || 0,
        notes: box.querySelector('#f-notes').value,
        dependsOn: task?.dependsOn ?? [],
        selectedQuoteId: task?.selectedQuoteId ?? null
      }
      if (!fields.name) { box.querySelector('#f-name').focus(); return }
      try {
        if (isNew) addTask(fields)
        else updateTask(taskId, fields)
        closeModal()
      } catch (err) {
        import('../lib/ui.js').then(({ showToast }) => showToast(err.message, 'error'))
      }
    })
  })
}
