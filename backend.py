from fastapi import FastAPI, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate
from langchain_groq import Groq  # ✅ Use the correct import!

from fpdf import FPDF
import io
import zipfile
import asyncio

app = FastAPI()

# ✅ Allow CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_methods=["*"],
    allow_headers=["*"],
)

# === CONFIG ===
GROQ_API_KEY = "YOUR_GROQ_API_KEY"  # Replace with your actual key!
GROQ_MODEL = "llama3-70b-8192"

# === INIT ===
groq_llm = Groq(
    api_key=GROQ_API_KEY,
    model=GROQ_MODEL
)

# === PROMPT TEMPLATE ===
template = PromptTemplate(
    input_variables=["text"],
    template=(
        "Generate a Detailed Explanation, Important Questions, "
        "and a Last-Minute Recap from this study text:\n\n{text}\n\n"
    )
)

# === LLM CHAIN ===
chain = LLMChain(
    llm=groq_llm,
    prompt=template
)

# === FILE UPLOAD ENDPOINT ===
@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    async def event_generator():
        try:
            yield '{"status": "Reading file", "percentage": 10}\n'
            await asyncio.sleep(0.5)
            
            text = extract_text(file)
            yield '{"status": "Generating summaries", "percentage": 40}\n'
            await asyncio.sleep(0.5)

            output = chain.run({"text": text})

            # Demo: fake split for sections
            detailed = output[:200] + "\n(Detailed Explanation...)"
            questions = output[200:400] + "\n(Important Questions...)"
            recap = output[400:600] + "\n(Last-Minute Recap...)"

            yield '{"status": "Creating PDFs", "percentage": 75}\n'
            await asyncio.sleep(0.5)

            pdfs = []
            pdfs.append(create_pdf(detailed, "Detailed Explanation"))
            pdfs.append(create_pdf(questions, "Important Questions"))
            pdfs.append(create_pdf(recap, "Last-Minute Recap"))

            zip_bytes = create_zip(pdfs)

            with open("study_summaries.zip", "wb") as f:
                f.write(zip_bytes.getvalue())

            yield '{"status": "Done", "percentage": 100}\n'
        except Exception as e:
            yield f'{{"status": "error", "message": "{str(e)}"}}\n'

    return StreamingResponse(event_generator(), media_type="text/event-stream")

# === HELPERS ===

def extract_text(file: UploadFile):
    text = file.file.read()
    return text.decode("utf-8", errors="ignore")

def create_pdf(content: str, title: str):
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)
    pdf.multi_cell(0, 10, txt=content)
    output = io.BytesIO()
    pdf.output(output)
    output.seek(0)
    return (f"{title}.pdf", output.read())

def create_zip(pdfs):
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zf:
        for filename, data in pdfs:
            zf.writestr(filename, data)
    zip_buffer.seek(0)
    return zip_buffer

# === MAIN ===
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
