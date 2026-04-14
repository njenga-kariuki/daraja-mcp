/**
 * Agent Skills HTTP route handlers.
 *
 * Serves installable best-practice instruction sets at:
 *   GET /.well-known/skills/index.json  — manifest of all available skills
 *   GET /.well-known/skills/:name       — individual skill by name
 */
import { Router } from 'express';
import { allSkills, type Skill } from './data.js';

const skills = new Map<string, Skill>(
  allSkills.map((s) => [s.name, s]),
);

/** Build the index manifest (array of skill summaries). */
function buildIndex() {
  return {
    skills: allSkills.map((s) => ({
      name: s.name,
      version: s.version,
      description: s.description,
      url: `./${s.name}`,
    })),
  };
}

/** Express router for /.well-known/skills/* */
export function skillsRouter(): Router {
  const router = Router();

  router.get('/index.json', (_req, res) => {
    res.json(buildIndex());
  });

  router.get('/:name', (req, res) => {
    const skill = skills.get(req.params.name);
    if (!skill) {
      res.status(404).json({ error: `Skill "${req.params.name}" not found` });
      return;
    }
    res.json(skill);
  });

  return router;
}

export { skills, buildIndex };
