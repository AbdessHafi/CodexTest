import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const git = (...args: string[]) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const rules: [string, RegExp][] = [
  ["GitHub token", /\b(?:ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{20,}\b/],
  ["Stripe secret", /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/],
  ["AWS access key", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ["Supabase secret", /\bsb_secret_[A-Za-z0-9_-]{16,}\b/],
  ["Private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  [
    "JWT credential",
    /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/,
  ],
];
const found = new Set<string>();
let checked = 0;
function check(label: string, text: string) {
  checked++;
  for (const [name, pattern] of rules)
    if (pattern.test(text)) found.add(`${label} : ${name}`);
}
const paths = git(
  "ls-files",
  "--cached",
  "--others",
  "--exclude-standard",
  "-z",
)
  .split("\0")
  .filter(Boolean);
for (const path of paths) {
  if (/(^|\/)\.env(?:\.|$)/.test(path) && !path.endsWith(".env.example"))
    found.add(`${path} : environnement non public suivi`);
  try {
    check(path, readFileSync(path, "utf8"));
  } catch {
    /* Deleted files are checked in history below. */
  }
}
const history = git("rev-list", "--objects", "--all")
  .split("\n")
  .filter(Boolean);
for (const row of history) {
  const split = row.indexOf(" ");
  if (split < 0) continue;
  const oid = row.slice(0, split),
    path = row.slice(split + 1);
  if (git("cat-file", "-t", oid).trim() !== "blob") continue;
  if (/(^|\/)\.env(?:\.|$)/.test(path) && !path.endsWith(".env.example"))
    found.add(`${path} : environnement présent dans l’historique`);
  check(`historique ${path}`, git("cat-file", "-p", oid));
}
if (found.size) {
  console.error(
    "Détections (valeurs volontairement masquées) :\n" + [...found].join("\n"),
  );
  process.exitCode = 1;
} else
  console.log(
    `${checked} contenus contrôlés (fichiers et historique Git) : aucun secret reconnu détecté. Audit par motifs, à compléter par les protections GitHub ; ne garantit pas l’absence de tout secret possible.`,
  );
