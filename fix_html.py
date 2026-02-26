
import re
import os

file_path = r'd:/Recovery WEBAPP/index.html'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix opening tags with spaces: < div -> <div
# strict check for tag names to avoid math comparisons
# standard HTML tags
tags = [
    'div', 'span', 'i', 'b', 'strong', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
    'table', 'thead', 'tbody', 'tr', 'td', 'th', 'ul', 'ol', 'li', 
    'form', 'input', 'button', 'select', 'option', 'textarea', 'label', 
    'canvas', 'script', 'style', 'head', 'body', 'html', 'a', 'img', 'br', 'hr'
]
tags_pattern = '|'.join(tags)

# 1. Fix < tag
# Match < followed by space(s) followed by a tag name, ignoring case
pattern1 = r'<\s+(' + tags_pattern + r')\b'
new_content = re.sub(pattern1, r'<\1', content, flags=re.IGNORECASE)

# 2. Fix </ tag
pattern2 = r'</\s+(' + tags_pattern + r')\b'
new_content = re.sub(pattern2, r'</\1', new_content, flags=re.IGNORECASE)

# 3. Fix </tag > -> </tag>
pattern3 = r'</(' + tags_pattern + r')\s+>'
new_content = re.sub(pattern3, r'</\1>', new_content, flags=re.IGNORECASE)

# 4. Fix < tag > -> <tag> (specifically dealing with < tr > where there are no attributes)
pattern4 = r'<(' + tags_pattern + r')\s+>'
new_content = re.sub(pattern4, r'<\1>', new_content, flags=re.IGNORECASE)

# 5. Check for any remaining < div
# Just for safety/logging, we can print matches if we want, but let's just write.

if content != new_content:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Fixed HTML tags.")
else:
    print("No changes needed.")
