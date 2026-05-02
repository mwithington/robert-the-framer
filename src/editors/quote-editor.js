// src/editors/quote-editor.js
import { openModal, closeModal } from '../lib/ui.js'
import { addQuote, updateQuote } from '../state/mutations.js'
import { getState } from '../state/store.js'

export function open(taskId, quoteId = null) {
  const state = getState()
  const quote = quoteId ? state.quotes.find(q => q.id === quoteId) : null

  openModal(box => {
    box.innerHTML = `
      <div class="modal-title">${quote ? 'Edit Quote' : 'Add Quote'}</div>
      <div class="form-grid">
        <div class="form-group full">
          <label>Vendor</label>
          <input id="f-vendor" value="${quote?.vendor ?? ''}" placeholder="Company name" />
        </div>
        <div class="form-group">
          <label>Amount ($)</label>
          <input id="f-amount" type="number" value="${quote?.amount ?? ''}" />
        </div>
        <div class="form-group">
          <label>Date Received</label>
          <input id="f-date" type="date" value="${quote?.receivedDate ?? ''}" />
        </div>
        <div class="form-group full">
          <label>Notes</label>
          <textarea id="f-notes">${quote?.notes ?? ''}</textarea>
        </div>
        <div class="form-group full">
          <label>Attachment URL (optional)</label>
          <input id="f-url" value="${quote?.attachmentUrl ?? ''}" placeholder="https://..." />
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
        vendor: box.querySelector('#f-vendor').value.trim(),
        amount: Number(box.querySelector('#f-amount').value) || 0,
        receivedDate: box.querySelector('#f-date').value || null,
        notes: box.querySelector('#f-notes').value,
        attachmentUrl: box.querySelector('#f-url').value.trim()
      }
      if (!fields.vendor) { box.querySelector('#f-vendor').focus(); return }
      if (quote) updateQuote(quoteId, fields)
      else addQuote(fields)
      closeModal()
    })
  })
}
