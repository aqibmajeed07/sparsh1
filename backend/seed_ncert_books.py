import os
import pypdf

BASE_DIR = os.path.join(os.path.dirname(__file__), "books")

NCERT_STRUCTURE = {
    "Class 10": {
        "Science": {
            "Science Textbook": [
                ("Chapter 1 Chemical Reactions and Equations", "Chemical reactions involve breaking and forming of bonds between atoms to produce new substances. Combination, Decomposition, Displacement, and Double Displacement are major types of chemical reactions."),
                ("Chapter 2 Acids Bases and Salts", "Acids taste sour and turn blue litmus red. Bases taste bitter and turn red litmus blue. The pH scale measures hydrogen ion concentration from 0 (acidic) to 14 (basic)."),
                ("Chapter 6 Life Processes", "Life processes include nutrition, respiration, transportation, and excretion. Chlorophyll in plants absorbs solar energy for photosynthesis. Human heart pumps oxygenated blood."),
                ("Chapter 10 Light Reflection and Refraction", "Light travels in straight lines. Reflection follows laws of reflection. Refraction occurs when light enters a medium with a different optical density, governed by Snell's Law."),
            ]
        },
        "Mathematics": {
            "Maths Textbook": [
                ("Chapter 1 Real Numbers", "Euclid's Division Lemma states that for positive integers a and b, there exist unique integers q and r such that a = bq + r, 0 <= r < b. Fundamental Theorem of Arithmetic."),
                ("Chapter 2 Polynomials", "A polynomial of degree n has at most n real zeroes. Sum of zeroes alpha + beta = -b/a, product of zeroes alpha * beta = c/a for quadratic polynomials.")
            ]
        }
    },
    "Class 9": {
        "Science": {
            "Science Textbook": [
                ("Chapter 1 Matter in Our Surroundings", "Matter is anything that has mass and occupies space. Three physical states are solid, liquid, and gas. Evaporation causes cooling."),
                ("Chapter 8 Motion", "Distance is scalar while displacement is vector. Velocity is speed with direction. Acceleration is rate of change of velocity per unit time.")
            ]
        }
    },
    "Class 8": {
        "Science": {
            "Science Textbook": [
                ("Chapter 1 Crop Production and Management", "Preparation of soil, sowing seeds, applying manure and fertilizers, irrigation, weeding, harvesting, and storage are key agricultural practices."),
                ("Chapter 2 Microorganisms Friend and Foe", "Microorganisms include bacteria, fungi, protozoa, and algae. Penicillin is an antibiotic discovered by Alexander Fleming.")
            ]
        }
    },
    "Class 7": {
        "Science": {
            "Science Textbook": [
                ("Chapter 1 Nutrition in Plants", "Autotrophic nutrition is performed by plants using photosynthesis. Heterotrophic nutrition is found in saprotrophs, parasites, and insectivorous plants.")
            ]
        }
    },
    "Class 6": {
        "Science": {
            "Science Textbook": [
                ("Chapter 1 Components of Food", "Carbohydrates, proteins, fats, vitamins, and minerals are essential nutrients required for healthy growth and body function.")
            ]
        }
    }
}

def generate_sample_pdfs():
    os.makedirs(BASE_DIR, exist_ok=True)
    count = 0
    for cls_name, subjs in NCERT_STRUCTURE.items():
        for subj_name, bks in subjs.items():
            for bk_name, chaps in bks.items():
                target_dir = os.path.join(BASE_DIR, cls_name, subj_name, bk_name)
                os.makedirs(target_dir, exist_ok=True)
                for chap_title, chap_text in chaps:
                    file_path = os.path.join(target_dir, f"{chap_title}.pdf")
                    if not os.path.exists(file_path):
                        # Create PDF using pypdf / reportlab or simple text writer
                        writer = pypdf.PdfWriter()
                        page = writer.add_blank_page(width=595, height=842)
                        
                        # Store metadata in PDF or write readable pages
                        writer.add_metadata({
                            "/Title": chap_title,
                            "/Subject": subj_name,
                            "/Author": "NCERT SPARSH Engine"
                        })
                        with open(file_path, "wb") as f:
                            writer.write(f)
                        
                        # Write corresponding text sidecar cache for instant loading
                        txt_path = file_path.replace(".pdf", ".txt")
                        with open(txt_path, "w", encoding="utf-8") as f:
                            f.write(f"{chap_title}\n\n{chap_text}\n\nSummary:\nThis section covers key principles of {chap_title} for {cls_name} {subj_name}.")
                        count += 1
    print(f"[NCERT Seeder] Generated {count} structured NCERT books in backend/books.")

if __name__ == "__main__":
    generate_sample_pdfs()
