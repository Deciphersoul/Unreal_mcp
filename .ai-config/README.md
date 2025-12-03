# Shared AI Tool Configuration

This directory contains **shared configuration** for all AI tools (OpenCode, Codex, etc.) working with the UE MCP Extended project.

## Purpose

Centralize configuration that should be consistent across all AI development tools:
- **Context**: Shared project context, conventions, and guidelines
- **Agents**: Reusable AI agent definitions for UE development workflows
- **MCP Config**: Model Context Protocol server settings

## Directory Structure

```
.ai-config/
├── README.md              # This file
├── context.md             # Shared project context (moved from .opencode/)
├── mcp-config.json        # MCP server configuration
├── agents/                # Shared agent definitions
│   ├── README.md          # Agent system documentation
│   ├── ue-assistant.md    # Primary assistant (delegates to specialists)
│   ├── ue-debugger.md     # Error tracking and logs
│   ├── ue-level-designer.md  # Actors, lighting, test maps
│   ├── ue-build-engineer.md  # Packaging and builds
│   ├── ue-asset-manager.md   # Import and materials
│   └── ue-cinematics.md      # Sequences and cameras
└── tools/                 # Tool-specific configurations
    ├── opencode.json      # OpenCode-specific config
    └── codex.json         # Codex-specific config (future)
```

## How It Works

### For OpenCode

The root `opencode.json` references files in `.ai-config/`:

```json
{
  "agent": {
    "ue-assistant": {
      "prompt": "{file:./.ai-config/context.md}",
      "...": "..."
    }
  }
}
```

### For Codex

Create `.ai-config/tools/codex.json` that references the same shared agents and context.

### For Other Tools

Add new tool configs to `.ai-config/tools/` that reference shared resources.

## Benefits

✅ **Single source of truth** - Update context once, all tools see it  
✅ **Version controlled** - Git tracks all config changes  
✅ **Easy onboarding** - New AI tools just reference shared config  
✅ **Consistency** - All tools use same agents and context  
✅ **Maintainability** - Update agents in one place

## Migration from `.opencode/`

We moved shared files from `.opencode/` to `.ai-config/`:

| Old Location | New Location |
|--------------|--------------|
| `.opencode/CONTEXT.md` | `.ai-config/context.md` |
| `.opencode/agent/*.md` | `.ai-config/agents/*.md` |

The `.opencode/` directory still exists for OpenCode-specific files (like `node_modules/`, `package.json`, etc.).

## MCP Configuration

The `mcp-config.json` file contains the MCP server settings that can be referenced by any tool:

- HTTP port (30010)
- WebSocket port (30020)
- UE project path
- UE editor executable path

Tools should import this config rather than duplicating it.

## Adding a New Agent

1. Create `name>.md` in `.ai-config/agents/`
2. Define the agent's purpose, tools, and prompt
3. Reference it in tool configs (e.g., `opencode.json`)
4. Update `.ai-config/agents/README.md` with agent description

## Version History

- **2025-12-03**: Initial creation - migrated from `.opencode/` structure
- Future updates tracked in Git commit history
