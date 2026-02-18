const LEGACY_BRANCH_TO_CURRENT = {
  CE: "C",
  CME: "CM",
  ECE: "EC",
  EEE: "EE",
  AIML: "AIM",
};

export const normalizeBranchCode = (branch) => {
  if (!branch) return branch;
  return LEGACY_BRANCH_TO_CURRENT[branch] || branch;
};

export const expandBranchCodes = (branch) => {
  if (!branch) return [];

  const normalized = normalizeBranchCode(branch);
  const legacyMatches = Object.entries(LEGACY_BRANCH_TO_CURRENT)
    .filter(([, current]) => current === normalized)
    .map(([legacy]) => legacy);

  return Array.from(new Set([normalized, branch, ...legacyMatches])).filter(Boolean);
};

export const formatPinNumber = (pinNumber) => {
  if (!pinNumber) return pinNumber;

  return pinNumber
    .replace("-CME-", "-CM-")
    .replace("-CE-", "-C-")
    .replace("-ECE-", "-EC-")
    .replace("-EEE-", "-EE-")
    .replace("-AIML-", "-AIM-");
};
