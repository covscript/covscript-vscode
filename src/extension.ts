import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

let terminal: vscode.Terminal | null = null;
const tempFiles = new Set<string>();

function mapEncoding(enc: string | undefined): BufferEncoding {
    if (!enc) return "utf8";
    const e = enc.toLowerCase();
    if (e === "utf8" || e === "utf-8") return "utf8";
    if (e === "utf16le" || e === "utf-16le") return "utf16le";
    if (e === "ascii") return "ascii";
    if (e === "base64") return "base64";
    return "utf8";
}

export function activate(context: vscode.ExtensionContext) {
    vscode.window.onDidEndTerminalShellExecution((e) => {
        if (e.terminal === terminal) {
            tempFiles.forEach(f => {
                try { fs.unlinkSync(f); } catch { }
            });
            tempFiles.clear();
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) vscode.window.showTextDocument(activeEditor.document, activeEditor.viewColumn ?? undefined);
        }
    });

    vscode.window.onDidCloseTerminal(t => {
        if (t === terminal) {
            terminal = null;
        }
    });

    const runCommand = vscode.commands.registerCommand("covscript.runFile", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("No active editor found");
            return;
        }

        const doc = editor.document;
        const ext = path.extname(doc.fileName).toLowerCase();
        const config = vscode.workspace.getConfiguration("covscript");
        const defaultRuntime = config.get<string>("defaultRuntime") || "ecs";
        let filePath = doc.fileName;
        let tempFile: string | null = null;

        let runtime = "";
        if (ext === ".csc") runtime = "cs";
        else if (ext === ".ecs") runtime = "ecs";
        else if (ext === ".csp" || ext === ".ecsx") {
            const choice = await vscode.window.showQuickPick(
                ["cs", "ecs"],
                { placeHolder: `Cannot directly run ${ext}. Use which interpreter?` }
            );
            if (!choice) return;
            runtime = choice;
        } else if (doc.isUntitled) {
            runtime = defaultRuntime;
        } else {
            vscode.window.showErrorMessage(`Use CovScript Extension with unsupported file type: ${ext}`)
            return;
        }

        if (doc.isUntitled || doc.isDirty) {
            let tmpExt = ext;
            if (!ext) {
                tmpExt = runtime == "cs" ? ".csc" : ".ecs"
            }
            const encoding = mapEncoding(vscode.workspace.getConfiguration("files").get<string>("encoding"));
            tempFile = path.join(os.tmpdir(), `covscript_temp_${Date.now()}${tmpExt}`);
            fs.writeFileSync(tempFile, doc.getText(), { encoding });
            filePath = tempFile;
            tempFiles.add(tempFile);
        }

        const interpreter = config.get<string>(`${runtime}Path`) || runtime;
        const interpreterArgs = (config.get<string>(`${runtime}Args`) || "").split(" ").filter(a => a.length > 0);

        if (!terminal) {
            terminal = vscode.window.createTerminal("CovScript Interpreter");
        }
        terminal.show();

        const cmdLine = `${interpreter} ${[...interpreterArgs, filePath].map(a => `"${a}"`).join(" ")}`;
        terminal.sendText(cmdLine, true);
    });

    context.subscriptions.push(runCommand);
}

export function deactivate() {
    if (terminal) terminal.dispose();
}
