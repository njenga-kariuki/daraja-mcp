const ts = () => new Date().toISOString();

const color = (c, s) => `\x1b[${c}m${s}\x1b[0m`;

export const logger = {
  info: (...a) => console.log(color(36, `[${ts()}] INFO `), ...a),
  warn: (...a) => console.warn(color(33, `[${ts()}] WARN `), ...a),
  error: (...a) => console.error(color(31, `[${ts()}] ERROR`), ...a),
  debug: (...a) => {
    if (process.env.DEBUG) console.log(color(90, `[${ts()}] DEBUG`), ...a);
  },
};
