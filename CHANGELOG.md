# Changelog - Pine Script v6 VS Code Extension

All notable changes to the **Pine Script v6 Language Server** extension will be documented in this file.

---


# Changelog
**v0.1.6 - 0.1.7** - 2024-07-02
- **Improvement**: Updated syntax highlighting to improve readability and accuracy for various Pine Script elements.
- **Improvement**: Updated theme names and styles.
- **Documentation**: Updated the README to show contributors.
- **Documentation**: Updated various typedocs in the project.

**v0.1.5** - 2024-05-13
- **Bug Fix**: Fixed the Signature Provider and the completions for functions, which now displays recommended parameters and like-typed values.
- **Bug Fix**: Fixed miscellaneous bugs in the Hover Provider, documentation strings, themes, highlighting, and images on the download page and other areas.
- **Improvement**: The function parameter completions now display objects and their properties correctly.
- **Improvement**: Updated the typify functionality to correctly handle array types without adding an array type prefix to an array type that uses `[]`.
- **Documentation**: Updated the README to reflect recent changes and improvements.
- **Documentation**: Fixed the Pine Documentation to show information for all documentation in different parts of extension.

**v0.1.4** - 2024-04-05
- **Bug Fix**: Fixed a bug where errors remained displayed even after being resolved.
- **Documentation**: Updated the README to reflect recent changes and improvements.

**v0.1.3** - 2024-02-04
- **Bug Fix**: Fixed bugs in Auto Completion and Signature Helper
- **Improvement**: Improved Auto Completion and Signature Helper in functions
- **Improvement**: Libraries and working document are parsed for the default arguments values.
- **Improvement**: Default argument values are now displayed with hover over.
- **Improvement**: Now prompted to select param name first in functions and then value.
- **Improvement**: Like typed variables now are queued for the auto completion in functions.
- **Improvement**: Signature helper now changes the argument highlighted based on the auto completion highlighted.
- **Improvement**: Signature helper now shows the default argument value if there is one.
- **Improvement**: The default argument value is selectable in the auto completion.
- **Improvement**: Like typed type fields now show in the auto completion of functions.

**v0.1.2** - 2024-01-30
- **Bug Fix**: Fixed method completions.
- **Bug Fix**: Fixed method argument completions.
- **Improvement**: Argument completions now reference other like-typed variables.
- **Bug Fix**: Fixed some hover over bugs.
- **Bug Fix**: Fixed minor highlighting bugs.

**v0.1.1** - 2024-01-29
- **Improvement**: Improved syntax highlighting to correctly highlight UDT types in function headers.
- **Bug Fix**: Fixed Hover Over first param not showing in functions.
- **Bug Fix**: Fixed Signature Helper for user defined functions (Arguments should be highlighted now.)
- **Refactor**: Simplified PineDocString.ts and refactored PineHelpers.ts.

**v0.1.0** - 2024-01-26
- **New Feature**: Added F2 - Rename Symbol functionality. *(**if renaming symbol that shares a name with a function param, param may get renamed also. This is due to not using an AST(abstract syntax tree) so the exact locations of the symbols is fetched from matching the symbol with the document.**)*
Requested by **@StaticNoiseLog**.
- **Bug Fix**: Fixed mergeDocs function in PineDocsManager.ts.
- **Bug Fix**: Fixed Hover Over Syntax Duplicating.
- **Bug Fix**: Fixed Hover Over Returns Not Showing.
- **Bug Fix**: Fixed Bugs in PineTypify.ts - no longer adds duplicate Array<> to array types.
- **Maintenance**: Corrected typos in pineDocs.json.

**v0.0.3** - 2024-01-24
- **Refactor**: Refactored and Fixed Bugs in PineHelpers.ts.
- **Documentation**: Updated function and method documentation references.

**v0.0.2** - 2024-01-22
- **Refactor**: Refactored PineSignatureHelpProvider.ts to handle default values correctly.
- **Documentation**: Fixed function documentation and added completion support.

**v0.0.1** - 2024-01-22
- **New Feature**: Extension Added to VSCode Marketplace.
- **Initial Release**: First Commit.

---
