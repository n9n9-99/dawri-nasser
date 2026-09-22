(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LegalAffairsUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function setModalOpen(documentRef, id, open) {
    const modal = documentRef.getElementById(id);
    if (!modal) return;
    modal.classList.toggle('open', open);
    documentRef.body.classList.toggle('modal-open', Boolean(documentRef.querySelector('.modal.open')));
  }

  function resetViewport(windowRef) {
    windowRef.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }

  function isTransactionNumber(value) {
    const normalized = String(value || '').trim();
    return /^[A-Za-zء-ي0-9]+(?:[\/-][A-Za-zء-ي0-9]+)*$/.test(normalized);
  }

  function setTransactionFieldsEditable(documentRef) {
    ['txNumber', 'txDate', 'txSubject', 'txEntity', 'txType'].forEach(id => {
      const field = documentRef.getElementById(id);
      if (field) field.disabled = false;
    });
  }

  function buildTransactionWorkArgs(values) {
    return {
      p_id: values.id,
      p_transaction_no: values.transactionNo,
      p_entry_date: values.entryDate,
      p_subject: values.subject,
      p_entity: values.entity,
      p_transaction_type: values.transactionType,
      p_status: values.status,
      p_required_action: values.requiredAction,
      p_notes: values.notes,
      p_sent_date: values.sentDate,
      p_outgoing_letter_no: values.outgoingLetterNo,
      p_sent_to: values.sentTo
    };
  }

  function selectReportRows(rows, scope, admin) {
    if (!admin) return [];
    const selected = rows.filter(row => {
      if (scope === 'active') return row.status !== 'منتهية';
      if (scope === 'completed') return row.status === 'منتهية';
      return scope === 'all';
    });
    return selected.toSorted((a, b) =>
      String(b.entry_date || '').localeCompare(String(a.entry_date || '')) ||
      String(a.transaction_no || '').localeCompare(String(b.transaction_no || ''), 'ar', { numeric: true })
    );
  }

  function summarizeReportRows(rows) {
    return {
      total: rows.length,
      active: rows.filter(row => row.status !== 'منتهية').length,
      completed: rows.filter(row => row.status === 'منتهية').length,
      waiting: rows.filter(row => row.status === 'بانتظار رد').length,
      late: rows.filter(row => row.status === 'متأخرة').length
    };
  }

  return { buildTransactionWorkArgs, isTransactionNumber, resetViewport, selectReportRows, setModalOpen, setTransactionFieldsEditable, summarizeReportRows };
});

/*
 * Legal Affairs mobile follow-up hotfix.
 * - Keeps the Umm Al-Qura picker above the transaction sheet on iPhone.
 * - Generates the follow-up letter number as <transaction-no>-1.
 * The database enforces the same follow-up numbering rule.
 */
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function () {
    const calendarModal = document.getElementById('hijriCalendarModal');
    if (calendarModal) {
      calendarModal.style.zIndex = '3200';
    }

    const txModal = document.getElementById('txModal');
    const txForm = document.getElementById('txForm');
    const status = document.getElementById('txStatus');
    const txNumber = document.getElementById('txNumber');
    const letterNumber = document.getElementById('txLetterNo');

    if (!status || !txNumber || !letterNumber) return;

    const labelText = letterNumber.closest('label')?.querySelector('span');

    function followupNumber() {
      const base = String(txNumber.value || '').trim();
      return base ? base + '-1' : '';
    }

    function syncFollowupNumber() {
      const isFollowup = status.value === 'تحتاج إلحاقي';

      if (isFollowup) {
        letterNumber.value = followupNumber();
        letterNumber.readOnly = true;
        letterNumber.setAttribute('aria-readonly', 'true');
        if (labelText) labelText.textContent = 'رقم الخطاب الإلحاقي';
      } else {
        letterNumber.readOnly = false;
        letterNumber.removeAttribute('aria-readonly');
        if (labelText) labelText.textContent = 'رقم الخطاب';
      }
    }

    status.addEventListener('change', syncFollowupNumber);
    txNumber.addEventListener('input', function () {
      if (status.value === 'تحتاج إلحاقي') syncFollowupNumber();
    });

    if (txModal) {
      const observer = new MutationObserver(function () {
        if (txModal.classList.contains('open')) {
          queueMicrotask(syncFollowupNumber);
        }
      });
      observer.observe(txModal, { attributes: true, attributeFilter: ['class'] });
    }

    /*
     * The current main form validator accepts digits only for this legacy field.
     * Before it reads the value, briefly provide the base digits. A DB trigger
     * writes the canonical <transaction-no>-1 value for follow-up status.
     */
    if (txForm) {
      txForm.addEventListener('submit', function () {
        if (status.value !== 'تحتاج إلحاقي') return;
        const base = String(txNumber.value || '').trim();
        if (!base) return;
        letterNumber.value = base;
        setTimeout(function () {
          if (status.value === 'تحتاج إلحاقي' && txModal?.classList.contains('open')) {
            letterNumber.value = followupNumber();
          }
        }, 0);
      }, true);
    }

    syncFollowupNumber();
  });
}
