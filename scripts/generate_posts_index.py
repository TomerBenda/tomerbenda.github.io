import os
import json

POSTS_DIR = 'posts'
INDEX_FILE = 'index.json'

posts = []
for filename in sorted(os.listdir(POSTS_DIR)):
    if filename.endswith('.md'):
        # You can parse title/date from the file or filename if needed
        posts.append({
            'filename': filename,
            'title': filename.replace('.md', '').replace('-', ' ').title()
        })

with open(os.path.join(POSTS_DIR, INDEX_FILE), 'w') as f:
    json.dump(posts, f, indent=2)