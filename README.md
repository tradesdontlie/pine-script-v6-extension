# Pine Script v6 Language Server for VS Code

A comprehensive VS Code extension for Pine Script v6 with advanced language server capabilities, specifically designed for TradingView's latest Pine Script version.

## 🚀 Features

### Pine Script v6 Specific Features
- **Dynamic Requests**: Support for `request.*()` functions with "series string" values
- **Enhanced Boolean Operations**: Short-circuit evaluation for `and`/`or` operators
- **Typographic Text Sizing**: Support for point-based text sizes in drawings
- **Text Formatting**: Bold and italic text formatting support
- **Strategy Improvements**: Order trimming instead of 9000-limit errors
- **Negative Array Indices**: Support for negative array indexing

### Core Language Features
- 🎯 **Advanced Syntax Highlighting** - Comprehensive Pine Script v6 syntax support
- 💡 **Intelligent Code Completion** - Context-aware completions with function signatures
- 📖 **Hover Documentation** - Instant access to function and variable documentation
- 🔍 **Library Integration** - Import statement completions and hover previews
- 🎨 **Multiple Themes** - Various color themes optimized for Pine Script
- 📝 **Code Templates** - Quick templates for indicators, strategies, and libraries
- 🏷️ **Type Generation** - Automatic type annotations for variables
- 📋 **Documentation Generation** - Automated docstring generation

## 📦 Installation

### Via VS Code Marketplace
1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for "Pine Script v6"
4. Click Install

### Manual Installation
1. Download the `.vsix` file from releases
2. In VS Code: `Ctrl+Shift+P` → "Extensions: Install from VSIX"
3. Select the downloaded file

## 🆕 What's New in v6

### Dynamic Requests
```pine
//@version=6
indicator("Dynamic Symbol Analysis")

// Now you can use series strings for symbols!
symbols = array.from("AAPL", "GOOGL", "MSFT")

for symbol in symbols
    price = request.security(symbol, "1D", close)  // Dynamic!
    // Process each symbol's data
```

### Enhanced Text Features
```pine
//@version=6
indicator("Enhanced Text")

if barstate.islast
    // Use exact point sizes for text
    label.new(bar_index, high, "Bold Text", 
              text_size = 16,  // Exact points!
              text_formatting = text.format_bold)
```

### Boolean Optimizations
```pine
//@version=6
indicator("Smart Conditions")

// Short-circuit evaluation - more efficient!
if array.size(myArray) > 0 and myArray.first() > 0
    // myArray.first() only evaluated if size > 0
    label.new(bar_index, high, "Safe!")
```

## 🛠️ Development Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/Pine-Script-v6-VS-Code.git
cd Pine-Script-v6-VS-Code
```

2. Install dependencies:
```bash
pnpm install
```

3. Compile the extension:
```bash
pnpm run compile
```

4. Run in development mode:
```bash
pnpm run start
```

## 📚 Documentation

- [Pine Script v6 Migration Guide](https://www.tradingview.com/pine-script-docs/migration-guides/to-pine-version-6/)
- [Pine Script v6 Release Notes](https://www.tradingview.com/pine-script-docs/release-notes/)
- [TradingView Pine Script Documentation](https://www.tradingview.com/pine-script-docs/)

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE.txt](LICENSE.txt) file for details.

## 🙏 Acknowledgments

- Based on the excellent [Pine Script v5 extension](https://github.com/frizLabz-FFriZz/Pine-Script-v5-VS-Code) by frizLabz
- Thanks to TradingView for Pine Script v6
- Community feedback and contributions

## 📞 Support

- [GitHub Issues](https://github.com/yourusername/Pine-Script-v6-VS-Code/issues)
- [VS Code Extension Page](https://marketplace.visualstudio.com/items?itemName=yourPublisherName.pinescript-v6-vscode)

---

**Disclaimer**: Pine Script™ is a trademark of TradingView. This project is not affiliated with, endorsed by, or connected to TradingView.
