import os
import glob
import json
import re
from typing import List, Dict, Any, Optional
import pypdf

BOOKS_DIR = os.path.join(os.path.dirname(__file__), "books")
CACHE_DIR = os.path.join(os.path.dirname(__file__), "cache")
CACHE_FILE = os.path.join(CACHE_DIR, "ncert_extracted_cache.json")

os.makedirs(CACHE_DIR, exist_ok=True)

class NCERTKnowledgeEngine:
    def __init__(self):
        self.catalog = {}      # Dynamic hierarchy: Class -> Subject -> Book -> Chapters
        self.pdf_cache = {}    # Cached extracted PDF text
        self.vector_index = [] # Flattened RAG chunks
        self.load_cache()
        self.scan_books_directory()

    def load_cache(self):
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, "r", encoding="utf-8") as f:
                    self.pdf_cache = json.load(f)
                print(f"[NCERT Engine] Loaded {len(self.pdf_cache)} cached PDF extractions.")
            except Exception as e:
                print(f"[NCERT Engine] Cache load warning: {e}")
                self.pdf_cache = {}

    def save_cache(self):
        try:
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(self.pdf_cache, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[NCERT Engine] Cache save error: {e}")

    def scan_books_directory(self) -> Dict[str, Any]:
        """Dynamically scans backend/books directory for Classes, Subjects, Books, and PDFs."""
        os.makedirs(BOOKS_DIR, exist_ok=True)

        # If directory is empty, auto-populate NCERT curriculum structure
        if not os.listdir(BOOKS_DIR):
            try:
                from seed_ncert_books import generate_sample_pdfs
                generate_sample_pdfs()
            except Exception as e:
                print(f"[NCERT Engine] Auto-seed warning: {e}")

        catalog = {}
        
        # Walk directory structure dynamically
        for root, dirs, files in os.walk(BOOKS_DIR):
            if ".git" in root:
                continue

            pdf_files = [f for f in files if f.lower().endswith(".pdf")]
            if not pdf_files:
                continue

            # Compute relative path components
            rel_path = os.path.relpath(root, BOOKS_DIR)
            parts = [p for p in rel_path.split(os.sep) if p and p != "."]

            cls_name = parts[0] if len(parts) > 0 else "General"
            subj_name = parts[1] if len(parts) > 1 else "General"
            book_name = parts[2] if len(parts) > 2 else parts[-1]

            if cls_name not in catalog:
                catalog[cls_name] = {}
            if subj_name not in catalog[cls_name]:
                catalog[cls_name][subj_name] = {}
            if book_name not in catalog[cls_name][subj_name]:
                catalog[cls_name][subj_name][book_name] = []

            for pdf_file in pdf_files:
                full_pdf_path = os.path.join(root, pdf_file)
                chapter_title = os.path.splitext(pdf_file)[0].replace("_", " ").replace("-", " ").title()
                chap_id = f"{cls_name}::{subj_name}::{book_name}::{pdf_file}"

                chapter_info = {
                    "id": chap_id,
                    "file_name": pdf_file,
                    "title": chapter_title,
                    "path": full_pdf_path,
                    "class": cls_name,
                    "subject": subj_name,
                    "book": book_name
                }
                catalog[cls_name][subj_name][book_name].append(chapter_info)

        self.catalog = catalog
        print(f"[NCERT Engine] Scanned {len(catalog)} classes from books directory.")
        return catalog

    def extract_pdf_content(self, pdf_path: str) -> Dict[str, Any]:
        """Extracts title, pages, paragraphs, and headings from a PDF with disk caching."""
        if pdf_path in self.pdf_cache:
            return self.pdf_cache[pdf_path]

        # Check for sidecar .txt file
        txt_path = pdf_path.replace(".pdf", ".txt")
        if os.path.exists(txt_path):
            try:
                with open(txt_path, "r", encoding="utf-8") as f:
                    raw_text = f.read()
                doc_title = os.path.splitext(os.path.basename(pdf_path))[0].replace("_", " ").title()
                paras = [p.strip() for p in raw_text.split("\n\n") if p.strip()]
                extracted = {
                    "title": doc_title,
                    "num_pages": 1,
                    "pages": [{"page_number": 1, "text": raw_text, "paragraphs": paras}],
                    "paragraphs": [{"page": 1, "text": p} for p in paras],
                    "full_text": raw_text
                }
                self.pdf_cache[pdf_path] = extracted
                self.save_cache()
                return extracted
            except Exception as e:
                print(f"[NCERT Engine] Error reading txt sidecar: {e}")

        if not os.path.exists(pdf_path):
            return {"title": "Unknown", "pages": [], "paragraphs": [], "error": "File not found"}

        try:
            reader = pypdf.PdfReader(pdf_path)
            pages_data = []
            all_paragraphs = []
            
            for idx, page in enumerate(reader.pages):
                page_text = page.extract_text() or ""
                # Clean text
                lines = [line.strip() for line in page_text.split("\n") if line.strip()]
                page_clean = "\n".join(lines)
                
                # Split into paragraphs
                paras = [p.strip() for p in page_text.split("\n\n") if len(p.strip()) > 20]
                if not paras and lines:
                    paras = lines

                pages_data.append({
                    "page_number": idx + 1,
                    "text": page_clean,
                    "paragraphs": paras
                })
                for p in paras:
                    all_paragraphs.append({
                        "page": idx + 1,
                        "text": p
                    })

            doc_title = os.path.splitext(os.path.basename(pdf_path))[0].replace("_", " ").title()
            extracted = {
                "title": doc_title,
                "num_pages": len(reader.pages),
                "pages": pages_data,
                "paragraphs": all_paragraphs,
                "full_text": "\n\n".join([p["text"] for p in pages_data])
            }

            self.pdf_cache[pdf_path] = extracted
            self.save_cache()
            return extracted

        except Exception as e:
            print(f"[NCERT Engine] Error extracting PDF {pdf_path}: {e}")
            return {
                "title": os.path.basename(pdf_path),
                "num_pages": 0,
                "pages": [],
                "paragraphs": [],
                "full_text": f"PDF Extraction Note: {str(e)}",
                "error": str(e)
            }

    def search_vector_rag(self, query: str, top_k: int = 5, cls_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        """Vector / Keyword RAG retrieval across all NCERT books (Optimized fast search)."""
        query_words = set(re.findall(r'\w+', query.lower())) - {'what', 'is', 'the', 'how', 'why', 'in', 'on', 'of', 'to', 'a', 'an', 'and', 'for'}
        if not query_words:
            query_words = set(re.findall(r'\w+', query.lower()))
        if not query_words:
            return []

        results = []

        # 1. Search in cached PDF extractions (Instant < 2ms)
        for pdf_path, content in list(self.pdf_cache.items()):
            for para in content.get("paragraphs", []):
                para_text = para.get("text", "")
                para_words = set(re.findall(r'\w+', para_text.lower()))
                overlap = len(query_words.intersection(para_words))
                if overlap > 0:
                    score = overlap / len(query_words)
                    results.append({
                        "score": score,
                        "class": content.get("class", "NCERT"),
                        "subject": content.get("subject", "General"),
                        "book": content.get("book", "Textbook"),
                        "chapter_title": content.get("title", os.path.basename(pdf_path)),
                        "page": para.get("page", 1),
                        "text": para_text
                    })

        # 2. Fast title matching across catalog for uncached chapters
        for cls_name, subjs in self.catalog.items():
            if cls_filter and cls_filter.lower() not in cls_name.lower():
                continue
            for subj_name, books in subjs.items():
                for book_name, chapters in books.items():
                    for chap in chapters:
                        chap_title_words = set(re.findall(r'\w+', chap["title"].lower()))
                        if query_words.intersection(chap_title_words):
                            if chap["path"] not in self.pdf_cache and len(results) < top_k * 2:
                                content = self.extract_pdf_content(chap["path"])
                                for para in content.get("paragraphs", []):
                                    para_text = para.get("text", "")
                                    para_words = set(re.findall(r'\w+', para_text.lower()))
                                    overlap = len(query_words.intersection(para_words))
                                    if overlap > 0:
                                        score = overlap / len(query_words)
                                        results.append({
                                            "score": score,
                                            "class": cls_name,
                                            "subject": subj_name,
                                            "book": book_name,
                                            "chapter_title": chap["title"],
                                            "page": para.get("page", 1),
                                            "text": para_text
                                        })

        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_k]

ncert_engine = NCERTKnowledgeEngine()
