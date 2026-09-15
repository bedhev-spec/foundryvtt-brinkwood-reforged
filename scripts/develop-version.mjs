const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)$/;

export function createDevelopVersion(version, runNumber, runAttempt = 1) {
  const match = SEMVER_PATTERN.exec(version);
  if (!match) {
    throw new Error(
      `Development builds require a prerelease version in system.json; received "${version}". ` +
        "Start the next development line before publishing another develop build.",
    );
  }

  const normalizedRunNumber = String(runNumber);
  const normalizedRunAttempt = String(runAttempt);
  if (!/^[1-9]\d*$/.test(normalizedRunNumber) || !/^[1-9]\d*$/.test(normalizedRunAttempt)) {
    throw new Error(
      `Invalid development build sequence "${normalizedRunNumber}.${normalizedRunAttempt}".`,
    );
  }

  const coreVersion = `${match[1]}.${match[2]}.${match[3]}`;
  const prereleaseIdentifiers = match[4].split(".");
  const hasDevelopmentSuffix =
    prereleaseIdentifiers.length >= 2 &&
    prereleaseIdentifiers.at(-2) === "dev" &&
    /^\d+$/.test(prereleaseIdentifiers.at(-1));

  if (hasDevelopmentSuffix) {
    prereleaseIdentifiers.splice(
      prereleaseIdentifiers.length - 1,
      1,
      normalizedRunNumber,
      normalizedRunAttempt,
    );
  } else {
    prereleaseIdentifiers.push("dev", normalizedRunNumber, normalizedRunAttempt);
  }

  return `${coreVersion}-${prereleaseIdentifiers.join(".")}`;
}
