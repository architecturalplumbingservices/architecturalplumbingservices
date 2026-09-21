// Test reversed date maths (start+finish -> days) and work-order sorting.
const fs = require('fs');
const src = fs.readFileSync('app.js', 'utf8');

function extract(a, b) {
    const i = src.indexOf(a);
    if (i === -1) throw new Error('not found: ' + a);
    return src.slice(i, src.indexOf(b, i));
}

/* Non-overlapping ranges: each block stops before the next begins. */
const coreBlock = extract('const WORKING_HOURS_PER_DAY', 'const DEFAULT_TASK_MINUTES = {');
const helpersBlock = extract('function minutesToHours', 'const WORK_SEQUENCE = [');
const tableBlock = extract('const DEFAULT_TASK_MINUTES = {', 'const WORK_SEQUENCE = [');
const orderBlock = extract('const WORK_SEQUENCE = [', 'function tasksFromQuote');

const sandbox = `
const localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
${dateBlock}
${tableBlock}
${taskMinutesBlock}
${orderBlock}
return { addWorkingMinutes, workingMinutesBetween, formatDuration, describeDays,
         minutesToWorkingDays, workingDaysToMinutes, minutesForTask, taskDuration, taskDays,
         workOrder, WORKING_MINUTES_PER_DAY };
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

// Same rank must preserve original quote order.
check('equal ranks keep quote order', api.workOrder('Install new toilet', 0) === api.workOrder('Install basin', 5), true);

const failed = results.filter(r => !r.pass);
results.forEach(r => console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (r.pass ? '' : `   got ${JSON.stringify(r.actual)} want ${JSON.stringify(r.expected)}`)));
console.log('');
console.log(`${results.length - failed.length}/${results.length} checks passed`);
