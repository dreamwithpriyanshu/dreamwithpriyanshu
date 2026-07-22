import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUTPUT_DIR = path.join(process.cwd(), "assets");
const BADGE_PATH = path.join(OUTPUT_DIR, "profile-followers.svg");

function getUsername() {
  if (process.env.MOCK_PROFILE_RESPONSE) {
    const payload = JSON.parse(process.env.MOCK_PROFILE_RESPONSE);
    return payload.login ?? "dreamwithpriyanshu";
  }

  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository || !repository.includes("/")) {
    throw new Error("GITHUB_REPOSITORY must be set to owner/repo.");
  }

  return repository.split("/")[0];
}

async function fetchProfile() {
  if (process.env.MOCK_PROFILE_RESPONSE) {
    return JSON.parse(process.env.MOCK_PROFILE_RESPONSE);
  }

  const username = getUsername();
  const response = await fetch(`https://api.github.com/users/${username}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "dreamwithpriyanshu-followers-badge",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub profile API failed (${response.status}): ${body}`);
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
  const labelWidth = Math.max(122, label.length * 7 + 22);
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
  const profile = await fetchProfile();
  const followers = Number.isFinite(profile.followers) ? profile.followers : 0;
  const badge = buildBadge("FOLLOWERS", String(followers));

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(BADGE_PATH, badge, "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
