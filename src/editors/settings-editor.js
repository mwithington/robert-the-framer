// src/editors/settings-editor.js
import { openModal, closeModal } from '../lib/ui.js'
import { updateMeta } from '../state/mutations.js'
import { getState } from '../state/store.js'
import { escapeHtml } from '../lib/escape.js'

export function open() {
  const { meta } = getState()
  openModal(box => {
    box.innerHTML = `
      <div class="modal-title">Project Settings</div>
      <div class="form-grid">
        <div class="form-group full">
          <label>Project Name</label>
          <input id="f-name" value="${escapeHtml(meta.projectName)}" />
        </div>
        <div class="form-group">
          <label>Start Date</label>
          <input id="f-start" type="date" value="${meta.startDate ?? ''}" />
        </div>
        <div class="form-group">
          <label>Target End Date</label>
          <input id="f-end" type="date" value="${meta.targetEndDate ?? ''}" />
        </div>
        <div class="form-group">
          <label>Total Budget ($) — leave blank to sum tasks</label>
          <input id="f-budget" type="text" inputmode="numeric" value="${meta.totalBudget != null ? meta.totalBudget.toLocaleString() : ''}" placeholder="e.g. 575,000" />
        </div>
        <div class="form-group">
          <label>Square Footage — shows cost per sq ft</label>
          <input id="f-sqft" type="text" inputmode="numeric" value="${meta.sqFt != null ? meta.sqFt.toLocaleString() : ''}" placeholder="e.g. 2,400" />
        </div>
        <div class="form-group">
          <label>Currency</label>
          <input id="f-currency" value="${escapeHtml(meta.currency ?? 'USD')}" />
        </div>
      </div>
      <div class="form-actions">
        <button id="btn-cancel">Cancel</button>
        <button class="primary" id="btn-save">Save</button>
      </div>
    `
    box.querySelector('#btn-cancel').addEventListener('click', closeModal)
    box.querySelector('#btn-save').addEventListener('click', () => {
      const budgetVal = box.querySelector('#f-budget').value
      const sqFtVal = box.querySelector('#f-sqft').value
      updateMeta({
        projectName: box.querySelector('#f-name').value.trim() || meta.projectName,
        startDate: box.querySelector('#f-start').value || null,
        targetEndDate: box.querySelector('#f-end').value || null,
        totalBudget: budgetVal ? Number(budgetVal.replace(/,/g, '')) : null,
        sqFt: sqFtVal ? Number(sqFtVal.replace(/,/g, '')) : null,
        currency: box.querySelector('#f-currency').value.trim() || 'USD'
      })
      closeModal()
    })
  })
}
