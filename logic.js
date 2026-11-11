/* Casa Hoy — lógica de fechas, tareas y formato. Sin DOM, testeable con Node. */
const CasaLogic = (() => {
  'use strict';

  const DAY_MS = 86400000;
  const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const MEALS = [
    { key: 'desayuno', label: 'Desayuno', icon: '☕' },
    { key: 'almuerzo', label: 'Almuerzo', icon: '🍲' },
    { key: 'cena', label: 'Cena', icon: '🌙' }
  ];
  const SHOP_CATEGORIES = ['Abarrotes', 'Frescos', 'Lácteos', 'Limpieza', 'Baño', 'Otros'];
  const EXPENSE_CATEGORIES = ['Súper', 'Casa', 'Salud', 'Transporte', 'Ocio', 'Otros'];
  const FREQUENCIES = [
    { key: 'diaria', label: 'Todos los días' },
    { key: 'semanal', label: 'Cada semana' },
    { key: 'mensual', label: 'Cada mes' },
    { key: 'unica', label: 'Una sola vez' }
  ];

  const pad2 = n => String(n).padStart(2, '0');
  const toISO = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const parseISO = iso => {
    const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };
  const todayISO = () => toISO(new Date());
  const addDaysISO = (iso, n) => {
    const d = parseISO(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
  };
  const dayDiff = (fromIso, toIso) => Math.round((parseISO(toIso) - parseISO(fromIso)) / DAY_MS);
  const weekdayIndex = iso => (parseISO(iso).getDay() + 6) % 7; // 0 = lunes
  const weekdayName = iso => WEEKDAYS[weekdayIndex(iso)];
  const monthKey = iso => String(iso).slice(0, 7);

  const capitalize = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  let longFmt, shortFmt, monthFmt, moneyFmt;
  try {
    longFmt = new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
    shortFmt = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short' });
    monthFmt = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' });
    moneyFmt = new Intl.NumberFormat('es-CL', {
      style: 'currency', currency: 'CLP', maximumFractionDigits: 0
    });
  } catch (err) {
    longFmt = shortFmt = monthFmt = null;
    moneyFmt = new Intl.NumberFormat('es-CL');
  }

  const formatLong = date => {
    try { return capitalize(longFmt.format(date)); }
    catch (err) { return toISO(date); }
  };
  const formatShort = iso => {
    try { return shortFmt.format(parseISO(iso)); }
    catch (err) { return iso; }
  };
  const formatMonth = ym => {
    try { return capitalize(monthFmt.format(parseISO(`${ym}-01`))); }
    catch (err) { return ym; }
  };
  const money = n => {
    const value = Math.round(Number(n) || 0);
    try { return moneyFmt.format(value); }
    catch (err) { return '$' + value.toLocaleString('es-CL'); }
  };
  const parseAmount = raw => {
    if (typeof raw === 'number') return Math.round(raw);
    const cleaned = String(raw || '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    const value = Number.parseFloat(cleaned);
    return Number.isFinite(value) ? Math.round(value) : NaN;
  };

  const shiftMonth = (ym, delta) => {
    const [y, m] = String(ym).split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  };
  const currentMonth = () => monthKey(todayISO());

  /** Fecha en que la tarea vuelve a estar disponible, o null si es única. */
  const nextDue = task => {
    if (!task || !task.lastDone) return null;
    switch (task.freq) {
      case 'diaria': return addDaysISO(task.lastDone, 1);
      case 'semanal': return addDaysISO(task.lastDone, 7);
      case 'mensual': {
        const d = parseISO(task.lastDone);
        const next = new Date(d.getFullYear(), d.getMonth() + 1, d.getDate());
        return toISO(next);
      }
      default: return null; // única: ya no vuelve
    }
  };

  const isDoneToday = (task, today = todayISO()) => Boolean(task && task.lastDone === today);

  const isDue = (task, today = todayISO()) => {
    if (!task) return false;
    if (isDoneToday(task, today)) return false;
    if (!task.lastDone) return true;
    switch (task.freq) {
      case 'diaria': return true;
      case 'semanal': return dayDiff(task.lastDone, today) >= 7;
      case 'mensual': return monthKey(task.lastDone) !== monthKey(today);
      default: return false;
    }
  };

  /** Texto corto de estado para la lista de tareas. */
  const dueLabel = (task, today = todayISO()) => {
    if (!task) return '';
    if (task.freq === 'unica') {
      return isDoneToday(task, today) ? 'Completada' : 'Pendiente';
    }
    if (isDoneToday(task, today)) {
      const next = nextDue(task);
      if (!next) return 'Lista por hoy';
      const wait = dayDiff(today, next);
      if (wait <= 1) return 'Lista por hoy · vuelve mañana';
      if (task.freq === 'mensual') return 'Lista por hoy · vuelve el próximo mes';
      return `Lista por hoy · vuelve el ${formatShort(next)}`;
    }
    if (isDue(task, today)) {
      if (!task.lastDone) return 'Pendiente';
      const late = dayDiff(nextDue(task), today);
      if (late > 0) return `Pendiente · atrasada ${late} ${late === 1 ? 'día' : 'días'}`;
      return 'Pendiente';
    }
    const next = nextDue(task);
    if (!next) return 'Completada';
    const wait = dayDiff(today, next);
    if (wait === 1) return 'Vuelve mañana';
    if (wait <= 6) return `Vuelve en ${wait} días`;
    return `Vuelve el ${formatShort(next)}`;
  };

  const frequencyLabel = key => {
    const found = FREQUENCIES.find(f => f.key === key);
    return found ? found.label : 'Todos los días';
  };

  /** normaliza el plan semanal a un objeto por día */
  const normalizeWeekPlan = raw => {
    const plan = (raw && typeof raw === 'object') ? raw : {};
    const out = {};
    for (let i = 0; i < 7; i += 1) {
      const day = plan[i] && typeof plan[i] === 'object' ? plan[i] : {};
      out[i] = {
        desayuno: typeof day.desayuno === 'string' ? day.desayuno : '',
        almuerzo: typeof day.almuerzo === 'string' ? day.almuerzo : '',
        cena: typeof day.cena === 'string' ? day.cena : ''
      };
    }
    return out;
  };

  const monthlyTotals = (expenses, ym) => {
    const list = (Array.isArray(expenses) ? expenses : []).filter(e => monthKey(e.date) === ym);
    const total = list.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const byCategory = {};
    list.forEach(e => {
      const cat = e.category || 'Otros';
      byCategory[cat] = (byCategory[cat] || 0) + (Number(e.amount) || 0);
    });
    return { list, total, byCategory, count: list.length };
  };

  const api = {
    DAY_MS, WEEKDAYS, MEALS, SHOP_CATEGORIES, EXPENSE_CATEGORIES, FREQUENCIES,
    toISO, parseISO, todayISO, addDaysISO, dayDiff, weekdayIndex, weekdayName, monthKey,
    formatLong, formatShort, formatMonth, money, parseAmount, shiftMonth, currentMonth,
    nextDue, isDoneToday, isDue, dueLabel, frequencyLabel, normalizeWeekPlan, monthlyTotals
  };

  if (typeof globalThis !== 'undefined') globalThis.CasaLogic = api;
  return api;
})();

if (typeof module !== 'undefined' && module.exports) module.exports = CasaLogic;
