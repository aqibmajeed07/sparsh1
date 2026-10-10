import os
import shutil
import re

BACKEND_DIR = os.path.dirname(__file__)
TARGET_BOOKS_DIR = os.path.join(BACKEND_DIR, "books")

# Regex to detect Class 1 to 12 in path or filename
CLASS_REGEX = re.compile(r'(?:class|cl|std|grade)[\s_\\/-]*(\d{1,2})', re.IGNORECASE)

# Common NCERT Subject Mappings
SUBJECT_MAP = {
    'phy': 'Physics', 'physics': 'Physics',
    'chem': 'Chemistry', 'chemistry': 'Chemistry',
    'bio': 'Biology', 'biology': 'Biology',
    'math': 'Mathematics', 'maths': 'Mathematics', 'mathematics': 'Mathematics',
    'sci': 'Science', 'science': 'Science',
    'hist': 'History', 'history': 'History',
    'geo': 'Geography', 'geography': 'Geography',
    'civ': 'Civics', 'civics': 'Civics', 'pol': 'Political Science', 'political': 'Political Science',
    'eco': 'Economics', 'economics': 'Economics',
    'eng': 'English', 'english': 'English',
    'hin': 'Hindi', 'hindi': 'Hindi',
    'san': 'Sanskrit', 'sanskrit': 'Sanskrit',
    'soc': 'Social Science', 'social': 'Social Science', 'sst': 'Social Science',
    'evs': 'Environmental Studies', 'env': 'Environmental Studies'
}

def detect_subject(path_str):
    lower_path = path_str.lower()
    for key, val in SUBJECT_MAP.items():
        if key in lower_path:
            return val
    return "General Studies"

def organize_ncert_repo():
    print("[NCERT Organizer] Scanning repository for all NCERT PDFs...")
    search_dirs = [
        os.path.join(BACKEND_DIR, "books_repo"),
        os.path.join(BACKEND_DIR, "books_gh")
    ]

    copied_count = 0
    os.makedirs(TARGET_BOOKS_DIR, exist_ok=True)

    for search_dir in search_dirs:
        if not os.path.exists(search_dir):
            continue

        for root, dirs, files in os.walk(search_dir):
            if ".git" in root:
                continue

            for file in files:
                if not file.lower().endswith(".pdf"):
                    continue

                full_src = os.path.join(root, file)
                rel_path = os.path.relpath(full_src, search_dir)
                combined_path = f"{rel_path}_{file}"

                # Match Class
                match = CLASS_REGEX.search(combined_path)
                if match:
                    class_num = int(match.group(1))
                    if 1 <= class_num <= 12:
                        cls_name = f"Class {class_num}"
                    else:
                        cls_name = "Class 10"
                else:
                    cls_name = "General"

                # Match Subject
                subj_name = detect_subject(combined_path)
                book_name = f"{subj_name} NCERT Textbook"

                # Target directory
                dest_dir = os.path.join(TARGET_BOOKS_DIR, cls_name, subj_name, book_name)
                os.makedirs(dest_dir, exist_ok=True)

                # Clean filename
                clean_name = os.path.splitext(file)[0].replace("_", " ").replace("-", " ").title()
                dest_file = os.path.join(dest_dir, f"{clean_name}.pdf")

                if not os.path.exists(dest_file):
                    shutil.copy2(full_src, dest_file)
                    copied_count += 1

    print(f"[NCERT Organizer] Organized {copied_count} NCERT PDF chapters into {TARGET_BOOKS_DIR}.")

if __name__ == "__main__":
    organize_ncert_repo()
