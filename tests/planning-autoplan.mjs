/*
   Auto-plan: does it sequence tasks into work order and chain the dates?

   Driven through the real UI, not by calling the functions directly, so it
   exercises the button, the re-render and the stored row together - the parts
   that actually broke.

   Run it with the browser-automation driver against a served copy:
     node .serve.cjs &
     node <browser-automation>/browser.mjs http://localhost:8123/ \
       --script tests/planning-autoplan.mjs
*/
export default async function run(page, ui) {
  // Go to the planning view.
  await page.getByRole('button', { name: /Project planning/ }).first().click();
  await page.waitForTimeout(300);

  // Create a project.
  await page.locator('#new-project').click();
  await page.waitForTimeout(200);
  await page.locator('#project-name').fill('QA autoplan');
  await page.locator('#project-start').fill('2026-03-02'); // a Monday

  // Add tasks deliberately in the WRONG order, mirroring a badly-quoted job.
  const taskNames = [
    'Clean work area',
    'Install new pipe',
    'Call-out and inspection',
    'Excavate trench',
    'Backfill trench'
  ];
  for (const name of taskNames) {
    await page.locator('#add-planning-task').click();
    await page.waitForTimeout(80);
    const rows = page.locator('#planning-list .planning-row');
    await rows.nth(await rows.count() - 1).locator('.planning-task').fill(name);
    // Commit the change so duration is derived from the time table.
    await rows.nth(await rows.count() - 1).locator('.planning-task').blur();
    await page.waitForTimeout(80);
  }

  const beforeOrder = await page.locator('#planning-list .planning-task').evaluateAll(els => els.map(e => e.value));
  const beforeDates = await page.locator('#planning-list .planning-start').evaluateAll(els => els.map(e => e.value));

  // Run the whole point of this change.
  await page.locator('#auto-plan-project').click();
  await page.waitForTimeout(400);

  const afterOrder = await page.locator('#planning-list .planning-task').evaluateAll(els => els.map(e => e.value));
  const afterStarts = await page.locator('#planning-list .planning-start').evaluateAll(els => els.map(e => e.value));
  const afterFinishes = await page.locator('#planning-list .planning-finish').evaluateAll(els => els.map(e => e.value));
  const projectEnd = await page.locator('#project-end').inputValue();

  // ---- Case: idempotency ----
  // A second Auto-plan must not re-anchor every task to its own last calculated
  // date. This is the regression that broke the chain in the first build.
  await page.locator('#auto-plan-project').click();
  await page.waitForTimeout(400);
  const rerunStarts = await page.locator('#planning-list .planning-start').evaluateAll(els => els.map(e => e.value));
  const rerunFinishes = await page.locator('#planning-list .planning-finish').evaluateAll(els => els.map(e => e.value));

  // ---- Case: a pre-seeded start the user typed is honoured ----
  // Pin one task to a fixed Wednesday, then re-plan. The chain must work
  // AROUND it, not overwrite it.
  //
  // Chosen by name, not a hard-coded row number: the row a task lands in is
  // exactly what the sequencing decides, so pinning "row 2" would silently
  // pin whatever the sort happened to put there and prove nothing.
  const pinnedTask = 'Backfill trench';
  const pinIndex = await page.locator('#planning-list .planning-task')
    .evaluateAll((els, name) => els.findIndex(e => e.value === name), pinnedTask);
  if (pinIndex < 0) return { error: 'task to pin not found', pinnedTask };

  const rows = page.locator('#planning-list .planning-row');
  await rows.nth(pinIndex).locator('.planning-start').fill('2026-03-11');
  await rows.nth(pinIndex).locator('.planning-start').blur();
  await page.waitForTimeout(150);
  await page.locator('#auto-plan-project').click();
  await page.waitForTimeout(400);
  const pinnedStarts = await page.locator('#planning-list .planning-start').evaluateAll(els => els.map(e => e.value));
  const pinnedOrder = await page.locator('#planning-list .planning-task').evaluateAll(els => els.map(e => e.value));
  const newIndex = pinnedOrder.indexOf(pinnedTask);

  return {
    beforeOrder,
    beforeDates,
    afterOrder,
    afterStarts,
    afterFinishes,
    projectEnd,
    reordered: JSON.stringify(beforeOrder) !== JSON.stringify(afterOrder),
    firstStartIsAnchor: afterStarts[0] === '2026-03-02',
    allDated: afterStarts.every(Boolean) && afterFinishes.every(Boolean),
    chained: afterStarts.every((s, i) => i === 0 || s > afterFinishes[i - 1]),
    endMatchesLastFinish: projectEnd === afterFinishes[afterFinishes.length - 1],
    rerunStarts,
    rerunFinishes,
    idempotentStarts: JSON.stringify(rerunStarts) === JSON.stringify(afterStarts),
    idempotentFinishes: JSON.stringify(rerunFinishes) === JSON.stringify(afterFinishes),
    pinnedStarts,
    pinnedOrder,
    pinIndex,
    pinnedHonoured: pinnedStarts[newIndex] === '2026-03-11',
    pinnedTaskKeptItsRow: newIndex === pinIndex,
    chainContinuesAfterPin: pinnedStarts[newIndex + 1] > pinnedStarts[newIndex]
  };
}
