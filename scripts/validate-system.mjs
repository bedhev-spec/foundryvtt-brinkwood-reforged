import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

const relative = (file) => path.relative(root, file).split(path.sep).join("/");
const exists = async (file) => {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
};
const report = (message) => errors.push(message);

async function filesUnder(directory, predicate) {
  const found = [];
  const visit = async (current) => {
    if (!(await exists(current))) return;
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (predicate(file)) found.push(file);
    }
  };
  await visit(directory);
  return found;
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    report(`${relative(file)}: invalid JSON (${error.message})`);
    return null;
  }
}

async function validateJson() {
  const files = [
    path.join(root, "system.json"),
    path.join(root, "system-test.json"),
    path.join(root, "template.json")
  ];
  files.push(...await filesUnder(path.join(root, "lang"), (file) => file.endsWith(".json")));
  const parsed = new Map();
  for (const file of files) parsed.set(file, await readJson(file));
  return {
    system: parsed.get(path.join(root, "system.json")),
    testSystem: parsed.get(path.join(root, "system-test.json"))
  };
}

async function validateManifestPaths(system, manifestName) {
  if (!system) return;
  const paths = [
    ...(system.esmodules ?? []).map((value) => ["esmodule", value]),
    ...(system.styles ?? []).map((value) => ["style", value]),
    ...(system.languages ?? []).map(({ path: value }) => ["language", value]),
    ...(system.packs ?? []).map(({ path: value, name }) => [`pack ${name}`, value]),
  ];
  for (const [kind, value] of paths) {
    if (typeof value !== "string" || !(await exists(path.resolve(root, value)))) {
      report(`${manifestName} ${kind} path does not exist: ${value}`);
    }
  }
}

function validateManifestCompatibility(system, manifestName) {
  if (!system) return;
  const {minimum, verified, maximum} = system.compatibility ?? {};
  if (minimum !== "13") report(`${manifestName} compatibility.minimum must be "13", received: ${minimum}`);
  if (maximum !== "13") report(`${manifestName} compatibility.maximum must be "13", received: ${maximum}`);
  if (typeof verified !== "string" || !/^13(?:\.|$)/.test(verified)) {
    report(`${manifestName} compatibility.verified must target Foundry v13, received: ${verified}`);
  }
}

async function resolveImport(from, specifier) {
  if (specifier.startsWith("systems/brinkwood-reforged/")) {
    return path.join(root, specifier.slice("systems/brinkwood-reforged/".length));
  }
  if (specifier.startsWith("/systems/brinkwood-reforged/")) {
    return path.join(root, specifier.slice("/systems/brinkwood-reforged/".length));
  }
  return path.resolve(path.dirname(from), specifier);
}

async function resolvesModule(from, specifier) {
  const target = await resolveImport(from, specifier);
  const candidates = [target, `${target}.js`, `${target}.mjs`, `${target}.json`, path.join(target, "index.js")];
  for (const candidate of candidates) {
    if (await exists(candidate)) {
      try {
        if ((await stat(candidate)).isFile()) return true;
      } catch {
        // A concurrent filesystem change is reported below as unresolved.
      }
    }
  }
  return false;
}

async function validateImports(jsFiles) {
  const importPattern = /(?:\bimport\s*(?:[\s\S]*?\sfrom\s*)?|\bexport\s*(?:[\s\S]*?\sfrom\s*))(["'])([^"']+)\1|\bimport\s*\(\s*(["'])([^"']+)\3\s*\)/g;
  for (const file of jsFiles) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[2] ?? match[4];
      if (!specifier.startsWith(".") && !specifier.startsWith("/systems/brinkwood-reforged/") && !specifier.startsWith("systems/brinkwood-reforged/")) continue;
      if (!(await resolvesModule(file, specifier))) {
        report(`${relative(file)}: unresolved local import ${specifier}`);
      }
    }
  }
}

async function validateTemplatePaths(jsFiles) {
  const templateFiles = await filesUnder(path.join(root, "templates"), (file) => file.endsWith(".html") || file.endsWith(".hbs"));
  const sourceFiles = [...jsFiles, ...templateFiles];
  const pathPattern = /\/?systems\/brinkwood\/(templates\/[^\s"'`)}]+\.html)/g;
  for (const file of sourceFiles) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(pathPattern)) {
      const target = path.join(root, match[1]);
      if (!(await exists(target))) report(`${relative(file)}: missing template ${match[0]}`);
    }
  }
}

function validateSyntax(jsFiles) {
  for (const file of jsFiles.filter((file) => path.dirname(file) === path.join(root, "module"))) {
    const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    if (result.status !== 0) report(`${relative(file)}: node --check failed\n${result.stderr.trim()}`);
  }
}

const {system, testSystem} = await validateJson();
validateManifestCompatibility(system, "system.json");
validateManifestCompatibility(testSystem, "system-test.json");
await validateManifestPaths(system, "system.json");
await validateManifestPaths(testSystem, "system-test.json");
const jsFiles = await filesUnder(path.join(root, "module"), (file) => file.endsWith(".js"));
await validateImports(jsFiles);
await validateTemplatePaths(jsFiles);
validateSyntax(jsFiles);

if (errors.length) {
  console.error(`Validation failed (${errors.length} issue${errors.length === 1 ? "" : "s"}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Validation passed.");
}
