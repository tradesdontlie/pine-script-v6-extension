### Building from Source

To build the Pine Script v6 Language Server extension from source, follow these steps:

#### Prerequisites
Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (which includes npm)
- [pnpm](https://pnpm.io/) (`npm install -g pnpm`)
- [Git](https://git-scm.com/)
- [Visual Studio Code](https://code.visualstudio.com/)

#### Step 1: Clone the Repository
Clone the repository to your local machine using Git:

```bash
git clone https://github.com/tradesdontlie/pine-script-v6-extension.git
cd pine-script-v6-extension
```

**or:**

Within VS Code open the command palette by going to

    view > command palette
or:

    press CTRL+SHIFT+P


then:

    type "clone" > press "Enter" > paste the repo url > select a dir location then open the new cloned repo when prompted.

#### Step 2: Install Dependencies
Navigate to the cloned directory and install the necessary dependencies:

```bash
pnpm install
```

#### Step 3: Compile the Code
Compile the TypeScript code into JavaScript:

```bash
pnpm run compile
```

#### Step 4: Run Tests
Verify everything is working:

```bash
pnpm test
```

#### Step 5: Open in Visual Studio Code
Open the folder in Visual Studio Code (skip if already open):

```bash
code .
```

#### Step 6: Run the Extension
In VS Code, press `F5` to run the extension in a new Extension Development Host window.

#### Step 7: Package the Extension (Optional)
If you want to package the extension into a `.vsix` file:

```bash
npx @vscode/vsce package --no-dependencies -o INSTALL-ME.vsix
```

This will create a `.vsix` file that you can distribute or install manually using the Extensions view in VS Code.

#### Additional Notes
- Make sure to update the version number in `package.json` if you are making changes and plan to release a new version.
- If you encounter any issues during the build process, check the `scripts` section of `package.json` for custom commands used by the project.
