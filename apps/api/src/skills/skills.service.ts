import { Injectable, NotFoundException, type OnModuleInit } from "@nestjs/common";

import { heldoutSets, loadSim, readReport } from "@hsp/evals";
import { providerFromEnv, SimulatedProvider, type Behaviour, type Provider } from "@hsp/harness";
import { repoRoot } from "@hsp/hr-data";
import { checkRelease, latest, lint, loadSkill, readRegistry, skillDirs, type Skill } from "@hsp/skill-kit";
import { REFERENCE_TOOLS } from "@hsp/hr-mcp";

/**
 * The skills as the platform runs them: loaded once at start from skills/, with their release
 * record, latest evaluation and the model that runs them (a configured provider, or the
 * simulated model in a demo, labelled as such everywhere it appears).
 */
@Injectable()
export class SkillsService implements OnModuleInit {
  readonly root = repoRoot();
  skills: Skill[] = [];
  provider!: Provider;

  async onModuleInit() {
    this.skills = skillDirs(this.root).map(loadSkill);
    const real = providerFromEnv();
    if (real) this.provider = real;
    else {
      const behaviours: Record<string, Behaviour> = {};
      for (const s of this.skills) {
        const sim = await loadSim(s);
        if (sim) behaviours[s.name] = sim.behaviour;
      }
      this.provider = new SimulatedProvider(behaviours);
    }
  }

  get(name: string): Skill {
    const s = this.skills.find((x) => x.name === name);
    if (!s) throw new NotFoundException(`No skill called ${name}.`);
    return s;
  }

  catalogue() {
    const dev = readReport(this.root, "dev");
    return this.skills.map((s) => {
      const release = latest(readRegistry(this.root, s.name));
      const check = checkRelease(s, this.root);
      const evalRow = dev?.skills.find((x) => x.skill === s.name);
      return {
        name: s.name,
        description: s.description,
        version: s.contract.version,
        owner: s.contract.owner,
        classification: s.contract.classification,
        audience: s.contract.audience,
        inputs: s.contract.inputs,
        validators: s.contract.validators,
        released: release ? { version: release.version, at: release.releasedAt, approvedBy: release.approvedBy } : null,
        releaseStatus: check.status,
        releaseProblems: check.problems,
        lint: lint(s, { knownTools: REFERENCE_TOOLS.map((t) => `mcp:${t}`) }),
        evaluation: evalRow
          ? { recordedAt: dev!.recordedAt, model: evalRow.model, passed: evalRow.cases.filter((c) => c.passed).length, cases: evalRow.cases.length, faultsCaught: evalRow.faults.filter((f) => f.caught).length, faults: evalRow.faults.length, metrics: evalRow.metrics }
          : null,
        heldout: heldoutSets(s).map((h) => {
          const first = readReport(this.root, `heldout-${s.name}-${h.name}`)?.skills[0];
          return { set: h.name, status: h.status ?? "held out", firstRun: first ? { passed: first.cases.filter((c) => c.passed).length, cases: first.cases.length, metrics: first.metrics, model: first.model } : null };
        }),
      };
    });
  }
}
