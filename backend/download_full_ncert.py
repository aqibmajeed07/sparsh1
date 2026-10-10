import os
import urllib.request
import zipfile
import shutil

BOOKS_DIR = os.path.join(os.path.dirname(__file__), "books")
ZIP_PATH = os.path.join(os.path.dirname(__file__), "books_repo.zip")

URLS = [
    "https://github.com/manisoni28/books/archive/refs/heads/main.zip",
    "https://github.com/manisoni28/books/archive/refs/heads/master.zip"
]

def download_and_extract():
    print("[NCERT Sync] Downloading full NCERT books repository from GitHub...")
    downloaded = False
    for url in URLS:
        try:
            print(f"[NCERT Sync] Trying {url}...")
            urllib.request.urlretrieve(url, ZIP_PATH)
            if os.path.exists(ZIP_PATH) and os.path.getsize(ZIP_PATH) > 1000:
                print(f"[NCERT Sync] Downloaded ZIP successfully ({os.path.getsize(ZIP_PATH)} bytes).")
                downloaded = True
                break
        except Exception as e:
            print(f"[NCERT Sync] Download error for {url}: {e}")

    if not downloaded:
        print("[NCERT Sync] Direct ZIP download failed or repo uses Git LFS/git clone.")
        return False

    print("[NCERT Sync] Extracting repository to backend/books...")
    with zipfile.ZipFile(ZIP_PATH, 'r') as zip_ref:
        zip_ref.extractall(os.path.dirname(__file__))

    # Move extracted contents into BOOKS_DIR
    extracted_folder = None
    for item in os.listdir(os.path.dirname(__file__)):
        if item.startswith("books-") and os.path.isdir(os.path.join(os.path.dirname(__file__), item)):
            extracted_folder = os.path.join(os.path.dirname(__file__), item)
            break

    if extracted_folder:
        if os.path.exists(BOOKS_DIR):
            shutil.rmtree(BOOKS_DIR)
        shutil.move(extracted_folder, BOOKS_DIR)
        print("[NCERT Sync] Successfully extracted and moved full NCERT repo into backend/books!")

    if os.path.exists(ZIP_PATH):
        os.remove(ZIP_PATH)

    return True

if __name__ == "__main__":
    download_and_extract()
