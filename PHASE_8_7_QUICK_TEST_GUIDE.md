# Phase 8.7 Widget Text - Quick Test Reference

**Use this for rapid testing without reading the full guide**

---

## Quick Setup (2 minutes)

```bash
# Step 1: Check UE running
curl -s http://localhost:30010/remote/object/call \
  -H "Content-Type: application/json" \
  -d '{"objectPath":"/Script/Engine.Default__GameModeBase","functionName":"GetName","parameters":{}}'

# Step 2: Rebuild and restart MCP
npm run build
# Then restart OpenCode

# Step 3: Spawn test actor (if needed)
# Tool: control_actor, Action: spawn
# classPath: "TextRenderActor", actorName: "TestText", location: {x: 0, y: 0, z: 200}
```

---

## 5-Minute Test Suite

### Test 1: Basic Text
```
Tool: manage_ui
Action: set_actor_text
Params: {actorName: "TestText", text: "Hello World!"}

Expected: Success, text appears in viewport
```

### Test 2: Red Text
```
Tool: manage_ui
Action: set_textrender_text
Params: {
  actorName: "TestText",
  text: "Red Text",
  textColorR: 1.0, textColorG: 0.0, textColorB: 0.0,
  fontSize: 100
}

Expected: Large red text visible
```

### Test 3: Unicode (Japanese)
```
Tool: manage_ui
Action: set_actor_text
Params: {actorName: "TestText", text: "こんにちは"}

Expected: Japanese characters visible, no corruption
```

### Test 4: Centered
```
Tool: manage_ui
Action: set_textrender_text
Params: {
  actorName: "TestText",
  text: "Centered",
  horizontalAlignment: 1,
  verticalAlignment: 1
}

Expected: Text centered on actor
```

### Test 5: Error Handling
```
Tool: manage_ui
Action: set_actor_text
Params: {actorName: "NonExistent", text: "Test"}

Expected: Error response, graceful handling
```

---

## Expected Results

| Test | Expected | Pass |
|------|----------|------|
| 1 | "Hello World!" text | [ ] |
| 2 | Large red text | [ ] |
| 3 | Japanese chars visible | [ ] |
| 4 | Centered text | [ ] |
| 5 | Error (no crash) | [ ] |

---

## If All Pass ✅

```bash
git add -A
git commit -m "test: Phase 8.7 widget text - all tests passing"
```

## If Any Fail ❌

Check:
1. Is UE Editor running?
2. Is port 30010 responding?
3. Did you restart OpenCode after npm run build?
4. Does TestText actor exist in level?

---

## Quick Troubleshooting

| Issue | Fix |
|-------|-----|
| "Actor not found" | Spawn TextRenderActor first or use existing |
| Text doesn't appear | Check actor visibility, move camera closer |
| Unicode shows boxes | Normal (font may not support chars) |
| Connection refused | Start UE Editor, check port 30010 |
| Tool not found | Restart OpenCode after build |

---

## Reference: Tool Actions

### set_actor_text
```json
{
  "actorName": "string - actor label",
  "text": "string - content"
}
```

### set_textrender_text
```json
{
  "actorName": "string",
  "text": "string",
  "textColorR": 0.0-1.0,
  "textColorG": 0.0-1.0,
  "textColorB": 0.0-1.0,
  "fontSize": number,
  "horizontalAlignment": 0-2,
  "verticalAlignment": 0-2
}
```

---

**Total Testing Time**: ~15 minutes for all 5 tests + cleanup

Go to `PHASE_8_7_WIDGET_TEXT_TESTING.md` for full details.
