(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LegalReportShare = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function buildFilename(date = new Date()) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `legal-open-transactions-${year}-${month}-${day}.pdf`;
  }

  async function shareOrDownload({ file, navigatorRef, documentRef, urlRef }) {
    if (navigatorRef.share && navigatorRef.canShare?.({ files: [file] })) {
      try {
        await navigatorRef.share({ files: [file], title: 'تقرير متابعة المعاملات' });
        return 'shared';
      } catch (error) {
        if (error?.name === 'AbortError') return 'cancelled';
        if (error?.name !== 'NotAllowedError') throw error;
      }
    }

    const href = urlRef.createObjectURL(file);
    const link = documentRef.createElement('a');
    link.href = href;
    link.download = file.name;
    documentRef.body.appendChild(link);
    link.click();
    link.remove();
    urlRef.revokeObjectURL(href);
    return 'downloaded';
  }

  return { buildFilename, shareOrDownload };
});
