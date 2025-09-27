import os
import json
import yaml

POSTS_DIR = 'posts'
INDEX_FILE = 'index.json'
PROPERTIRES = ['title', 'date', 'categories', 'uploadto']

def parse_frontmatter(filepath):
    res = {}
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
            
            for prop in PROPERTIRES:
                res[prop] = fm_data.get(prop)
                if not res[prop]:
                    print(f"\t[-] Warning: '{prop}' not found in frontmatter of {filepath}")

                # Handle things that should be strings
                if prop in ['date'] and not isinstance(res[prop], str):
                    res[prop] = str(res[prop]).strip()
                else:
                    res[prop] = res[prop] or ""
                
                # Handle things that shouldn't be strings
                if prop in ['categories'] and isinstance(res[prop], str):
                    res[prop] = [item.strip() for item in res[prop].split(',')]
                else:
                    res[prop] = res[prop] or []

            return res
        else:
            print(f"\t[!] No frontmatter found in {filepath}")
    except Exception as e:
        print(f"\t[!] Error parsing frontmatter in {filepath}: {e}")
    return res

def get_markdown_files(directory):
    print(f"[ ] Scanning directory '{directory}' for markdown files")
    md_files = []
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith('.md'):
                filepath = os.path.join(root, file).replace('posts/', '').replace('posts\\', '')
                md_files.append(filepath)
    print(f"[+] Found {len(md_files)} markdown files")
    return sorted(md_files)

posts = []
for filename in get_markdown_files(POSTS_DIR):
    print(f"[ ] Processing {filename}")
    if filename.endswith('.md'):
        filepath = os.path.join(POSTS_DIR, filename)
        res = parse_frontmatter(filepath)

        title = res.get('title')
        date = res.get('date', "")
        categories = res.get('categories', [])
        uploadto = res.get('uploadto')
        
        # Fallbacks for missing frontmatter
        if not title:
            title = filename.replace('.md', '').replace('-', ' ').title()
        posts.append({
            'filename': filename,
            'title': title,
            'date': date,
            'categories': categories
        })
        print(f"\t[+] Processed '{filename}': title='{title}', date='{date}', categories={categories}")

try:
    with open(os.path.join(POSTS_DIR, INDEX_FILE), 'w', encoding='utf-8') as f:
        json.dump(posts, f, indent=2)
except Exception as e:
    print(f"[!] Error writing index file: {e}")

print(f"[+] Generated {INDEX_FILE} with {len(posts)} posts.")