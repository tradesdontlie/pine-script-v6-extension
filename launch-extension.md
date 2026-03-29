# Manual Extension Launch Guide

Since VS Code CLI is not available, follow these steps to test the Pine Script v6 extension:

## Step 1: Install VS Code CLI (Optional but Recommended)
1. Open VS Code normally
2. Press `Cmd+Shift+P`
3. Type "Shell Command: Install 'code' command in PATH"
4. Select and run it
5. Restart terminal

## Step 2: Manual Launch (Alternative Method)
If you can't install CLI, do this:

1. **Open VS Code**
2. **Go to Extensions View** (`Cmd+Shift+X`)
3. **Click the "..." menu** → "Install from VSIX..."
4. **OR use Run and Debug**:
   - Press `Cmd+Shift+P`
   - Type "Debug: Start Debugging"
   - Select "Extension Development Host"

## Step 3: Alternative - Package and Install
```bash
# In terminal, run:
npm run vsce-package
# This creates pinescriptv5.vsix file
# Then install it manually in VS Code
```

## Step 4: Open Test Files
Once extension dev window opens:
1. Open `PineScripts/test.pine`
2. Verify no "Must be v5" errors appear
3. Test completion with `math.`, `array.`, etc.

## Step 5: Verify v6 Recognition
The extension should now:
- ✅ Accept `//@version=6` without errors
- ✅ Show "Must be v5 or v6" if using wrong version (not just "v5")
- ✅ Generate v6 templates from context menu 