// Supply-chain gate. Fails when:
//   - a workflow `uses:` is not pinned to a full commit SHA, or that SHA is not the commit
//     of the action's latest release (the `# vX.Y.Z` comment must name that release);
//   - a devDependency is not an exact pin, or is behind its latest stable version;
//   - a hold in .dependency-holds.json is no longer needed.
// The only exceptions are the named holds, each with its reason. Nothing is rewritten:
// Dependabot proposes the bumps, this makes an unmerged one fail the build.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const WORKFLOWS = '.github/workflows';
/** @type {Record<string, { major: number, reason: string }>} */
const holds = JSON.parse(readFileSync('.dependency-holds.json', 'utf8'));
/** @type {string[]} */
const problems = [];
/** @type {string[]} */
const notes = [];

/** @param {string} path */
async function github(path) {
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'arcade-check-latest' };
  const token = process.env.GITHUB_TOKEN;
  const response = await fetch(`https://api.github.com/${path}`, token ? { headers: { ...headers, authorization: `Bearer ${token}` } } : { headers });
  if (!response.ok) throw new Error(`GitHub API ${path}: ${response.status}`);
  return response.json();
}

/** @type {Map<string, Promise<{ tag: string, sha: string }>>} */
const latestRelease = new Map();
/** @param {string} repo owner/name */
function latestOf(repo) {
  if (!latestRelease.has(repo)) {
    latestRelease.set(repo, (async () => {
      const { tag_name: tag } = await github(`repos/${repo}/releases/latest`);
      const { sha } = await github(`repos/${repo}/commits/${tag}`);
      return { tag, sha };
    })());
  }
  return /** @type {Promise<{ tag: string, sha: string }>} */ (latestRelease.get(repo));
}

async function checkActions() {
  const uses = readdirSync(WORKFLOWS).filter(f => /\.ya?ml$/.test(f)).flatMap(file =>
    readFileSync(join(WORKFLOWS, file), 'utf8').split('\n').flatMap((line, i) => {
      const m = line.match(/uses:\s*([\w.-]+\/[\w.-]+)(?:\/[\w./-]+)?@(\S+)(?:\s+#\s*(\S+))?/);
      return m ? [{ where: `${file}:${i + 1} ${m[1]}`, repo: m[1], ref: m[2], comment: m[3] }] : [];
    }));
  await Promise.all(uses.map(async ({ where, repo, ref, comment }) => {
    if (!/^[0-9a-f]{40}$/.test(ref)) {
      problems.push(`${where}: pinned to "${ref}", not a full commit SHA`);
      return;
    }
    const latest = await latestOf(repo);
    if (ref !== latest.sha) problems.push(`${where}: ${comment ?? ref} is behind the latest release ${latest.tag}`);
    else if (comment !== latest.tag) problems.push(`${where}: comment "${comment}" should name the pinned release ${latest.tag}`);
  }));
}

/** @param {string} spec */
function npmVersion(spec) {
  const out = JSON.parse(execFileSync('npm', ['view', spec, 'version', '--json'], { encoding: 'utf8' }));
  return Array.isArray(out) ? String(out.at(-1)) : String(out);
}

function checkPackages() {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  for (const [name, pinned] of Object.entries(/** @type {Record<string, string>} */ (pkg.devDependencies ?? {}))) {
    if (!/^\d+\.\d+\.\d+$/.test(pinned)) {
      problems.push(`${name}: "${pinned}" is not an exact version pin`);
      continue;
    }
    const newest = npmVersion(`${name}@latest`);
    const hold = holds[name];
    if (hold) {
      const heldLatest = npmVersion(`${name}@${hold.major}`);
      if (Number(newest.split('.')[0]) <= hold.major) problems.push(`${name}: hold on major ${hold.major} is no longer needed (latest is ${newest}); remove it`);
      if (pinned !== heldLatest) problems.push(`${name}: ${pinned} is behind ${heldLatest}, the latest of held major ${hold.major}`);
      notes.push(`${name} held on ${hold.major}.x (latest ${newest}): ${hold.reason}`);
    } else if (pinned !== newest) {
      problems.push(`${name}: ${pinned} is behind the latest stable ${newest}`);
    }
  }
  for (const name of Object.keys(holds)) {
    if (!(name in (pkg.devDependencies ?? {}))) problems.push(`hold for ${name} matches no dependency; remove it`);
  }
}

await checkActions();
checkPackages();
for (const note of notes) console.log(`hold: ${note}`);
if (problems.length) {
  for (const p of problems) console.log(`::error::${p}`);
  process.exit(1);
}
console.log('every action is SHA-pinned to its latest release and every dependency is current');
