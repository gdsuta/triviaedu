# Project skills

Claude Code loads skills from this folder for anyone working in this repo. Each skill is a folder with a `SKILL.md` file:

```
.claude/skills/
  <skill-name>/
    SKILL.md        # YAML frontmatter (name, description) + instructions
    ...             # optional scripts, templates, reference files
```

`SKILL.md` frontmatter:

```yaml
---
name: skill-name
description: What it does and WHEN Claude should use it (this text decides when the skill triggers).
---
```

Current skills:

| Skill | Use it for |
| --- | --- |
| `site-content` | Adding or editing pages on the public website |
| `deploy-hostinger` | Deploying or updating the app on Hostinger (Business plan, Node.js) |

To add or improve a skill, edit its `SKILL.md`, or ask Claude to "create a skill for …" (the `skill-creator` skill can help).
