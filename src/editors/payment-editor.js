// src/editors/payment-editor.js
import { openModal, closeModal } from '../lib/ui.js'
import { addPayment, updatePayment } from '../state/mutations.js'
import { getState } from '../state/store.js'

export function open(taskId, paymentId = null) {
  const state = getState()
  const payment = paymentId ? state.payments.find(p => p.id === paymentId) : null

  openModal(box => {
    box.innerHTML = `
      <div class="modal-title">${payment ? 'Edit Payment' : 'Log Payment'}</div>
      <div class="form-grid">
        <div class="form-group">
          <label>Amount ($)</label>
          <input id="f-amount" type="number" value="${payment?.amount ?? ''}" />
        </div>
        <div class="form-group">
          <label>Date</label>
          <input id="f-date" type="date" value="${payment?.date ?? new Date().toISOString().slice(0,10)}" />
        </div>
        <div class="form-group">
          <label>Type</label>
          <select id="f-type">
            ${['deposit','progress','final'].map(t =>
              `<option value="${t}" ${payment?.type === t ? 'selected' : ''}>${t}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group full">
          <label>Notes</label>
          <textarea id="f-notes">${payment?.notes ?? ''}</textarea>
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
        taskId,
        amount: Number(box.querySelector('#f-amount').value) || 0,
        date: box.querySelector('#f-date').value || null,
        type: box.querySelector('#f-type').value,
        notes: box.querySelector('#f-notes').value
      }
      if (!fields.amount) { box.querySelector('#f-amount').focus(); return }
      if (payment) updatePayment(paymentId, fields)
      else addPayment(fields)
      closeModal()
    })
  })
}
