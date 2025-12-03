# Rollback Instructions

If OpenCode fails to load after the configuration change, follow these steps:

## Quick Rollback

1. **Restore opencode.json:**
   ```bash
   copy opencode.json.backup opencode.json
   ```

2. **Update to use old .opencode/ paths:**
   Edit `opencode.json` and change line 23:
   ```json
   "prompt": "{file:./.opencode/agent/ue-assistant.md}",
   ```

3. **Restart OpenCode**

## Alternative: Manual Fix

If you want to keep the new structure but fix path issues:

1. **Check that these files exist:**
   - `.ai-config/agents/ue-assistant.md`
   - `.ai-config/context.md`

2. **Verify paths in opencode.json:**
   ```json
   "prompt": "{file:./.ai-config/agents/ue-assistant.md}",
   ```

3. **Verify paths in agent files:**
   Inside `.ai-config/agents/ue-assistant.md` (and other agents), the context reference should be:
   ```markdown
   {file:../context.md}
   ```
   
   NOT:
   ```markdown
   {file:../.ai-config/context.md}  ❌ Wrong!
   ```

## Files to Keep for Rollback

- `opencode.json.backup` - Original working config
- `.opencode/CONTEXT.md` - Original context (kept as backup)
- `.opencode/agent/*.md` - Original agents (kept as backup)

## Testing Checklist

Before restarting OpenCode:
- [ ] `.ai-config/agents/ue-assistant.md` exists
- [ ] `.ai-config/context.md` exists  
- [ ] `opencode.json` points to `.ai-config/agents/ue-assistant.md`
- [ ] Agent file references `{file:../context.md}` (not `../.ai-config/context.md`)

## Contact

If issues persist, the old `.opencode/` files are still present and can be referenced.
