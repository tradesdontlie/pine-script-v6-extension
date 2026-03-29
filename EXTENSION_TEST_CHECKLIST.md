# Pine Script v6 Extension - Live Testing Checklist

## ✅ **IMMEDIATE TESTS** (Do These First)

### 1. **File Recognition Test**
- [ ] Open `PineScripts/test.pine` 
- [ ] Verify the Pine Script icon appears in the file tab
- [ ] Check that language is detected as "Pine Script" (bottom right corner)

### 2. **Syntax Highlighting Test**
In `PineScripts/test.pine`, verify these elements are properly colored:

- [ ] `//@version=6` - Version number should be highlighted
- [ ] `text.format_bold` - Should be highlighted as constant
- [ ] `text.format_italic` - Should be highlighted as constant  
- [ ] `math.abs` - Namespace and function highlighted differently
- [ ] `array.get` - Method highlighting
- [ ] `label.new` - Function highlighting
- [ ] Comments starting with `//` - Should be grayed out

### 3. **IntelliSense/Completion Test**
Type these patterns and check for completion popups:

- [ ] Type `math.` → Should show math functions (abs, max, min, sqrt...)
- [ ] Type `array.` → Should show array methods (new, get, push, size...)
- [ ] Type `text.format_` → Should show: format_bold, format_italic
- [ ] Type `ta.` → Should show technical analysis functions
- [ ] Type `color.` → Should show color constants
- [ ] Type `label.new(` → Should show parameter hints

### 4. **Hover Documentation Test**
Hover over these and check for documentation popups:

- [ ] `close` - Should show description of close price
- [ ] `math.abs` - Should show math.abs documentation  
- [ ] `array.get` - Should show array.get documentation
- [ ] `text.format_bold` - Should show v6 text formatting info
- [ ] `ta.sma` - Should show simple moving average docs

## 🔧 **v6-SPECIFIC FEATURE TESTS**

### 5. **Enhanced Text Features (v6)**
Check highlighting and completion for:

- [ ] `text_size = 16` - Exact point sizes (v6 feature)
- [ ] `text_formatting = text.format_bold` - New v6 formatting
- [ ] Combined formatting: `text.format_bold + text.format_italic`

### 6. **Array Negative Indexing (v6)**
Verify these work without syntax errors:

- [ ] `array.get(myArray, -1)` - Last element
- [ ] `array.get(myArray, -2)` - Second to last
- [ ] No error highlighting on negative indices

### 7. **Dynamic Requests (v6)**
Check that these don't show syntax errors:

- [ ] `request.security(dynamicSymbol, timeframe, close)` - Variable symbols
- [ ] Dynamic timeframe usage

## 🎛️ **EXTENSION COMMANDS TEST**

### 8. **Context Menu Test**
Right-click in the Pine file:

- [ ] "Pine Script Options" submenu appears
- [ ] "Generate Docstring" option works
- [ ] "Typify Variables" option available
- [ ] Template options (New Indicator/Strategy/Library) work

### 9. **Command Palette Test**
Press `Ctrl+Shift+P` (or `Cmd+Shift+P`) and search:

- [ ] "Pine Script" - Shows extension commands
- [ ] "Pine: Typify Variables" - Command appears
- [ ] "Pine: Open Built-in Script" - Works
- [ ] "Pine: Generate Docstring" - Available

## 🎨 **THEME TEST**

### 10. **Pine Script Themes**
Test a few of the 16 included themes:

- [ ] Go to Settings → Color Theme
- [ ] Try "Pine-Preferred" theme
- [ ] Try "Pine-V4-Classic" theme  
- [ ] Verify Pine syntax looks good in different themes

## 🔍 **ADVANCED FEATURES TEST**

### 11. **Error Detection**
Try introducing errors to test linting:

- [ ] Remove a closing parenthesis - Should show error
- [ ] Use wrong syntax - Should highlight problems
- [ ] Check if error messages are helpful

### 12. **Rename Provider Test**
- [ ] Select a variable name (e.g., `myArray`)
- [ ] Press F2 or right-click → "Rename Symbol"
- [ ] Check if renaming works across the file

### 13. **Signature Help Test**
- [ ] Type `label.new(` and check parameter hints
- [ ] Use arrow keys to navigate parameters
- [ ] Check if hints update as you type

## 📊 **PERFORMANCE TEST**

### 14. **Extension Loading**
- [ ] Note extension startup time
- [ ] Check if autocomplete is responsive (< 1 second)
- [ ] Verify no noticeable lag when typing

### 15. **Large File Test**
- [ ] Open `test-v6-features.pine` (the larger test file)
- [ ] Check if syntax highlighting works on the full file
- [ ] Test completion performance in larger file

## 🎯 **FINAL VALIDATION**

### 16. **Complete Script Test**
Create a new indicator from template:

- [ ] Right-click → Pine Script Options → New Indicator
- [ ] Verify template includes `//@version=6`
- [ ] Test that all features work in the new file
- [ ] Save and reopen to test file persistence

## 📋 **RESULTS TRACKING**

**Working Features:** ____/50
**Issues Found:** ____________
**Overall Rating:** ⭐⭐⭐⭐⭐

## 🐛 **Issue Reporting Template**

If you find issues, note:
1. **Feature:** What were you testing?
2. **Expected:** What should happen?
3. **Actual:** What actually happened?
4. **Steps:** How to reproduce?
5. **Error Messages:** Any console errors?

---

## 🎉 **CONCLUSION**

If most features work (40+/50), the extension is **ready for production use**!

**Next Steps:**
- [ ] Package for VS Code Marketplace (`npm run vsce-package`)
- [ ] Test on different operating systems
- [ ] Get community feedback
- [ ] Plan v0.2.0 features 