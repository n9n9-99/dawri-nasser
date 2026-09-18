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

  return { resetViewport, setModalOpen };
});
