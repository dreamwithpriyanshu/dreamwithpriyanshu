import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const API_VERSION = "2026-03-10";
const OUTPUT_DIR = path.join(process.cwd(), "assets");
const BADGE_PATH = path.join(OUTPUT_DIR, "profile-visitors.svg");
const SNAPSHOT_PATH = path.join(OUTPUT_DIR, "profile-visitors.json");

function getRepoContext() {
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository || !repository.includes("/")) {
    throw new Error("GITHUB_REPOSITORY must be set to owner/repo.");
  }

  const [owner, repo] = repository.split("/");
  return { owner, repo };
}

async function fetchTraffic() {
  if (process.env.MOCK_TRAFFIC_RESPONSE) {
    return JSON.parse(process.env.MOCK_TRAFFIC_RESPONSE);
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN is required unless MOCK_TRAFFIC_RESPONSE is set.");
  }

  const { owner, repo } = getRepoContext();
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/traffic/views`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "dreamwithpriyanshu-profile-visitors-badge",
        "X-GitHub-Api-Version": API_VERSION,
      },
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub traffic API failed (${response.status}): ${body}`);
  }

  return response.json();
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildBadge(label, value) {
  const safeLabel = escapeXml(label);
  const safeValue = escapeXml(value);
  const labelWidth = Math.max(158, label.length * 7 + 22);
  const valueWidth = Math.max(52, value.length * 8 + 20);
  const totalWidth = labelWidth + valueWidth;
  const valueStart = labelWidth;
  const valueCenter = valueStart + valueWidth / 2;
  const labelCenter = labelWidth / 2;

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="28" role="img" aria-label="${safeLabel}: ${safeValue}">
  <title>${safeLabel}: ${safeValue}</title>
  <defs>
    <linearGradient id="valueGradient" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0%" stop-color="#1f6feb" />
      <stop offset="100%" stop-color="#2ea043" />
    </linearGradient>
  </defs>
  <rect width="${totalWidth}" height="28" rx="8" fill="#161b22" />
  <rect width="${labelWidth}" height="28" rx="8" fill="#0d1117" />
  <rect x="${valueStart}" width="${valueWidth}" height="28" rx="8" fill="url(#valueGradient)" />
  <rect x="${labelWidth - 8}" width="16" height="28" fill="url(#valueGradient)" opacity="0.18" />
  <g fill="#e6edf3" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="11" font-weight="700">
    <text x="${labelCenter}" y="18">${safeLabel}</text>
    <text x="${valueCenter}" y="18">${safeValue}</text>
  </g>
</svg>`.trimStart();
}

async function main() {
  const traffic = await fetchTraffic();
  const snapshot = {
    updatedAt: new Date().toISOString(),
    source: "github-repository-traffic",
    period: "last_14_days",
    visitors: traffic.uniques ?? 0,
    views: traffic.count ?? 0,
    daily: Array.isArray(traffic.views) ? traffic.views : [],
  };

  const badge = buildBadge("PROFILE VISITORS 14D", String(snapshot.visitors));

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  await writeFile(BADGE_PATH, badge, "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
