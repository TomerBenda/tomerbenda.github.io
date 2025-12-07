import json
import yaml
from pathlib import Path
from typing import List, Dict, Any


FRONTMATTER_KEYS = ["title", "date", "categories", "uploadto"]


def parse_frontmatter(filepath: Path) -> Dict[str, Any]:
    """Extract YAML frontmatter from a markdown file.

    Returns a dict with keys from FRONTMATTER_KEYS (missing keys -> sensible defaults).
    """
    result = {key: None for key in FRONTMATTER_KEYS}
    try:
        with filepath.open("r", encoding="utf-8") as f:
            lines = f.readlines()

        if lines and lines[0].strip() == "---":
            frontmatter = []
            for line in lines[1:]:
                if line.strip() == "---":
                    break
                frontmatter.append(line)

            fm_data = yaml.safe_load("".join(frontmatter)) or {}

            for key in FRONTMATTER_KEYS:
                value = fm_data.get(key, None)

                if key == "date":
                    result[key] = str(value).strip().replace("T", " ") if value else ""
                elif key == "categories":
                    if isinstance(value, str):
                        result[key] = [item.strip() for item in value.split(",")]
                    elif isinstance(value, list):
                        result[key] = value
                    else:
                        result[key] = []
                elif key == "uploadto":
                    if isinstance(value, str):
                        result[key] = [item.strip().lower() for item in value.split(",")]
                    elif isinstance(value, list):
                        result[key] = [str(v).strip().lower() for v in value]
                    else:
                        result[key] = []
                else:
                    result[key] = str(value).strip() if value else ""

            return result
    except Exception:
        # Keep this helper silent on parse errors; callers can log if needed
        pass

    return result


def get_markdown_files(directory: Path) -> List[Path]:
    """Return list of all markdown files under directory (sorted)."""
    return sorted([f for f in directory.rglob("*.md")])


def write_json_file(path: Path, data: Any) -> None:
    """Write JSON to path, creating parent dirs if needed."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
