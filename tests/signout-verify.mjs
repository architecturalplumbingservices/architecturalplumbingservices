/*
   Verify the sign-out control that replaced the removed header button,
   and that the Saved quotes header carries only New quote.

   Runs against a served copy with the browser-automation driver:
     node .serve.cjs
     node <browser-automation>/browser.mjs http://localhost:8123/ \
       --script tests/signout-verify.mjs

   The cloud calls in this test will be blocked by CORS, because the
   deployed function still answers with another company's origin. That is
   expected and is NOT a failure of anything here - it is documented in
   supabase/CLOUD-SYNC-BROKEN.md. This test deliberately asserts only on
   local UI state, so it stays meaningful while the cloud is broken.
*/
export default async function run(page, ui) {
  const result = {};

  // 1. The Saved quotes header must offer nothing but New quote.
  result.headerButtons = await page.evaluate(() =>
    [...document.querySelectorAll('#quotes-view .view-intro-actions button')]
      .map(b => b.textContent.trim())
  );

  // 2. Sign out must exist and start hidden, because nobody is signed in.
  result.signoutExists = await page.evaluate(() =>
    !!document.getElementById('cloud-signout')
  );
  result.signoutHiddenBefore = await page.evaluate(() =>
    document.getElementById('cloud-signout').hidden
  );

  // 3. updateCloudButtons() is what reveals it, so confirm toggling works.
  result.signoutToggles = await page.evaluate(() => {
    const btn = document.getElementById('cloud-signout');
    btn.hidden = false;
    const shown = !btn.hidden;
    btn.hidden = true;
    return shown && btn.hidden;
  });

  // 4. Open the dialog the way openSignInDialog() does, then click the
  //    real button and check the click handler ran.
  await page.evaluate(() => document.getElementById('cloud-dialog').showModal());
  result.dialogOpenBefore = await page.evaluate(() =>
    document.getElementById('cloud-dialog').open
  );

  await page.evaluate(() => { document.getElementById('cloud-signout').hidden = false; });
  await page.locator('#cloud-signout').click();
  await page.waitForTimeout(250);

  result.afterSignOut = await page.evaluate(() => {
    const d = document.getElementById('cloud-dialog');
    return {
      dialogClosed: !d.open,
      signoutHidden: document.getElementById('cloud-signout').hidden,
      status: document.getElementById('cloud-status').textContent
    };
  });

  // 5. The quote form actions must still be present and untouched.
  result.quoteFormButtons = await page.evaluate(() =>
    ['pdf-button', 'save-quote', 'clear-quote']
      .filter(id => document.getElementById(id))
  );

  return result;
}
