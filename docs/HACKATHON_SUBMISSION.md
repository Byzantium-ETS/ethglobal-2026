# Hackathon Submission Guide

This project is intended for the ETHGlobal Classic "From Scratch" track. Use this guide when planning work, reviewing pull requests, preparing submission materials, and recording the demo.

## Critical Dates

- Submission deadline: Sunday, June 14, 2026 at 09:00 EDT.
- Late submissions are not accepted.
- Finalist judging, if selected, uses a 7 minute session: 4 minutes demo, then 3 minutes Q&A.

## Submission Package

Submit from the Hacker Dashboard with:

- Project title and concise description.
- Public GitHub repository link.
- Demo video link or upload, strongly recommended.
- Up to 3 selected Partner Prizes.
- Partner-specific explanations for how AgentGate uses each partner tool.
- Any Figma files, specs, prompts, planning artifacts, or equivalent evidence needed to show work completed during the hackathon.

## Classic From Scratch Compliance

Because this is a fresh-track project, all project-specific code, designs, and assets must be created after the hackathon officially starts.

Allowed:

- Public open-source libraries.
- Public starter kits and boilerplates.
- Sponsor SDKs, docs, examples, and public reference implementations.
- AI-assisted coding, if documented transparently.

Not allowed for Classic eligibility:

- Private or pre-event project-specific code.
- Pre-event project-specific designs or assets.
- Large undocumented imports that hide when work was created.

Every PR should make it clear whether it adds new hackathon work, integrates a public dependency, or documents reused public material.

## Version Control Expectations

Use version control throughout the event. Avoid large single commits that make progress hard to review.

Required workflow:

- Create a branch before committing.
- Keep commits scoped and reviewable.
- Open a pull request for each branch.
- Link PRs to the epic or issue when relevant.
- Include verification commands in PR descriptions.
- Keep generated files and secrets out of commits.

Submission risk to avoid:

- Missing history.
- One huge final commit.
- Committed secrets.
- Unclear distinction between new work and reused public material.

## AI Use Disclosure

AI tools are allowed, but the submission must explain where and how they were used. AI should assist team development, not replace all team direction or contribution.

Document AI use in the submission and, where useful, in PR descriptions.

Suggested disclosure template:

```markdown
## AI Assistance Disclosure

- Tools used: GitHub Copilot, ChatGPT, Claude Code, Cursor, or other tools.
- Assisted areas: files, modules, docs, tests, scripts, prompts, or assets.
- Human direction: describe architecture choices, review decisions, integration work, and manual validation done by the team.
- Generated or assisted artifacts: list important files or folders.
- Verification: list tests, builds, demos, or manual checks performed by the team.
```

If a spec-driven workflow is used, include all relevant spec files, prompts, and planning artifacts in the repository so judges can see the full direction process.

## Partner Prize Preparation

The submission can select up to 3 Partner Prizes. If a partner has multiple tracks, those tracks can still count as one selected Partner Prize.

For AgentGate, keep partner evidence easy to inspect:

- Arc/Circle: x402 nanopayments, USDC settlement path, Gateway or Arc testnet evidence, payment challenge and paid-call flow.
- ENS: agent subnames, text records, metadata-driven discovery, endpoint and price records.
- World: human-backed trust signal, AgentKit proof or registration flow, free-trial gating tied to verified identity.

For each selected partner prize, prepare:

- What was integrated.
- Which code paths prove the integration.
- What worked well.
- What was hard or incomplete.
- Any feedback for the partner SDK, docs, or developer experience.

## Demo Video Requirements

The demo video is optional but strongly recommended. It appears on the ETHGlobal Showcase and helps partner judges understand the project.

Hard constraints:

- Length must be 2 to 4 minutes.
- Resolution must be at least 720p.
- Do not exceed 4 minutes.
- Do not speed up the video to fit the time limit.
- Do not use mobile-phone footage as the submission recording.
- Do not use text-to-speech or AI voiceover.
- Do not use music plus text as a substitute for narration.

Recommended structure:

1. 0:00-0:20 - Problem and one-sentence product thesis.
2. 0:20-1:15 - Provider registration and discoverability, especially ENS metadata.
3. 1:15-2:15 - Trust gate and free-trial flow, especially World verification.
4. 2:15-3:20 - Paid request flow, especially Arc/x402 USDC payment.
5. 3:20-4:00 - Why it matters, what is complete, and what comes next.

Recording checklist:

- Speak clearly and at a normal pace.
- Avoid background noise and echo.
- Keep backstory under 20 seconds.
- Show the product running, not only slides.
- Edit out waiting time.
- Use no more than 4 bullets per slide when slides are needed.

## Judging Preparation

Judges evaluate:

- Technicality: depth and sophistication of the implementation.
- Originality: novelty and creativity of the idea.
- Practicality: completeness and usefulness for the target audience.
- Usability: user, developer, and demo experience.
- WOW factor: memorable or unusually compelling parts of the project.

Prepare answers for:

- What inspired AgentGate?
- What tools and sponsor technologies were used, and why?
- What challenges were solved, and how?
- What is fully working versus demo-scaffolded?
- What would be built next with more time?

## Final Submission Checklist

Before submission:

- Repository is public and accessible.
- Commit history shows progress through the hackathon.
- `README.md` explains setup, demo, and sponsor integrations.
- `.env.example` documents all required environment variables without secrets.
- Partner prize selections are intentional and backed by clear evidence.
- AI assistance is disclosed.
- Spec files, prompts, and planning artifacts are committed if a spec-driven workflow was used.
- Demo video is 2 to 4 minutes and at least 720p.
- Demo video has spoken narration by a team member.
- Build and tests pass from a clean install.
- No secrets or private keys are committed.
- New work is clearly distinguishable from public libraries, starter kits, or reused assets.

## Agent Instructions

When working on this repository, agents should:

- Read this guide before submission, demo, README, or sponsor-prize work.
- Keep PRs small enough to preserve a clear hackathon history.
- Add tests and concise TypeDoc/TSDoc with feature work.
- Update this guide if ETHGlobal or partner requirements change.
- Never hide AI-assisted work; document it clearly and practically.