# Ship PR
Given a Jira ticket ID and description:
1. Create feature branch named CORE-XXXX-short-desc
2. Implement changes, run tests + lint
3. Commit with conventional message referencing ticket
4. Push (split from commit to respect pre-push hooks)
5. Open PR with description linking the Jira ticket
6. Poll for agent-merge-approved label every 60s until merged or 'gigantic' label appears
7. If 'gigantic' label, propose split into stacked PRs
