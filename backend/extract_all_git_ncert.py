import subprocess
import os
import shutil

BACKEND_DIR = os.path.dirname(__file__)
REPO_DIR = os.path.join(BACKEND_DIR, "books_repo")
TARGET_BOOKS_DIR = os.path.join(BACKEND_DIR, "books")

def sanitize_filename(filename):
    # Replace Windows invalid filename characters: ? : * " < > | \
    for char in ['?', ':', '*', '"', '<', '>', '|']:
        filename = filename.replace(char, '_')
    return filename

def extract_git_files():
    print("[NCERT Git Extractor] Listing all files from git repository index...")
    try:
        res = subprocess.run(
            ["git", "ls-tree", "-r", "--name-only", "HEAD"],
            cwd=REPO_DIR,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='ignore'
        )
        all_files = res.stdout.splitlines()
        print(f"[NCERT Git Extractor] Found {len(all_files)} total files in git index.")

        pdf_files = [f for f in all_files if f.lower().endswith(".pdf")]
        print(f"[NCERT Git Extractor] Found {len(pdf_files)} PDF books.")

        extracted = 0
        for rel_path in pdf_files:
            clean_rel = sanitize_filename(rel_path)
            # Determine Class
            parts = clean_rel.split('/')
            
            # Simple heuristic for class & subject
            cls_name = "Class 10"
            subj_name = "General Studies"
            
            for part in parts:
                p_lower = part.lower()
                if "class" in p_lower or "cl" in p_lower or "std" in p_lower:
                    import re
                    m = re.search(r'\d{1,2}', p_lower)
                    if m and 1 <= int(m.group(0)) <= 12:
                        cls_name = f"Class {int(m.group(0))}"
                
                if "math" in p_lower: subj_name = "Mathematics"
                elif "phy" in p_lower: subj_name = "Physics"
                elif "chem" in p_lower: subj_name = "Chemistry"
                elif "bio" in p_lower: subj_name = "Biology"
                elif "sci" in p_lower: subj_name = "Science"
                elif "eng" in p_lower: subj_name = "English"
                elif "hin" in p_lower: subj_name = "Hindi"
                elif "soc" in p_lower or "sst" in p_lower: subj_name = "Social Science"
                elif "geo" in p_lower: subj_name = "Geography"
                elif "his" in p_lower: subj_name = "History"
                elif "eco" in p_lower: subj_name = "Economics"

            filename = os.path.basename(clean_rel)
            dest_dir = os.path.join(TARGET_BOOKS_DIR, cls_name, subj_name, f"{subj_name} NCERT Textbook")
            os.makedirs(dest_dir, exist_ok=True)
            dest_path = os.path.join(dest_dir, filename)

            if not os.path.exists(dest_path):
                # Extract blob using git show
                blob_content = subprocess.run(
                    ["git", "show", f"HEAD:{rel_path}"],
                    cwd=REPO_DIR,
                    capture_output=True
                ).stdout
                if blob_content:
                    with open(dest_path, "wb") as f:
                        f.write(blob_content)
                    extracted += 1

        print(f"[NCERT Git Extractor] Successfully extracted {extracted} NCERT PDF books into {TARGET_BOOKS_DIR}.")

    except Exception as e:
        print(f"[NCERT Git Extractor] Error: {e}")

if __name__ == "__main__":
    extract_git_files()
