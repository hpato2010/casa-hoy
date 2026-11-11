/* Pruebas de la lógica de Casa Hoy. Ejecutar: node test-logic.js */
const assert = require('node:assert/strict');
const L = require('./logic.js');

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed += 1; console.log(`  ok  ${name}`); }
  catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

console.log('Casa Hoy · pruebas de lógica');

test('toISO / parseISO conservan el día local', () => {
  assert.equal(L.toISO(new Date(2026, 10, 9)), '2026-11-09');
  assert.equal(L.parseISO('2026-11-09').getDate(), 9);
  assert.equal(L.parseISO('2026-01-01').getMonth(), 0);
});

test('addDaysISO cruza fin de mes y de año', () => {
  assert.equal(L.addDaysISO('2026-01-31', 1), '2026-02-01');
  assert.equal(L.addDaysISO('2026-12-31', 1), '2027-01-01');
  assert.equal(L.addDaysISO('2026-03-01', -1), '2026-02-28');
});

test('weekdayIndex empieza en lunes', () => {
  assert.equal(L.weekdayIndex('2026-11-09'), 0); // lunes
  assert.equal(L.weekdayIndex('2026-11-15'), 6); // domingo
  assert.equal(L.weekdayName('2026-11-09'), 'Lunes');
});

test('tarea diaria vence si no se hizo hoy', () => {
  const t = { freq: 'diaria', lastDone: '2026-11-08' };
  assert.equal(L.isDue(t, '2026-11-09'), true);
  assert.equal(L.isDue({ ...t, lastDone: '2026-11-09' }, '2026-11-09'), false);
});

test('tarea semanal espera 7 días', () => {
  const t = { freq: 'semanal', lastDone: '2026-11-02' };
  assert.equal(L.isDue(t, '2026-11-08'), false);
  assert.equal(L.isDue(t, '2026-11-09'), true);
  assert.equal(L.nextDue(t), '2026-11-09');
});

test('tarea mensual espera cambio de mes', () => {
  const t = { freq: 'mensual', lastDone: '2026-11-09' };
  assert.equal(L.isDue(t, '2026-11-30'), false);
  assert.equal(L.isDue(t, '2026-12-01'), true);
  assert.equal(L.nextDue(t), '2026-12-09');
});

test('tarea única no vuelve a vencer', () => {
  const t = { freq: 'unica', lastDone: '2026-11-09' };
  assert.equal(L.isDue(t, '2026-12-01'), false);
  assert.equal(L.nextDue(t), null);
  assert.equal(L.dueLabel(t, '2026-11-09'), 'Completada');
});

test('una tarea nunca hecha está pendiente', () => {
  const t = { freq: 'semanal', lastDone: null };
  assert.equal(L.isDue(t, '2026-11-09'), true);
  assert.equal(L.dueLabel(t, '2026-11-09'), 'Pendiente');
});

test('dueLabel describe el estado con naturalidad', () => {
  const today = '2026-11-09';
  assert.equal(L.dueLabel({ freq: 'diaria', lastDone: today }, today), 'Lista por hoy · vuelve mañana');
  assert.equal(L.dueLabel({ freq: 'semanal', lastDone: '2026-11-03' }, today), 'Vuelve mañana');
  assert.equal(L.dueLabel({ freq: 'semanal', lastDone: '2026-11-06' }, today), 'Vuelve en 4 días');
  assert.equal(L.dueLabel({ freq: 'semanal', lastDone: '2026-10-31' }, today), 'Pendiente · atrasada 2 días');
});

test('parseAmount acepta formatos chilenos', () => {
  assert.equal(L.parseAmount('12.500'), 12500);
  assert.equal(L.parseAmount('$ 12.500'), 12500);
  assert.equal(L.parseAmount('12500'), 12500);
  assert.equal(L.parseAmount('12,5'), 13);
  assert.ok(Number.isNaN(L.parseAmount('abc')));
});

test('monthlyTotals filtra por mes y suma por categoría', () => {
  const expenses = [
    { date: '2026-11-01', amount: 10000, category: 'Súper' },
    { date: '2026-11-08', amount: 5000, category: 'Casa' },
    { date: '2026-10-31', amount: 9999, category: 'Súper' }
  ];
  const res = L.monthlyTotals(expenses, '2026-11');
  assert.equal(res.total, 15000);
  assert.equal(res.count, 2);
  assert.equal(res.byCategory['Súper'], 10000);
  assert.equal(res.byCategory['Casa'], 5000);
});

test('shiftMonth navega entre meses y años', () => {
  assert.equal(L.shiftMonth('2026-01', -1), '2025-12');
  assert.equal(L.shiftMonth('2026-12', 1), '2027-01');
});

test('normalizeWeekPlan rellena los siete días y las tres comidas', () => {
  const plan = L.normalizeWeekPlan({ 0: { almuerzo: 'Lentejas' } });
  assert.equal(Object.keys(plan).length, 7);
  assert.equal(plan[0].almuerzo, 'Lentejas');
  assert.equal(plan[0].desayuno, '');
  assert.equal(plan[6].cena, '');
});

console.log(`\n${passed} pruebas correctas${process.exitCode ? ' · hay fallos' : ''}`);
