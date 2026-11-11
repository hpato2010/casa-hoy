# 🏡 Casa Hoy

Una micro app para el día a día en casa: lista de compras, tareas que se repiten solas, menú semanal, gastos del mes y recordatorios. Todo en una sola pantalla, sin cuentas, sin internet y sin instalar nada.

![Vista de Hoy](capturas/hoy-desktop.png)

*Vista de Hoy con datos de ejemplo.*

## Cómo abrirla

**Opción recomendada (macOS):** haz doble clic en `iniciar.command`. Se abre el navegador en `http://127.0.0.1:8765/` (o el siguiente puerto libre) y la app queda servida localmente. Deja esa ventana de Terminal abierta mientras la usas; ciérrala o pulsa `Ctrl+C` para detener.

**Opción directa:** abre `index.html` con Chrome o Firefox. Funciona sin servidor, pero algunos navegadores (Safari, por ejemplo) no permiten guardar datos en archivos locales. Si eso pasa, usa `iniciar.command`.

No necesita conexión a internet. Los datos quedan en el almacenamiento local del navegador de este dispositivo.

## Verla en el celular

### Misma Wi-Fi (rápido, sin publicar nada)

1. Haz doble clic en `servir-en-red.command`. La ventana mostrará una dirección como `http://192.168.1.7:8765/`.
2. Conecta el celular a la misma red Wi-Fi y abre esa dirección en Safari (iPhone) o Chrome (Android).
3. Para dejarla a mano:
   - **iPhone:** Safari → botón Compartir → **Añadir a pantalla de inicio**.
   - **Android:** Chrome → menú ⋮ → **Añadir a pantalla de inicio** (o «Instalar app» si el navegador lo ofrece).

Limitaciones de esta opción: el Mac debe estar encendido y en la misma red, y el atajo no funciona sin conexión. Para que funcione de verdad como app instalada y sin internet, publícala con HTTPS (ver abajo).

### Instalación real con HTTPS (funciona sin el Mac)

La app es 100 % estática, así que puedes publicar la carpeta en cualquier hosting gratuito con HTTPS, por ejemplo GitHub Pages, Netlify o Cloudflare Pages. Luego:

1. Abre la URL publicada en el navegador del celular.
2. iPhone: Compartir → **Añadir a pantalla de inicio**. Android: menú ⋮ → **Instalar app**.
3. Los datos se guardan en el teléfono, igual que en el computador; usa «Exportar copia» si quieres pasarlos de un dispositivo a otro.

Incluye `manifest.webmanifest`, `sw.js` e iconos para que el navegador la reconozca como app instalable y funcione sin conexión después de la primera visita.

## Qué puedes hacer

- **Hoy** — resumen del día: tareas pendientes, compras, comidas y total gastado del mes. El anillo muestra el avance de las tareas de hoy.
- **Compras** — lista agrupada por categoría, con cantidades. Marca lo comprado y limpia la lista con un clic.
- **Tareas** — se repiten según su frecuencia (diaria, semanal, mensual o una sola vez). Al marcarlas, calculan solas cuándo vuelven y avisan si están atrasadas.
- **Comidas** — menú semanal de desayuno, almuerzo y cena. Se repite cada semana y el día de hoy queda resaltado.
- **Gastos** — registro rápido en pesos chilenos, total del mes y desglose por categoría. Puedes navegar entre meses.
- **Recordatorios** — notas rápidas para lo que no quieres olvidar.
- **Copias de seguridad** — exporta todo a un archivo `.json` e impórtalo cuando quieras (por ejemplo, al cambiar de navegador).

## Detalles útiles

- Cada sección tiene su propio enlace directo: `index.html#compras`, `#tareas`, `#comidas`, `#gastos`.
- Los montos se escriben como en Chile: `12.500` o `12500`.
- La app parte con cuatro tareas de ejemplo; puedes editarlas o borrarlas. El botón «Borrar todo» deja la app como nueva (sin ejemplos).
- Funciona en modo claro y oscuro según el sistema, y se adapta a celular.

## Estructura

```
casa-hoy/
├── index.html         · estructura de la app
├── styles.css         · diseño responsive y modo oscuro
├── logic.js           · fechas, recurrencias y formato (sin DOM)
├── app.js             · interfaz, eventos y guardado local
├── test-logic.js      · pruebas de la lógica (Node)
├── iniciar.command    · lanzador local para macOS
├── servir-en-red.command · lanzador para verla desde el celular en la misma Wi-Fi
├── manifest.webmanifest · datos de app instalable (PWA)
├── sw.js              · caché para funcionar sin conexión
├── icons/             · iconos de la app
└── capturas/          · vistas de referencia
```

## Pruebas

La lógica de fechas y recurrencias tiene pruebas automáticas:

```bash
node test-logic.js
```

## Privacidad

Nada sale de tu computador: no hay analítica, ni cuentas, ni peticiones a servidores. Todo se guarda con `localStorage` en tu navegador. Si borras los datos del navegador, se pierde la información; por eso conviene exportar una copia de vez en cuando.
