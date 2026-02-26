
import re
import subprocess
import os

with open('d:/Recovery WEBAPP/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# simple regex to extract script content
match = re.search(r'<script>(.*?)</script>', content, re.DOTALL)
if match:
    js_content = match.group(1)
    with open('temp_script.js', 'w', encoding='utf-8') as f:
        f.write(js_content)
    
    try:
        # Run node to check syntax
        result = subprocess.run(['node', '--check', 'temp_script.js'], capture_output=True, text=True)
        if result.returncode != 0:
            print("Syntax Error Found:")
            print(result.stderr)
        else:
            print("No Syntax Error Found in Script Tag.")
    except Exception as e:
        print(f"Error running node: {e}")
else:
    print("No script tag found.")
