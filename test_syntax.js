const fs = require('fs');
const cp = require('child_process');
try {
    const content = fs.readFileSync('index.html', 'utf8');
    const matches = content.match(/<script>([\s\S]*?)<\/script>/g);
    if (matches) {
        matches.forEach((m, i) => {
            const code = m.substring(8, m.length - 9);
            const filename = `temp_check_${i}.js`;
            fs.writeFileSync(filename, code, 'utf8');
            try {
                cp.execSync(`node --check ${filename}`, { stdio: 'pipe' });
                console.log(`Script tag ${i} syntax is perfect!`);
            } catch (err) {
                console.error(`Error in script tag ${i}:`);
                console.error(err.stderr ? err.stderr.toString() : err.message);
            }
            try {
                fs.unlinkSync(filename);
            } catch (e) {}
        });
    } else {
        console.log("No script tags found.");
    }
} catch (e) {
    console.error("Syntax checker run failed:", e);
}
