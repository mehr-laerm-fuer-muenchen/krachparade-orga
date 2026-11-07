// Spec 022: last line of defence before anything is published. If a text
// looks like it contains a secret, nothing gets published. Only the names of
// the patterns are reported, never the match itself.

const PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: "postgres://", pattern: /postgres(?:ql)?:\/\//i },
  { name: "sk-ant-", pattern: /sk-ant-/i },
  { name: "ghs_", pattern: /ghs_/ },
  { name: "ghp_", pattern: /ghp_/ },
  { name: "github_pat_", pattern: /github_pat_/i },
  { name: "-----BEGIN", pattern: /-----BEGIN/ },
  // Case-sensitive on purpose: catches CLAUDE_CODE_OAUTH_TOKEN, not "OAuth" in a spec.
  { name: "OAUTH", pattern: /OAUTH/ },
];

/** Names of the secret patterns found in `text` (empty = clean). */
export function findSecretPatterns(text: string): string[] {
  return PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ name }) => name);
}
