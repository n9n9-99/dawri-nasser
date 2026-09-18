(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.UmmAlQuraCalendar = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ARABIC_DIGITS = /[\u0660-\u0669\u06F0-\u06F9]/;
  const MONTH_NAMES = [
    'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
    'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
  ];
  const formatter = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
    timeZone: 'Asia/Riyadh', year: 'numeric', month: 'numeric', day: 'numeric'
  });

  function parts(date) {
    const values = {};
    for (const part of formatter.formatToParts(date)) {
      if (part.type === 'year' || part.type === 'month' || part.type === 'day') {
        values[part.type] = Number(part.value);
      }
    }
    return values;
  }

  function formatHijri(year, month, day) {
    return String(year).padStart(4, '0') + '/' +
      String(month).padStart(2, '0') + '/' + String(day).padStart(2, '0');
  }

  function toGregorian(year, month, day) {
    const estimatedYear = Math.floor(year * 0.970224 + 621.5774);
    const cursor = new Date(Date.UTC(estimatedYear - 1, 0, 1, 12));
    for (let i = 0; i < 800; i += 1) {
      const current = parts(cursor);
      if (current.year === year && current.month === month && current.day === day) {
        return cursor.toISOString().slice(0, 10);
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return null;
  }

  function normalizeHijri(value) {
    const text = String(value || '').trim();
    if (ARABIC_DIGITS.test(text) || !/^[0-9]{4}\/[0-9]{2}\/[0-9]{2}$/.test(text)) return null;
    const [year, month, day] = text.split('/').map(Number);
    if (month < 1 || month > 12 || day < 1 || day > 30) return null;
    return toGregorian(year, month, day) ? formatHijri(year, month, day) : null;
  }

  function shiftMonth(year, month, amount) {
    const absolute = year * 12 + (month - 1) + amount;
    return { year: Math.floor(absolute / 12), month: ((absolute % 12) + 12) % 12 + 1 };
  }

  function buildMonth(year, month) {
    const firstGregorian = toGregorian(year, month, 1);
    if (!firstGregorian) throw new RangeError('التاريخ خارج نطاق تقويم أم القرى المدعوم');
    const days = [];
    const cursor = new Date(firstGregorian + 'T12:00:00Z');
    for (let day = 1; day <= 30; day += 1) {
      const current = parts(cursor);
      if (current.year !== year || current.month !== month) break;
      days.push({
        day,
        hijri: formatHijri(year, month, day),
        gregorian: cursor.toISOString().slice(0, 10),
        weekday: cursor.getUTCDay()
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return { year, month, monthName: MONTH_NAMES[month - 1], days };
  }

  return { buildMonth, formatHijri, normalizeHijri, shiftMonth, toGregorian };
});
