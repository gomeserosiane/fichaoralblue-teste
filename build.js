const fs = require("fs");
const path = require("path");

const publicDir = path.join(__dirname, "public");

fs.rmSync(publicDir, { recursive: true, force: true });
fs.mkdirSync(publicDir, { recursive: true });

const items = ["index.html", "css", "js", "assets"];

for (const item of items) {
    const source = path.join(__dirname, item);
    const target = path.join(publicDir, item);

    if (fs.existsSync(source)) {
        fs.cpSync(source, target, { recursive: true });
    }
}

console.log("Build estático concluído.");