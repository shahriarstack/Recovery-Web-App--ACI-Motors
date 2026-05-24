const fs = require('fs');
const cp = require('child_process');
try {
    // Check index.html script tag
    const content = fs.readFileSync('index.html', 'utf8');
    const matches = content.match(/<script>([\s\S]*?)<\/script>/g);
    if (matches) {
        matches.forEach((m, i) => {
            const code = m.substring(8, m.length - 9);
            const filename = `temp_check_${i}.js`;
            fs.writeFileSync(filename, code, 'utf8');
            try {
                cp.execSync(`node --check ${filename}`);
                console.log(`index.html Script ${i}: OK`);
            } catch (err) {
                console.error(`index.html Script ${i} Error:`, err.stderr ? err.stderr.toString() : err.message);
            }
            try {
                fs.unlinkSync(filename);
            } catch (e) {}
        });
    }
    // Check functions/api/[[route]].js
    try {
        cp.execSync('node --check functions/api/[[route]].js');
        console.log("functions/api/[[route]].js: OK");
    } catch (err) {
        console.error("functions/api/[[route]].js Error:", err.stderr ? err.stderr.toString() : err.message);
    }
} catch (e) {
    console.error("Validation failed:", e);
}
