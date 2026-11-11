/* Casa Hoy · interfaz y persistencia local */
(function () {
  'use strict';

  const L = window.CasaLogic;
  const KEY = 'casa-hoy.v1';
  const VIEWS = ['hoy', 'compras', 'tareas', 'comidas', 'gastos'];
  const CIRCUMFERENCE = 100.53; // 2π × r16

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  let storageOk = true;
  let toastTimer = null;
  let lastRenderedDay = '';

  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  const uid = () => {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  };

  const isISODate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const oneOrMany = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const capitalizeFirst = text => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

  let miniDateFormatter = null;
  try {
    miniDateFormatter = new Intl.DateTimeFormat('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch (err) { miniDateFormatter = null; }

  const formatMiniDate = date => {
    try { return capitalizeFirst(miniDateFormatter.format(date)); }
    catch (err) { return capitalizeFirst(L.formatShort(L.toISO(date))); }
  };

  /* ---------------- datos ---------------- */

  function makeTask(title, freq) {
    return { id: uid(), title, freq, person: '', lastDone: null };
  }

  function defaultState(withExamples) {
    return {
      version: 1,
      shopping: [],
      tasks: withExamples ? [
        makeTask('Sacar la basura', 'diaria'),
        makeTask('Regar las plantas', 'semanal'),
        makeTask('Limpiar el baño', 'semanal'),
        makeTask('Cambiar las sábanas', 'semanal')
      ] : [],
      meals: L.normalizeWeekPlan({}),
      expenses: [],
      notes: [],
      ui: { view: 'hoy', expenseMonth: L.currentMonth() }
    };
  }

  function normalizeState(data) {
    const base = defaultState(false);
    const list = value => (Array.isArray(value) ? value : []);

    const shopping = list(data.shopping).map(item => {
      if (!item || typeof item !== 'object') return null;
      const name = typeof item.name === 'string' ? item.name.trim() : '';
      if (!name) return null;
      return {
        id: typeof item.id === 'string' && item.id ? item.id : uid(),
        name,
        qty: typeof item.qty === 'string' ? item.qty.slice(0, 16) : '',
        category: L.SHOP_CATEGORIES.includes(item.category) ? item.category : 'Otros',
        done: Boolean(item.done),
        createdAt: Number(item.createdAt) || Date.now()
      };
    }).filter(Boolean);

    const tasks = list(data.tasks).map(item => {
      if (!item || typeof item !== 'object') return null;
      const title = typeof item.title === 'string' ? item.title.trim() : '';
      if (!title) return null;
      const freq = L.FREQUENCIES.some(f => f.key === item.freq) ? item.freq : 'diaria';
      return {
        id: typeof item.id === 'string' && item.id ? item.id : uid(),
        title,
        freq,
        person: typeof item.person === 'string' ? item.person.slice(0, 40) : '',
        lastDone: isISODate(item.lastDone) ? item.lastDone : null
      };
    }).filter(Boolean);

    const expenses = list(data.expenses).map(item => {
      if (!item || typeof item !== 'object') return null;
      const desc = typeof item.desc === 'string' ? item.desc.trim() : '';
      const amount = Number(item.amount);
      if (!desc || !Number.isFinite(amount) || amount <= 0) return null;
      return {
        id: typeof item.id === 'string' && item.id ? item.id : uid(),
        desc,
        amount: Math.round(amount),
        category: L.EXPENSE_CATEGORIES.includes(item.category) ? item.category : 'Otros',
        date: isISODate(item.date) ? item.date : L.todayISO(),
        createdAt: Number(item.createdAt) || Date.now()
      };
    }).filter(Boolean);

    const notes = list(data.notes).map(item => {
      if (!item || typeof item !== 'object') return null;
      const text = typeof item.text === 'string' ? item.text.trim() : '';
      if (!text) return null;
      const rawDue = typeof item.dueAt === 'string' ? item.dueAt : '';
      const dueAt = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(rawDue) ? rawDue : null;
      return {
        id: typeof item.id === 'string' && item.id ? item.id : uid(),
        text,
        dueAt,
        done: Boolean(item.done),
        notifiedAt: Number(item.notifiedAt) || null,
        createdAt: Number(item.createdAt) || Date.now()
      };
    }).filter(Boolean);

    const ui = (data.ui && typeof data.ui === 'object') ? data.ui : {};
    const expenseMonth = typeof ui.expenseMonth === 'string' && /^\d{4}-\d{2}$/.test(ui.expenseMonth)
      ? ui.expenseMonth : base.ui.expenseMonth;

    return {
      version: 1,
      shopping,
      tasks,
      meals: L.normalizeWeekPlan(data.meals),
      expenses,
      notes,
      ui: {
        view: VIEWS.includes(ui.view) ? ui.view : 'hoy',
        expenseMonth
      }
    };
  }

  function loadState() {
    let raw = null;
    try {
      raw = window.localStorage.getItem(KEY);
    } catch (err) {
      storageOk = false;
      return defaultState(true);
    }
    if (!raw) return defaultState(true);
    try {
      return normalizeState(JSON.parse(raw));
    } catch (err) {
      return defaultState(true);
    }
  }

  let state = loadState();

  function save() {
    if (!storageOk) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch (err) {
      storageOk = false;
      toast('El navegador no permite guardar. Abre la app con iniciar.command.');
    }
  }

  /* ---------------- avisos ---------------- */

  function toast(message) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { el.hidden = true; }, 3200);
  }

  /* ---------------- recordatorios y avisos ---------------- */

  function updateNotifyUI() {
    const status = $('#notify-status');
    const button = $('#notify-enable');
    if (!status || !button) return;

    if (!('Notification' in window)) {
      status.textContent = 'Este navegador no permite avisos. Puedes exportar al calendario.';
      button.hidden = true;
      return;
    }
    if (Notification.permission === 'granted') {
      status.textContent = 'Avisos activados mientras la app esté abierta.';
      button.hidden = true;
    } else if (Notification.permission === 'denied') {
      status.textContent = 'Los avisos están bloqueados en el navegador. Usa el calendario.';
      button.hidden = true;
    } else {
      status.textContent = 'Activa los avisos para que la app te avise mientras está abierta.';
      button.hidden = false;
    }
  }

  function fireNotification(note) {
    toast(`⏰ ${note.text}`);
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const title = 'Casa Hoy · Recordatorio';
    const options = {
      body: note.text,
      icon: 'icons/icon-192.png',
      badge: 'icons/favicon-32.png',
      tag: `casa-hoy-${note.id}`
    };
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready
          .then(registration => registration.showNotification(title, options))
          .catch(() => { try { new Notification(title, options); } catch (err) { /* sin notificación */ } });
        return;
      }
    } catch (err) { /* seguir con Notification */ }
    try { new Notification(title, options); } catch (err) { /* el aviso queda en el toast */ }
  }

  function checkReminders() {
    if (document.hidden) return;
    const now = new Date();
    const due = state.notes.filter(note => L.isReminderDue(note, now) && !note.notifiedAt);
    if (!due.length) return;
    due.forEach(note => {
      note.notifiedAt = Date.now();
      fireNotification(note);
    });
    save();
    renderHoy();
  }

  async function enableNotifications() {
    if (!('Notification' in window)) {
      toast('Este navegador no permite avisos. Usa la exportación al calendario.');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      updateNotifyUI();
      if (permission === 'granted') toast('Avisos activados. Te avisaré mientras la app esté abierta.');
      else if (permission === 'denied') toast('Avisos bloqueados. Puedes usar la exportación al calendario.');
      else toast('No se activaron los avisos.');
    } catch (err) {
      toast('No se pudieron activar los avisos.');
    }
  }

  function downloadICS(notes) {
    const dated = (Array.isArray(notes) ? notes : []).filter(note => note && note.dueAt);
    if (!dated.length) {
      toast('Ese recordatorio no tiene fecha.');
      return;
    }
    try {
      const content = L.buildICS(dated);
      const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'casa-hoy-recordatorios.ics';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast('Calendario descargado. Ábrelo para añadir el recordatorio.');
    } catch (err) {
      toast('No se pudo generar el calendario.');
    }
  }

  function toggleNote(id) {
    const note = state.notes.find(item => item.id === id);
    if (!note) return;
    note.done = !note.done;
    save();
    renderAll();
  }

  /* ---------------- piezas de interfaz ---------------- */

  function emptyHTML(text, view, cta) {
    const action = view && cta
      ? ` <button class="link" type="button" data-goto="${view}">${esc(cta)}</button>`
      : '';
    return `<p class="empty">${text}${action}</p>`;
  }

  function taskRow(task, today, options) {
    const opts = options || {};
    const done = L.isDoneToday(task, today);
    const meta = [];
    if (opts.showFrequency !== false) meta.push(esc(L.frequencyLabel(task.freq)));
    if (task.person) meta.push(esc(task.person));
    meta.push(esc(L.dueLabel(task, today)));
    const remove = opts.showDelete
      ? `<button class="row-delete" type="button" data-action="delete-task" data-id="${esc(task.id)}" aria-label="Eliminar ${esc(task.title)}" title="Eliminar">×</button>`
      : '';
    return `
      <div class="row${done ? ' done' : ''}">
        <input class="check" type="checkbox" data-action="toggle-task" data-id="${esc(task.id)}"
          ${done ? 'checked' : ''} aria-label="${done ? 'Marcar como pendiente' : 'Marcar como hecha'}: ${esc(task.title)}">
        <div class="row-main">
          <div class="row-title">${esc(task.title)}</div>
          <div class="row-meta">${meta.join(' · ')}</div>
        </div>
        ${remove}
      </div>`;
  }

  function shopRow(item, showDelete) {
    const remove = showDelete
      ? `<button class="row-delete" type="button" data-action="delete-shop" data-id="${esc(item.id)}" aria-label="Quitar ${esc(item.name)}" title="Quitar">×</button>`
      : '';
    return `
      <div class="row${item.done ? ' done' : ''}">
        <input class="check" type="checkbox" data-action="toggle-shop" data-id="${esc(item.id)}"
          ${item.done ? 'checked' : ''} aria-label="${item.done ? 'Volver a pendientes' : 'Marcar como comprado'}: ${esc(item.name)}">
        <div class="row-main">
          <div class="row-title">${esc(item.name)}</div>
        </div>
        ${item.qty ? `<span class="qty-badge">${esc(item.qty)}</span>` : ''}
        ${remove}
      </div>`;
  }

  /* ---------------- render: encabezado y hoy ---------------- */

  function renderHeader() {
    const now = new Date();
    const hour = now.getHours();
    $('#greeting').textContent = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
    $('#hoy-title').textContent = L.formatLong(now);
    $('#header-date').textContent = formatMiniDate(now);
    $('#today-summary').textContent = summaryText(now);
  }

  function summaryText() {
    const today = L.todayISO();
    const now = new Date();
    const due = state.tasks.filter(t => L.isDue(t, today));
    const shopping = state.shopping.filter(i => !i.done);
    const dueReminders = state.notes.filter(n => L.isReminderDue(n, now));
    const parts = [];
    if (due.length) parts.push(oneOrMany(due.length, 'tarea', 'tareas'));
    if (shopping.length) parts.push(oneOrMany(shopping.length, 'compra', 'compras'));
    if (dueReminders.length) {
      parts.push(`${oneOrMany(dueReminders.length, 'recordatorio', 'recordatorios')} ${dueReminders.length === 1 ? 'te toca' : 'te tocan'}`);
    }
    if (!parts.length) return 'Todo al día en casa. Disfruta el día.';
    return `${parts.join(' · ')}.`;
  }

  function renderHoy() {
    const today = L.todayISO();

    const tasks = state.tasks.filter(t => L.isDue(t, today) || L.isDoneToday(t, today));
    const doneToday = tasks.filter(t => L.isDoneToday(t, today));
    const pendingShopping = state.shopping.filter(item => !item.done);
    const pct = tasks.length ? Math.round((doneToday.length / tasks.length) * 100) : 0;
    const fill = $('#hero-ring-fill');
    if (fill) {
      fill.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - pct / 100));
      $('#hero-ring-label').textContent = tasks.length ? `${pct}%` : '—';
    }

    // tareas de hoy
    const taskBox = $('#hoy-tareas');
    if (!tasks.length) {
      taskBox.innerHTML = emptyHTML('No hay tareas para hoy.', 'tareas', 'Agregar una');
    } else {
      const sorted = tasks.slice().sort((a, b) => {
        const doneA = L.isDoneToday(a, today) ? 1 : 0;
        const doneB = L.isDoneToday(b, today) ? 1 : 0;
        return doneA - doneB || a.title.localeCompare(b.title, 'es');
      });
      taskBox.innerHTML = sorted.slice(0, 6).map(t => taskRow(t, today, { showFrequency: false, showDelete: false })).join('');
      if (sorted.length > 6) taskBox.innerHTML += emptyHTML(`y ${oneOrMany(sorted.length - 6, 'tarea más', 'tareas más')}.`, 'tareas', 'Ver todas');
    }

    // compras
    const shopBox = $('#hoy-compras');
    if (!pendingShopping.length) {
      const doneCount = state.shopping.length;
      shopBox.innerHTML = emptyHTML(
        doneCount ? 'No falta nada: todas las compras están hechas.' : 'La lista de compras está vacía.',
        'compras', doneCount ? 'Ver lista' : 'Crear lista'
      );
    } else {
      const sorted = pendingShopping.slice().sort((a, b) => a.createdAt - b.createdAt);
      shopBox.innerHTML = sorted.slice(0, 5).map(item => shopRow(item, false)).join('');
      if (sorted.length > 5) {
        shopBox.innerHTML += emptyHTML(`y ${oneOrMany(sorted.length - 5, 'producto más', 'productos más')}.`, 'compras', 'Abrir lista');
      }
    }

    // comidas
    const dayIndex = L.weekdayIndex(today);
    const plan = state.meals[dayIndex] || { desayuno: '', almuerzo: '', cena: '' };
    if (!plan.desayuno && !plan.almuerzo && !plan.cena) {
      $('#hoy-comidas').innerHTML = emptyHTML('Aún no hay menú para hoy.', 'comidas', 'Planificar la semana');
    } else {
      $('#hoy-comidas').innerHTML = L.MEALS.map(meal => {
        const value = (plan[meal.key] || '').trim();
        return `<div class="meal-row">
          <span class="meal-label"><span class="meal-dot meal-dot--${meal.key}"></span>${meal.label}</span>
          <span class="meal-value${value ? '' : ' empty'}">${value ? esc(value) : 'Sin planificar'}</span>
        </div>`;
      }).join('');
    }

    // gastos
    const month = L.monthlyTotals(state.expenses, L.currentMonth());
    const todayTotal = state.expenses
      .filter(e => e.date === today)
      .reduce((sum, e) => sum + e.amount, 0);
    $('#hoy-gastos').innerHTML = `
      <div class="big-number">${L.money(month.total)}</div>
      <p class="peek-note"><strong>${L.money(todayTotal)}</strong> hoy · ${oneOrMany(month.count, 'movimiento', 'movimientos')} este mes</p>`;

    // recordatorios
    const now = new Date();
    $('#notes-count').textContent = String(state.notes.filter(n => !n.done).length);
    const icsButton = $('#ics-export');
    if (icsButton) icsButton.hidden = !state.notes.some(n => n.dueAt && !n.done);

    const notesBox = $('#notes-list');
    if (!state.notes.length) {
      notesBox.innerHTML = emptyHTML('Sin recordatorios. Puedes ponerles fecha y hora para que te avisen.');
    } else {
      const sorted = state.notes.slice().sort((a, b) => {
        if (Boolean(a.done) !== Boolean(b.done)) return a.done ? 1 : -1;
        const aDate = L.reminderDate(a);
        const bDate = L.reminderDate(b);
        if (aDate && bDate) return aDate - bDate;
        if (aDate) return -1;
        if (bDate) return 1;
        return b.createdAt - a.createdAt;
      });

      notesBox.innerHTML = sorted.map(note => {
        const due = L.isReminderDue(note, now);
        const when = L.reminderWhen(note, now);
        const calendarIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>';
        const calendarButton = note.dueAt
          ? `<button class="row-icon" type="button" data-action="ics-note" data-id="${esc(note.id)}" aria-label="Añadir al calendario" title="Añadir al calendario">${calendarIcon}</button>`
          : '';
        return `
          <div class="row${note.done ? ' done' : ''}${due ? ' is-due' : ''}">
            <input class="check" type="checkbox" data-action="toggle-note" data-id="${esc(note.id)}"
              ${note.done ? 'checked' : ''} aria-label="${note.done ? 'Marcar como pendiente' : 'Marcar como hecho'}: ${esc(note.text)}">
            <div class="row-main">
              <div class="row-title">${esc(note.text)}</div>
              <div class="row-meta">
                ${when ? `<span>${esc(when)}</span>` : '<span>Sin fecha</span>'}
                ${due ? '<span class="pill pill-due">Te toca</span>' : ''}
              </div>
            </div>
            ${calendarButton}
            <button class="row-delete" type="button" data-action="delete-note" data-id="${esc(note.id)}" aria-label="Eliminar recordatorio" title="Eliminar">×</button>
          </div>`;
      }).join('');
    }
  }

  /* ---------------- render: compras ---------------- */

  function renderCompras() {
    const pending = state.shopping.filter(item => !item.done);
    const done = state.shopping.filter(item => item.done);

    $('#compras-resumen').textContent = state.shopping.length
      ? `${oneOrMany(pending.length, 'pendiente', 'pendientes')} · ${oneOrMany(done.length, 'comprado', 'comprados')}`
      : 'Todo lo que falta en casa, en un solo lugar.';

    const box = $('#shop-list');
    if (!state.shopping.length) {
      box.innerHTML = `<div class="card">${emptyHTML('Tu lista está vacía. Agrega el primer producto arriba.')}</div>`;
      return;
    }

    let html = '';
    L.SHOP_CATEGORIES.forEach(category => {
      const items = pending
        .filter(item => item.category === category)
        .sort((a, b) => a.createdAt - b.createdAt);
      if (!items.length) return;
      html += `<section class="shop-group">
        <h4>${esc(category)}</h4>
        ${items.map(item => shopRow(item, true)).join('')}
      </section>`;
    });

    if (done.length) {
      html += `<section class="shop-group done">
        <h4>Comprados</h4>
        ${done.slice().sort((a, b) => b.createdAt - a.createdAt).map(item => shopRow(item, true)).join('')}
      </section>`;
    }

    box.innerHTML = html || `<div class="card">${emptyHTML('No queda nada pendiente. Buena compra.')}</div>`;
  }

  /* ---------------- render: tareas ---------------- */

  function renderTareas() {
    const today = L.todayISO();
    const due = state.tasks.filter(t => L.isDue(t, today));
    const doneToday = state.tasks.filter(t => L.isDoneToday(t, today));

    $('#tareas-resumen').textContent = state.tasks.length
      ? `${oneOrMany(due.length, 'pendiente', 'pendientes')} · ${oneOrMany(doneToday.length, 'hecha', 'hechas')} hoy · ${oneOrMany(state.tasks.length, 'tarea', 'tareas')} en total`
      : 'Marca una tarea y vuelve cuando toque. Se repiten solas.';

    const box = $('#task-list');
    if (!state.tasks.length) {
      box.innerHTML = emptyHTML('Aún no hay tareas. Prueba con “sacar la basura” todos los días o “limpiar el baño” cada semana.');
      return;
    }

    const sorted = state.tasks.slice().sort((a, b) => {
      const rank = task => (L.isDue(task, today) ? 0 : L.isDoneToday(task, today) ? 1 : 2);
      return rank(a) - rank(b) || a.title.localeCompare(b.title, 'es');
    });

    box.innerHTML = sorted.map(task => taskRow(task, today, { showDelete: true })).join('');
  }

  /* ---------------- render: comidas ---------------- */

  function renderComidas() {
    const todayIndex = L.weekdayIndex(L.todayISO());
    $('#week-grid').innerHTML = L.WEEKDAYS.map((day, index) => {
      const plan = state.meals[index] || { desayuno: '', almuerzo: '', cena: '' };
      const isToday = index === todayIndex;
      const meals = L.MEALS.map(meal => `
        <div class="meal-field">
          <label for="meal-${index}-${meal.key}"><span class="meal-dot meal-dot--${meal.key}"></span>${meal.label}</label>
          <textarea id="meal-${index}-${meal.key}" data-day="${index}" data-meal="${meal.key}" rows="2"
            placeholder="Idea…" maxlength="80">${esc(plan[meal.key] || '')}</textarea>
        </div>`).join('');
      return `<div class="day-card${isToday ? ' is-today' : ''}">
        <h4>${esc(day)}${isToday ? '<span class="today-dot" aria-label="Hoy"></span>' : ''}</h4>
        ${meals}
      </div>`;
    }).join('');
  }

  /* ---------------- render: gastos ---------------- */

  function renderGastos() {
    const ym = state.ui.expenseMonth;
    $('#exp-month-label').textContent = L.formatMonth(ym);
    $('#exp-count').textContent = '0';

    const totals = L.monthlyTotals(state.expenses, ym);
    const summary = $('#exp-summary');

    if (!totals.count) {
      summary.innerHTML = `
        <div class="summary-total">${L.money(0)}</div>
        <p class="summary-sub">Sin movimientos en ${esc(L.formatMonth(ym))}. Anota el primero arriba.</p>`;
    } else {
      const categories = Object.entries(totals.byCategory).sort((a, b) => b[1] - a[1]);
      const bars = categories.map(([name, amount]) => {
        const width = Math.max(2, Math.round((amount / totals.total) * 100));
        return `<div class="cat-bar">
          <div class="cat-bar-head">
            <span class="cat-name">${esc(name)}</span>
            <span class="cat-amount">${L.money(amount)}</span>
          </div>
          <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${width}%"></div></div>
        </div>`;
      }).join('');
      summary.innerHTML = `
        <div class="summary-total">${L.money(totals.total)}</div>
        <p class="summary-sub">${oneOrMany(totals.count, 'movimiento', 'movimientos')} en ${esc(L.formatMonth(ym))}</p>
        <div class="cat-bars">${bars}</div>`;
    }

    $('#exp-count').textContent = String(totals.count);

    const list = $('#exp-list');
    if (!totals.count) {
      list.innerHTML = emptyHTML('Sin movimientos este mes.');
      return;
    }

    const rows = totals.list.slice().sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return b.createdAt - a.createdAt;
    });

    list.innerHTML = rows.map(expense => `
      <div class="row">
        <div class="row-main">
          <div class="row-title">${esc(expense.desc)}</div>
          <div class="row-meta">${esc(L.formatShort(expense.date))} <span class="dot">·</span> ${esc(expense.category)}</div>
        </div>
        <span class="exp-amount">${L.money(expense.amount)}</span>
        <button class="row-delete" type="button" data-action="delete-expense" data-id="${esc(expense.id)}" aria-label="Eliminar gasto" title="Eliminar">×</button>
      </div>`).join('');
  }

  /* ---------------- navegación ---------------- */

  function setView(view, persist) {
    const target = VIEWS.includes(view) ? view : 'hoy';
    state.ui.view = target;
    if (persist !== false) save();
    try { window.history.replaceState(null, '', '#' + target); } catch (err) { /* file:// sin historial */ }

    $$('.tab').forEach(tab => {
      const active = tab.dataset.view === target;
      tab.classList.toggle('is-active', active);
      if (active) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    });

    VIEWS.forEach(name => {
      const section = document.getElementById('view-' + name);
      if (!section) return;
      const active = name === target;
      section.hidden = !active;
      section.classList.toggle('is-active', active);
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------------- render general ---------------- */

  function renderAll() {
    lastRenderedDay = L.todayISO();
    updateNotifyUI();
    renderHeader();
    renderHoy();
    renderCompras();
    renderTareas();
    renderComidas();
    renderGastos();
  }

  /* ---------------- acciones ---------------- */

  function toggleTask(id) {
    const task = state.tasks.find(item => item.id === id);
    if (!task) return;
    const today = L.todayISO();
    task.lastDone = task.lastDone === today ? null : today;
    save();
    renderAll();
  }

  function deleteTask(id) {
    const task = state.tasks.find(item => item.id === id);
    if (!task) return;
    state.tasks = state.tasks.filter(item => item.id !== id);
    save();
    renderAll();
    toast('Tarea eliminada.');
  }

  function toggleShopping(id) {
    const item = state.shopping.find(entry => entry.id === id);
    if (!item) return;
    item.done = !item.done;
    save();
    renderAll();
  }

  function deleteShopping(id) {
    state.shopping = state.shopping.filter(entry => entry.id !== id);
    save();
    renderAll();
  }

  function deleteNote(id) {
    state.notes = state.notes.filter(note => note.id !== id);
    save();
    renderAll();
  }

  function deleteExpense(id) {
    state.expenses = state.expenses.filter(expense => expense.id !== id);
    save();
    renderAll();
    toast('Gasto eliminado.');
  }

  /* ---------------- eventos ---------------- */

  function onClick(event) {
    const goto = event.target.closest('[data-goto]');
    if (goto) {
      setView(goto.dataset.goto);
      return;
    }

    const action = event.target.closest('[data-action]');
    if (!action) return;
    const id = action.dataset.id;
    switch (action.dataset.action) {
      case 'toggle-task': toggleTask(id); break;
      case 'delete-task': deleteTask(id); break;
      case 'toggle-shop': toggleShopping(id); break;
      case 'delete-shop': deleteShopping(id); break;
      case 'toggle-note': toggleNote(id); break;
      case 'delete-note': deleteNote(id); break;
      case 'ics-note': {
        const note = state.notes.find(item => item.id === id);
        if (note) downloadICS([note]);
        break;
      }
      case 'delete-expense': deleteExpense(id); break;
      default: break;
    }
  }

  function onSubmitNote(event) {
    event.preventDefault();
    const input = $('#note-input');
    const text = input.value.trim();
    if (!text) return;

    const dateInput = $('#note-date');
    const timeInput = $('#note-time');
    const date = dateInput.value;
    const time = timeInput.value;
    const dueAt = date ? `${date}T${time || L.DEFAULT_REMINDER_TIME}` : null;

    state.notes.push({
      id: uid(),
      text,
      dueAt,
      done: false,
      notifiedAt: null,
      createdAt: Date.now()
    });
    save();
    input.value = '';
    dateInput.value = '';
    timeInput.value = '';
    renderAll();
    input.focus();
    toast(dueAt ? 'Recordatorio guardado con fecha y hora.' : 'Recordatorio guardado.');
    if (dueAt) window.setTimeout(checkReminders, 150);
  }

  function onSubmitShopping(event) {
    event.preventDefault();
    const nameInput = $('#shop-name');
    const qtyInput = $('#shop-qty');
    const categorySelect = $('#shop-cat');
    const name = nameInput.value.trim();
    if (!name) return;
    const category = categorySelect.value;
    state.shopping.push({
      id: uid(),
      name,
      qty: qtyInput.value.trim(),
      category,
      done: false,
      createdAt: Date.now()
    });
    save();
    nameInput.value = '';
    qtyInput.value = '';
    nameInput.focus();
    renderAll();
  }

  function onSubmitTask(event) {
    event.preventDefault();
    const titleInput = $('#task-title');
    const title = titleInput.value.trim();
    if (!title) return;
    state.tasks.push({
      id: uid(),
      title,
      freq: $('#task-freq').value,
      person: $('#task-person').value.trim(),
      lastDone: null
    });
    save();
    titleInput.value = '';
    $('#task-person').value = '';
    titleInput.focus();
    renderAll();
  }

  function onSubmitExpense(event) {
    event.preventDefault();
    const descInput = $('#exp-desc');
    const amountInput = $('#exp-amount');
    const desc = descInput.value.trim();
    const amount = L.parseAmount(amountInput.value);
    if (!desc) return;
    if (!Number.isFinite(amount) || amount <= 0) {
      toast('Escribe un monto válido, por ejemplo 12500.');
      amountInput.focus();
      return;
    }
    state.expenses.push({
      id: uid(),
      desc,
      amount,
      category: $('#exp-cat').value,
      date: L.todayISO(),
      createdAt: Date.now()
    });
    // si estaba mirando otro mes, volvemos al mes actual para ver el gasto
    state.ui.expenseMonth = L.currentMonth();
    save();
    descInput.value = '';
    amountInput.value = '';
    descInput.focus();
    renderAll();
    toast('Gasto anotado.');
  }

  function onMealInput(event) {
    const input = event.target.closest('[data-meal]');
    if (!input) return;
    const day = input.dataset.day;
    const meal = input.dataset.meal;
    if (!state.meals[day]) state.meals[day] = { desayuno: '', almuerzo: '', cena: '' };
    state.meals[day][meal] = input.value.trim();
    save();
  }

  function onMealChange(event) {
    if (!event.target.closest('[data-meal]')) return;
    renderHoy();
  }

  function clearMeals() {
    const hasContent = Object.values(state.meals).some(day =>
      day && (day.desayuno || day.almuerzo || day.cena));
    if (!hasContent) {
      toast('El menú ya está vacío.');
      return;
    }
    if (!window.confirm('¿Vaciar el menú semanal? Se borran todas las comidas.')) return;
    state.meals = L.normalizeWeekPlan({});
    save();
    renderAll();
    toast('Menú vaciado.');
  }

  function shiftExpenseMonth(delta) {
    state.ui.expenseMonth = L.shiftMonth(state.ui.expenseMonth, delta);
    save();
    renderGastos();
  }

  function exportData() {
    try {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `casa-hoy-${L.todayISO()}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast('Copia exportada. Guárdala donde quieras.');
    } catch (err) {
      toast('No se pudo exportar la copia.');
    }
  }

  function importData(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!data || typeof data !== 'object' || !Array.isArray(data.shopping) || !Array.isArray(data.tasks)) {
          throw new Error('formato');
        }
        state = normalizeState(data);
        save();
        renderAll();
        setView(state.ui.view, false);
        toast('Copia importada correctamente.');
      } catch (err) {
        toast('Ese archivo no parece una copia de Casa Hoy.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  function resetData() {
    if (!window.confirm('¿Borrar todas las tareas, compras, comidas, gastos y recordatorios? No se puede deshacer.')) return;
    state = defaultState(false);
    try { window.localStorage.removeItem(KEY); } catch (err) { /* sin almacenamiento */ }
    save();
    renderAll();
    setView('hoy', false);
    toast('Datos borrados.');
  }

  /* ---------------- inicio ---------------- */

  function populateSelects() {
    $('#shop-cat').innerHTML = L.SHOP_CATEGORIES
      .map(cat => `<option value="${esc(cat)}">${esc(cat)}</option>`).join('');
    $('#task-freq').innerHTML = L.FREQUENCIES
      .map(freq => `<option value="${esc(freq.key)}">${esc(freq.label)}</option>`).join('');
    $('#exp-cat').innerHTML = L.EXPENSE_CATEGORIES
      .map(cat => `<option value="${esc(cat)}">${esc(cat)}</option>`).join('');
  }

  function bindEvents() {
    $$('.tab').forEach(tab => {
      tab.addEventListener('click', () => setView(tab.dataset.view));
    });
    document.addEventListener('click', onClick);

    $('#note-form').addEventListener('submit', onSubmitNote);
    $('#shop-form').addEventListener('submit', onSubmitShopping);
    $('#task-form').addEventListener('submit', onSubmitTask);
    $('#exp-form').addEventListener('submit', onSubmitExpense);

    $('#week-grid').addEventListener('input', onMealInput);
    $('#week-grid').addEventListener('change', onMealChange);
    $('#meals-clear').addEventListener('click', clearMeals);

    $('#shop-clear').addEventListener('click', () => {
      const done = state.shopping.filter(item => item.done);
      if (!done.length) {
        toast('No hay compras marcadas como hechas.');
        return;
      }
      state.shopping = state.shopping.filter(item => !item.done);
      save();
      renderAll();
      toast('Compras hechas eliminadas.');
    });

    $('#exp-prev').addEventListener('click', () => shiftExpenseMonth(-1));
    $('#exp-next').addEventListener('click', () => shiftExpenseMonth(1));

    $('#export-btn').addEventListener('click', exportData);
    $('#import-file').addEventListener('change', importData);
    $('#reset-btn').addEventListener('click', resetData);

    $('#notify-enable').addEventListener('click', enableNotifications);
    $('#ics-export').addEventListener('click', () => downloadICS(state.notes.filter(note => note.dueAt && !note.done)));

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      if (L.todayISO() !== lastRenderedDay) renderAll();
      checkReminders();
    });
    window.setInterval(() => {
      if (!document.hidden) checkReminders();
    }, 30000);
  }

  function init() {
    populateSelects();
    bindEvents();
    renderAll();
    const hashView = (window.location.hash || '').replace('#', '');
    setView(VIEWS.includes(hashView) ? hashView : (state.ui.view || 'hoy'), false);

    updateNotifyUI();
    window.setTimeout(checkReminders, 800);

    if (!storageOk) {
      toast('Sin almacenamiento: tus cambios no se guardarán. Abre la app con iniciar.command.');
    }
  }

  // PWA: cache para abrir sin conexión (solo en localhost o HTTPS)
  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => { /* sin service worker */ });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
