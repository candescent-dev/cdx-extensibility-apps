/**
 * Terminal questions for create-aspect and submit-to-fi (Node 18+, no dependencies).
 *
 *   ask(question, default, error)    one typed answer. On a terminal the default is typed in for you
 *                                    (edit it, or press Enter to keep it). Pass `error` when asking
 *                                    again: the rejected answer is redrawn in place with the error
 *                                    shown above it, and cleared once a valid answer comes in.
 *   choose(question, choices, index) arrow-key menu (choices: [{ label, hint }]); the default is
 *                                    highlighted and marked. Piped input gets a numbered list.
 *   confirm(question, default)       yes/no.
 *   log(message)                     a line between questions (use it instead of console.log while
 *                                    asking, so a redraw knows how many lines to go back).
 *   settle()                         finishes any redraw before other output.
 *
 * Piped input (not a terminal) gets plain lines, with `[default]` hints and Enter for the default.
 */
import { emitKeypressEvents } from 'node:readline';
import { createInterface } from 'node:readline/promises';

const plain = Boolean(process.env.NO_COLOR);
const RED = (s) => (plain ? s : `\x1b[31m${s}\x1b[0m`);
const CYAN = (s) => (plain ? s : `\x1b[36m${s}\x1b[0m`);
const DIM = (s) => (plain ? s : `\x1b[2m${s}\x1b[0m`);
// eslint-disable-next-line no-control-regex
const visible = (s) => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');

/**
 * Arrow-key menu: up/down (or j/k, or the option number) moves, Enter picks. Resolves to the picked
 * index. Each line is cut to the terminal width so redrawing stays in place.
 */
export function select(
  question,
  choices,
  { input = process.stdin, output = process.stdout, initial = 0, marked } = {},
) {
  const width = Math.max((output.columns || 80) - 1, 20);
  const line = (c, n, on) => {
    const tag = n === marked ? ' (default)' : '';
    const text = `${on ? '> ' : '  '}${c.label}${tag}${c.hint ? ` - ${c.hint}` : ''}`;
    const cut = text.length > width ? `${text.slice(0, width - 1)}…` : text;
    return on ? CYAN(cut) : cut;
  };
  let i = Math.min(Math.max(initial, 0), choices.length - 1);
  const draw = (again) => {
    if (again) output.write(`\x1b[${choices.length}A`);
    for (const [n, c] of choices.entries())
      output.write(`\x1b[2K${line(c, n, n === i)}\n`);
  };
  output.write(`${question} ${DIM('(arrow keys, Enter to pick)')}\n`);
  draw(false);
  emitKeypressEvents(input);
  input.setRawMode?.(true);
  input.resume();
  return new Promise((done, fail) => {
    const finish = () => {
      input.off('keypress', onKey);
      input.setRawMode?.(false);
      input.pause();
    };
    function onKey(str, key = {}) {
      if (key.ctrl && key.name === 'c') {
        finish();
        fail(Object.assign(new Error('Cancelled.'), { cancelled: true }));
      } else if (key.name === 'return' || key.name === 'enter') {
        finish();
        output.write(`\x1b[${choices.length + 1}A\x1b[J`);
        output.write(
          `${question}${/[?:]$/.test(question) ? '' : ':'} ${choices[i].label}\n`,
        );
        done(i);
      } else {
        const n = Number(str);
        if (key.name === 'up' || key.name === 'k')
          i = (i - 1 + choices.length) % choices.length;
        else if (key.name === 'down' || key.name === 'j')
          i = (i + 1) % choices.length;
        else if (n >= 1 && n <= choices.length) i = n - 1;
        else return;
        draw(true);
      }
    }
    input.on('keypress', onKey);
  });
}

export function createPrompter({
  input = process.stdin,
  output = process.stdout,
  cancelMessage = 'Cancelled.',
} = {}) {
  const tty = Boolean(input.isTTY && output.isTTY);
  const cancelError = () =>
    Object.assign(new Error(cancelMessage), { cancelled: true });
  // Piped input: one reader for the whole run, with lines queued, because a script often sends
  // every answer at once. Each answer is echoed so the log reads like a terminal session.
  const queued = [];
  let waiting = null;
  let ended = false;
  let piped = null;
  const nextLine = (prompt) => {
    if (!piped) {
      piped = createInterface({ input, terminal: false });
      piped.on('line', (line) => {
        if (waiting) {
          waiting.resolve(line);
          waiting = null;
        } else queued.push(line);
      });
      piped.on('close', () => {
        ended = true;
        waiting?.reject(
          new Error('Input ended before every question was answered.'),
        );
        waiting = null;
      });
    }
    output.write(prompt);
    const echo = (line) => {
      output.write(`${line}\n`);
      return line;
    };
    if (queued.length) return Promise.resolve(echo(queued.shift()));
    if (ended)
      return Promise.reject(
        new Error('Input ended before every question was answered.'),
      );
    return new Promise((resolve, reject) => {
      waiting = { resolve: (l) => resolve(echo(l)), reject };
    });
  };

  // The last answered question, the error shown above it and the lines logged since.
  let last = null;
  let since = [];

  const rows = (text) =>
    String(text)
      .split('\n')
      .reduce(
        (n, line) =>
          n +
          Math.max(1, Math.ceil(visible(line).length / (output.columns || 80))),
        0,
      );
  // A typed line takes one more row when it fills the width exactly: readline moves the cursor to
  // the next row, where a printed line ending in a newline does not.
  const answerRows = (text) =>
    Math.floor(visible(String(text)).length / (output.columns || 80)) + 1;
  const back = (n) => n && output.write(`\x1b[${n}A\r\x1b[J`);
  const linesSince = () => since.reduce((n, l) => n + rows(l), 0);

  /** Removes the error above the last answered question once that answer was accepted. */
  function settle() {
    if (!tty || !last?.errorRows) return;
    back(last.errorRows + answerRows(last.prompt + last.answer) + linesSince());
    output.write(`${last.prompt}${last.answer}\n`);
    for (const line of since) output.write(`${line}\n`);
    last.errorRows = 0;
  }

  function log(message = '') {
    settle();
    output.write(`${message}\n`);
    if (last) since.push(String(message));
  }

  async function ask(question, def = '', error) {
    // On a terminal the default is typed in, so the prompt shows no [default] hint.
    const prompt = `${question}${!tty && def ? ` [${def}]` : ''}: `;
    let errorRows = 0;
    // Only a repeat of the question just answered is redrawn; any other error is printed above.
    if (error && tty && last?.prompt === prompt) {
      back(
        last.errorRows + answerRows(last.prompt + last.answer) + linesSince(),
      );
      const text = RED(`  ✖ ${error}`);
      output.write(`${text}\n`);
      errorRows = rows(text);
    } else {
      settle();
      if (error)
        output.write(tty ? `${RED(`  ✖ ${error}`)}\n` : `  ${error}\n`);
    }
    since = [];
    let answer;
    if (!tty) answer = (await nextLine(prompt)).trim();
    else {
      // A reader per question leaves the keyboard free for menus in between.
      const rl = createInterface({ input, output });
      let cancelled = false;
      rl.on('SIGINT', () => {
        cancelled = true;
        rl.close();
      });
      answer = await new Promise((resolve, reject) => {
        const onClose = () =>
          reject(
            cancelled
              ? cancelError()
              : new Error('Input ended before every question was answered.'),
          );
        rl.once('close', onClose);
        rl.question(prompt).then((a) => {
          rl.off('close', onClose);
          resolve(a.trim());
        }, reject);
        if (def) rl.write(def);
      });
      rl.close();
    }
    last = { prompt, answer, errorRows };
    // On a terminal an emptied default means "no value"; piped input uses the default for Enter.
    return tty ? answer : answer || def;
  }

  async function choose(question, choices, defaultIndex = 0) {
    settle();
    if (!tty) {
      choices.forEach((c, n) =>
        output.write(
          `  ${n + 1}. ${c.label}${n === defaultIndex ? ' (default)' : ''}${
            c.hint ? ` - ${c.hint}` : ''
          }\n`,
        ),
      );
      let error;
      for (;;) {
        const answer = await ask(question, String(defaultIndex + 1), error);
        const n = Number(answer);
        if (Number.isInteger(n) && n >= 1 && n <= choices.length) return n - 1;
        error = `Enter a number from 1 to ${choices.length}.`;
      }
    }
    let picked;
    try {
      picked = await select(question, choices, {
        input,
        output,
        initial: defaultIndex,
        marked: defaultIndex,
      });
    } catch (e) {
      throw e.cancelled ? cancelError() : e;
    }
    last = {
      prompt: `${question}: `,
      answer: choices[picked].label,
      errorRows: 0,
    };
    since = [];
    return picked;
  }

  async function confirm(question, def = false) {
    return (
      (await choose(
        question,
        [{ label: 'Yes' }, { label: 'No' }],
        def ? 0 : 1,
      )) === 0
    );
  }

  return {
    tty,
    ask,
    choose,
    confirm,
    log,
    settle,
    close: () => {
      settle();
      piped?.close();
    },
  };
}
