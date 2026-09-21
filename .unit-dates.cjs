// Test reversed date maths (start+finish -> days) and work-order sorting.
const fs = require('fs');
const src = fs.readFileSync('app.js', 'utf8');

function extract(a, b) {
    const i = src.indexOf(a);
    if (i === -1) throw new Error('not found: ' + a);
    return src.slice(i, src.indexOf(b, i));
}

/*
   Non-overlapping ranges, taken straight out of app.js rather than
   duplicated here, so the test cannot drift from the code it tests.

   Each block stops before the next begins, or a `const` would be declared
   twice and the sandbox would throw before a single check ran. The order in
   app.js is: the minutes table, the conversion helpers, the date maths, then
   the work sequence.
*/
const tableBlock = extract('const DEFAULT_TASK_MINUTES = {', 'function minutesToHours');
const helpersBlock = extract('function minutesToHours', 'const WORKING_HOURS_PER_DAY');
const dateBlock = extract('const WORKING_HOURS_PER_DAY', 'const WORK_SEQUENCE = [');
const orderBlock = extract('const WORK_SEQUENCE = [', 'function tasksFromQuote');

const sandbox = `
const localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
${tableBlock}
${helpersBlock}
${dateBlock}
${orderBlock}
return { addWorkingMinutes, workingMinutesBetween, formatDuration, describeDays,
         minutesToWorkingDays, workingDaysToMinutes, minutesForTask, taskDuration, taskDays,
         workOrder, sequenceItems, autoScheduleItems, WORKING_MINUTES_PER_DAY };
`;
const api = new Function(sandbox)();

const results = [];
const check = (name, actual, expected) => results.push({ name, actual, expected, pass: JSON.stringify(actual) === JSON.stringify(expected) });

// ---- start + finish -> duration (the reverse direction) ----
check('Mon-Mon (same day) = 1 day', api.workingMinutesBetween('2026-03-02', '2026-03-02'), 420);
check('Mon-Tue = 2 days', api.workingMinutesBetween('2026-03-02', '2026-03-03'), 840);
check('Mon-Wed = 3 days', api.workingMinutesBetween('2026-03-02', '2026-03-04'), 1260);
check('Mon-Fri = 5 days', api.workingMinutesBetween('2026-03-02', '2026-03-06'), 2100);
// Fri -> Mon spans a weekend: only Friday and Monday are working.
check('Fri-Mon skips weekend = 2 days', api.workingMinutesBetween('2026-03-06', '2026-03-09'), 840);
check('Fri-Fri = 1 day', api.workingMinutesBetween('2026-03-06', '2026-03-06'), 420);
// Fri -> next Fri spans one weekend.
check('Fri-next Fri = 6 days', api.workingMinutesBetween('2026-03-06', '2026-03-13'), 2520);
check('reversed dates still work', api.workingMinutesBetween('2026-03-04', '2026-03-02'), 1260);
check('missing date = 0', api.workingMinutesBetween('', '2026-03-02'), 0);

// ---- round trip: start + days -> finish -> back to the same days ----
const days = [1, 2, 3, 5, 10];
let roundTripFails = 0;
for (const d of days) {
    for (const start of ['2026-03-02', '2026-03-06', '2026-03-09', '2026-03-13']) {
        const finish = api.addWorkingMinutes(start, api.workingDaysToMinutes(d));
        if (api.workingMinutesBetween(start, finish) !== api.workingDaysToMinutes(d)) roundTripFails++;
    }
}
check('days -> finish -> days round-trips', roundTripFails, 0);

// ---- work order ----
const inOrder = [
    'Call-out and inspection',
    'Leak detection',
    'Isolate water',
    'Dig trench for water or sewer pipe',
    'Install new pipe',
    'Install new toilet',
    'Pressure test',
    'Backfill trench',
    'Clean work area',
    'Remove rubble'
];
const ranks = inOrder.map((t, i) => api.workOrder(t, i));
let monotonic = true;
for (let i = 1; i < ranks.length; i++) if (ranks[i] < ranks[i - 1]) monotonic = false;
check('site order ranks increase down the list', monotonic, true);

check('call-out before dig', api.workOrder('Call-out and inspection', 0) < api.workOrder('Dig trench', 0), true);
check('dig before install', api.workOrder('Dig trench', 0) < api.workOrder('Install new toilet', 0), true);
check('install before test', api.workOrder('Install new toilet', 0) < api.workOrder('Pressure test', 0), true);
check('test before clean', api.workOrder('Pressure test', 0) < api.workOrder('Clean work area', 0), true);
check('clean up sorts last', api.workOrder('Remove rubble', 0) >= api.workOrder('Backfill trench', 0), true);
check('unknown task lands mid-sequence', api.workOrder('Frobnicate widget', 0) > api.workOrder('Dig trench', 0) && api.workOrder('Frobnicate widget', 0) < api.workOrder('Pressure test', 0), true);

// ---- auto-schedule packs whole working days ----
// A task carries an explicit duration so these cases do not depend on the
// minutes table, which has its own tests above.
const task = (name, minutes) => ({
    source: 'Manual', task: name, quantity: 1, duration: minutes, days: 0, daysOverridden: false,
    quoteId: '', start: '', startPinned: false, finish: '', owner: '', stage: 'Not started'
});
const plan = (items, anchor) => {
    const list = items.map(([name, minutes]) => task(name, minutes));
    api.autoScheduleItems(list, anchor);
    return list.map(item => ({ task: item.task, start: item.start, finish: item.finish }));
};
const dates = (items, anchor) => plan(items, anchor).map(item => item.start);

// Short jobs share one day rather than each taking a day of its own.
check('three one-hour jobs share a day',
    dates([['a', 60], ['b', 60], ['c', 60]], '2026-03-02'),
    ['2026-03-02', '2026-03-02', '2026-03-02']);

// 4h + 3h exactly fills a 7-hour day; the next job starts the day after.
check('a full day takes no more',
    dates([['a', 240], ['b', 180], ['c', 60]], '2026-03-02'),
    ['2026-03-02', '2026-03-02', '2026-03-03']);

// 4h + 4h cannot both fit, so the second rolls over.
check('an overflowing task rolls to the next day',
    dates([['a', 240], ['b', 240]], '2026-03-02'),
    ['2026-03-02', '2026-03-03']);

// A job longer than a day starts on the anchor day, not the day after.
// 840 minutes is two WHOLE days, so both are used up and the next job has to
// wait for a third - a long job that ends part-way through a day is the case
// below.
check('a 2-day job starts on the anchor day and uses both',
    dates([['a', 840], ['b', 60]], '2026-03-02'),
    ['2026-03-02', '2026-03-04']);

// 900 minutes touches THREE days: two full and an hour on the third. The job
// ends on that third day and the rest of it is free, so the next job joins it
// there rather than starting a fourth.
check('a part-day overhang leaves room on the finish day',
    dates([['a', 900], ['b', 60]], '2026-03-02'),
    ['2026-03-02', '2026-03-04']);

check('900 minutes ends on the third day it touches',
    plan([['a', 900]], '2026-03-02')[0].finish, '2026-03-04');

check('an 8-hour job ends on the second day',
    plan([['a', 480]], '2026-03-02')[0].finish, '2026-03-03');

// Friday work rolls to Monday: a Saturday is never a start date.
check('Friday overflow skips the weekend',
    dates([['a', 240], ['b', 240]], '2026-03-06'),
    ['2026-03-06', '2026-03-09']);

// An empty row is skipped without breaking the chain around it.
check('an empty row does not break the chain',
    dates([['a', 60], ['', 0], ['b', 60]], '2026-03-02'),
    ['2026-03-02', '', '2026-03-02']);

// A start the user typed is honoured, and the chain resumes from it.
check('a pinned start is honoured',
    (() => {
        const list = [task('a', 60), task('b', 60), task('c', 60)];
        list[2].start = '2026-03-11';
        list[2].startPinned = true;
        api.autoScheduleItems(list, '2026-03-02');
        return list.map(item => item.start);
    })(),
    ['2026-03-02', '2026-03-02', '2026-03-11']);

// Same rank must preserve original quote order.
check('equal ranks keep quote order', api.workOrder('Install new toilet', 0) === api.workOrder('Install basin', 5), true);

const failed = results.filter(r => !r.pass);
results.forEach(r => console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (r.pass ? '' : `   got ${JSON.stringify(r.actual)} want ${JSON.stringify(r.expected)}`)));
console.log('');
console.log(`${results.length - failed.length}/${results.length} checks passed`);
