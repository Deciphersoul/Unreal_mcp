#!/bin/bash

# Test the debug build by calling the widget text tool
# This will show debug output from Python execution

echo "Testing widget text modification with debug build..."
echo "====================================================="
echo ""

# Since we can't directly call the MCP tool from bash, we'll instead:
# 1. Verify the build exists
# 2. Show the current state

if [ -f dist/tools/ui.js ]; then
    echo "✓ Debug build exists at dist/tools/ui.js"
    echo ""
    echo "Build timestamp:"
    ls -l dist/tools/ui.js | awk '{print $6, $7, $8}'
else
    echo "✗ Debug build NOT found at dist/tools/ui.js"
    exit 1
fi

echo ""
echo "To test the debug build:"
echo "1. Ensure OpenCode MCP process has been restarted after build"
echo "2. Call: manage_ui action:set_actor_text with actor 'TestText'"
echo "3. Check UE Output Log (Window → Developer Tools → Output Log)"
echo "4. Look for DEBUG: messages from Python execution"
echo ""
echo "Expected DEBUG output in UE console:"
echo "  DEBUG: setActorText started"
echo "  DEBUG: Parameters - actor_name='TestText', text_value='Hello World', ..."
echo "  DEBUG: Getting EditorActorSubsystem..."
echo "  DEBUG: Found N actors"
echo "  DEBUG: Actor X: label='...', class=..."
echo "  ... (full actor iteration) ..."
echo "  DEBUG: Target actor found"
echo "  ... (more debug as execution progresses) ..."
