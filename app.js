/*
 * How a Java debugger works - interactive animation (plain JavaScript).
 *
 * Idea: the run of the Java program is pre-computed as a list of "stops"
 * (TRACE). Every debugger button only decides WHICH stop comes next:
 *   Step Into -> the very next stop
 *   Step Over -> next stop that is NOT deeper in the call stack
 *   Step Out  -> next stop that is shallower in the call stack
 *   Continue  -> next stop on a line that has a breakpoint
 * The animation shows the messages the IDE and the JVM exchange (JDWP).
 */
'use strict';

/* ------------------------------------------------------------------ */
/* 1. The program being debugged                                       */
/* ------------------------------------------------------------------ */
const CODE = [
  '<span class="kw">public class</span> <span class="ty">Main</span> {',
  '    <span class="kw">static</span> <span class="ty">int</span> <span class="fn">factorial</span>(<span class="ty">int</span> n) {',
  '        <span class="kw">if</span> (n &lt;= <span class="num">1</span>) {',
  '            <span class="kw">return</span> <span class="num">1</span>;',
  '        }',
  '        <span class="kw">return</span> n * <span class="fn">factorial</span>(n - <span class="num">1</span>);',
  '    }',
  '',
  '    <span class="kw">public static void</span> <span class="fn">main</span>(<span class="ty">String</span>[] args) {',
  '        <span class="ty">int</span> x = <span class="num">3</span>;',
  '        <span class="ty">int</span> result = <span class="fn">factorial</span>(x);',
  '        System.out.<span class="fn">println</span>(result);',
  '    }',
  '}',
];
const EXECUTABLE = new Set([3, 4, 6, 10, 11, 12, 13]); // lines where a breakpoint makes sense

/* ------------------------------------------------------------------ */
/* 2. The recorded run (one entry per place where the JVM can stop)    */
/* ------------------------------------------------------------------ */
// A stack frame: method name, current line, local variables [type, name, value]
const F = (n, line) => ({ fn: 'factorial', line, vars: [['int', 'n', n]] });
const M = (line, x, result) => ({
  fn: 'main', line,
  vars: [['String[]', 'args', 'String[0]'], ['int', 'x', x], ['int', 'result', result]],
});
// stack[0] is the TOP of the stack (the method that is running now).
// "mid" = we returned into the middle of a line: a breakpoint does not fire there.
const TRACE = [
  { line: 10, stack: [M(10)] },
  { line: 11, stack: [M(11, 3)] },
  { line: 3,  stack: [F(3, 3), M(11, 3)] },
  { line: 6,  stack: [F(3, 6), M(11, 3)] },
  { line: 3,  stack: [F(2, 3), F(3, 6), M(11, 3)] },
  { line: 6,  stack: [F(2, 6), F(3, 6), M(11, 3)] },
  { line: 3,  stack: [F(1, 3), F(2, 6), F(3, 6), M(11, 3)] },
  { line: 4,  stack: [F(1, 4), F(2, 6), F(3, 6), M(11, 3)] },
  { line: 6,  stack: [F(2, 6), F(3, 6), M(11, 3)], ret: 1, mid: true },
  { line: 6,  stack: [F(3, 6), M(11, 3)],          ret: 2, mid: true },
  { line: 11, stack: [M(11, 3)],                   ret: 6, mid: true },
  { line: 12, stack: [M(12, 3, 6)] },
  { line: 13, stack: [M(13, 3, 6)] },
  { line: null, stack: [] }, // program finished
];
const END = TRACE.length - 1;
const NOT_STARTED = -1;

/* ------------------------------------------------------------------ */
/* 3. Texts (Spanish / English)                                        */
/* ------------------------------------------------------------------ */
const TXT = {
  es: {
    title: 'Cómo funciona un depurador de Java',
    lead: 'Pulsa «Depurar» y avanza paso a paso, o deja que la demo automática te lo explique. Haz clic en un número de línea para poner o quitar un punto de interrupción.',
    autoStart: '▶ Demo automática', autoStop: '⏸ Pausar demo',
    archTitle: '1. Quién habla con quién',
    ideName: 'IDE (depurador)', ideSub: 'Tu pantalla: botones, variables y pila',
    jvmName: 'JVM', jvmSub: 'Ejecuta tu programa',
    cmdIntro: 'El programa se lanza en modo depuración. La JVM abre el puerto 5005 y espera al IDE:',
    ideTitle: '2. El código y los controles',
    bDebug: 'Depurar', bContinue: 'Continuar', bStop: 'Detener',
    bpLabel: 'Punto de interrupción en la línea',
    varsTitle: 'Variables', stackTitle: 'Pila de llamadas (call stack)', consoleTitle: 'Consola',
    retVal: 'Valor devuelto',
    notStarted: 'Programa sin iniciar.', ended: 'El programa ha terminado.',
    stackHint: 'Haz clic en un marco para ver sus variables.',
    footer: 'Hecho con HTML, CSS y JavaScript puros. Los mensajes del cable son una simplificación de JDWP (Java Debug Wire Protocol).',
    status: { idle: 'No iniciada', running: 'Ejecutando…', suspended: 'Suspendida (en pausa)', ended: 'Terminada' },
    notes: {
      debug: 'Depurar: se lanza la JVM con el agente JDWP, el IDE se conecta y la JVM corre hasta el primer punto de interrupción.',
      continue: 'Continuar: la JVM se reanuda y corre hasta el siguiente punto de interrupción (o hasta el final).',
      over: 'Step Over: ejecuta la línea completa, incluidas las llamadas a métodos que contenga.',
      into: 'Step Into: si la línea llama a un método, entra en él; si no, pasa a la línea siguiente.',
      out: 'Step Out: ejecuta hasta terminar el método actual y vuelve a quien lo llamó.',
    },
    idle: 'El programa aún no se está ejecutando. Pulsa «Depurar»: la JVM se detendrá en el punto de interrupción rojo de la línea 10, antes de ejecutarla.',
    state: [
      'Parada en la línea 10, antes de ejecutarla. x y result ya existen, pero aún no tienen valor.',
      'La línea 10 se ejecutó: x vale 3. Ahora toca la línea 11, que llama a factorial(x).',
      'Estamos dentro de factorial: hay un marco nuevo en la pila con n = 3. Con Step Over nos habríamos saltado esta llamada.',
      'n vale 3, así que n <= 1 es falso y salta al return de la línea 6. Para calcularlo necesita factorial(2).',
      'Llamada recursiva: otro marco nuevo en la pila, ahora con n = 2. Cada llamada tiene sus propias variables.',
      'La condición vuelve a ser falsa. Para calcular 2 * factorial(1) hace falta otra llamada.',
      'Tercer marco de factorial, con n = 1. Ya hay 4 marcos en la pila: tres de factorial y uno de main.',
      'Ahora n <= 1 es verdadero: es el caso base y va a devolver 1.',
      'factorial(1) terminó y su marco desapareció de la pila. Devolvió 1. Seguimos en factorial(2), que calcula 2 * 1.',
      'factorial(2) devolvió 2. Seguimos en factorial(3), que calcula 3 * 2.',
      'factorial(3) devolvió 6. Estamos de vuelta en main: la línea 11 aún debe guardar el resultado en result.',
      'result vale 6. Lo siguiente es imprimirlo por la consola.',
      'Se imprimió 6 en la consola. Solo queda salir de main.',
      'El programa terminó y la JVM se desconectó del depurador. Pulsa «Depurar» para repetir.',
    ],
  },
  en: {
    title: 'How a Java debugger works',
    lead: 'Press "Debug" and step through the program, or let the automatic demo explain it. Click a line number to set or remove a breakpoint.',
    autoStart: '▶ Automatic demo', autoStop: '⏸ Pause demo',
    archTitle: '1. Who talks to whom',
    ideName: 'IDE (debugger)', ideSub: 'Your screen: buttons, variables and stack',
    jvmName: 'JVM', jvmSub: 'Runs your program',
    cmdIntro: 'The program is launched in debug mode. The JVM opens port 5005 and waits for the IDE:',
    ideTitle: '2. The code and the controls',
    bDebug: 'Debug', bContinue: 'Continue', bStop: 'Stop',
    bpLabel: 'Breakpoint on line',
    varsTitle: 'Variables', stackTitle: 'Call stack', consoleTitle: 'Console',
    retVal: 'Return value',
    notStarted: 'Program not started.', ended: 'The program has finished.',
    stackHint: 'Click a frame to see its variables.',
    footer: 'Made with plain HTML, CSS and JavaScript. The messages on the wire are a simplification of JDWP (Java Debug Wire Protocol).',
    status: { idle: 'Not started', running: 'Running…', suspended: 'Suspended (paused)', ended: 'Finished' },
    notes: {
      debug: 'Debug: the JVM is launched with the JDWP agent, the IDE connects and the JVM runs until the first breakpoint.',
      continue: 'Continue: the JVM resumes and runs until the next breakpoint (or until the end).',
      over: 'Step Over: runs the whole line, including any method calls it contains.',
      into: 'Step Into: if the line calls a method, it goes inside; otherwise it moves to the next line.',
      out: 'Step Out: runs until the current method finishes and returns to its caller.',
    },
    idle: 'The program is not running yet. Press "Debug": the JVM will stop at the red breakpoint on line 10, before running it.',
    state: [
      'Stopped at line 10, before running it. x and result exist, but they have no value yet.',
      'Line 10 ran: x is 3. Next is line 11, which calls factorial(x).',
      'We are inside factorial: a new frame is on the stack with n = 3. With Step Over we would have skipped this call.',
      'n is 3, so n <= 1 is false and execution jumps to the return on line 6. To compute it, it needs factorial(2).',
      'Recursive call: another new frame on the stack, now with n = 2. Every call has its own variables.',
      'The condition is false again. To compute 2 * factorial(1) another call is needed.',
      'Third factorial frame, with n = 1. The stack now has 4 frames: three of factorial and one of main.',
      'Now n <= 1 is true: this is the base case and it will return 1.',
      'factorial(1) finished and its frame left the stack. It returned 1. We are back in factorial(2), which computes 2 * 1.',
      'factorial(2) returned 2. We are back in factorial(3), which computes 3 * 2.',
      'factorial(3) returned 6. We are back in main: line 11 still has to store the result in result.',
      'result is 6. Next it will be printed to the console.',
      '6 was printed to the console. Only the exit from main is left.',
      'The program finished and the JVM disconnected from the debugger. Press "Debug" to start again.',
    ],
  },
};

/* ------------------------------------------------------------------ */
/* 4. State                                                            */
/* ------------------------------------------------------------------ */
const S = {
  lang: 'es',
  i: NOT_STARTED,          // index of the current stop in TRACE
  sel: 0,                  // selected stack frame (0 = top)
  bp: new Set([10]),       // lines with a breakpoint
  busy: false,             // true while a message travels on the wire
  jvm: 'idle',
  note: '',                // key of the button that was just pressed (explained in the narration)
  snap: new Map(),         // variable values of the previous stop (to flash changes)
  changed: new Set(),
  prevLen: 0,              // stack size of the previous stop (to animate new frames)
  logLines: [],
  auto: null,              // automatic demo handle
};

const $ = (id) => document.getElementById(id);
const t = (key) => TXT[S.lang][key];
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, reduced ? 0 : ms));
const cur = () => (S.i === NOT_STARTED ? null : TRACE[S.i]);

/* ------------------------------------------------------------------ */
/* 5. Which stop comes next? (the heart of the debugger logic)         */
/* ------------------------------------------------------------------ */
function nextIndex(kind, from) {
  const depth = (k) => (k === NOT_STARTED ? 0 : TRACE[k].stack.length);
  for (let j = from + 1; j <= END; j++) {
    if (kind === 'into') return j;
    if (kind === 'over' && depth(j) <= depth(from)) return j;
    if (kind === 'out' && depth(j) < depth(from)) return j;
    if (kind === 'continue' && TRACE[j].line && !TRACE[j].mid && S.bp.has(TRACE[j].line)) return j;
  }
  return END; // nothing else to stop at: the program runs to the end
}

/* ------------------------------------------------------------------ */
/* 6. Wire animation (messages IDE <-> JVM)                            */
/* ------------------------------------------------------------------ */
function packet(kind, label) {
  const wireLabel = $('wireLabel');
  wireLabel.textContent = label;
  wireLabel.style.color = kind === 'req' ? 'var(--blue)' : 'var(--green)';
  if (reduced) return Promise.resolve();
  const dot = document.createElement('span');
  dot.className = 'dot ' + kind;
  $('wire').append(dot);
  const [from, to] = kind === 'req' ? ['0%', '100%'] : ['100%', '0%'];
  const anim = dot.animate(
    [{ left: from, opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.85 }, { left: to, opacity: 0 }],
    { duration: 450, easing: 'ease-in-out' }
  );
  return anim.finished.then(() => dot.remove());
}

function log(kind, text) {
  S.logLines.push(`<span class="${kind}">${kind === 'req' ? '→' : '←'} ${text}</span>`);
  S.logLines = S.logLines.slice(-6);
  $('log').innerHTML = S.logLines.join('\n');
}

function setJvm(state) {
  S.jvm = state;
  const el = $('jvmStatus');
  el.className = 'status ' + state;
  el.textContent = t('status')[state];
}

/* ------------------------------------------------------------------ */
/* 7. Actions                                                          */
/* ------------------------------------------------------------------ */
function can(kind) {
  if (S.busy) return false;
  if (kind === 'debug') return S.i === NOT_STARTED || S.i === END;
  if (kind === 'stop') return S.i !== NOT_STARTED;
  return S.i > NOT_STARTED && S.i < END; // continue / over / into / out
}

const REQUEST = {
  debug: 'JDWP-Handshake + VM.Resume',
  continue: 'VM.Resume',
  over: 'EventRequest.Set(STEP, OVER)',
  into: 'EventRequest.Set(STEP, INTO)',
  out: 'EventRequest.Set(STEP, OUT)',
};

async function act(kind) {
  if (!can(kind)) return;
  S.busy = true;
  renderButtons();

  const from = kind === 'debug' ? NOT_STARTED : S.i;
  const how = kind === 'debug' ? 'continue' : kind;
  const to = nextIndex(how, from);
  const prev = cur() && kind !== 'debug' ? cur() : null;

  if (kind === 'debug') { resetView(); setJvm('idle'); renderAll(false); }
  S.note = kind;
  renderNarr();

  // IDE -> JVM: the request
  log('req', REQUEST[kind]);
  await packet('req', REQUEST[kind]);

  // The JVM runs the program for a moment
  setJvm('running');
  await sleep(350);

  // JVM -> IDE: the event that says "I stopped here"
  const line = TRACE[to].line;
  const event = to === END ? 'VM_DEATH' : `${how === 'continue' ? 'BREAKPOINT' : 'STEP'} @ Main.java:${line}`;
  log('evt', event);
  await packet('evt', event);

  // The IDE now knows where the thread stopped
  S.prevLen = prev ? prev.stack.length : 0;
  S.i = to;
  S.sel = 0;
  setJvm(to === END ? 'ended' : 'suspended');
  if (to !== END) log('req', 'ThreadReference.Frames + StackFrame.GetValues');
  computeChanges();
  renderAll(true);

  S.busy = false;
  renderButtons();
}

function resetView() {
  S.i = NOT_STARTED;
  S.sel = 0;
  S.note = '';
  S.snap = new Map();
  S.changed = new Set();
  S.prevLen = 0;
}

function stopProgram() {
  stopAuto();
  if (S.busy || !can('stop')) return;
  log('req', 'VM.Dispose');
  resetView();
  setJvm('idle');
  renderAll(false);
}

// Remember which variables changed since the previous stop, to flash them
function computeChanges() {
  const snap = new Map();
  const st = cur();
  if (st) {
    st.stack.forEach((fr, idx) => {
      const pos = st.stack.length - 1 - idx; // position counted from the bottom of the stack
      fr.vars.forEach(([, name, val]) => snap.set(`${pos}:${name}`, String(val)));
    });
  }
  S.changed = new Set([...snap].filter(([k, v]) => S.snap.get(k) !== v).map(([k]) => k));
  S.snap = snap;
}

function toggleBreakpoint(line) {
  if (!EXECUTABLE.has(line)) return;
  const adding = !S.bp.has(line);
  adding ? S.bp.add(line) : S.bp.delete(line);
  const msg = `EventRequest.${adding ? 'Set' : 'Clear'}(BREAKPOINT, Main:${line})`;
  log('req', msg);
  if (!S.busy) packet('req', msg);
  renderCode();
}

/* ------------------------------------------------------------------ */
/* 8. Rendering                                                        */
/* ------------------------------------------------------------------ */
function renderCode() {
  const st = cur();
  const hl = st && st.stack.length ? st.stack[S.sel].line : null;
  $('code').innerHTML = CODE.map((html, k) => {
    const n = k + 1;
    const on = S.bp.has(n);
    const cls = n === hl ? (S.sel === 0 ? 'current' : 'caller') : '';
    return `<div class="line ${cls}">` +
      `<button type="button" class="bp ${on ? 'on' : ''}" data-line="${n}" aria-pressed="${on}" ` +
      `aria-label="${t('bpLabel')} ${n}" ${EXECUTABLE.has(n) ? '' : 'disabled'}>${n}</button>` +
      `<span class="arrow" aria-hidden="true">${n === hl ? '▶' : ''}</span>` +
      `<code>${html || ' '}</code></div>`;
  }).join('');
}

function renderVars(fresh) {
  const st = cur();
  const box = $('vars');
  if (!st || !st.stack.length) {
    box.innerHTML = `<li class="empty">${t(S.i === END ? 'ended' : 'notStarted')}</li>`;
    return;
  }
  const fr = st.stack[S.sel];
  const pos = st.stack.length - 1 - S.sel;
  let html = '';
  if (S.sel === 0 && st.ret !== undefined) {
    html += `<li class="ret"><span>↩ ${t('retVal')}</span><b>${st.ret}</b></li>`;
  }
  html += fr.vars.map(([type, name, val]) => {
    const changed = fresh && S.changed.has(`${pos}:${name}`);
    const shown = val === undefined ? '<span class="unset">—</span>' : val;
    return `<li class="${changed ? 'changed' : ''}"><span><span class="type">${type}</span>${name}</span><b>${shown}</b></li>`;
  }).join('');
  box.innerHTML = html;
}

function renderStack(fresh) {
  const st = cur();
  const box = $('stack');
  if (!st || !st.stack.length) {
    box.innerHTML = `<li class="empty">${t(S.i === END ? 'ended' : 'notStarted')}</li>`;
    return;
  }
  const n = st.stack.length;
  box.innerHTML = st.stack.map((fr, idx) => {
    const isNew = fresh && (n - 1 - idx) >= S.prevLen;
    return `<li class="frame-item"><button type="button" class="frame ${isNew ? 'enter' : ''}" data-frame="${idx}" ` +
      `aria-pressed="${idx === S.sel}"><span>Main.${fr.fn}()</span><span class="loc">Main.java:${fr.line}</span></button></li>`;
  }).join('') + `<li class="empty">${t('stackHint')}</li>`;
}

function renderConsole() {
  const lines = [];
  if (S.i !== NOT_STARTED) lines.push("Connected to the target VM, address: 'localhost:5005', transport: 'socket'");
  if (S.i >= 12) lines.push('<span class="out">6</span>');
  if (S.i === END) lines.push("Disconnected from the target VM\n\nProcess finished with exit code 0");
  $('console').innerHTML = lines.join('\n');
}

function renderNarr() {
  const msg = S.i === NOT_STARTED ? t('idle') : t('state')[S.i];
  $('narr').innerHTML = (S.note ? `<p class="note">${t('notes')[S.note]}</p>` : '') + `<p>${msg}</p>`;
}

function renderButtons() {
  document.querySelectorAll('[data-act]').forEach((b) => { b.disabled = !can(b.dataset.act); });
  $('autoBtn').textContent = S.auto ? t('autoStop') : t('autoStart');
}

function renderAll(fresh) {
  renderCode();
  renderVars(fresh);
  renderStack(fresh);
  renderConsole();
  renderNarr();
  renderButtons();
  setJvm(S.jvm);
}

function applyLanguage(lang) {
  S.lang = lang;
  document.documentElement.lang = lang;
  document.title = t('title');
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  renderAll(false);
}

/* ------------------------------------------------------------------ */
/* 9. Automatic demo                                                   */
/* ------------------------------------------------------------------ */
const DEMO = ['debug', 'over', 'into', 'into', 'into', 'into', 'into', 'into', 'over', 'out', 'over', 'over', 'over', 'over'];

function stopAuto() {
  if (S.auto) { S.auto.cancelled = true; S.auto = null; renderButtons(); }
}

async function toggleAuto() {
  if (S.auto) { stopAuto(); return; }
  const me = { cancelled: false };
  S.auto = me;
  while (S.busy) await sleep(100);
  if (S.i !== NOT_STARTED) { resetView(); setJvm('idle'); renderAll(false); }
  renderButtons();
  for (const kind of DEMO) {
    if (me.cancelled) return;
    await act(kind);
    await sleep(3000);
  }
  if (S.auto === me) { S.auto = null; renderButtons(); }
}

/* ------------------------------------------------------------------ */
/* 10. Events                                                          */
/* ------------------------------------------------------------------ */
document.querySelector('.toolbar').addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  if (b.dataset.act === 'stop') return stopProgram();
  stopAuto();
  act(b.dataset.act);
});

$('code').addEventListener('click', (e) => {
  const b = e.target.closest('.bp');
  if (b) toggleBreakpoint(Number(b.dataset.line));
});

$('stack').addEventListener('click', (e) => {
  const b = e.target.closest('[data-frame]');
  if (!b) return;
  S.sel = Number(b.dataset.frame);
  renderCode(); renderVars(false); renderStack(false);
});

$('autoBtn').addEventListener('click', toggleAuto);
document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => applyLanguage(b.dataset.lang)));

// Keyboard shortcuts (same as IntelliJ IDEA)
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const kind = { F7: 'into', F8: e.shiftKey ? 'out' : 'over', F9: S.i === NOT_STARTED || S.i === END ? 'debug' : 'continue' }[e.key];
  if (!kind) return;
  e.preventDefault();
  stopAuto();
  act(kind);
});

/* ------------------------------------------------------------------ */
/* 11. Start                                                           */
/* ------------------------------------------------------------------ */
applyLanguage('es');
