# OpenCode Agents

## Agents

| Agent | Mode | Invoke | Purpose |
|-------|------|--------|---------|
| ue-assistant | primary | Tab | Main assistant, delegates to specialists |
| ue-debugger | subagent | @ue-debugger | Error tracking, log analysis |
| ue-level-designer | subagent | @ue-level-designer | Actors, lighting, test maps |
| ue-build-engineer | subagent | @ue-build-engineer | Packaging, validation |
| ue-asset-manager | subagent | @ue-asset-manager | Import, materials, blueprints |
| ue-cinematics | subagent | @ue-cinematics | Sequences, cameras |

## Usage

- **Tab**: Switch primary agents
- **@agent-name**: Invoke subagent in message

## Shared Context

All agents reference `.opencode/CONTEXT.md` for:
- Tool reference
- Code quality standards
- Test project info
- Error recovery patterns
