// Copies what `rushx convert-looks` wrote (tools/forms-corpus/corpus/converted) into
// src/converted/*.local.* for the "Converted" screen. The corpus is another
// repository's forms and is gitignored, and so are these copies.
//
//   node scripts/sync-converted.mjs [Form ...]     default: a handful of ServiceTas forms
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const corpus = join(here, "../../../tools/forms-corpus/corpus");
const out = join(here, "../src/converted");
const from = join(corpus, "converted");
if (!existsSync(join(from, "looks.native.js"))) {
  console.error("No converted looks: run `rushx convert-looks` in tools/forms-corpus first.");
  process.exit(1);
}
const wanted = process.argv.slice(2);
const names = wanted.length
  ? wanted
  : ["Home", "Services", "MyAccount", "PersonalDetails", "Address", "ContactUs", "ContactUsEnquiry", "Search", "AccountPreferences", "NotificationPreferences", "TempPaymentForm", "MrsLicenceRenewal", "PlatesPlusRegistrationWizard", "LinkMastWizard", "Fire", "Wallet", "AllControls", "CarSearch"];

mkdirSync(out, { recursive: true });
copyFileSync(join(from, "looks.native.js"), join(out, "looks.local.js"));
const forms = {};
for (const n of names) {
  const p = ["servicetas", "forms-app", "testtemplate"].map((d) => join(from, "forms", d, `${n}.json`)).find(existsSync);
  if (!p) { console.warn(`no converted form ${n}`); continue; }
  forms[n] = JSON.parse(readFileSync(p, "utf8"));
}
writeFileSync(join(out, "forms.local.json"), JSON.stringify(forms));
const tokens = join(here, "../../../tools/forms-corpus/sidecar/nativeTokens.json");
writeFileSync(join(out, "tokens.local.json"), existsSync(tokens) ? readFileSync(tokens, "utf8") : "{}");
console.log(`synced ${Object.keys(forms).length} forms`);
