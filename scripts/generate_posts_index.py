import os
import json
import yaml

POSTS_DIR = 'posts'
INDEX_FILE = 'index.json'

def parse_frontmatter(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        if lines and lines[0].strip() == '---':
            frontmatter = []
            for line in lines[1:]:
                if line.strip() == '---':
                    break
                frontmatter.append(line)
            try:
                fm_data = yaml.safe_load(''.join(frontmatter)) or {}
            except Exception:
                fm_data = {}
            title = fm_data.get('title')
            date = fm_data.get('date')
            # Convert date to string if it's a date object
            if date is not None and not isinstance(date, str):
                date = str(date)
            categories = fm_data.get('categories', [])
            if isinstance(categories, str):
                categories = [c.strip() for c in categories.split(',')]
            return title, date, categories
    except Exception as e:
        print(f"Error parsing frontmatter in {filepath}: {e}")
    # Defaults if no frontmatter or error
    return None, None, []

posts = []
for filename in sorted(os.listdir(POSTS_DIR)):
    if filename.endswith('.md'):
        filepath = os.path.join(POSTS_DIR, filename)
        title, date, categories = parse_frontmatter(filepath)
        # Fallbacks for missing frontmatter
        if not title:
            title = filename.replace('.md', '').replace('-', ' ').title()
        if not date:
            date = ""
        if not categories:
            categories = []
        posts.append({
            'filename': filename,
            'title': title,
            'date': date,
            'categories': categories
        })

try:
    with open(os.path.join(POSTS_DIR, INDEX_FILE), 'w', encoding='utf-8') as f:
        json.dump(posts, f, indent=2)
except Exception as e:
    print(f"Error writing index file: {e}")