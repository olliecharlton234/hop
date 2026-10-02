/* Demo clock. HOP opens at "Friday, 7:04 PM" so the map shows a real Friday night.
   The offset is stored with the demo data, so time keeps moving forward across launches.
   Profile → "Use real time" turns it off. */
let offset = 0;
let realtime = false;

export function demoOffset(): number {
  const real = new Date();
  const t = new Date(real);
  t.setHours(19, 4, 0, 0);
  while (t.getDay() !== 5) t.setDate(t.getDate() + 1);
  return t.getTime() - real.getTime();
}
export const clock = {
  set(o: number) { offset = o || 0; },
  get offset() { return offset; },
  get realtime() { return realtime; },
  setRealtime(v: boolean) { realtime = v; },
};
export const now = () => Date.now() + offset;
